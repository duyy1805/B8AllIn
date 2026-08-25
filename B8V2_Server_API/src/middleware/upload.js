const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const env = require('../config/env');

fs.mkdirSync(env.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, env.uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});

module.exports = multer({
  storage,
  limits: { fileSize: env.maxUploadMb * 1024 * 1024 }
});
