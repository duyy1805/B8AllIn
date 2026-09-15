const router=require('express').Router();
const repo=require('./master.repository');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {execProc}=require('../../utils/proc');

const idList=value=>{
  if(!Array.isArray(value)||value.length>500) { const error=new Error('Danh sách ID không hợp lệ.'); error.status=400; throw error; }
  const ids=[...new Set(value.map(Number))];
  if(ids.some(id=>!Number.isSafeInteger(id)||id<1)) { const error=new Error('Danh sách ID không hợp lệ.'); error.status=400; throw error; }
  return ids;
};

router.use(authRequired);
router.get('/departments',asyncHandler(async(req,res)=>res.json({success:true,data:await repo.listDepartments(req.query.keyword||'')})));
router.get('/document-types/admin',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_DocumentType_GetAdminList');
  res.json({success:true,data:result.recordset});
}));
router.get('/document-types',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','PRODUCT_CUSTOMER_TEMPLATE_MANAGE','PRODUCTION_PROCESS_MANAGE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_DocumentType_GetList');
  res.json({success:true,data:result.recordset});
}));
router.get('/product-customers',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','PRODUCT_CUSTOMER_ASSIGN','PRODUCT_CUSTOMER_TEMPLATE_MANAGE','PRODUCTION_PROCESS_MANAGE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_ProductCustomer_GetList');
  res.json({success:true,data:result.recordset});
}));
router.get('/product-customer-templates',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','PRODUCT_CUSTOMER_TEMPLATE_MANAGE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_ProductCustomerTemplate_Get',{CustomerCode:{type:'varchar',value:req.query.customerCode||null}});
  res.json({success:true,data:result.recordset});
}));
router.put('/product-customer-templates/:customerCode',requirePermissions('PRODUCT_CUSTOMER_TEMPLATE_MANAGE'),asyncHandler(async(req,res)=>{
  const ids=idList(req.body.documentTypeIds||[]);
  const result=await execProc('B8V2.sp_ProductCustomerTemplate_Set',{
    CustomerCode:{type:'varchar',value:String(req.params.customerCode).toUpperCase()},DocumentTypeIds:{type:'nvarchar',value:JSON.stringify(ids)},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:result.recordset});
}));
router.get('/document-types/:id/default-audience',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','DOCUMENT_VERSION_CREATE','DOCUMENT_AUDIENCE_MANAGE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_DocumentType_GetDefaultAudience',{DocumentTypeId:{type:'int',value:Number(req.params.id)}});
  res.json({success:true,data:result.recordset});
}));
router.get('/production-processes',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','DOCUMENT_VERSION_CREATE','PRODUCTION_PROCESS_MANAGE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_ProductionProcess_GetList',{IncludeInactive:{type:'bit',value:req.query.includeInactive==='true'}});
  res.json({success:true,data:{processes:result.recordsets?.[0]||[],departments:result.recordsets?.[1]||[],documentTypes:result.recordsets?.[2]||[]}});
}));
router.post('/production-processes',requirePermissions('PRODUCTION_PROCESS_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body; const departmentIds=idList(b.departmentIds||[]); const documentTypeIds=idList(b.documentTypeIds||[]);
  const result=await execProc('B8V2.sp_ProductionProcess_Save',{
    ProductionProcessId:{type:'int',value:null},Code:{type:'varchar',value:String(b.code||'').trim().toUpperCase()},Name:{type:'nvarchar',value:String(b.name||'').trim()},Description:{type:'nvarchar',value:b.description||null},
    DepartmentIds:{type:'nvarchar',value:JSON.stringify(departmentIds)},DocumentTypeIds:{type:'nvarchar',value:JSON.stringify(documentTypeIds)},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:result.recordsets?.[0]?.find(item=>item.Code===String(b.code||'').trim().toUpperCase())});
}));
router.put('/production-processes/:id',requirePermissions('PRODUCTION_PROCESS_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body; const departmentIds=idList(b.departmentIds||[]); const documentTypeIds=idList(b.documentTypeIds||[]);
  const result=await execProc('B8V2.sp_ProductionProcess_Save',{
    ProductionProcessId:{type:'int',value:Number(req.params.id)},Code:{type:'varchar',value:String(b.code||'').trim().toUpperCase()},Name:{type:'nvarchar',value:String(b.name||'').trim()},Description:{type:'nvarchar',value:b.description||null},
    DepartmentIds:{type:'nvarchar',value:JSON.stringify(departmentIds)},DocumentTypeIds:{type:'nvarchar',value:JSON.stringify(documentTypeIds)},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:result.recordsets?.[0]?.find(item=>Number(item.Id)===Number(req.params.id))});
}));
router.patch('/production-processes/:id/active',requirePermissions('PRODUCTION_PROCESS_MANAGE'),asyncHandler(async(req,res)=>{
  const result=await execProc('B8V2.sp_ProductionProcess_SetActive',{ProductionProcessId:{type:'int',value:Number(req.params.id)},IsActive:{type:'bit',value:!!req.body.isActive},UpdatedBy:{type:'int',value:req.user.userId}});
  res.json({success:true,data:result.recordset?.[0]});
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
router.patch('/users/:userId/email',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const data=await repo.updateUserEmail(req.params.userId,req.body.email,req.user.userId);
  res.json({success:true,data});
}));
module.exports=router;
