const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requireRoles}=require('../../middleware/auth');

router.use(authRequired);

router.get('/',asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_GetList',{
    Keyword:{type:'nvarchar',value:req.query.keyword||null},
    DocumentTypeId:{type:'int',value:req.query.documentTypeId?Number(req.query.documentTypeId):null},
    Page:{type:'int',value:Number(req.query.page||1)},
    PageSize:{type:'int',value:Number(req.query.pageSize||50)}
  });
  res.json({success:true,data:r.recordset});
}));

router.post('/',requireRoles('DOCUMENT_CONTROLLER','EDITOR'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_ProductDocument_Create',{
    DocumentCode:{type:'nvarchar',value:b.documentCode},DocumentName:{type:'nvarchar',value:b.documentName},
    DocumentTypeId:{type:'int',value:b.documentTypeId},OwnerDepartmentId:{type:'int',value:b.ownerDepartmentId||null},
    CreatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));

router.post('/:id/itemcodes',requireRoles('DOCUMENT_CONTROLLER','EDITOR'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_MapItemCode',{
    DocumentId:{type:'int',value:Number(req.params.id)},ItemCode:{type:'nvarchar',value:req.body.itemCode},
    ApplicableFrom:{type:'date',value:req.body.applicableFrom||null},CreatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));

router.post('/:id/versions',requireRoles('DOCUMENT_CONTROLLER','EDITOR'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_ProductDocumentVersion_Create',{
    DocumentId:{type:'int',value:Number(req.params.id)},IssueDate:{type:'date',value:b.issueDate||null},
    EffectiveDate:{type:'date',value:b.effectiveDate||null},ChangeSummary:{type:'nvarchar',value:b.changeSummary||null},
    CreatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));

router.get('/my/list',asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocument_GetMyDocuments',{
    UserId:{type:'int',value:req.user.userId},Page:{type:'int',value:Number(req.query.page||1)},PageSize:{type:'int',value:Number(req.query.pageSize||50)}
  });
  res.json({success:true,data:r.recordset});
}));
module.exports=router;
