const router=require('express').Router();
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const upload=require('../../middleware/upload');
const {authRequired,requirePermissions,requireAnyPermission}=require('../../middleware/auth');
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');
const env=require('../../config/env');
const {getActiveFile}=require('./file.repository');
const {canViewFile}=require('../auth/authorization.service');

router.use(authRequired);

router.post('/upload',requirePermissions('DOCUMENT_FILE_UPLOAD'),upload.single('file'),asyncHandler(async(req,res)=>{
  if(!req.file) return res.status(400).json({success:false,message:'Missing file'});
  const hash=crypto.createHash('sha256').update(fs.readFileSync(req.file.path)).digest('hex');
  const r=await execProc('B8V2.sp_File_Create',{
    OriginalName:{type:'nvarchar',value:req.file.originalname},
    StoredName:{type:'nvarchar',value:req.file.filename},
    StoragePath:{type:'nvarchar',value:req.file.path.replace(/\\/g,'/')},
    Extension:{type:'varchar',value:path.extname(req.file.originalname).replace('.','')||null},
    MimeType:{type:'varchar',value:req.file.mimetype},
    FileSize:{type:'bigint',value:req.file.size},
    Sha256Hash:{type:'varchar',value:hash},
    UploadedBy:{type:'int',value:req.user.userId}
  });
  res.status(201).json({success:true,data:r.recordset[0]});
}));

router.post('/process-version/:versionId/:fileId',requirePermissions('DOCUMENT_FILE_UPLOAD'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessVersion_AttachFile',{
    ProcessVersionId:{type:'int',value:Number(req.params.versionId)},FileId:{type:'bigint',value:Number(req.params.fileId)},
    FileRole:{type:'varchar',value:req.body.fileRole||'PDF'},UploadedBy:{type:'int',value:req.user.userId}
  });
  await execProc('B8V2.sp_ProcessVersion_SyncDepartmentReceipts',{
    ProcessVersionId:{type:'int',value:Number(req.params.versionId)},ChangedBy:{type:'int',value:req.user.userId}
  });
  res.json({success:true,data:r.recordset[0]});
}));

router.post('/product-document-version/:versionId/:fileId',requirePermissions('DOCUMENT_FILE_UPLOAD'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocumentVersion_AttachFile',{
    DocumentVersionId:{type:'int',value:Number(req.params.versionId)},FileId:{type:'bigint',value:Number(req.params.fileId)},
    FileRole:{type:'varchar',value:req.body.fileRole||'PDF'},UploadedBy:{type:'int',value:req.user.userId}
  });res.json({success:true,data:r.recordset[0]});
}));

router.get('/:fileId/view',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  const fileId=Number(req.params.fileId);
  if(!Number.isSafeInteger(fileId) || fileId<1) {
    return res.status(400).json({success:false,message:'FileId không hợp lệ.'});
  }
  if(!await canViewFile(req.user,fileId)) return res.status(403).json({success:false,message:'Bạn không có quyền xem file này.'});

  const file=await getActiveFile(fileId);
  if(!file) return res.status(404).json({success:false,message:'Không tìm thấy file.'});

  const uploadRoot=path.resolve(env.uploadDir);
  const absolutePath=path.resolve(file.StoragePath);
  const isInsideUploadRoot=absolutePath===uploadRoot || absolutePath.startsWith(`${uploadRoot}${path.sep}`);
  if(!isInsideUploadRoot) return res.status(403).json({success:false,message:'Đường dẫn file không hợp lệ.'});
  if(!fs.existsSync(absolutePath)) return res.status(404).json({success:false,message:'File vật lý không tồn tại.'});

  const safeName=encodeURIComponent(file.OriginalName || `file-${fileId}.pdf`);
  res.setHeader('Content-Type',file.MimeType || 'application/pdf');
  res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${safeName}`);
  res.setHeader('Cache-Control','private, max-age=300');
  res.sendFile(absolutePath);
}));

router.get('/:fileId/download',requireAnyPermission('DOCUMENT_VIEW_ALL','DOCUMENT_ASSIGNED_VIEW'),asyncHandler(async(req,res)=>{
  const fileId=Number(req.params.fileId);
  if(!Number.isSafeInteger(fileId) || fileId<1) {
    return res.status(400).json({success:false,message:'FileId không hợp lệ.'});
  }
  if(!await canViewFile(req.user,fileId)) return res.status(403).json({success:false,message:'Bạn không có quyền tải file này.'});
  const file=await getActiveFile(fileId);
  if(!file) return res.status(404).json({success:false,message:'Không tìm thấy file.'});
  const uploadRoot=path.resolve(env.uploadDir);
  const absolutePath=path.resolve(file.StoragePath);
  const isInsideUploadRoot=absolutePath===uploadRoot || absolutePath.startsWith(`${uploadRoot}${path.sep}`);
  if(!isInsideUploadRoot) return res.status(403).json({success:false,message:'Đường dẫn file không hợp lệ.'});
  if(!fs.existsSync(absolutePath)) return res.status(404).json({success:false,message:'File vật lý không tồn tại.'});
  res.download(absolutePath,file.OriginalName || `file-${fileId}`);
}));

module.exports=router;
