const sql = require('mssql');
const env = require('./env');

let pool;

async function getPool() {
  if (pool?.connected) return pool;
  pool = await new sql.ConnectionPool(env.db).connect();
  pool.on('error', err => console.error('SQL pool error:', err));
  return pool;
}

module.exports = { sql, getPool };
