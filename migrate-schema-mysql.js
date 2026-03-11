const pool = require('./db');

async function migrateSchema() {
    try {
        console.log('Starting schema migration (MySQL)...\n');
        
        // Backup existing students table if it exists
        try {
            await pool.query('DROP TABLE IF EXISTS students_backup');
            await pool.query('CREATE TABLE students_backup AS SELECT * FROM students');
            console.log('✓ Backup created');
        } catch (e) {
            console.warn('Could not create backup table (it may not exist):', e.message || e);
        }
        
        // Drop old students table if present
        try {
            await pool.query('DROP TABLE IF EXISTS students');
            console.log('✓ Old students table dropped');
        } catch (e) {
            console.warn('Could not drop students table:', e.message || e);
        }
        
        // Create new students table with MySQL compatible schema
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id VARCHAR(50) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255),
                phone VARCHAR(20),
                grade_level VARCHAR(50),
                class_id INT,
                account_status VARCHAR(20) DEFAULT 'active',
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_students_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✓ New students table created');
        
        // Migrate data from backup if present
        try {
            const [backupData] = await pool.query('SELECT * FROM students_backup');
            if (backupData && backupData.length) {
                for (const row of backupData) {
                    const names = (row.name || '').split(' ');
                    const firstName = names[0] || '';
                    const lastName = names.slice(1).join(' ') || '';
                    await pool.query(
                        `INSERT INTO students (student_id, first_name, last_name, email, phone, grade_level, class_id, account_status, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [row.student_id, firstName, lastName, row.email, row.phone, row.grade_level, row.class_id || null, 'active', row.created_at || new Date()]
                    );
                }
                console.log(`✓ Migrated ${backupData.length} student records`);
            } else {
                console.log('No backup data found, skipping data migration');
            }
        } catch (e) {
            console.warn('Skipping data migration from backup:', e.message || e);
        }

        // Drop backup table if exists (safe)
        try {
            await pool.query('DROP TABLE IF EXISTS students_backup');
            console.log('✓ Backup table dropped');
        } catch (e) { /* ignore */ }
        
        console.log('\n✅ Schema migration completed successfully!');
        // don't close the pool here in case caller continues
    } catch (err) {
        console.error('\n❌ Migration error:', err.message || err);
        try { await pool.end(); } catch(e){}
        process.exit(1);
    }
}

migrateSchema();

