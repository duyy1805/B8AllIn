const { getPool, sql } = require('../../config/db');
const env = require('../../config/env');
const { safeIdentifier: I } = require('../../utils/sqlName');

function departmentTable() {
  const master=env.master;
  return `${I(master.database)}.${I(master.depSchema)}.${I(master.depTable)}`;
}

function paymentName(alias) {
  return `NULLIF(LTRIM(RTRIM(${alias}.${I(env.master.depPaymentName)})),N'')`;
}

function canViewAll(user) {
  return user?.roles?.includes('ADMIN') || user?.permissions?.includes('DOCUMENT_VIEW_ALL');
}

async function canViewProcessVersion(user, versionId) {
  if (canViewAll(user)) return true;
  if (!user?.departmentId) return false;
  const pool = await getPool();
  const result = await pool.request()
    .input('VersionId', sql.Int, Number(versionId))
    .input('DepartmentId', sql.Int, Number(user.departmentId))
    .query(`
      SELECT TOP (1) 1 AS Allowed
      FROM [B8V2].[ProcessVersion] version
      JOIN [B8V2].[ProcessVersionAudience] audience
        ON audience.ProcessVersionId = version.Id
       AND audience.IsActive = 1
      JOIN ${departmentTable()} audienceDepartment
        ON audienceDepartment.${I(env.master.depId)} = audience.DepartmentId
      JOIN ${departmentTable()} userDepartment
        ON userDepartment.${I(env.master.depId)} = @DepartmentId
       AND ${paymentName('userDepartment')} = ${paymentName('audienceDepartment')}
      WHERE version.Id = @VersionId AND version.Status = 'EFFECTIVE'
    `);
  return Boolean(result.recordset[0]);
}

async function canViewProductDocumentVersion(user, versionId) {
  if (canViewAll(user)) return true;
  if (!user?.departmentId) return false;
  const pool = await getPool();
  const result = await pool.request()
    .input('VersionId', sql.Int, Number(versionId))
    .input('DepartmentId', sql.Int, Number(user.departmentId))
    .query(`
      SELECT TOP (1) 1 AS Allowed
      FROM [B8V2].[ProductDocumentVersion] version
      JOIN [B8V2].[ProductDocumentVersionAudience] audience
        ON audience.DocumentVersionId = version.Id
       AND audience.IsActive = 1
      JOIN ${departmentTable()} audienceDepartment
        ON audienceDepartment.${I(env.master.depId)} = audience.DepartmentId
      JOIN ${departmentTable()} userDepartment
        ON userDepartment.${I(env.master.depId)} = @DepartmentId
       AND ${paymentName('userDepartment')} = ${paymentName('audienceDepartment')}
      WHERE version.Id = @VersionId AND version.Status = 'EFFECTIVE'
    `);
  return Boolean(result.recordset[0]);
}

async function canViewFile(user, fileId) {
  if (canViewAll(user)) return true;
  if (!user?.departmentId) return false;
  const pool = await getPool();
  const result = await pool.request()
    .input('FileId', sql.BigInt, Number(fileId))
    .input('DepartmentId', sql.Int, Number(user.departmentId))
    .query(`
      SELECT TOP (1) 1 AS Allowed
      FROM
      (
        SELECT processFile.FileId
        FROM [B8V2].[ProcessVersionFile] processFile
        JOIN [B8V2].[ProcessVersion] version ON version.Id = processFile.ProcessVersionId AND version.Status = 'EFFECTIVE'
        JOIN [B8V2].[ProcessVersionAudience] audience
          ON audience.ProcessVersionId = version.Id AND audience.IsActive = 1
        JOIN ${departmentTable()} audienceDepartment
          ON audienceDepartment.${I(env.master.depId)} = audience.DepartmentId
        JOIN ${departmentTable()} userDepartment
          ON userDepartment.${I(env.master.depId)} = @DepartmentId
         AND ${paymentName('userDepartment')} = ${paymentName('audienceDepartment')}
        WHERE processFile.FileId = @FileId

        UNION ALL

        SELECT documentFile.FileId
        FROM [B8V2].[ProductDocumentVersionFile] documentFile
        JOIN [B8V2].[ProductDocumentVersion] version ON version.Id = documentFile.DocumentVersionId AND version.Status = 'EFFECTIVE'
        JOIN [B8V2].[ProductDocumentVersionAudience] audience
          ON audience.DocumentVersionId = version.Id AND audience.IsActive = 1
        JOIN ${departmentTable()} audienceDepartment
          ON audienceDepartment.${I(env.master.depId)} = audience.DepartmentId
        JOIN ${departmentTable()} userDepartment
          ON userDepartment.${I(env.master.depId)} = @DepartmentId
         AND ${paymentName('userDepartment')} = ${paymentName('audienceDepartment')}
        WHERE documentFile.FileId = @FileId
      ) allowed
    `);
  return Boolean(result.recordset[0]);
}

module.exports = { canViewAll, canViewProcessVersion, canViewProductDocumentVersion, canViewFile };
