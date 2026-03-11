const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ratings'
  });

  const [tables] = await conn.query('SHOW TABLES');
  const tableNames = tables.map((row) => Object.values(row)[0]).filter((name) => /grade/i.test(String(name)));
  console.log('GRADE_TABLES:', tableNames);

  for (const tableName of tableNames) {
    const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
    console.log('TABLE:', tableName, 'COLUMNS:', cols.map((c) => c.Field));

    const [rows] = await conn.query(`SELECT * FROM \`${tableName}\` LIMIT 20`);
    console.log('ROWS:', rows);
  }

  await conn.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});



