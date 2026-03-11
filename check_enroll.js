const pool=require('./db');
(async()=>{
 try{
  const [rows]=await pool.query('SELECT id,lastname,firstname,enrollment_data FROM enrollments WHERE student_id=5');
  console.log('db query result', rows);
 }catch(e){console.error('query error',e);}finally{process.exit();}
})();

