const pool = require('./db.js');

(async () => {
  try {
    const [grades] = await pool.query('SELECT * FROM grades LIMIT 20');
    console.log('Grades in database:');
    console.log(grades);
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();


