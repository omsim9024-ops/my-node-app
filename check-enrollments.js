const pool = require('./db');

async function run() {
  try {
    const active = await pool.query('SELECT id, school_year, is_active FROM school_years WHERE is_active = true LIMIT 1');
    console.log('Active school year rows:', active.rows);

    const countRes = await pool.query('SELECT COUNT(*) AS cnt FROM enrollments');
    console.log('Total enrollments:', countRes.rows[0].cnt);

    const sample = await pool.query('SELECT id, enrollment_id, student_id, status, enrollment_date, school_year_id FROM enrollments ORDER BY enrollment_date DESC LIMIT 5');
    console.log('Sample enrollments:', sample.rows);

    process.exit(0);
  } catch (err) {
    console.error('DB Error:', err.message || err);
    process.exit(1);
  }
}

run();


