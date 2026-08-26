const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const master = require('../master/master.repository');
const crypto = require('crypto');
const { getPool } = require('../../config/db');

async function passwordOk(raw, stored) {
  const md5 = crypto
    .createHash('md5')
    .update(String(raw))
    .digest('hex');

  return md5.toLowerCase() === String(stored || '').toLowerCase();
}

async function login(username, password) {
  const user = await master.findUserByUsername(username);
  if (!user || !(await passwordOk(password, user.PasswordHash))) {
    const e = new Error('Sai tài khoản hoặc mật khẩu'); e.status = 401; throw e;
  }

  const pool = await getPool();
  const result = await pool.request().input('UserId', user.UserId).execute('B8V2.sp_UserAccess_Get');
  const roles = (result.recordsets?.[0] || []).map(x => x.Code);
  const permissions = (result.recordsets?.[1] || []).map(x => x.Code);

  const payload = {
    userId: user.UserId,
    username: user.Username,
    fullName: user.FullName,
    departmentId: user.DepartmentId,
    email: user.Email,
    roles,
    permissions
  };
  return { token: jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn }), user: payload };
}
module.exports = { login };
