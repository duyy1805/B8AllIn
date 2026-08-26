const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {canViewProductDocumentVersion}=require('../auth/authorization.service');
const {positiveId}=require('../../utils/validation');
const {assertProductDocumentVersionActive,assertProductDocumentVersionParentActive}=require('../../utils/entityState');

router.use(authRequired);

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
  const versionId=await assertProductDocumentVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProductDocumentVersion_SetWorkflowStatus',{
    DocumentVersionId:{type:'int',value:versionId},Action:{type:'varchar',value:'SUBMIT'},UserId:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/review',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProductDocumentVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProductDocumentVersion_SetWorkflowStatus',{
    DocumentVersionId:{type:'int',value:versionId},Action:{type:'varchar',value:'REVIEW'},UserId:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/publish',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProductDocumentVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProductDocumentVersion_Publish',{
    DocumentVersionId:{type:'int',value:versionId},ApprovedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/audiences',requirePermissions('DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body; const versionId=await assertProductDocumentVersionActive(req.params.id); const r=await execProc('B8V2.sp_ProductDocumentVersion_AssignDepartment',{
    DocumentVersionId:{type:'int',value:versionId},DepartmentId:{type:'int',value:b.departmentId},
    RequiredRead:{type:'bit',value:b.requiredRead!==false},RequiredAcknowledge:{type:'bit',value:!!b.requiredAcknowledge},
    RequiredTraining:{type:'bit',value:!!b.requiredTraining},AssignedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/view',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  if(!await canViewProductDocumentVersion(req.user,req.params.id)) return res.status(403).json({success:false,message:'Bạn không được phân phối phiên bản này.'});
  const r=await execProc('B8V2.sp_ProductDocumentVersion_MarkViewed',{
    DocumentVersionId:{type:'int',value:Number(req.params.id)},UserId:{type:'int',value:req.user.userId},
    DepartmentIdSnapshot:{type:'int',value:req.user.departmentId||null}
  });res.json({success:true,data:r.recordset?.[0] || r.recordsets?.at(-1)?.[0]});
}));
module.exports=router;
