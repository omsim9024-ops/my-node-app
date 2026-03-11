const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ratings'
  });

  const [rows] = await conn.query('SELECT id, grade_to_enroll_id, enrollment_data FROM enrollments WHERE tenant_id = 1 ORDER BY id DESC LIMIT 10');

  for (const row of rows) {
    let parsed = null;
    try {
      parsed = typeof row.enrollment_data === 'string' ? JSON.parse(row.enrollment_data) : row.enrollment_data;
    } catch (_) {
      parsed = null;
    }

    console.log('ID', row.id, {
      grade_to_enroll_id: row.grade_to_enroll_id,
      data_gradeLevel: parsed && parsed.gradeLevel,
      data_gradelevel: parsed && parsed.gradelevel,
      data_lastGradeLevel: parsed && parsed.lastGradeLevel,
      data_keys: parsed ? Object.keys(parsed).slice(0, 20) : null
    });
  }

  await conn.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});



