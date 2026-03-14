const control = require('./db-control');

(async () => {
  try {
    const [rows] = await control.query('SELECT id,action,details,created_at FROM audit_logs ORDER BY id DESC LIMIT 10');
    console.log(rows);
  } catch (e) {
    console.error('error', e);
  }
  process.exit(0);
})();
