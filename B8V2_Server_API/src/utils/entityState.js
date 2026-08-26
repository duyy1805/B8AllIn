const { getPool, sql } = require('../config/db');
const { positiveId } = require('./validation');

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

async function assertProcessVersionActive(value) {
  const id = positiveId(value, 'ProcessVersionId');
  const pool = await getPool();
  const result = await pool.request().input('Id', sql.Int, id).query(`
    SELECT TOP (1) version.Id
    FROM [B8V2].[ProcessVersion] version
    JOIN [B8V2].[ProcessMaster] process ON process.Id=version.ProcessId
    WHERE version.Id=@Id AND version.DeletedAt IS NULL AND process.DeletedAt IS NULL
  `);
  if (!result.recordset[0]) throw notFound('Phiên bản quy trình không tồn tại hoặc đã bị xóa.');
  return id;
}

async function assertProcessVersionParentActive(value) {
  const id = positiveId(value, 'ProcessVersionId');
  const pool = await getPool();
  const result = await pool.request().input('Id', sql.Int, id).query(`
    SELECT TOP (1) version.Id FROM [B8V2].[ProcessVersion] version
    JOIN [B8V2].[ProcessMaster] process ON process.Id=version.ProcessId AND process.DeletedAt IS NULL
    WHERE version.Id=@Id
  `);
  if (!result.recordset[0]) throw notFound('Quy trình cha không tồn tại hoặc đã bị xóa.');
  return id;
}

async function assertProductDocumentVersionActive(value) {
  const id = positiveId(value, 'DocumentVersionId');
  const pool = await getPool();
  const result = await pool.request().input('Id', sql.Int, id).query(`
    SELECT TOP (1) version.Id
    FROM [B8V2].[ProductDocumentVersion] version
    JOIN [B8V2].[ProductDocument] document ON document.Id=version.DocumentId
    WHERE version.Id=@Id AND version.DeletedAt IS NULL AND document.DeletedAt IS NULL
  `);
  if (!result.recordset[0]) throw notFound('Phiên bản tài liệu không tồn tại hoặc đã bị xóa.');
  return id;
}

async function assertProductDocumentVersionParentActive(value) {
  const id = positiveId(value, 'DocumentVersionId');
  const pool = await getPool();
  const result = await pool.request().input('Id', sql.Int, id).query(`
    SELECT TOP (1) version.Id FROM [B8V2].[ProductDocumentVersion] version
    JOIN [B8V2].[ProductDocument] document ON document.Id=version.DocumentId AND document.DeletedAt IS NULL
    WHERE version.Id=@Id
  `);
  if (!result.recordset[0]) throw notFound('Tài liệu cha không tồn tại hoặc đã bị xóa.');
  return id;
}

module.exports = { assertProcessVersionActive, assertProcessVersionParentActive, assertProductDocumentVersionActive, assertProductDocumentVersionParentActive };
