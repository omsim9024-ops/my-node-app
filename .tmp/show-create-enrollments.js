const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ratings'
  });

  const [rows] = await conn.query('SHOW CREATE TABLE enrollments');
  console.log(rows[0]['Create Table']);

  await conn.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});



