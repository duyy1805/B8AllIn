const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {positiveId,deletedMode}=require('../../utils/validation');

router.use(authRequired);

router.get('/',requireAnyPermission('DOCUMENT_VIEW_ALL','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Product_GetList',{
    Keyword:{type:'nvarchar',value:req.query.keyword||null},CustomerName:{type:'nvarchar',value:req.query.customerName||null},
    ProductLine:{type:'nvarchar',value:req.query.productLine||null},Page:{type:'int',value:Number(req.query.page||1)},
    PageSize:{type:'int',value:Number(req.query.pageSize||50)},DeletedMode:{type:'varchar',value:deletedMode(req.query.deletedMode,req.user)}
  });
  res.json({success:true,data:r.recordset});
}));

router.post('/upsert',requirePermissions('PRODUCT_MANAGE'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_Product_Upsert',{
    ItemCode:{type:'nvarchar',value:b.itemCode},ProductName:{type:'nvarchar',value:b.productName||null},
    ModelCode:{type:'nvarchar',value:b.modelCode||null},CustomerCode:{type:'nvarchar',value:b.customerCode||null},
    CustomerName:{type:'nvarchar',value:b.customerName||null},ProductLine:{type:'nvarchar',value:b.productLine||null},
    Category:{type:'nvarchar',value:b.category||null},UserId:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));

router.get('/:id/detail',requireAnyPermission('DOCUMENT_VIEW_ALL','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE'),asyncHandler(async(req,res)=>{
  const includeDeleted=(req.user.roles||[]).includes('ADMIN') || (req.user.permissions||[]).some(code=>['PRODUCT_EDIT','PRODUCT_DELETE'].includes(code));
  const r=await execProc('B8V2.sp_Product_GetDetailById',{
    ProductId:{type:'int',value:positiveId(req.params.id,'ProductId')},IncludeDeleted:{type:'bit',value:includeDeleted}
  });
  res.json({success:true,data:{product:r.recordsets[0]?.[0]||null,documents:r.recordsets[1]||[]}});
}));

router.put('/:id',requirePermissions('PRODUCT_EDIT'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_Product_Update',{
    ProductId:{type:'int',value:positiveId(req.params.id,'ProductId')},ProductName:{type:'nvarchar',value:b.productName||null},
    ModelCode:{type:'nvarchar',value:b.modelCode||null},CustomerCode:{type:'nvarchar',value:b.customerCode||null},
    CustomerName:{type:'nvarchar',value:b.customerName||null},ProductLine:{type:'nvarchar',value:b.productLine||null},
    Category:{type:'nvarchar',value:b.category||null},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.delete('/:id',requirePermissions('PRODUCT_DELETE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Product_SoftDelete',{
    ProductId:{type:'int',value:positiveId(req.params.id,'ProductId')},DeletedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.post('/:id/restore',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Product_Restore',{
    ProductId:{type:'int',value:positiveId(req.params.id,'ProductId')},RestoredBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.get('/:itemCode',requireAnyPermission('DOCUMENT_VIEW_ALL','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Product_GetDetailByItemCode',{ItemCode:{type:'nvarchar',value:req.params.itemCode}});
  res.json({success:true,data:{product:r.recordsets[0]?.[0]||null,documents:r.recordsets[1]||[]}});
}));
module.exports=router;
