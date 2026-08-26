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
  const managementPermissions=[
    'DOCUMENT_VIEW_ALL','PROCESS_EDIT','PROCESS_DELETE','PROCESS_VERSION_EDIT','PROCESS_VERSION_DELETE',
    'PRODUCT_EDIT','PRODUCT_DELETE','PRODUCT_DOCUMENT_EDIT','PRODUCT_DOCUMENT_DELETE',
    'PRODUCT_DOCUMENT_VERSION_EDIT','PRODUCT_DOCUMENT_VERSION_DELETE'
  ];
  return user?.roles?.includes('ADMIN') || managementPermissions.some(permission=>user?.permissions?.includes(permission));
}

async function canViewProcessVersion(user, versionId) {
  if (canViewAll(user)) return true;
  return isProcessVersionAssignedToDepartment(user, versionId);
}

async function isProcessVersionAssignedToDepartment(user, versionId, effectiveOnly=false) {
  if (!user?.departmentId) return false;
  const pool = await getPool();
  const result = await pool.request()
    .input('VersionId', sql.Int, Number(versionId))
    .input('DepartmentId', sql.Int, Number(user.departmentId))
    .input('EffectiveOnly', sql.Bit, effectiveOnly)
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
      JOIN [B8V2].[ProcessMaster] process ON process.Id=version.ProcessId AND process.DeletedAt IS NULL
      WHERE version.Id = @VersionId AND version.PublishedAt IS NOT NULL AND version.DeletedAt IS NULL
        AND (@EffectiveOnly=0 OR version.Status='EFFECTIVE')
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
      JOIN [B8V2].[ProductDocument] document ON document.Id=version.DocumentId AND document.DeletedAt IS NULL
      WHERE version.Id = @VersionId AND version.Status = 'EFFECTIVE' AND version.DeletedAt IS NULL
    `);
  return Boolean(result.recordset[0]);
}

async function canViewFile(user, fileId) {
  const pool = await getPool();
  if (canViewAll(user)) {
    const managed = await pool.request().input('FileId', sql.BigInt, Number(fileId)).query(`
      SELECT TOP (1) 1 AS Allowed FROM
      (
        SELECT link.FileId FROM [B8V2].[ProcessVersionFile] link
        JOIN [B8V2].[ProcessVersion] version ON version.Id=link.ProcessVersionId AND version.DeletedAt IS NULL
        JOIN [B8V2].[ProcessMaster] process ON process.Id=version.ProcessId AND process.DeletedAt IS NULL
        WHERE link.FileId=@FileId
        UNION ALL
        SELECT link.FileId FROM [B8V2].[ProductDocumentVersionFile] link
        JOIN [B8V2].[ProductDocumentVersion] version ON version.Id=link.DocumentVersionId AND version.DeletedAt IS NULL
        JOIN [B8V2].[ProductDocument] document ON document.Id=version.DocumentId AND document.DeletedAt IS NULL
        WHERE link.FileId=@FileId
        UNION ALL
        SELECT evidence.FileId FROM [B8V2].[ProcessTrainingEvidence] evidence
        JOIN [B8V2].[ProcessVersionDepartmentReceipt] receipt ON receipt.Id=evidence.DepartmentReceiptId AND receipt.IsActive=1
        JOIN [B8V2].[ProcessVersion] version ON version.Id=receipt.ProcessVersionId AND version.DeletedAt IS NULL
        JOIN [B8V2].[ProcessMaster] process ON process.Id=version.ProcessId AND process.DeletedAt IS NULL
        WHERE evidence.FileId=@FileId AND evidence.IsActive=1
      ) source
    `);
    return Boolean(managed.recordset[0]);
  }
  if (!user?.departmentId) return false;
  const result = await pool.request()
    .input('FileId', sql.BigInt, Number(fileId))
    .input('DepartmentId', sql.Int, Number(user.departmentId))
    .query(`
      SELECT TOP (1) 1 AS Allowed
      FROM
      (
        SELECT processFile.FileId
        FROM [B8V2].[ProcessVersionFile] processFile
        JOIN [B8V2].[ProcessVersion] version ON version.Id = processFile.ProcessVersionId AND version.PublishedAt IS NOT NULL AND version.DeletedAt IS NULL
        JOIN [B8V2].[ProcessMaster] process ON process.Id=version.ProcessId AND process.DeletedAt IS NULL
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
        JOIN [B8V2].[ProductDocumentVersion] version ON version.Id = documentFile.DocumentVersionId AND version.Status = 'EFFECTIVE' AND version.DeletedAt IS NULL
        JOIN [B8V2].[ProductDocument] document ON document.Id=version.DocumentId AND document.DeletedAt IS NULL
        JOIN [B8V2].[ProductDocumentVersionAudience] audience
          ON audience.DocumentVersionId = version.Id AND audience.IsActive = 1
        JOIN ${departmentTable()} audienceDepartment
          ON audienceDepartment.${I(env.master.depId)} = audience.DepartmentId
        JOIN ${departmentTable()} userDepartment
          ON userDepartment.${I(env.master.depId)} = @DepartmentId
         AND ${paymentName('userDepartment')} = ${paymentName('audienceDepartment')}
        WHERE documentFile.FileId = @FileId

        UNION ALL

        SELECT evidence.FileId
        FROM [B8V2].[ProcessTrainingEvidence] evidence
        JOIN [B8V2].[ProcessVersionDepartmentReceipt] receipt
          ON receipt.Id = evidence.DepartmentReceiptId AND receipt.IsActive = 1
        JOIN [B8V2].[ProcessVersion] evidenceVersion
          ON evidenceVersion.Id = receipt.ProcessVersionId AND evidenceVersion.Status = 'EFFECTIVE' AND evidenceVersion.DeletedAt IS NULL
        JOIN [B8V2].[ProcessMaster] evidenceProcess ON evidenceProcess.Id=evidenceVersion.ProcessId AND evidenceProcess.DeletedAt IS NULL
        JOIN ${departmentTable()} evidenceDepartment
          ON evidenceDepartment.${I(env.master.depId)} = receipt.DepartmentId
        JOIN ${departmentTable()} userDepartment
          ON userDepartment.${I(env.master.depId)} = @DepartmentId
         AND ${paymentName('userDepartment')} = ${paymentName('evidenceDepartment')}
        WHERE evidence.FileId = @FileId AND evidence.IsActive = 1
      ) allowed
    `);
  return Boolean(result.recordset[0]);
}

module.exports = { canViewAll, canViewProcessVersion, isProcessVersionAssignedToDepartment, canViewProductDocumentVersion, canViewFile };
