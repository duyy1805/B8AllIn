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
  const paymentName=`NULLIF(LTRIM(RTRIM(${I(m.depPaymentName)})),N'')`;
  const q=`
    SELECT
      MIN(${I(m.depId)}) AS DepartmentId,
      CAST(NULL AS NVARCHAR(100)) AS DepartmentCode,
      ${paymentName} AS DepartmentName,
      COUNT(*) AS DepartmentMemberCount
    FROM ${depTable()}
    WHERE ${paymentName} IS NOT NULL
      AND (@keyword=N'' OR ${paymentName} LIKE N'%'+@keyword+N'%')
      ${m.depActive ? `AND ISNULL(${I(m.depActive)},1)=1` : ''}
    GROUP BY ${paymentName}
    ORDER BY ${paymentName}
  `;
  return (await pool.request().input('keyword',keyword).query(q)).recordset;
}

async function listUsers({keyword='',departmentId=null}) {
  const m=env.master,pool=await getPool();
  const userAlias='account',departmentAlias='department',selectedAlias='selectedDepartment';
  const userColumn=column=>`${userAlias}.${I(column)}`;
  const departmentColumn=column=>`${departmentAlias}.${I(column)}`;
  const selectedColumn=column=>`${selectedAlias}.${I(column)}`;
  const paymentName=aliasColumn=>`NULLIF(LTRIM(RTRIM(${aliasColumn(m.depPaymentName)})),N'')`;
  const q=`
    SELECT TOP(500)
      ${userColumn(m.userId)} AS UserId,
      ${userColumn(m.username)} AS Username,
      ${userColumn(m.fullName)} AS FullName,
      ${userColumn(m.departmentId)} AS DepartmentId,
      ${paymentName(departmentColumn)} AS DepartmentName,
      ${userColumn(m.email)} AS Email
    FROM ${userTable()} ${userAlias}
    LEFT JOIN ${depTable()} ${departmentAlias}
      ON ${departmentColumn(m.depId)}=${userColumn(m.departmentId)}
    LEFT JOIN ${depTable()} ${selectedAlias}
      ON ${selectedColumn(m.depId)}=@departmentId
    WHERE (@keyword=N'' OR ${userColumn(m.username)} LIKE N'%'+@keyword+N'%' OR ${userColumn(m.fullName)} LIKE N'%'+@keyword+N'%')
      AND (@departmentId IS NULL OR ${paymentName(departmentColumn)}=${paymentName(selectedColumn)})
      ${m.active ? `AND ISNULL(${userColumn(m.active)},1)=1` : ''}
    ORDER BY ${userColumn(m.fullName)}
  `;
  return (await pool.request().input('keyword',keyword).input('departmentId',departmentId).query(q)).recordset;
}

async function getUsersByIds(userIds=[]) {
  const ids=[...new Set(userIds.map(Number).filter(Number.isSafeInteger))];
  if (!ids.length) return [];
  const m=env.master,pool=await getPool();
  const request=pool.request();
  const parameters=ids.map((id,index)=>{
    request.input(`userId${index}`,id);
    return `@userId${index}`;
  });
  const result=await request.query(`
    SELECT ${I(m.userId)} AS UserId,${I(m.username)} AS Username,${I(m.fullName)} AS FullName
    FROM ${userTable()}
    WHERE ${I(m.userId)} IN (${parameters.join(',')})
  `);
  return result.recordset;
}

module.exports={findUserByUsername,listDepartments,listUsers,getUsersByIds};
