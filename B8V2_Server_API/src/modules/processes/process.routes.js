const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions}=require('../../middleware/auth');

router.use(authRequired);

router.get('/',requirePermissions('DOCUMENT_VIEW_ALL'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Process_GetList',{
    Keyword:{type:'nvarchar',value:req.query.keyword||null},
    Status:{type:'varchar',value:req.query.status||null},
    OwnerDepartmentId:{type:'int',value:req.query.departmentId?Number(req.query.departmentId):null},
    Page:{type:'int',value:Number(req.query.page||1)},
    PageSize:{type:'int',value:Number(req.query.pageSize||50)}
  });
  res.json({success:true,data:r.recordset});
}));

router.post('/',requirePermissions('DOCUMENT_CREATE'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_Process_Create',{
    ProcessCode:{type:'nvarchar',value:b.processCode},
    ProcessName:{type:'nvarchar',value:b.processName},
    OwnerDepartmentId:{type:'int',value:b.ownerDepartmentId},
    CreatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));

router.get('/my-documents',requirePermissions('DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Process_GetMyDocuments',{
    UserId:{type:'int',value:req.user.userId},
    DepartmentId:{type:'int',value:req.user.departmentId||null},
    Page:{type:'int',value:Number(req.query.page||1)},
    PageSize:{type:'int',value:Number(req.query.pageSize||50)}
  });
  res.json({success:true,data:r.recordset});
}));

router.get('/:id',requirePermissions('DOCUMENT_VIEW_ALL'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Process_GetDetail',{ProcessId:{type:'int',value:Number(req.params.id)}});
  res.json({success:true,data:{process:r.recordsets[0]?.[0]||null,versions:r.recordsets[1]||[]}});
}));

router.post('/:id/versions',requirePermissions('DOCUMENT_VERSION_CREATE'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_ProcessVersion_Create',{
    ProcessId:{type:'int',value:Number(req.params.id)},
    VersionCode:{type:'nvarchar',value:b.versionCode},
    Title:{type:'nvarchar',value:b.title||null},
    IssueDate:{type:'date',value:b.issueDate||null},
    EffectiveDate:{type:'date',value:b.effectiveDate||null},
    ChangeSummary:{type:'nvarchar',value:b.changeSummary||null},
    CreatedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));

module.exports=router;
