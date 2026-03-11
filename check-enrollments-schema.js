const mysql = require('mysql2/promise');

(async ()=>{
    try {
        const conn = await mysql.createConnection({host:'localhost',user:'root',password:'mysql',database:'ratings'});
        const [rows] = await conn.query('SHOW COLUMNS FROM enrollments');
        console.log('Enrollments schema columns:');
        rows.forEach(r => console.log(r.Field, r.Type));
        console.log('total rows', rows.length);
        await conn.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
})();


