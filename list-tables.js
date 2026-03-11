const pool = require('./db');

(async () => {
    try {
        // MySQL: list tables in current database
        const [res] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()");
        console.log('Tables in database:', res.map(t => t.table_name).join(', '));
        process.exit(0);
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();

