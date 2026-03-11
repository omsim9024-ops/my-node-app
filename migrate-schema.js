const pool = require('./db');

async function migrateSchema() {
    try {
        console.log('Starting schema migration...\n');
        
        // Drop the old students table and recreate with new schema
        console.log('Backing up existing data and recreating students table...');
        
        await pool.query(`
            -- Create backup table with old schema
            CREATE TABLE IF NOT EXISTS students_backup AS 
            SELECT * FROM students;
        `);
        console.log('✓ Backup created');
        
        // Drop foreign keys that reference students
        await pool.query(`
            ALTER TABLE IF EXISTS classes DROP CONSTRAINT IF EXISTS classes_teacher_id_fkey;
        `);
        console.log('✓ Foreign keys dropped');
        
        // Drop the old students table
        await pool.query(`DROP TABLE IF EXISTS students CASCADE`);
        console.log('✓ Old students table dropped');
        
        // Create new students table with correct schema
        await pool.query(`
            CREATE TABLE students (
                id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255),
                phone VARCHAR(20),
                grade_level VARCHAR(50),
                class_id INTEGER REFERENCES classes(id),
                account_status VARCHAR(20) DEFAULT 'active',
                registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ New students table created');
        
        // Migrate data from backup (split name into first_name and last_name)
        const backupData = await pool.query('SELECT * FROM students_backup');
        
        for (const row of backupData.rows) {
            const names = row.name.split(' ');
            const firstName = names[0];
            const lastName = names.slice(1).join(' ') || '';
            
            await pool.query(
                `INSERT INTO students 
                 (student_id, first_name, last_name, email, phone, grade_level, class_id, account_status, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [row.student_id, firstName, lastName, row.email, row.phone, row.grade_level, row.class_id, 'active', row.created_at]
            );
        }
        console.log(`✓ Migrated ${backupData.rows.length} student records`);
        
        // Create indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)`);
        console.log('✓ Indexes created');
        
        // Drop backup table
        await pool.query(`DROP TABLE students_backup`);
        console.log('✓ Backup table dropped');
        
        console.log('\n✅ Schema migration completed successfully!');
        
        await pool.end();
    } catch (err) {
        console.error('\n❌ Migration error:', err.message);
        await pool.end();
        process.exit(1);
    }
}

migrateSchema();

