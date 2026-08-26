const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const {positiveId,deletedMode}=require('../../utils/validation');
const {getUsersByIds}=require('../master/master.repository');

router.use(authRequired);

router.get('/',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_GetList',{
    Keyword:{type:'nvarchar',value:req.query.keyword||null},
    DocumentTypeId:{type:'int',value:req.query.documentTypeId?Number(req.query.documentTypeId):null},
    Page:{type:'int',value:Number(req.query.page||1)},
    PageSize:{type:'int',value:Number(req.query.pageSize||50)},
    DeletedMode:{type:'varchar',value:deletedMode(req.query.deletedMode,req.user)}
  });
  res.json({success:true,data:r.recordset});
}));

router.post('/',requirePermissions('DOCUMENT_CREATE'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_ProductDocument_Create',{
    DocumentCode:{type:'nvarchar',value:b.documentCode},DocumentName:{type:'nvarchar',value:b.documentName},
    DocumentTypeId:{type:'int',value:b.documentTypeId},OwnerDepartmentId:{type:'int',value:b.ownerDepartmentId||null},
    CreatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));

router.post('/:id/itemcodes',requirePermissions('PRODUCT_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_MapItemCode',{
    DocumentId:{type:'int',value:Number(req.params.id)},ItemCode:{type:'nvarchar',value:req.body.itemCode},
    ApplicableFrom:{type:'date',value:req.body.applicableFrom||null},CreatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));

router.delete('/:id/itemcodes/:itemCode',requirePermissions('PRODUCT_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_UnmapItemCode',{
    DocumentId:{type:'int',value:positiveId(req.params.id,'DocumentId')},ItemCode:{type:'nvarchar',value:req.params.itemCode},
    EndedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.post('/:id/versions',requirePermissions('DOCUMENT_VERSION_CREATE'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_ProductDocumentVersion_Create',{
    DocumentId:{type:'int',value:Number(req.params.id)},VersionCode:{type:'nvarchar',value:b.versionCode},IssueDate:{type:'date',value:b.issueDate||null},
    EffectiveDate:{type:'date',value:b.effectiveDate||null},ChangeSummary:{type:'nvarchar',value:b.changeSummary||null},
    CreatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));

router.get('/my/list',requirePermissions('DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_GetMyDocuments',{
    UserId:{type:'int',value:req.user.userId},DepartmentId:{type:'int',value:req.user.departmentId||null},
    Page:{type:'int',value:Number(req.query.page||1)},PageSize:{type:'int',value:Number(req.query.pageSize||50)}
  });
  res.json({success:true,data:r.recordset});
}));

router.get('/:id',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_CREATE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const includeDeleted=(req.user.roles||[]).includes('ADMIN') || (req.user.permissions||[]).some(code=>['PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE','PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'].includes(code));
  const r=await execProc('B8V2.sp_ProductDocument_GetDetail',{
    DocumentId:{type:'int',value:positiveId(req.params.id,'DocumentId')},IncludeDeleted:{type:'bit',value:includeDeleted}
  });
  const versions=r.recordsets[1]||[];
  const users=await getUsersByIds(versions.map(item=>item.DeletedBy));
  const userNames=new Map(users.map(item=>[Number(item.UserId),item.FullName||item.Username]));
  res.json({success:true,data:{document:r.recordsets[0]?.[0]||null,versions:versions.map(item=>({...item,DeletedByName:userNames.get(Number(item.DeletedBy))||null})),products:r.recordsets[2]||[]}});
}));

router.put('/:id',requirePermissions('PRODUCT_DOCUMENT_EDIT'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_ProductDocument_Update',{
    DocumentId:{type:'int',value:positiveId(req.params.id,'DocumentId')},DocumentName:{type:'nvarchar',value:b.documentName},
    DocumentTypeId:{type:'int',value:positiveId(b.documentTypeId,'DocumentTypeId')},
    OwnerDepartmentId:{type:'int',value:b.ownerDepartmentId?positiveId(b.ownerDepartmentId,'OwnerDepartmentId'):null},
    Status:{type:'varchar',value:b.status},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.delete('/:id',requirePermissions('PRODUCT_DOCUMENT_DELETE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_SoftDelete',{
    DocumentId:{type:'int',value:positiveId(req.params.id,'DocumentId')},DeletedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.post('/:id/restore',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_Restore',{
    DocumentId:{type:'int',value:positiveId(req.params.id,'DocumentId')},RestoredBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));
module.exports=router;
