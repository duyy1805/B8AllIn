const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getPool, sql } = require('../../config/db');
const { execProc } = require('../../utils/proc');
const master = require('../master/master.repository');

const removeFiles = files => Promise.allSettled((files || []).map(file => fs.unlink(file.path)));
const hashFile = filePath => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256'); const stream = createReadStream(filePath);
  stream.on('error', reject); stream.on('data', chunk => hash.update(chunk)); stream.on('end', () => resolve(hash.digest('hex')));
});

async function confirmTraining({ documentVersionId, user, files, comment }) {
  if (!Number.isSafeInteger(documentVersionId) || documentVersionId < 1) { const error = new Error('DocumentVersionId không hợp lệ.'); error.status = 400; throw error; }
  if (!user?.departmentId) { const error = new Error('Tài khoản không thuộc bộ phận hợp lệ.'); error.status = 403; throw error; }
  if (!files?.length) { const error = new Error('Phải tải ít nhất một file minh chứng.'); error.status = 400; throw error; }
  const pool = await getPool(); const transaction = new sql.Transaction(pool);
  try {
    const hashes = await Promise.all(files.map(file => hashFile(file.path)));
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const begin = await new sql.Request(transaction).input('DocumentVersionId', sql.Int, documentVersionId)
      .input('UserId', sql.Int, user.userId).input('DepartmentId', sql.Int, user.departmentId)
      .input('Comment', sql.NVarChar(1000), comment || null).execute('B8V2.sp_ProductTrainingConfirmation_Begin');
    const receipt = begin.recordset?.[0]; const evidence = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const created = await new sql.Request(transaction).input('OriginalName', sql.NVarChar(255), file.originalname)
        .input('StoredName', sql.NVarChar(255), file.filename).input('StoragePath', sql.NVarChar(1000), file.path.replace(/\\/g, '/'))
        .input('Extension', sql.VarChar(20), path.extname(file.originalname).slice(1).toLowerCase()).input('MimeType', sql.VarChar(100), file.mimetype)
        .input('FileSize', sql.BigInt, file.size).input('Sha256Hash', sql.VarChar(64), hashes[index]).input('UploadedBy', sql.Int, user.userId)
        .execute('B8V2.sp_File_Create');
      const attached = await new sql.Request(transaction).input('DepartmentReceiptId', sql.BigInt, receipt.Id)
        .input('FileId', sql.BigInt, created.recordset[0].Id).input('UploadedBy', sql.Int, user.userId).execute('B8V2.sp_ProductTrainingEvidence_Attach');
      evidence.push({ ...attached.recordset[0], OriginalName: file.originalname, MimeType: file.mimetype, FileSize: file.size });
    }
    const completed = await new sql.Request(transaction).input('DepartmentReceiptId', sql.BigInt, receipt.Id)
      .input('UserId', sql.Int, user.userId).execute('B8V2.sp_ProductTrainingConfirmation_Complete');
    await transaction.commit(); return { receipt: completed.recordset[0], evidence };
  } catch (error) { try { await transaction.rollback(); } catch {} await removeFiles(files); throw error; }
}

async function getDepartmentTraining(documentVersionId, departmentId) {
  const result = await execProc('B8V2.sp_ProductDocumentVersion_GetDepartmentTraining', {
    DocumentVersionId: { type: 'int', value: documentVersionId }, DepartmentId: { type: 'int', value: departmentId }
  });
  return { receipt: result.recordsets?.[0]?.[0] || null, evidence: result.recordsets?.[1] || [] };
}

async function getDepartmentProgress(documentVersionId) {
  const result = await execProc('B8V2.sp_ProductDocumentVersion_GetDepartmentProgress', { DocumentVersionId: { type: 'int', value: documentVersionId } });
  const summary = result.recordsets?.[0]?.[0] || {}; const departments = result.recordsets?.[1] || []; const evidence = result.recordsets?.[2] || [];
  const userIds = [...new Set([...departments.flatMap(item => [item.FirstViewedBy, item.LastViewedBy, item.TrainingConfirmedBy]), ...evidence.map(item => item.UploadedBy)].filter(Boolean))];
  const users = await master.getUsersByIds(userIds); const names = new Map(users.map(user => [Number(user.UserId), user.FullName || user.Username]));
  return { summary, departments: departments.map(item => ({ ...item, FirstViewedByName: names.get(Number(item.FirstViewedBy)) || null,
    LastViewedByName: names.get(Number(item.LastViewedBy)) || null, TrainingConfirmedByName: names.get(Number(item.TrainingConfirmedBy)) || null,
    evidence: evidence.filter(file => String(file.DepartmentReceiptId) === String(item.Id)).map(file => ({ ...file, UploadedByName: names.get(Number(file.UploadedBy)) || null })) })) };
}

async function deleteEvidence(evidenceId, userId) {
  const result = await execProc('B8V2.sp_ProductTrainingEvidence_Delete', { EvidenceId: { type: 'bigint', value: evidenceId }, DeletedBy: { type: 'int', value: userId } });
  return result.recordset?.[0];
}

module.exports = { confirmTraining, getDepartmentTraining, getDepartmentProgress, deleteEvidence };
