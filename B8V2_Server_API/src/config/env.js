require('dotenv').config();

const required = ['DB_SERVER','DB_NAME','DB_USER','DB_PASSWORD','JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);
}

module.exports = {
  port: Number(process.env.PORT || 3100),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 50),
  db: {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE).toLowerCase() !== 'false'
    },
    pool: { max: 20, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 60000
  },
  master: {
    database: process.env.MASTER_DATABASE || 'TAG_SYSTEM',
    userSchema: process.env.MASTER_USER_SCHEMA || 'dbo',
    userTable: process.env.MASTER_USER_TABLE || 'TaiKhoanDangNhap',
    userId: process.env.MASTER_USER_ID_COLUMN || 'ID_TaiKhoanDangNhap',
    username: process.env.MASTER_USERNAME_COLUMN || 'TenDangNhap',
    password: process.env.MASTER_PASSWORD_COLUMN || 'MatKhau',
    fullName: process.env.MASTER_FULLNAME_COLUMN || 'HoTen',
    departmentId: process.env.MASTER_DEPARTMENT_COLUMN || 'ID_DonVi',
    email: process.env.MASTER_EMAIL_COLUMN || 'Email',
    active: process.env.MASTER_ACTIVE_COLUMN || 'TonTai',
    depSchema: process.env.MASTER_DEPARTMENT_SCHEMA || 'dbo',
    depTable: process.env.MASTER_DEPARTMENT_TABLE || 'DM_DonVi',
    depId: process.env.MASTER_DEPARTMENT_ID_COLUMN || 'ID_DonVi',
    depCode: process.env.MASTER_DEPARTMENT_CODE_COLUMN || 'Ma_DonVi',
    depName: process.env.MASTER_DEPARTMENT_NAME_COLUMN || 'Ten_DonVi',
    depActive: process.env.MASTER_DEPARTMENT_ACTIVE_COLUMN || 'TonTai'
  },
  authPasswordMode: process.env.AUTH_PASSWORD_MODE || 'plain'
};
