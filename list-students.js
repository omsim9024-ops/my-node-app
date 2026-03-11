const pool = require('./db').pool;
pool.promise().query('SELECT id, first_name, last_name FROM students LIMIT 5')
  .then(([rows]) => {
    console.log(rows);
    pool.end();
  })
  .catch(err => {
    console.error('Error querying students:', err);
    pool.end();
  });
