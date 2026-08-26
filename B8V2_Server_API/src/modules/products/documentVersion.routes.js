const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {canViewProductDocumentVersion}=require('../auth/authorization.service');
const {positiveId}=require('../../utils/validation');
const {assertProductDocumentVersionActive,assertProductDocumentVersionParentActive}=require('../../utils/entityState');
const {isProductDocumentVersionAssignedToDepartment}=require('../auth/authorization.service');
const trainingEvidenceUpload=require('../../middleware/trainingEvidenceUpload');
const training=require('./productTraining.service');

router.use(authRequired);

const requireAssignedDepartment=async(req,res,next)=>{
  try {
    const versionId=Number(req.params.id);
    if(!Number.isSafeInteger(versionId)||versionId<1) return res.status(400).json({success:false,message:'DocumentVersionId không hợp lệ.'});
    if(!await isProductDocumentVersionAssignedToDepartment(req.user,versionId,true)) return res.status(403).json({success:false,message:'Tài liệu không được phân phối cho bộ phận của bạn.'});
    next();
  } catch(error) { next(error); }
};

router.get('/:id',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const includeDeleted=(req.user.roles||[]).includes('ADMIN') || (req.user.permissions||[]).some(code=>['PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'].includes(code));
  if(!includeDeleted && !await canViewProductDocumentVersion(req.user,req.params.id)) return res.status(403).json({success:false,message:'Bạn không được phân phối phiên bản này.'});
  const r=await execProc('B8V2.sp_ProductDocumentVersion_GetDetail',{
    DocumentVersionId:{type:'int',value:positiveId(req.params.id,'DocumentVersionId')},IncludeDeleted:{type:'bit',value:includeDeleted}
  });
  res.json({success:true,data:{version:r.recordsets[0]?.[0]||null,audiences:r.recordsets[1]||[],files:r.recordsets[2]||[],itemCodes:r.recordsets[3]||[]}});
}));
router.put('/:id',requirePermissions('PRODUCT_DOCUMENT_VERSION_EDIT'),asyncHandler(async(req,res)=>{
  const b=req.body; const versionId=await assertProductDocumentVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProductDocumentVersion_Update',{
    DocumentVersionId:{type:'int',value:versionId},VersionCode:{type:'nvarchar',value:b.versionCode},
    IssueDate:{type:'date',value:b.issueDate||null},EffectiveDate:{type:'date',value:b.effectiveDate},ExpiryDate:{type:'date',value:b.expiryDate||null},
    ChangeSummary:{type:'nvarchar',value:b.changeSummary||null},UpdatedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset?.[0]});
}));
router.get('/:id/training-confirmation',requirePermissions('DOCUMENT_ASSIGNED_VIEW'),requireAssignedDepartment,asyncHandler(async(req,res)=>{
  const data=await training.getDepartmentTraining(Number(req.params.id),req.user.departmentId);
  res.json({success:true,data});
}));
router.get('/:id/department-progress',requirePermissions('DOCUMENT_VIEW_ALL'),asyncHandler(async(req,res)=>{
  const data=await training.getDepartmentProgress(Number(req.params.id));
  res.json({success:true,data});
}));
router.post('/:id/training-confirmations',requirePermissions('DOCUMENT_TRAINING_CONFIRM'),requireAssignedDepartment,trainingEvidenceUpload.array('files',10),asyncHandler(async(req,res)=>{
  const data=await training.confirmTraining({documentVersionId:Number(req.params.id),user:req.user,files:req.files,comment:req.body.comment});
  res.status(201).json({success:true,data});
}));
router.delete('/:id',requirePermissions('PRODUCT_DOCUMENT_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProductDocumentVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProductDocumentVersion_SoftDelete',{
    DocumentVersionId:{type:'int',value:versionId},DeletedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset?.[0]});
}));
router.post('/:id/restore',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const versionId=await assertProductDocumentVersionParentActive(req.params.id);
  const r=await execProc('B8V2.sp_ProductDocumentVersion_Restore',{
    DocumentVersionId:{type:'int',value:versionId},RestoredBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset?.[0]});
}));
router.post('/:id/submit',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  await assertProductDocumentVersionActive(req.params.id);
  res.status(405).json({success:false,message:'Phiên bản tài liệu sản phẩm tự có hiệu lực khi gắn PDF hoặc SIGNED.'});
}));
router.post('/:id/review',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  await assertProductDocumentVersionActive(req.params.id);
  res.status(405).json({success:false,message:'Luồng hiện tại không có bước duyệt riêng; PDF/SIGNED hợp lệ sẽ phát hành ngay.'});
}));
router.post('/:id/publish',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  await assertProductDocumentVersionActive(req.params.id);
  res.status(405).json({success:false,message:'Không phát hành thủ công; hãy gắn file PDF hoặc SIGNED.'});
}));
router.post('/:id/audiences',requirePermissions('DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body; const versionId=await assertProductDocumentVersionActive(req.params.id); const r=await execProc('B8V2.sp_ProductDocumentVersion_AssignDepartment',{
    DocumentVersionId:{type:'int',value:versionId},DepartmentId:{type:'int',value:b.departmentId},
    RequiredRead:{type:'bit',value:b.requiredRead!==false},RequiredAcknowledge:{type:'bit',value:!!b.requiredAcknowledge},
    RequiredTraining:{type:'bit',value:!!b.requiredTraining},AssignedBy:{type:'int',value:req.user.userId}
  });
  await execProc('B8V2.sp_ProductDocumentVersion_SyncDepartmentReceipts',{DocumentVersionId:{type:'int',value:versionId},ChangedBy:{type:'int',value:req.user.userId}});
  res.json({success:true,data:r.recordset[0]});
}));
router.delete('/:id/audiences/:departmentId',requirePermissions('DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProductDocumentVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProductDocumentVersion_RemoveDepartment',{
    DocumentVersionId:{type:'int',value:versionId},DepartmentId:{type:'int',value:positiveId(req.params.departmentId,'DepartmentId')},UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));
router.post('/:id/view',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  if(!await isProductDocumentVersionAssignedToDepartment(req.user,req.params.id,true)) return res.status(403).json({success:false,message:'Bạn không được phân phối phiên bản này.'});
  const r=await execProc('B8V2.sp_ProductDocumentVersion_MarkViewed',{
    DocumentVersionId:{type:'int',value:Number(req.params.id)},UserId:{type:'int',value:req.user.userId},
    DepartmentIdSnapshot:{type:'int',value:req.user.departmentId||null}
  });res.json({success:true,data:r.recordset?.[0] || r.recordsets?.at(-1)?.[0]});
}));
module.exports=router;
