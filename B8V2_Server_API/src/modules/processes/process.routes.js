const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions,requireAnyPermission,requireRoles}=require('../../middleware/auth');
const assignedProcess=require('./assignedProcess.repository');
const {getUsersByIds}=require('../master/master.repository');
const {positiveId,deletedMode}=require('../../utils/validation');

router.use(authRequired);

router.get('/',requireAnyPermission('DOCUMENT_VIEW_ALL','PROCESS_EDIT','PROCESS_DELETE','PROCESS_VERSION_EDIT','PROCESS_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const mode=deletedMode(req.query.deletedMode,req.user);
  const r=await execProc('B8V2.sp_Process_GetList',{
    Keyword:{type:'nvarchar',value:req.query.keyword||null},
    Status:{type:'varchar',value:req.query.status||null},
    OwnerDepartmentId:{type:'int',value:req.query.departmentId?Number(req.query.departmentId):null},
    Page:{type:'int',value:Number(req.query.page||1)},
    PageSize:{type:'int',value:Number(req.query.pageSize||50)},
    DeletedMode:{type:'varchar',value:mode}
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

router.get('/:id/my-versions',requirePermissions('DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  if(!req.user.departmentId) return res.status(403).json({success:false,message:'Tài khoản không thuộc bộ phận hợp lệ.'});
  const data=await assignedProcess.getAssignedProcessVersions({
    processId:Number(req.params.id),departmentId:Number(req.user.departmentId)
  });
  if(!data.process) return res.status(403).json({success:false,message:'Quy trình không được phân phối cho bộ phận của bạn.'});
  res.json({success:true,data});
}));

router.get('/:id',requireAnyPermission('DOCUMENT_VIEW_ALL','PROCESS_EDIT','PROCESS_DELETE','PROCESS_VERSION_EDIT','PROCESS_VERSION_DELETE'),asyncHandler(async(req,res)=>{
  const canSeeDeleted=(req.user.roles||[]).includes('ADMIN') || (req.user.permissions||[]).some(code=>['PROCESS_EDIT','PROCESS_DELETE','PROCESS_VERSION_EDIT','PROCESS_VERSION_DELETE'].includes(code));
  const r=await execProc('B8V2.sp_Process_GetDetail',{
    ProcessId:{type:'int',value:positiveId(req.params.id,'ProcessId')},IncludeDeleted:{type:'bit',value:canSeeDeleted}
  });
  const versions=r.recordsets[1]||[];
  const users=await getUsersByIds(versions.map(item=>item.DeletedBy));
  const userNames=new Map(users.map(item=>[Number(item.UserId),item.FullName||item.Username]));
  res.json({success:true,data:{process:r.recordsets[0]?.[0]||null,versions:versions.map(item=>({...item,DeletedByName:userNames.get(Number(item.DeletedBy))||null}))}});
}));

router.put('/:id',requirePermissions('PROCESS_EDIT'),asyncHandler(async(req,res)=>{
  const b=req.body;
  const r=await execProc('B8V2.sp_Process_Update',{
    ProcessId:{type:'int',value:positiveId(req.params.id,'ProcessId')},ProcessName:{type:'nvarchar',value:b.processName},
    OwnerDepartmentId:{type:'int',value:positiveId(b.ownerDepartmentId,'OwnerDepartmentId')},
    Status:{type:'varchar',value:b.status},UpdatedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordsets?.[0]?.[0]||r.recordset?.[0]});
}));

router.delete('/:id',requirePermissions('PROCESS_DELETE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Process_SoftDelete',{
    ProcessId:{type:'int',value:positiveId(req.params.id,'ProcessId')},DeletedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
}));

router.post('/:id/restore',requireRoles('ADMIN'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Process_Restore',{
    ProcessId:{type:'int',value:positiveId(req.params.id,'ProcessId')},RestoredBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset?.[0]});
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
