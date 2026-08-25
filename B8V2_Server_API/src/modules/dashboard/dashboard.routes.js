const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired}=require('../../middleware/auth');

router.use(authRequired);
router.get('/',asyncHandler(async(req,res)=>{
  const admin=req.user.roles?.includes('ADMIN') || req.user.roles?.includes('DOCUMENT_CONTROLLER');
  const r=admin
    ? await execProc('B8V2.sp_Dashboard_GetAdmin')
    : await execProc('B8V2.sp_Dashboard_GetUser',{UserId:{type:'int',value:req.user.userId}});
  res.json({success:true,data:r.recordset[0]});
}));
module.exports=router;
