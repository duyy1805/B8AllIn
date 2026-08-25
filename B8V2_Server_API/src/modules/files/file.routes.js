const router=require('express').Router();
const path=require('path');
const fs=require('fs');
const crypto=require('crypto');
const upload=require('../../middleware/upload');
const {authRequired,requireRoles}=require('../../middleware/auth');
const {execProc}=require('../../utils/proc');
const asyncHandler=require('../../utils/asyncHandler');

router.use(authRequired);

router.post('/upload',requireRoles('DOCUMENT_CONTROLLER','EDITOR'),upload.single('file'),asyncHandler(async(req,res)=>{
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

router.post('/process-version/:versionId/:fileId',requireRoles('DOCUMENT_CONTROLLER','EDITOR'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProcessVersion_AttachFile',{
    ProcessVersionId:{type:'int',value:Number(req.params.versionId)},FileId:{type:'bigint',value:Number(req.params.fileId)},
    FileRole:{type:'varchar',value:req.body.fileRole||'PDF'}
  });res.json({success:true,data:r.recordset[0]});
}));

router.post('/product-document-version/:versionId/:fileId',requireRoles('DOCUMENT_CONTROLLER','EDITOR'),asyncHandler(async(req,res)=>{
  const r=await execProc('B8V2.sp_ProductDocumentVersion_AttachFile',{
    DocumentVersionId:{type:'int',value:Number(req.params.versionId)},FileId:{type:'bigint',value:Number(req.params.fileId)},
    FileRole:{type:'varchar',value:req.body.fileRole||'PDF'}
  });res.json({success:true,data:r.recordset[0]});
}));

module.exports=router;
