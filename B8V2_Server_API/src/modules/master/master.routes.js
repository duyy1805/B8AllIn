const router=require('express').Router();
const repo=require('./master.repository');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission}=require('../../middleware/auth');
const {execProc}=require('../../utils/proc');

router.use(authRequired);
router.get('/departments',asyncHandler(async(req,res)=>res.json({success:true,data:await repo.listDepartments(req.query.keyword||'')})));
router.get('/document-types',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_DocumentType_GetList');
  res.json({success:true,data:result.recordset});
}));
router.get('/users',requirePermissions('RBAC_VIEW'),asyncHandler(async(req,res)=>res.json({success:true,data:await repo.listUsers({
  keyword:req.query.keyword||'',departmentId:req.query.departmentId?Number(req.query.departmentId):null
})})));
module.exports=router;
