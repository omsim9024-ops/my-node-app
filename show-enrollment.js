const pool=require('./db').pool;
const id=12;
pool.promise().query('SELECT track_id, created_at, grade_to_enroll_id FROM enrollments WHERE id=?',[id])
.then(([rows])=>{console.log(rows); pool.end();})
.catch(e=>{console.error(e); pool.end();});
