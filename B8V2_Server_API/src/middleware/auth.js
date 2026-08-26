const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getUserAccess } = require('../modules/auth/access.service');

async function authRequired(req,res,next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  if (!token) return res.status(401).json({success:false,message:'Missing token'});

  let identity;
  try {
    identity = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({success:false,message:'Invalid or expired token'});
  }

  try {
    const access = await getUserAccess(identity.userId);
    req.user = {
      ...identity,
      roles: access.roles,
      permissions: access.permissions
    };
    next();
  } catch (error) {
    next(error);
  }
}

function requirePermissions(...permissions) {
  return (req,res,next) => {
    const roles = req.user?.roles || [];
    const owned = req.user?.permissions || [];
    if (roles.includes('ADMIN') || permissions.every(permission => owned.includes(permission))) return next();
    return res.status(403).json({success:false,message:'Bạn không có quyền thực hiện thao tác này.'});
  };
}

function requireAnyPermission(...permissions) {
  return (req,res,next) => {
    const roles = req.user?.roles || [];
    const owned = req.user?.permissions || [];
    if (roles.includes('ADMIN') || permissions.some(permission => owned.includes(permission))) return next();
    return res.status(403).json({success:false,message:'Bạn không có quyền thực hiện thao tác này.'});
  };
}

module.exports = { authRequired, requirePermissions, requireAnyPermission };
