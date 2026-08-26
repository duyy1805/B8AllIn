const { getPool, sql } = require('../../config/db');
const env = require('../../config/env');
const { safeIdentifier: I } = require('../../utils/sqlName');

function departmentTable() {
  const master = env.master;
  return `${I(master.database)}.${I(master.depSchema)}.${I(master.depTable)}`;
}

function paymentName(alias) {
  return `NULLIF(LTRIM(RTRIM(${alias}.${I(env.master.depPaymentName)})),N'')`;
}

async function getAssignedProcessVersions({ processId, departmentId }) {
  if (!Number.isSafeInteger(processId) || processId < 1 || !Number.isSafeInteger(departmentId) || departmentId < 1) {
    const error = new Error('Thông tin quy trình hoặc bộ phận không hợp lệ.'); error.status = 400; throw error;
  }
  const pool = await getPool();
  const result = await pool.request()
    .input('ProcessId', sql.Int, processId)
    .input('DepartmentId', sql.Int, departmentId)
    .query(`
      SELECT process.Id,process.ProcessCode,process.ProcessName,process.OwnerDepartmentId,process.Status,
             ${paymentName('ownerDepartment')} AS OwnerDepartmentName
      FROM [B8V2].[ProcessMaster] process
      LEFT JOIN ${departmentTable()} ownerDepartment
        ON ownerDepartment.${I(env.master.depId)}=process.OwnerDepartmentId
      WHERE process.Id=@ProcessId AND process.DeletedAt IS NULL
        AND EXISTS
        (
          SELECT 1
          FROM [B8V2].[ProcessVersion] version
          JOIN [B8V2].[ProcessVersionAudience] audience ON audience.ProcessVersionId=version.Id AND audience.IsActive=1
          JOIN ${departmentTable()} audienceDepartment ON audienceDepartment.${I(env.master.depId)}=audience.DepartmentId
          JOIN ${departmentTable()} userDepartment ON userDepartment.${I(env.master.depId)}=@DepartmentId
          WHERE version.ProcessId=process.Id AND version.PublishedAt IS NOT NULL AND version.DeletedAt IS NULL
            AND ${paymentName('audienceDepartment')}=${paymentName('userDepartment')}
        );

      SELECT version.Id,version.ProcessId,version.VersionNo,version.VersionCode,version.Title,
             version.IssueDate,version.EffectiveDate,version.ExpiryDate,version.ChangeSummary,
             version.Status,version.PublishedAt
      FROM [B8V2].[ProcessVersion] version
      WHERE version.ProcessId=@ProcessId AND version.PublishedAt IS NOT NULL AND version.DeletedAt IS NULL
        AND EXISTS
        (
          SELECT 1
          FROM [B8V2].[ProcessVersionAudience] audience
          JOIN ${departmentTable()} audienceDepartment ON audienceDepartment.${I(env.master.depId)}=audience.DepartmentId
          JOIN ${departmentTable()} userDepartment ON userDepartment.${I(env.master.depId)}=@DepartmentId
          WHERE audience.ProcessVersionId=version.Id AND audience.IsActive=1
            AND ${paymentName('audienceDepartment')}=${paymentName('userDepartment')}
        )
      ORDER BY version.VersionNo DESC;

      SELECT link.ProcessVersionId,link.FileId,link.FileRole,fileStore.OriginalName,
             fileStore.MimeType,fileStore.FileSize
      FROM [B8V2].[ProcessVersionFile] link
      JOIN [B8V2].[FileStore] fileStore ON fileStore.Id=link.FileId AND fileStore.IsActive=1
      JOIN [B8V2].[ProcessVersion] version ON version.Id=link.ProcessVersionId
      WHERE version.ProcessId=@ProcessId AND version.PublishedAt IS NOT NULL AND version.DeletedAt IS NULL
        AND EXISTS
        (
          SELECT 1
          FROM [B8V2].[ProcessVersionAudience] audience
          JOIN ${departmentTable()} audienceDepartment ON audienceDepartment.${I(env.master.depId)}=audience.DepartmentId
          JOIN ${departmentTable()} userDepartment ON userDepartment.${I(env.master.depId)}=@DepartmentId
          WHERE audience.ProcessVersionId=version.Id AND audience.IsActive=1
            AND ${paymentName('audienceDepartment')}=${paymentName('userDepartment')}
        );
    `);
  const process = result.recordsets?.[0]?.[0] || null;
  const files = result.recordsets?.[2] || [];
  return {
    process,
    versions: (result.recordsets?.[1] || []).map(version => ({
      ...version,
      files: files.filter(file => file.ProcessVersionId === version.Id)
    }))
  };
}

module.exports = { getAssignedProcessVersions };
