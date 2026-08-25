const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requireRoles}=require('../../middleware/auth');

router.use(authRequired);

router.post('/process/:versionId',asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessFeedback_Create',{
    ProcessVersionId:{type:'int',value:Number(req.params.versionId)},UserId:{type:'int',value:req.user.userId},
    DepartmentId:{type:'int',value:req.user.departmentId||null},FeedbackType:{type:'varchar',value:req.body.feedbackType},
    Content:{type:'nvarchar',value:req.body.content||null}
  });res.status(201).json({success:true,data:r.recordset[0]});
}));
router.post('/process/:feedbackId/resolve',requireRoles('DOCUMENT_CONTROLLER'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessFeedback_Resolve',{
    FeedbackId:{type:'bigint',value:Number(req.params.feedbackId)},Resolution:{type:'nvarchar',value:req.body.resolution},
    ResolvedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset[0]});
}));
router.post('/product/:versionId',asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocumentFeedback_Create',{
    DocumentVersionId:{type:'int',value:Number(req.params.versionId)},UserId:{type:'int',value:req.user.userId},
    DepartmentId:{type:'int',value:req.user.departmentId||null},FeedbackType:{type:'varchar',value:req.body.feedbackType},
    Content:{type:'nvarchar',value:req.body.content||null}
  });res.status(201).json({success:true,data:r.recordset[0]});
}));
module.exports=router;
