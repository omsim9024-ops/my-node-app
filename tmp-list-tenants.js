const control = require('./db-control');

(async () => {
  try {
    const [rows] = await control.query('SELECT id, code, db_name FROM tenants LIMIT 10');
    console.log('tenants', rows);
  } catch (e) {
    console.error('tenant query err', e.message);
  }
  process.exit(0);
})();
