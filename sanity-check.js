console.log('ENV VARS:', {
  DB_CLIENT: process.env.DB_CLIENT,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD
});

const pool = require('./db');
(async () => {
  try {
    const [rows] = await pool.query('SELECT 1');
    console.log('DB connected:', rows);
  } catch (err) {
    console.error('connection failed:', err);
  } finally {
    process.exit();
  }
})();
