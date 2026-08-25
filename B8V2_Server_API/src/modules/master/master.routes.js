const router=require('express').Router();
const repo=require('./master.repository');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired}=require('../../middleware/auth');

router.use(authRequired);
router.get('/departments',asyncHandler(async(req,res)=>res.json({success:true,data:await repo.listDepartments(req.query.keyword||'')})));
router.get('/users',asyncHandler(async(req,res)=>res.json({success:true,data:await repo.listUsers({
  keyword:req.query.keyword||'',departmentId:req.query.departmentId?Number(req.query.departmentId):null
})})));
module.exports=router;
