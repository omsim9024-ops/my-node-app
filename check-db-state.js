const pool = require('./db');

async function checkDatabase() {
    try {
        console.log('Checking database state...\n');

        // Check admins
        const adminRes = await pool.query('SELECT email, name FROM admins LIMIT 10');
        console.log(`Admins (${adminRes.rows.length} total):`);
        if (adminRes.rows.length === 0) {
            console.log('  (none - no admin accounts exist)');
        } else {
            adminRes.rows.forEach(row => console.log(`  - ${row.email} (${row.name})`));
        }
        console.log();

        // Check students
        const studentRes = await pool.query('SELECT email, first_name, last_name FROM students LIMIT 10');
        console.log(`Students (${studentRes.rows.length} total):`);
        if (studentRes.rows.length === 0) {
            console.log('  (none - no student accounts exist)');
        } else {
            studentRes.rows.forEach(row => console.log(`  - ${row.email} (${row.first_name} ${row.last_name})`));
        }
        console.log();

        // Check enrollments
        const enrollRes = await pool.query('SELECT COUNT(*) FROM enrollments');
        const enrollCount = parseInt(enrollRes.rows[0].count);
        console.log(`Enrollments: ${enrollCount} total`);
        console.log();

        if (enrollCount > 0) {
            // Get sample enrollments
            const sampleEnrollRes = await pool.query(`
                SELECT e.id, e.status, e.enrollment_date,
                       e.enrollment_data::text
                FROM enrollments e LIMIT 3
            `);
            console.log('Sample Enrollments:');
            sampleEnrollRes.rows.forEach(row => {
                try {
                    const data = JSON.parse(row.enrollment_data);
                    console.log(`  - ${data.firstName || ''} ${data.lastName || ''} (${row.status}, submitted ${row.enrollment_date})`);
                } catch (e) {
                    console.log(`  - (Could not parse enrollment data)`);
                }
            });
        }

        await pool.end();
    } catch (err) {
        console.error('Error checking database:', err.message);
        process.exit(1);
    }
}

checkDatabase();


