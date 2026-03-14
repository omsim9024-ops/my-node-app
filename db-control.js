const mysql = require('mysql2/promise');

// Support common deployment environment variable patterns (Railway, Docker, etc.).
// Railway typically provides a connection URL (MYSQL_URL or DATABASE_URL),
// while other setups may provide individual parts (MYSQL_HOST/DB_HOST, etc.).
function parseDatabaseUrl(urlString) {
  try {
    const url = new URL(urlString);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: url.username,
      password: url.password,
      database: url.pathname ? url.pathname.replace(/^\//, '') : ''
    };
  } catch (_err) {
    return null;
  }
}

const urlConfig = parseDatabaseUrl(process.env.MYSQL_URL || process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL);

const dbConfig = {
  host: urlConfig?.host || process.env.MYSQLHOST || process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
  user: urlConfig?.user || process.env.MYSQLUSER || process.env.MYSQL_USER || process.env.DB_USER || '',
  password: urlConfig?.password || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
  database: urlConfig?.database || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || process.env.DB_NAME || '',
  port: Number(urlConfig?.port || process.env.MYSQLPORT || process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
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
