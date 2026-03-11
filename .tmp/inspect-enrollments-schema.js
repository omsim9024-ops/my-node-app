const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ratings'
  });

  const [columns] = await conn.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='ratings' AND TABLE_NAME='enrollments' ORDER BY ORDINAL_POSITION"
  );

  const [fks] = await conn.query(
    "SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='ratings' AND TABLE_NAME='enrollments' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY COLUMN_NAME"
  );

  const [countRows] = await conn.query('SELECT COUNT(*) AS total FROM enrollments');

  console.log('COLUMNS:', columns.map((row) => row.COLUMN_NAME).join(', '));
  console.log('FKS:', fks);
  console.log('CURRENT_TOTAL:', countRows[0].total);

  await conn.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});



