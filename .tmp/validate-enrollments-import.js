const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ratings'
  });

  const [[total]] = await conn.query('SELECT COUNT(*) AS total FROM enrollments');
  const [[duplicateGroups]] = await conn.query(
    'SELECT COUNT(*) AS duplicate_groups FROM (SELECT id, COUNT(*) AS c FROM enrollments GROUP BY id HAVING COUNT(*) > 1) AS d'
  );
  const [[badSchoolYearFk]] = await conn.query(
    'SELECT COUNT(*) AS bad_school_year_fk FROM enrollments e LEFT JOIN school_years sy ON sy.id = e.school_year_id WHERE e.school_year_id IS NOT NULL AND sy.id IS NULL'
  );
  const [[maxId]] = await conn.query('SELECT MAX(id) AS max_id FROM enrollments');
  const [[nextAutoIncrement]] = await conn.query(
    "SELECT AUTO_INCREMENT AS next_auto_increment FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='ratings' AND TABLE_NAME='enrollments'"
  );
  const [[jsonSample]] = await conn.query(
    'SELECT JSON_VALID(enrollment_data) AS sample_json_valid FROM enrollments WHERE enrollment_data IS NOT NULL LIMIT 1'
  );

  console.log({
    total: total.total,
    duplicate_groups: duplicateGroups.duplicate_groups,
    bad_school_year_fk: badSchoolYearFk.bad_school_year_fk,
    max_id: maxId.max_id,
    next_auto_increment: nextAutoIncrement.next_auto_increment,
    sample_json_valid: jsonSample ? jsonSample.sample_json_valid : null
  });

  await conn.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});



