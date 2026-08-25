const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requireRoles}=require('../../middleware/auth');

router.use(authRequired);
router.get('/',asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Role_GetList'); res.json({success:true,data:r.recordset});
}));
router.get('/users/:userId',asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_UserRole_Get',{UserId:{type:'int',value:Number(req.params.userId)}});
  res.json({success:true,data:r.recordset});
}));
router.post('/users/:userId',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_UserRole_Assign',{
    UserId:{type:'int',value:Number(req.params.userId)},RoleCode:{type:'varchar',value:req.body.roleCode},
    AssignedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset});
}));
router.delete('/users/:userId/:roleCode',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_UserRole_Remove',{
    UserId:{type:'int',value:Number(req.params.userId)},RoleCode:{type:'varchar',value:req.params.roleCode}
  });res.json({success:true,data:r.recordset});
}));
module.exports=router;
