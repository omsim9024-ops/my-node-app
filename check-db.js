const pool = require('./db');

async function checkDatabase() {
    try {
        console.log('Checking compostela_sms database...\n');

        // Check if tables exist
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;
        
        const result = await pool.query(tablesQuery);
        
        if (result.rows.length === 0) {
            console.log('❌ No tables found. Database needs initialization.');
            console.log('\nRun: node init-db.js');
        } else {
            console.log('✅ Found tables in compostela_sms database:');
            result.rows.forEach(row => {
                console.log(`   - ${row.table_name}`);
            });
            
            // Count records in students table
            const studentCount = await pool.query('SELECT COUNT(*) as count FROM students');
            console.log(`\n   Students: ${studentCount.rows[0].count} records`);
            
            const enrollmentCount = await pool.query('SELECT COUNT(*) as count FROM enrollments');
            console.log(`   Enrollments: ${enrollmentCount.rows[0].count} records`);
        }
        
        await pool.end();
    } catch (err) {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    }
}

checkDatabase();


