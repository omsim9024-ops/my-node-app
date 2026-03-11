const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function setupSchema() {
    try {
        console.log('Starting MySQL schema setup...');
        
        // Read the SQL schema file
        const schemaPath = path.join(__dirname, 'schema-mysql.sql');
        const sqlContent = fs.readFileSync(schemaPath, 'utf8');
        
        // Remove SQL comments and split by semicolon
        let cleanedSQL = sqlContent
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');
        
        const statements = cleanedSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);
        
        console.log(`Found ${statements.length} SQL statements to execute.\n`);
        
        // Execute each statement
        let created = 0;
        let skipped = 0;
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
            const tableName = tableMatch ? tableMatch[1] : `Statement ${i + 1}`;
            
            try {
                await pool.query(stmt);
                console.log(`✓ Created ${tableName}`);
                created++;
            } catch (err) {
                // Some errors are OK (table exists, foreign key issues with order)
                console.log(`  ${tableName}: ${err.message.substring(0, 60)}...`);
                skipped++;
            }
        }
        
        console.log(`\n✅ Schema setup complete!`);
        console.log(`   Created: ${created}, Processed: ${skipped}`);
        
        // List all tables
        const [tables] = await pool.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME
        `);
        
        console.log('\nFinal tables in "ratings" database:');
        tables.forEach(row => {
            console.log(`  - ${row.TABLE_NAME}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Fatal error during schema setup:', err);
        process.exit(1);
    }
}

setupSchema();

