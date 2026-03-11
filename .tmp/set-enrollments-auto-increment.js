const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ratings'
  });

  const [[maxId]] = await conn.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM enrollments');
  const nextId = Number(maxId.max_id) + 1;

  await conn.query(`ALTER TABLE enrollments AUTO_INCREMENT = ${nextId}`);

  const [[autoRow]] = await conn.query(
    "SELECT AUTO_INCREMENT AS next_auto_increment FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='ratings' AND TABLE_NAME='enrollments'"
  );

  console.log({ max_id: maxId.max_id, next_auto_increment: autoRow.next_auto_increment });

  await conn.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});



