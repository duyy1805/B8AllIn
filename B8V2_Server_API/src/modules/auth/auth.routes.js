const router=require('express').Router();
const service=require('./auth.service');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired}=require('../../middleware/auth');

router.post('/login',asyncHandler(async(req,res)=>{
  const {username,password}=req.body;
  res.json({success:true,data:await service.login(username,password)});
}));
router.get('/me',authRequired,(req,res)=>res.json({success:true,data:req.user}));
module.exports=router;
