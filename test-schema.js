const pool = require('./db');

async function checkSchema() {
    try {
        // Check if table exists and list columns
        const result = await pool.query(
            `SELECT column_name, data_type FROM information_schema.columns 
             WHERE table_name = 'registration_codes' 
             ORDER BY ordinal_position`
        );
        
        if (result.rows.length === 0) {
            console.log('❌ Table registration_codes does NOT exist!');
        } else {
            console.log('✓ Table exists. Columns:');
            result.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type}`);
            });
        }
        
        // Try to query the table
        const testResult = await pool.query('SELECT COUNT(*) as count FROM registration_codes');
        console.log('✓ Query successful. Rows in table:', testResult.rows[0].count);
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkSchema();

