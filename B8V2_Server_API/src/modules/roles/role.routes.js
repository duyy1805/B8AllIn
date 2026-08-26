const router=require('express').Router();
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const {authRequired,requirePermissions}=require('../../middleware/auth');

router.use(authRequired);
router.get('/',requirePermissions('RBAC_VIEW'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Role_GetList',{
    IncludeInactive:{type:'bit',value:req.query.includeInactive==='true'}
  }); res.json({success:true,data:r.recordset});
}));
router.post('/',requirePermissions('RBAC_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Role_Create',{
    Code:{type:'varchar',value:req.body.code},Name:{type:'nvarchar',value:req.body.name},
    Description:{type:'nvarchar',value:req.body.description||null}
  });res.status(201).json({success:true,data:r.recordset[0]});
}));
router.get('/permissions',requirePermissions('RBAC_VIEW'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Permission_GetList'); res.json({success:true,data:r.recordset});
}));
router.get('/users/:userId',requirePermissions('RBAC_VIEW'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_UserRole_Get',{UserId:{type:'int',value:Number(req.params.userId)}});
  res.json({success:true,data:r.recordset});
}));
router.post('/users/:userId',requirePermissions('RBAC_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_UserRole_Assign',{
    UserId:{type:'int',value:Number(req.params.userId)},RoleCode:{type:'varchar',value:req.body.roleCode},
    AssignedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset});
}));
router.delete('/users/:userId/:roleCode',requirePermissions('RBAC_MANAGE'),asyncHandler(async(req,res)=>{
  if(Number(req.params.userId)===Number(req.user.userId) && String(req.params.roleCode).toUpperCase()==='ADMIN') {
    return res.status(400).json({success:false,message:'Không thể tự gỡ quyền ADMIN của chính mình.'});
  }
  const r=await execProc('B8V2.sp_UserRole_Remove',{
    UserId:{type:'int',value:Number(req.params.userId)},RoleCode:{type:'varchar',value:req.params.roleCode}
  });res.json({success:true,data:r.recordset});
}));
router.put('/:roleId',requirePermissions('RBAC_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Role_Update',{
    RoleId:{type:'int',value:Number(req.params.roleId)},Code:{type:'varchar',value:req.body.code},
    Name:{type:'nvarchar',value:req.body.name},Description:{type:'nvarchar',value:req.body.description||null}
  });res.json({success:true,data:r.recordset[0]});
}));
router.patch('/:roleId/active',requirePermissions('RBAC_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Role_SetActive',{
    RoleId:{type:'int',value:Number(req.params.roleId)},IsActive:{type:'bit',value:Boolean(req.body.isActive)}
  });res.json({success:true,data:r.recordset[0]});
}));
router.delete('/:roleId',requirePermissions('RBAC_MANAGE'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_Role_SetActive',{
    RoleId:{type:'int',value:Number(req.params.roleId)},IsActive:{type:'bit',value:false}
  });res.json({success:true,data:r.recordset[0]});
}));
router.get('/:roleId/permissions',requirePermissions('RBAC_VIEW'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_RolePermission_Get',{
    RoleId:{type:'int',value:Number(req.params.roleId)}
  });
  res.json({success:true,data:r.recordset});
}));
router.put('/:roleId/permissions',requirePermissions('RBAC_MANAGE'),asyncHandler(async(req,res)=>{
  const permissionCodes=Array.isArray(req.body.permissionCodes) ? req.body.permissionCodes : [];
  const r=await execProc('B8V2.sp_RolePermission_Set',{
    RoleId:{type:'int',value:Number(req.params.roleId)},
    PermissionCodes:{type:'nvarchar',value:JSON.stringify(permissionCodes)},
    AssignedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset});
}));
module.exports=router;
