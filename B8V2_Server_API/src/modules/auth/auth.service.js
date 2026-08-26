const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const master = require('../master/master.repository');
const crypto = require('crypto');
const { getUserAccess } = require('./access.service');

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

  const { roles, permissions } = await getUserAccess(user.UserId);

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
