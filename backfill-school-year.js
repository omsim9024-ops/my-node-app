const pool = require('./db');

async function run() {
  try {
    const [activeRows] = await pool.query('SELECT id FROM school_years WHERE is_active = true LIMIT 1');
    if (!activeRows || activeRows.length === 0) {
      console.error('No active school year found. Aborting backfill.');
      process.exit(1);
    }
    const activeId = activeRows[0].id;
    console.log('Active school_year id:', activeId);

    const [enrollCountRows] = await pool.query('SELECT COUNT(*) AS cnt FROM enrollments WHERE school_year_id IS NULL');
    console.log('Enrollments without school_year_id:', enrollCountRows[0].cnt);

    if (parseInt(enrollCount.rows[0].cnt) > 0) {
      const [upd] = await pool.query('UPDATE enrollments SET school_year_id = ? WHERE school_year_id IS NULL', [activeId]);
      console.log('Updated enrollments:', upd.affectedRows);
    } else {
      console.log('No enrollments to update.');
    }

    const [studentsCountRows] = await pool.query('SELECT COUNT(*) AS cnt FROM students WHERE school_year_id IS NULL');
    console.log('Students without school_year_id:', studentsCountRows[0].cnt);

    if (parseInt(studentsCount.rows[0].cnt) > 0) {
      const [upd2] = await pool.query('UPDATE students SET school_year_id = ? WHERE school_year_id IS NULL', [activeId]);
      console.log('Updated students:', upd2.affectedRows);
    } else {
      console.log('No students to update.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error during backfill:', err.message || err);
    process.exit(1);
  }
}

run();


