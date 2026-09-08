const router=require('express').Router();
const repo=require('./master.repository');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {execProc}=require('../../utils/proc');

router.use(authRequired);
router.get('/departments',asyncHandler(async(req,res)=>res.json({success:true,data:await repo.listDepartments(req.query.keyword||'')})));
router.get('/document-types/admin',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_DocumentType_GetAdminList');
  res.json({success:true,data:result.recordset});
}));
router.get('/document-types',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_DocumentType_GetList');
  res.json({success:true,data:result.recordset});
}));
router.post('/document-types',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const code=String(req.body.code||'').trim().toUpperCase();
  const name=String(req.body.name||'').trim();
  if(!/^[A-Z][A-Z0-9_]{1,49}$/.test(code)) return res.status(400).json({success:false,message:'Mã loại phải gồm 2-50 ký tự in hoa, số hoặc dấu gạch dưới.'});
  if(!name) return res.status(400).json({success:false,message:'Tên loại tài liệu không được để trống.'});
  const result=await execProc('B8V2.sp_DocumentType_Create',{
    Code:{type:'varchar',value:code},Name:{type:'nvarchar',value:name},Description:{type:'nvarchar',value:req.body.description||null},
    IsRequiredByDefault:{type:'bit',value:!!req.body.isRequiredByDefault},CreatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:result.recordset[0]});
}));
router.put('/document-types/:id',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const name=String(req.body.name||'').trim();
  if(!name) return res.status(400).json({success:false,message:'Tên loại tài liệu không được để trống.'});
  const result=await execProc('B8V2.sp_DocumentType_Update',{
    DocumentTypeId:{type:'int',value:Number(req.params.id)},Name:{type:'nvarchar',value:name},Description:{type:'nvarchar',value:req.body.description||null},
    IsRequiredByDefault:{type:'bit',value:!!req.body.isRequiredByDefault},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:result.recordset[0]});
}));
router.patch('/document-types/:id/active',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_DocumentType_SetActive',{
    DocumentTypeId:{type:'int',value:Number(req.params.id)},IsActive:{type:'bit',value:!!req.body.isActive},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:result.recordset[0]});
}));
router.get('/users',requirePermissions('RBAC_VIEW'),asyncHandler(async(req,res)=>res.json({success:true,data:await repo.listUsers({
  keyword:req.query.keyword||'',departmentId:req.query.departmentId?Number(req.query.departmentId):null
})})));
module.exports=router;
