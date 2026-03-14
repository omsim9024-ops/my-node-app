const control = require('./db-control');

(async () => {
  try {
    const [rows] = await control.query('SELECT COUNT(*) AS c FROM audit_logs');
    console.log('control audit count', rows[0].c);
  } catch (e) {
    console.error('control audit query err', e.message);
  }
  process.exit(0);
})();
