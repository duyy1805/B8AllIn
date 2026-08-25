const { getPool, sql } = require('../../config/db');

async function getActiveFile(fileId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('FileId', sql.BigInt, fileId)
    .query(`
      SELECT TOP (1)
        Id, OriginalName, StoragePath, MimeType, FileSize
      FROM [B8V2].[FileStore]
      WHERE Id=@FileId AND IsActive=1
    `);
  return result.recordset[0] || null;
}

module.exports = { getActiveFile };
