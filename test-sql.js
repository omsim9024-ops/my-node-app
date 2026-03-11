const pool=require('./db');
(async()=>{
 try{
  const [rows]=await pool.query("SELECT CONCAT(first_name, ' ', last_name) AS name, email FROM advisers LIMIT 1");
  console.log(rows);
 }catch(e){console.error(e)}
 process.exit();
})();