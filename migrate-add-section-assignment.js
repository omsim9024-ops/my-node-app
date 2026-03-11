/**
 * Migration: Add section_id and class_id columns to enrollments table
 * These columns are needed to track which section an enrolled student is assigned to
 */

const pool = require('./db');

async function runMigration() {
    try {
        console.log('Starting migration: Adding section assignment columns to enrollments...\n');
        
        // Check if columns already exist
        const checkResult = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'enrollments' 
            AND column_name IN ('section_id', 'class_id', 'updated_at')
        `);
        
        const existingColumns = checkResult.rows.map(r => r.column_name);
        console.log('Existing columns:', existingColumns);
        
        // Add section_id if it doesn't exist
        if (!existingColumns.includes('section_id')) {
            console.log('\n→ Adding section_id column...');
            await pool.query(`
                ALTER TABLE enrollments
                ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL
            `);
            console.log('✓ Added section_id column');
        } else {
            console.log('✓ section_id column already exists');
        }
        
        // Add class_id if it doesn't exist
        if (!existingColumns.includes('class_id')) {
            console.log('→ Adding class_id column...');
            await pool.query(`
                ALTER TABLE enrollments
                ADD COLUMN class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL
            `);
            console.log('✓ Added class_id column');
        } else {
            console.log('✓ class_id column already exists');
        }
        
        // Add updated_at if it doesn't exist
        if (!existingColumns.includes('updated_at')) {
            console.log('→ Adding updated_at column...');
            await pool.query(`
                ALTER TABLE enrollments
                ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            `);
            console.log('✓ Added updated_at column');
        } else {
            console.log('✓ updated_at column already exists');
        }
        
        // Create index on section_id for faster queries
        console.log('\n→ Creating index on section_id...');
        try {
            await pool.query(`
                CREATE INDEX IF NOT EXISTS idx_enrollments_section_id
                ON enrollments(section_id)
            `);
            console.log('✓ Index created');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('✓ Index already exists');
            } else {
                throw err;
            }
        }
        
        // Verify the changes
        console.log('\n✓ Migration completed successfully!\n');
        const verifyResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'enrollments'
            ORDER BY ordinal_position
        `);
        console.log('Updated enrollments table schema:');
        verifyResult.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable === 'YES'})`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Migration error:', err.message);
        console.error('Full error:', err);
        process.exit(1);
    }
}

runMigration();

