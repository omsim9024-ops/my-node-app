const mysql = require('mysql2/promise');

// Support both `DB_*` (used in documentation) and `MYSQL*` env vars.
// If variables are missing, fail fast with a clear message.
const dbConfig = {
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || '',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || '',
  port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const missing = [];
if (!dbConfig.user) missing.push('DB_USER or MYSQLUSER');
if (!dbConfig.password) missing.push('DB_PASSWORD or MYSQLPASSWORD');
if (!dbConfig.database) missing.push('DB_NAME or MYSQLDATABASE');

if (missing.length > 0) {
  console.error('[DB] Missing required environment variables:', missing.join(', '));
  console.error('[DB] Please define them in your .env file, for example:');
  console.error('  DB_USER=your_user');
  console.error('  DB_PASSWORD=your_password');
  console.error('  DB_NAME=your_database');
  process.exit(1);
}

const pool = mysql.createPool(dbConfig);

module.exports = pool;
