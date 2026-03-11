const pool = require('./db.js');

(async () => {
  try {
    const [tables] = await pool.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='ratings' ORDER BY TABLE_NAME`);
    console.log('Tables in ratings database:');
    tables.forEach(t => console.log('  - ' + t.TABLE_NAME));
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();


