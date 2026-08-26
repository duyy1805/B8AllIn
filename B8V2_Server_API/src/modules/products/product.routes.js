const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {positiveId,deletedMode}=require('../../utils/validation');
const management=require('./productManagement.service');
const {getUsersByIds}=require('../master/master.repository');

router.use(authRequired);

router.post('/sync',requirePermissions('PRODUCT_SYNC'),asyncHandler(async(req,res)=>{
  res.json({success:true,data:await management.syncProducts(req.user.userId)});
}));

router.get('/sync-runs/latest',requireAnyPermission('PRODUCT_SYNC','DOCUMENT_VIEW_ALL'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductSyncRun_GetLatest');
  const run=r.recordset?.[0]||null;
  if(run){const users=await getUsersByIds([run.StartedBy]);run.StartedByName=users[0]?.FullName||users[0]?.Username||null;}
  res.json({success:true,data:run});
}));

router.get('/sync-runs',requireAnyPermission('PRODUCT_SYNC','DOCUMENT_VIEW_ALL'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductSyncRun_GetList',{
    Page:{type:'int',value:Number(req.query.page||1)},PageSize:{type:'int',value:Number(req.query.pageSize||20)}
  });
  const runs=r.recordset||[];const users=await getUsersByIds(runs.map(item=>item.StartedBy));const names=new Map(users.map(item=>[Number(item.UserId),item.FullName||item.Username]));
  res.json({success:true,data:runs.map(item=>({...item,StartedByName:names.get(Number(item.StartedBy))||null}))});
}));

router.get('/my-documents',requirePermissions('DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Product_GetMyDocuments',{
    UserId:{type:'int',value:req.user.userId},DepartmentId:{type:'int',value:req.user.departmentId||null},
    Page:{type:'int',value:Number(req.query.page||1)},PageSize:{type:'int',value:Number(req.query.pageSize||100)}
  });
  res.json({success:true,data:r.recordset||[]});
}));

router.post('/required-document-types/bulk',requirePermissions('PRODUCT_REQUIREMENT_MANAGE'),asyncHandler(async(req,res)=>{
  const data=await management.setRequiredDocumentTypes({...req.body,userId:req.user.userId});
  res.json({success:true,data});
}));

router.get('/',requireAnyPermission('DOCUMENT_VIEW_ALL','PRODUCT_SYNC','PRODUCT_REQUIREMENT_MANAGE','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Product_GetList',{
    Keyword:{type:'nvarchar',value:req.query.keyword||null},
    MaB4:{type:'nvarchar',value:req.query.maB4||null},Category:{type:'nvarchar',value:req.query.category||null},
    Market:{type:'nvarchar',value:req.query.market||null},SourceStatus:{type:'varchar',value:req.query.sourceStatus||null},
    Completeness:{type:'varchar',value:req.query.completeness||null},HasDocuments:{type:'varchar',value:req.query.hasDocuments||'ALL'},
    Page:{type:'int',value:Number(req.query.page||1)},
    PageSize:{type:'int',value:Number(req.query.pageSize||50)},DeletedMode:{type:'varchar',value:deletedMode(req.query.deletedMode,req.user)}
  });
  res.json({success:true,data:r.recordset});
}));

router.post('/upsert',requirePermissions('PRODUCT_MANAGE'),asyncHandler(async(req,res)=>{
  res.status(405).json({success:false,message:'ItemCode chỉ được tạo hoặc cập nhật bằng nút Đồng bộ ItemCode.'});
}));

router.get('/:id/detail',requireAnyPermission('DOCUMENT_VIEW_ALL','PRODUCT_SYNC','PRODUCT_REQUIREMENT_MANAGE','PRODUCT_MANAGE','PRODUCT_EDIT','PRODUCT_DELETE'),asyncHandler(async(req,res)=>{
  const includeDeleted=(req.user.roles||[]).includes('ADMIN') || (req.user.permissions||[]).some(code=>['PRODUCT_EDIT','PRODUCT_DELETE'].includes(code));
  const r=await execProc('B8V2.sp_Product_GetDetailById',{
    ProductId:{type:'int',value:positiveId(req.params.id,'ProductId')},IncludeDeleted:{type:'bit',value:includeDeleted}
  });
  res.json({success:true,data:{product:r.recordsets[0]?.[0]||null,documentSlots:r.recordsets[1]||[],documents:r.recordsets[1]||[]}});
}));

router.put('/:id',requirePermissions('PRODUCT_EDIT'),asyncHandler(async(req,res)=>{
  positiveId(req.params.id,'ProductId');
  res.status(405).json({success:false,message:'Metadata sản phẩm được quản lý từ TAG_QTKD và chỉ đọc tại B8V2.'});
}));

router.delete('/:id',requirePermissions('PRODUCT_DELETE'),asyncHandler(async(req,res)=>{
  positiveId(req.params.id,'ProductId');
  res.status(405).json({success:false,message:'Trạng thái ItemCode được cập nhật qua đồng bộ nguồn, không xóa thủ công.'});
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
