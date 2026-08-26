const router=require('express').Router();
const {execProc,execProcWithDeadlockRetry}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {canViewProcessVersion,isProcessVersionAssignedToDepartment}=require('../auth/authorization.service');
const trainingEvidenceUpload=require('../../middleware/trainingEvidenceUpload');
const training=require('./processTraining.service');
const {positiveId}=require('../../utils/validation');
const {assertProcessVersionActive,assertProcessVersionParentActive}=require('../../utils/entityState');

router.use(authRequired);

const requireAssignedDepartment=async(req,res,next)=>{
  try {
    const versionId=Number(req.params.id);
    if(!Number.isSafeInteger(versionId)||versionId<1) return res.status(400).json({success:false,message:'ProcessVersionId không hợp lệ.'});
    if(!await isProcessVersionAssignedToDepartment(req.user,req.params.id,true)) {
      return res.status(403).json({success:false,message:'Tài liệu không được phân phối cho bộ phận của bạn.'});
    }
    return next();
  } catch(error) { return next(error); }
};

router.get('/:id',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW','PROCESS_EDIT','PROCESS_DELETE','PROCESS_VERSION_EDIT','PROCESS_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const includeDeleted=(req.user.roles||[]).includes('ADMIN') || (req.user.permissions||[]).some(code=>['PROCESS_EDIT','PROCESS_DELETE','PROCESS_VERSION_EDIT','PROCESS_VERSION_DELETE'].includes(code));
  if(!includeDeleted && !await canViewProcessVersion(req.user,req.params.id)) return res.status(403).json({success:false,message:'Bạn không được phân phối phiên bản này.'});
  const r=await execProc('B8V2.sp_ProcessVersion_GetDetail',{
    ProcessVersionId:{type:'int',value:positiveId(req.params.id,'ProcessVersionId')},IncludeDeleted:{type:'bit',value:includeDeleted}
  });
  res.json({success:true,data:{version:r.recordsets[0]?.[0]||null,audiences:r.recordsets[1]||[],files:r.recordsets[2]||[]}});
}));

router.put('/:id',requirePermissions('PROCESS_VERSION_EDIT'),asyncHandler(async(req,res)=>{
  const b=req.body; const versionId=await assertProcessVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProcessVersion_Update',{
    ProcessVersionId:{type:'int',value:versionId},VersionCode:{type:'nvarchar',value:b.versionCode},
    Title:{type:'nvarchar',value:b.title||null},IssueDate:{type:'date',value:b.issueDate||null},
    EffectiveDate:{type:'date',value:b.effectiveDate},ExpiryDate:{type:'date',value:b.expiryDate||null},
    ChangeSummary:{type:'nvarchar',value:b.changeSummary||null},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.delete('/:id',requirePermissions('PROCESS_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProcessVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProcessVersion_SoftDelete',{
    ProcessVersionId:{type:'int',value:versionId},DeletedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.post('/:id/restore',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const versionId=await assertProcessVersionParentActive(req.params.id);
  const r=await execProc('B8V2.sp_ProcessVersion_Restore',{
    ProcessVersionId:{type:'int',value:versionId},RestoredBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.get('/:id/training-confirmation',requirePermissions('DOCUMENT_ASSIGNED_VIEW'),requireAssignedDepartment,asyncHandler(async(req,res)=>{
  if(!req.user.departmentId) return res.status(403).json({success:false,message:'Tài khoản không thuộc bộ phận hợp lệ.'});
  const data=await training.getDepartmentTraining(Number(req.params.id),req.user.departmentId);
  if(!data.receipt) return res.status(403).json({success:false,message:'Tài liệu không được phân phối cho bộ phận của bạn.'});
  res.json({success:true,data});
}));

router.get('/:id/department-progress',requirePermissions('DOCUMENT_VIEW_ALL'),asyncHandler(async(req,res)=>{
  if(!(req.user.roles||[]).some(role=>['ADMIN','DOCUMENT_CONTROLLER'].includes(role))) {
    return res.status(403).json({success:false,message:'Chỉ ADMIN hoặc bộ phận kiểm soát tài liệu được xem tiến độ.'});
  }
  const data=await training.getDepartmentProgress(Number(req.params.id));
  res.json({success:true,data});
}));

router.post('/:id/training-confirmations',requirePermissions('DOCUMENT_TRAINING_CONFIRM'),requireAssignedDepartment,trainingEvidenceUpload.array('files',10),asyncHandler(async(req,res)=>{
  const data=await training.confirmTraining({
    processVersionId:Number(req.params.id),user:req.user,files:req.files,comment:req.body.comment
  });
  res.status(201).json({success:true,data});
}));

router.post('/:id/submit',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProcessVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProcessVersion_SetWorkflowStatus',{
    ProcessVersionId:{type:'int',value:versionId},Action:{type:'varchar',value:'SUBMIT'},UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/review',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProcessVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProcessVersion_SetWorkflowStatus',{
    ProcessVersionId:{type:'int',value:versionId},Action:{type:'varchar',value:'REVIEW'},UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/publish',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProcessVersionActive(req.params.id);
  const r=await execProc('B8V2.sp_ProcessVersion_Publish',{
    ProcessVersionId:{type:'int',value:versionId},ApprovedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/audiences',requirePermissions('DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body; const versionId=await assertProcessVersionActive(req.params.id);
  const r=await execProcWithDeadlockRetry('B8V2.sp_ProcessVersion_AssignDepartment',{
    ProcessVersionId:{type:'int',value:versionId},
    DepartmentId:{type:'int',value:b.departmentId},
    RequiredRead:{type:'bit',value:true},
    RequiredAcknowledge:{type:'bit',value:true},
    RequiredTraining:{type:'bit',value:true},
    AssignedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));
router.delete('/:id/audiences/:departmentId',requirePermissions('DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const versionId=await assertProcessVersionActive(req.params.id);
  const r=await execProcWithDeadlockRetry('B8V2.sp_ProcessVersion_RemoveDepartment',{
    ProcessVersionId:{type:'int',value:versionId},
    DepartmentId:{type:'int',value:Number(req.params.departmentId)},
    UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/view',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW'),requireAssignedDepartment,asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessVersion_MarkViewed',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},UserId:{type:'int',value:req.user.userId},
    DepartmentIdSnapshot:{type:'int',value:req.user.departmentId||null}
  });
  res.json({success:true,data:r.recordset?.[0] || r.recordsets?.at(-1)?.[0]});
}));
router.post('/:id/acknowledge',requirePermissions('DOCUMENT_ACKNOWLEDGE'),asyncHandler(async(req,res)=>{
  res.status(410).json({success:false,message:'Xác nhận tiếp nhận đã được thay bằng xác nhận đào tạo có file minh chứng.'});
}));
module.exports=router;
