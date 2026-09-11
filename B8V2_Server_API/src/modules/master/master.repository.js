const { getPool } = require('../../config/db');
const sql = require('mssql');
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
    SELECT ${I(m.userId)} AS UserId,${I(m.username)} AS Username,${I(m.fullName)} AS FullName,
           ${I(m.departmentId)} AS DepartmentId,${I(m.email)} AS Email
    FROM ${userTable()}
    WHERE ${I(m.userId)} IN (${parameters.join(',')})
  `);
  return result.recordset;
}

async function getEligibleMailUsers(departmentId, userIds=null) {
  const canonicalDepartmentId=Number(departmentId);
  if(!Number.isSafeInteger(canonicalDepartmentId)||canonicalDepartmentId<1) return [];
  // Mảng rỗng có nghĩa là ADMIN chủ động bỏ toàn bộ người nhận, không phải lấy tất cả.
  if(Array.isArray(userIds)&&userIds.length===0) return [];
  const m=env.master,pool=await getPool(); const request=pool.request().input('departmentId',canonicalDepartmentId);
  const userFilter=Array.isArray(userIds) && userIds.length ? `AND account.${I(m.userId)} IN (${userIds.map((id,index)=>{ request.input(`userId${index}`,Number(id)); return `@userId${index}`; }).join(',')})` : '';
  const paymentName=alias=>`NULLIF(LTRIM(RTRIM(${alias}.${I(m.depPaymentName)})),N'')`;
  const result=await request.query(`
    SELECT account.${I(m.userId)} AS UserId,account.${I(m.username)} AS Username,account.${I(m.fullName)} AS FullName,
           account.${I(m.departmentId)} AS DepartmentId,account.${I(m.email)} AS Email
    FROM ${userTable()} account
    JOIN ${depTable()} department ON department.${I(m.depId)}=account.${I(m.departmentId)}
    JOIN ${depTable()} selectedDepartment ON selectedDepartment.${I(m.depId)}=@departmentId
    WHERE ${paymentName('department')}=${paymentName('selectedDepartment')}
      AND NULLIF(LTRIM(RTRIM(account.${I(m.email)})),N'') IS NOT NULL
      ${m.active ? `AND ISNULL(account.${I(m.active)},1)=1` : ''} ${userFilter}
    ORDER BY account.${I(m.fullName)},account.${I(m.username)}`);
  return result.recordset;
}

async function updateUserEmail(userId,email,updatedBy) {
  const id=Number(userId),actorId=Number(updatedBy),normalized=String(email||'').trim().toLowerCase();
  if(!Number.isSafeInteger(id)||id<1) { const error=new Error('UserId không hợp lệ.'); error.status=400; throw error; }
  if(!Number.isSafeInteger(actorId)||actorId<1) { const error=new Error('Người cập nhật không hợp lệ.'); error.status=400; throw error; }
  if(normalized.length>320||!/^\S+@\S+\.\S+$/.test(normalized)) { const error=new Error('Địa chỉ email không hợp lệ.'); error.status=400; throw error; }

  const m=env.master,pool=await getPool(),transaction=new sql.Transaction(pool);
  await transaction.begin();
  try {
    const current=(await new sql.Request(transaction).input('userId',sql.Int,id).query(`
      SELECT ${I(m.userId)} AS UserId,${I(m.username)} AS Username,${I(m.fullName)} AS FullName,
             ${I(m.departmentId)} AS DepartmentId,${I(m.email)} AS Email
      FROM ${userTable()} WITH(UPDLOCK,HOLDLOCK)
      WHERE ${I(m.userId)}=@userId
    `)).recordset[0];
    if(!current) { const error=new Error('Không tìm thấy tài khoản.'); error.status=404; throw error; }

    await new sql.Request(transaction).input('userId',sql.Int,id).input('email',sql.NVarChar(320),normalized).query(`
      UPDATE ${userTable()} SET ${I(m.email)}=@email WHERE ${I(m.userId)}=@userId
    `);
    await new sql.Request(transaction)
      .input('updatedBy',sql.Int,actorId).input('userId',sql.Int,id)
      .input('oldData',sql.NVarChar(sql.MAX),JSON.stringify({Email:current.Email||null}))
      .input('newData',sql.NVarChar(sql.MAX),JSON.stringify({Email:normalized}))
      .query(`INSERT INTO [B8V2].[AuditLog](UserId,EntityType,EntityId,Action,OldData,NewData)
              VALUES(@updatedBy,'USER',@userId,'UPDATE_EMAIL',@oldData,@newData)`);
    await transaction.commit();
    return {...current,Email:normalized};
  } catch(error) {
    try { await transaction.rollback(); } catch {}
    throw error;
  }
}

module.exports={findUserByUsername,listDepartments,listUsers,getUsersByIds,getEligibleMailUsers,updateUserEmail};
