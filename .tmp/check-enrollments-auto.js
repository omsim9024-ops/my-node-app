const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'mysql', database: 'ratings' });

  const [statusRows] = await conn.query("SHOW TABLE STATUS LIKE 'enrollments'");
  const [infoRows] = await conn.query("SELECT AUTO_INCREMENT FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='ratings' AND TABLE_NAME='enrollments'");

  console.log({
    show_table_status_auto_increment: statusRows?.[0]?.Auto_increment,
    information_schema_auto_increment: infoRows?.[0]?.AUTO_INCREMENT
  });

  await conn.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});



