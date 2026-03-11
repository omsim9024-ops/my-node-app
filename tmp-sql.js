const mysql = require('mysql2/promise');
(async()=>{
  const conn = await mysql.createConnection({host:'localhost',user:'root',password:'mysql',database:'ratings'});
  const [rows] = await conn.query("SELECT id,school_year_id,created_at FROM enrollments e WHERE (e.school_year_id = (SELECT id FROM school_years WHERE is_active = true LIMIT 1) OR e.school_year_id IS NULL) ORDER BY e.created_at DESC LIMIT 10;");
  console.log(rows);
  await conn.end();
})();

