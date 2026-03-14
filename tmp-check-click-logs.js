const control = require('./db-control');

(async () => {
  try {
    const [rows] = await control.query(
      "SELECT id, action, details, created_at FROM audit_logs WHERE action LIKE 'click:%' ORDER BY id DESC LIMIT 10"
    );
    console.log('click logs:', rows);
  } catch (e) {
    console.error('error querying click logs', e);
  }
  process.exit(0);
})();
