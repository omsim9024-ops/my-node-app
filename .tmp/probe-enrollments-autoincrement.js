const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'mysql', database: 'ratings' });

  try {
    const [result] = await conn.query(
      "INSERT INTO enrollments (lastname, firstname, birthdate, sex) VALUES ('__AUTO_PROBE__', '__AUTO_PROBE__', '2000-01-01', 'Male')"
    );

    const insertedId = result.insertId;
    await conn.query('DELETE FROM enrollments WHERE id = ?', [insertedId]);

    const [statusRows] = await conn.query("SHOW TABLE STATUS LIKE 'enrollments'");

    console.log({
      probe_insert_id: insertedId,
      show_table_status_auto_increment_after_probe: statusRows?.[0]?.Auto_increment
    });
  } catch (error) {
    console.error('PROBE_FAILED');
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();



