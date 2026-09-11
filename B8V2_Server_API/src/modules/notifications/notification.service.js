const nodemailer=require('nodemailer');
const {execProc}=require('../../utils/proc');
const {getPool}=require('../../config/db');
const env=require('../../config/env');
const master=require('../master/master.repository');

const typeMeta={PROCESS_VERSION:{label:'Quy trình',path:id=>`/process-versions/${id}`},PRODUCT_DOCUMENT_VERSION:{label:'Tài liệu sản phẩm',path:id=>`/products?documentVersionId=${id}`}};
const shortError=error=>String(error?.message||error||'Không thể gửi email.').slice(0,2000);
const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

function configured(){ return Boolean(env.mail.host&&env.mail.user&&env.mail.password&&env.mail.from&&env.mail.appPublicUrl); }
function buildUrl(type,id){ return `${env.mail.appPublicUrl}${typeMeta[type].path(id)}`; }
function summary(){ return {sent:0,failed:0,skipped:0,errors:[]}; }
function versionFields(type,version){
  const name=version.ProcessName||version.DocumentName||version.Title||version.ProcessCode||'Tài liệu';
  return { name,versionCode:version.VersionCode||'',effectiveDate:version.EffectiveDate?new Date(version.EffectiveDate).toLocaleDateString('vi-VN'):null,changeSummary:version.ChangeSummary||null };
}
async function isCorrection(type,version){
  const table=type==='PROCESS_VERSION'?'[B8V2].[ProcessVersion]':'[B8V2].[ProductDocumentVersion]';
  const parentColumn=type==='PROCESS_VERSION'?'ProcessId':'DocumentId';
  const parentId=version[parentColumn];
  if(!parentId||!version.VersionCode) return false;
  const pool=await getPool();
  const result=await pool.request()
    .input('id',Number(version.Id))
    .input('parentId',Number(parentId))
    .input('versionCode',String(version.VersionCode))
    .query(`SELECT CAST(CASE WHEN EXISTS(SELECT 1 FROM ${table} WHERE ${parentColumn}=@parentId AND Id<>@id AND VersionCode=@versionCode AND DeletedAt IS NOT NULL) THEN 1 ELSE 0 END AS BIT) AS IsCorrection`);
  return Boolean(result.recordset?.[0]?.IsCorrection);
}
async function getVersion(type,id){
  const proc=type==='PROCESS_VERSION'?'B8V2.sp_ProcessVersion_GetDetail':'B8V2.sp_ProductDocumentVersion_GetDetail';
  const key=type==='PROCESS_VERSION'?'ProcessVersionId':'DocumentVersionId';
  const result=await execProc(proc,{[key]:{type:'int',value:id},IncludeDeleted:{type:'bit',value:false}});
  const version=result.recordsets?.[0]?.[0]||null;
  if(version) version.IsCorrection=await isCorrection(type,version);
  return {version,audiences:result.recordsets?.[1]||[]};
}
function mailBody({type,version,id}){
  const fields=versionFields(type,version); const targetUrl=buildUrl(type,id);
  const correctionPrefix=version.IsCorrection?'ĐÍNH CHÍNH - ':'';
  const subject=`[B8V2] ${correctionPrefix}${typeMeta[type].label} ${fields.name}${fields.versionCode?` - phiên bản ${fields.versionCode}`:''} đã có hiệu lực`;
  const correctionNotice=version.IsCorrection?'<p><strong>Đây là bản đính chính/thay thế cho phiên bản cùng mã đã bị thu hồi do file không chính xác.</strong></p>':'';
  const html=`${correctionNotice}<p>${escapeHtml(typeMeta[type].label)} <strong>${escapeHtml(fields.name)}</strong>${fields.versionCode?` - phiên bản <strong>${escapeHtml(fields.versionCode)}</strong>`:''} đã có hiệu lực.</p>${fields.effectiveDate?`<p>Ngày hiệu lực: ${escapeHtml(fields.effectiveDate)}</p>`:''}${fields.changeSummary?`<p>Nội dung thay đổi: ${escapeHtml(fields.changeSummary)}</p>`:''}<p><a href="${escapeHtml(targetUrl)}">Mở trong B8V2</a></p>`;
  return {subject,html,targetUrl};
}
async function deliveryCreate(values){
  const integerFields=new Set(['EntityVersionId','DepartmentId','UserId','RequestedBy']);
  return (await execProc('B8V2.sp_MailDelivery_Create',Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{type:key==='RetryOfDeliveryId'?'bigint':integerFields.has(key)?'int':'nvarchar',value}])))).recordset?.[0];
}
async function complete(id,status,errorMessage=null){ await execProc('B8V2.sp_MailDelivery_Complete',{DeliveryId:{type:'bigint',value:id},Status:{type:'varchar',value:status},ErrorMessage:{type:'nvarchar',value:errorMessage}}); }
async function wasNotified(type,versionId,departmentId){ const result=await execProc('B8V2.sp_MailDelivery_HasNotification',{EntityType:{type:'varchar',value:type},EntityVersionId:{type:'int',value:versionId},DepartmentId:{type:'int',value:departmentId}}); return Boolean(result.recordset?.[0]?.HasNotification); }

async function sendDepartmentNotification({type,versionId,departmentId,requestedBy,ignoreExisting=false}){
  const result=summary();
  if(!ignoreExisting&&await wasNotified(type,versionId,departmentId)){ result.skipped++; return result; }
  const context=await getVersion(type,versionId); if(!context.version) throw new Error('Không tìm thấy phiên bản cần thông báo.');
  const content=mailBody({type,version:context.version,id:versionId});
  const configuredRows=await execProc('B8V2.sp_DepartmentMailRecipient_Get',{DepartmentId:{type:'int',value:departmentId}});
  const configuredUserIds=(configuredRows.recordset||[]).map(row=>row.UserId);
  const users=configuredUserIds.length?await master.getEligibleMailUsers(departmentId,configuredUserIds):[];
  if(!users.length){
    const delivery=await deliveryCreate({EntityType:type,EntityVersionId:versionId,DepartmentId:departmentId,UserId:null,RecipientEmail:null,Subject:content.subject,TargetUrl:content.targetUrl,RequestedBy:requestedBy});
    await complete(delivery.Id,'SKIPPED_NO_RECIPIENT','Chưa cấu hình người nhận hợp lệ cho bộ phận hoặc người nhận không còn hoạt động/có email.'); result.skipped++; return result;
  }
  for(const user of users){
    const delivery=await deliveryCreate({EntityType:type,EntityVersionId:versionId,DepartmentId:departmentId,UserId:user.UserId,RecipientEmail:user.Email,Subject:content.subject,TargetUrl:content.targetUrl,RequestedBy:requestedBy});
    if(!configured()) { const error='SMTP chưa được cấu hình đầy đủ.'; await complete(delivery.Id,'FAILED',error); result.failed++; result.errors.push({userId:user.UserId,email:user.Email,error}); continue; }
    try { await nodemailer.createTransport({host:env.mail.host,port:env.mail.port,secure:env.mail.secure,auth:{user:env.mail.user,pass:env.mail.password}}).sendMail({from:env.mail.from,to:user.Email,subject:content.subject,html:content.html}); await complete(delivery.Id,'SENT'); result.sent++; }
    catch(error){ const message=shortError(error); await complete(delivery.Id,'FAILED',message); result.failed++; result.errors.push({userId:user.UserId,email:user.Email,error:message}); }
  }
  return result;
}
async function notifyVersion({type,versionId,requestedBy,departmentIds=null}){
  const context=await getVersion(type,versionId); const result=summary();
  if(!context.version||context.version.Status!=='EFFECTIVE') return result;
  const ids=departmentIds||[...new Set(context.audiences.filter(row=>row.IsActive!==false).map(row=>Number(row.DepartmentId)).filter(Number.isSafeInteger))];
  for(const departmentId of ids){ const item=await sendDepartmentNotification({type,versionId,departmentId,requestedBy}); result.sent+=item.sent;result.failed+=item.failed;result.skipped+=item.skipped;result.errors.push(...item.errors); }
  return result;
}
async function resendDelivery(deliveryId,requestedBy){
  const source=(await execProc('B8V2.sp_MailDelivery_Get',{DeliveryId:{type:'bigint',value:deliveryId}})).recordset?.[0];
  if(!source||source.Status!=='FAILED') { const error=new Error('Chỉ có thể gửi lại mail thất bại.'); error.status=400; throw error; }
  const delivery=await deliveryCreate({EntityType:source.EntityType,EntityVersionId:source.EntityVersionId,DepartmentId:source.DepartmentId,UserId:source.UserId,RecipientEmail:source.RecipientEmail,Subject:source.Subject,TargetUrl:source.TargetUrl,RequestedBy:requestedBy,RetryOfDeliveryId:source.Id});
  if(!configured()){ const error='SMTP chưa được cấu hình đầy đủ.'; await complete(delivery.Id,'FAILED',error); return {sent:0,failed:1,skipped:0,errors:[{email:source.RecipientEmail,error}]}; }
  try { await nodemailer.createTransport({host:env.mail.host,port:env.mail.port,secure:env.mail.secure,auth:{user:env.mail.user,pass:env.mail.password}}).sendMail({from:env.mail.from,to:source.RecipientEmail,subject:source.Subject,html:`<p><a href="${escapeHtml(source.TargetUrl)}">Mở trong B8V2</a></p>`}); await complete(delivery.Id,'SENT'); return {sent:1,failed:0,skipped:0,errors:[]}; }
  catch(error){ const message=shortError(error); await complete(delivery.Id,'FAILED',message); return {sent:0,failed:1,skipped:0,errors:[{email:source.RecipientEmail,error:message}]}; }
}
module.exports={getVersion,notifyVersion,sendDepartmentNotification,resendDelivery};
