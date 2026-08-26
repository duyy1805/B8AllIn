const { execProc } = require('../../utils/proc');
const { getPool, sql } = require('../../config/db');

async function getDefaultUserPermissions() {
  const pool = await getPool();
  const result = await pool.request()
    .input('RoleCode', sql.VarChar(50), 'USER')
    .query(`
      SELECT permission.Code
      FROM [B8V2].[SecurityRole] role
      JOIN [B8V2].[RolePermission] rolePermission ON rolePermission.RoleId=role.Id
      JOIN [B8V2].[Permission] permission ON permission.Id=rolePermission.PermissionId
      WHERE role.Code=@RoleCode AND role.IsActive=1 AND permission.IsActive=1
      ORDER BY permission.Code
    `);
  return result.recordset.map(item => item.Code);
}

async function getUserAccess(userId) {
  const access = await execProc('B8V2.sp_UserAccess_Get', {
    UserId: { type: 'int', value: userId }
  });
  const roles = (access.recordsets?.[0] || []).map(item => item.Code);
  const permissions = (access.recordsets?.[1] || []).map(item => item.Code);

  if (roles.length) return { roles, permissions };
  return { roles: ['USER'], permissions: await getDefaultUserPermissions() };
}

module.exports = { getUserAccess };
