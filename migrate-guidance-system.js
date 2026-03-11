/**
 * Migration script for Guidance Dashboard System
 * Creates tables for guidance requests, messages, and at-risk tracking
 */

const pool = require('./db');

async function migrate() {
    try {
        console.log('[Migration] Starting guidance system migration...');

        // Ensure a minimal `users` table exists for foreign key references
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255) UNIQUE,
                role VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[Migration] ✅ ensured users table exists (minimal)');

        // 1. Create guidance_requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guidance_requests (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                reason VARCHAR(100) NOT NULL,
                preferred_date DATE,
                preferred_time TIME,
                message TEXT,
                status VARCHAR(50) DEFAULT 'Pending',
                guidance_counselor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                internal_notes TEXT,
                appointment_date DATE,
                appointment_time TIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );
        `);
        console.log('[Migration] ✅ guidance_requests table created');

        // 2. Create guidance_messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guidance_messages (
                id SERIAL PRIMARY KEY,
                guidance_request_id INTEGER NOT NULL REFERENCES guidance_requests(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(id),
                sender_type VARCHAR(50),
                message_content TEXT NOT NULL,
                is_visible_to_student BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP
            );
        `);
        console.log('[Migration] ✅ guidance_messages table created');

        // 3. Create student_risk_flags table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS student_risk_flags (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                flag_type VARCHAR(100),
                flag_reason TEXT,
                severity VARCHAR(50),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                resolved_by INTEGER REFERENCES users(id)
            );
        `);
        console.log('[Migration] ✅ student_risk_flags table created');

        // 4. Create guidance_sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guidance_sessions (
                id SERIAL PRIMARY KEY,
                guidance_request_id INTEGER NOT NULL REFERENCES guidance_requests(id) ON DELETE CASCADE,
                session_date DATE NOT NULL,
                session_time TIME NOT NULL,
                session_notes TEXT,
                student_attended BOOLEAN,
                outcomes TEXT,
                next_follow_up DATE,
                counselor_id INTEGER NOT NULL REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('[Migration] ✅ guidance_sessions table created');

        // 5. Add guidance_counselor_id to users table if it doesn't exist
        const checkColumn = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='users' AND column_name='guidance_counselor'
        `);
        
        if (checkColumn.rows.length === 0) {
            await pool.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS guidance_counselor BOOLEAN DEFAULT false
            `);
            console.log('[Migration] ✅ Added guidance_counselor column to users table');
        }

        // 6. Create indexes for performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_guidance_requests_student 
            ON guidance_requests(student_id);
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_guidance_requests_status 
            ON guidance_requests(status);
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_risk_flags_student 
            ON student_risk_flags(student_id);
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_risk_flags_active 
            ON student_risk_flags(is_active);
        `);
        console.log('[Migration] ✅ Indexes created');

        console.log('[Migration] ✅ Guidance system migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('[Migration] ❌ Error:', err.message);
        process.exit(1);
    }
}

migrate();

