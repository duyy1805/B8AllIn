const { getPool } = require('../../config/db');
const env = require('../../config/env');
const { safeIdentifier: I } = require('../../utils/sqlName');

function userTable() {
  const m=env.master;
  return `${I(m.database)}.${I(m.userSchema)}.${I(m.userTable)}`;
}
function depTable() {
  const m=env.master;
  return `${I(m.database)}.${I(m.depSchema)}.${I(m.depTable)}`;
}

async function findUserByUsername(username) {
  const m=env.master, pool=await getPool();
  const q=`
    SELECT TOP(1)
      ${I(m.userId)} AS UserId,
      ${I(m.username)} AS Username,
      ${I(m.password)} AS PasswordHash,
      ${I(m.fullName)} AS FullName,
      ${I(m.departmentId)} AS DepartmentId,
      ${I(m.email)} AS Email
    FROM ${userTable()}
    WHERE ${I(m.username)}=@username
      ${m.active ? `AND ISNULL(${I(m.active)},1)=1` : ''}
  `;
  return (await pool.request().input('username',username).query(q)).recordset[0] || null;
}

async function listDepartments(keyword='') {
  const m=env.master,pool=await getPool();
  const q=`
    SELECT
      ${I(m.depId)} AS DepartmentId,
      ${I(m.depCode)} AS DepartmentCode,
      ${I(m.depName)} AS DepartmentName
    FROM ${depTable()}
    WHERE (@keyword=N'' OR ${I(m.depCode)} LIKE N'%'+@keyword+N'%' OR ${I(m.depName)} LIKE N'%'+@keyword+N'%')
      ${m.depActive ? `AND ISNULL(${I(m.depActive)},1)=1` : ''}
    ORDER BY ${I(m.depName)}
  `;
  return (await pool.request().input('keyword',keyword).query(q)).recordset;
}

async function listUsers({keyword='',departmentId=null}) {
  const m=env.master,pool=await getPool();
  const q=`
    SELECT TOP(500)
      ${I(m.userId)} AS UserId,
      ${I(m.username)} AS Username,
      ${I(m.fullName)} AS FullName,
      ${I(m.departmentId)} AS DepartmentId,
      ${I(m.email)} AS Email
    FROM ${userTable()}
    WHERE (@keyword=N'' OR ${I(m.username)} LIKE N'%'+@keyword+N'%' OR ${I(m.fullName)} LIKE N'%'+@keyword+N'%')
      AND (@departmentId IS NULL OR ${I(m.departmentId)}=@departmentId)
      ${m.active ? `AND ISNULL(${I(m.active)},1)=1` : ''}
    ORDER BY ${I(m.fullName)}
  `;
  return (await pool.request().input('keyword',keyword).input('departmentId',departmentId).query(q)).recordset;
}

module.exports={findUserByUsername,listDepartments,listUsers};
