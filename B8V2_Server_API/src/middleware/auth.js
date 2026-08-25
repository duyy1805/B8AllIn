const jwt = require('jsonwebtoken');
const env = require('../config/env');

function authRequired(req,res,next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'');
  if (!token) return res.status(401).json({success:false,message:'Missing token'});
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    return res.status(401).json({success:false,message:'Invalid or expired token'});
  }
}

function requireRoles(...roles) {
  return (req,res,next) => {
    const owned = req.user?.roles || [];
    if (owned.includes('ADMIN') || roles.some(r => owned.includes(r))) return next();
    return res.status(403).json({success:false,message:'Forbidden'});
  };
}

module.exports = { authRequired, requireRoles };
