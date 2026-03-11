const pool=require('./db').pool;
pool.promise().query('SHOW COLUMNS FROM students')
.then(([rows])=>{console.log(rows); pool.end();})
.catch(e=>{console.error(e); pool.end();});
