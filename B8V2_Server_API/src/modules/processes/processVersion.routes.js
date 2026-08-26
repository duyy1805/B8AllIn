const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission}=require('../../middleware/auth');
const {canViewProcessVersion}=require('../auth/authorization.service');

router.use(authRequired);

router.get('/:id',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  if(!await canViewProcessVersion(req.user,req.params.id)) return res.status(403).json({success:false,message:'Bạn không được phân phối phiên bản này.'});
  const r=await execProc('B8V2.sp_ProcessVersion_GetDetail',{ProcessVersionId:{type:'int',value:Number(req.params.id)}});
  res.json({success:true,data:{version:r.recordsets[0]?.[0]||null,audiences:r.recordsets[1]||[],files:r.recordsets[2]||[]}});
}));

router.post('/:id/submit',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessVersion_SetWorkflowStatus',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},Action:{type:'varchar',value:'SUBMIT'},UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/review',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessVersion_SetWorkflowStatus',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},Action:{type:'varchar',value:'REVIEW'},UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/publish',requirePermissions('DOCUMENT_STATUS_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessVersion_Publish',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},ApprovedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/audiences',requirePermissions('DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_ProcessVersion_AssignDepartment',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},
    DepartmentId:{type:'int',value:b.departmentId},
    RequiredRead:{type:'bit',value:true},
    RequiredAcknowledge:{type:'bit',value:true},
    RequiredTraining:{type:'bit',value:true},
    AssignedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));
router.delete('/:id/audiences/:departmentId',requirePermissions('DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessVersion_RemoveDepartment',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},
    DepartmentId:{type:'int',value:Number(req.params.departmentId)},
    UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));
router.post('/:id/view',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  if(!await canViewProcessVersion(req.user,req.params.id)) return res.status(403).json({success:false,message:'Bạn không được phân phối phiên bản này.'});
  const r=await execProc('B8V2.sp_ProcessVersion_MarkViewed',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},UserId:{type:'int',value:req.user.userId},
    DepartmentIdSnapshot:{type:'int',value:req.user.departmentId||null}
  });
  res.json({success:true,data:r.recordset?.[0] || r.recordsets?.at(-1)?.[0]});
}));
router.post('/:id/acknowledge',requirePermissions('DOCUMENT_ACKNOWLEDGE'),asyncHandler(async(req,res)=>{
  if(!await canViewProcessVersion(req.user,req.params.id)) return res.status(403).json({success:false,message:'Bạn không được phân phối phiên bản này.'});
  const r=await execProc('B8V2.sp_ProcessVersion_Acknowledge',{
    ProcessVersionId:{type:'int',value:Number(req.params.id)},UserId:{type:'int',value:req.user.userId},
    DepartmentIdSnapshot:{type:'int',value:req.user.departmentId||null}
  });
  res.json({success:true,data:r.recordset[0]});
}));
module.exports=router;
