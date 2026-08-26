const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions}=require('../../middleware/auth');
const {canViewProcessVersion,canViewProductDocumentVersion}=require('../auth/authorization.service');

router.use(authRequired);

router.post('/process/:versionId',requirePermissions('DOCUMENT_FEEDBACK_CREATE'),asyncHandler(async(req,res)=>{
  if(!await canViewProcessVersion(req.user,req.params.versionId)) return res.status(403).json({success:false,message:'Bạn không được phản hồi phiên bản này.'});
  const r=await execProc('B8V2.sp_ProcessFeedback_Create',{
    ProcessVersionId:{type:'int',value:Number(req.params.versionId)},UserId:{type:'int',value:req.user.userId},
    DepartmentId:{type:'int',value:req.user.departmentId||null},FeedbackType:{type:'varchar',value:req.body.feedbackType},
    Content:{type:'nvarchar',value:req.body.content||null}
  });res.status(201).json({success:true,data:r.recordset[0]});
}));
router.post('/process/:feedbackId/resolve',requirePermissions('DOCUMENT_FEEDBACK_RESOLVE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessFeedback_Resolve',{
    FeedbackId:{type:'bigint',value:Number(req.params.feedbackId)},Resolution:{type:'nvarchar',value:req.body.resolution},
    ResolvedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset[0]});
}));
router.post('/product/:versionId',requirePermissions('DOCUMENT_FEEDBACK_CREATE'),asyncHandler(async(req,res)=>{
  if(!await canViewProductDocumentVersion(req.user,req.params.versionId)) return res.status(403).json({success:false,message:'Bạn không được phản hồi phiên bản này.'});
  const r=await execProc('B8V2.sp_ProductDocumentFeedback_Create',{
    DocumentVersionId:{type:'int',value:Number(req.params.versionId)},UserId:{type:'int',value:req.user.userId},
    DepartmentId:{type:'int',value:req.user.departmentId||null},FeedbackType:{type:'varchar',value:req.body.feedbackType},
    Content:{type:'nvarchar',value:req.body.content||null}
  });res.status(201).json({success:true,data:r.recordset[0]});
}));
module.exports=router;
