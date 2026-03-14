const pool = require('./db');

async function tableExists(tableName) {
    const [rows] = await pool.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?
         LIMIT 1`,
        [tableName]
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function tableHasColumn(tableName, columnName) {
    const [rows] = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
         LIMIT 1`,
        [tableName, columnName]
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function ensureTenantColumn(tableName) {
    if (!(await tableExists(tableName))) return false;
    if (await tableHasColumn(tableName, 'tenant_id')) return true;
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN tenant_id INT NULL`);
    return true;
}

// Initialize database tables
async function initializeDatabase() {
    // wait briefly for the pool constructor to finish
    await new Promise(resolve => setTimeout(resolve, 500));

    // quick sanity check: can we talk to the database at all?
    try {
        await pool.query('SELECT 1');
    } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.error('Database connection refused. Is the MySQL/PG server running and are your .env values correct?');
            return; // skip further initialization
        }
        // rethrow other errors
        throw err;
    }

    // If the environment indicates we are using MySQL, we assume the
    // schema is managed externally (e.g. via phpMyAdmin) and skip the
    // PostgreSQL-specific DDL.  This prevents syntax errors such as
    // SERIAL/JSONB in a MySQL server.
    if ((process.env.DB_CLIENT || '').toLowerCase().includes('mysql')) {
        console.log('Database client is MySQL; performing MySQL-specific initialization.');

        // bootstrap multi-tenant support in a backward-compatible way
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS tenants (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    code VARCHAR(80) NOT NULL UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    is_default TINYINT(1) NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_tenants_status (status),
                    INDEX idx_tenants_default (is_default)
                )
            `);

            const defaultTenantCode = String(process.env.DEFAULT_TENANT_CODE || process.env.SCHOOL_CODE || 'default-school')
                .trim()
                .toLowerCase();
            const defaultTenantName = String(process.env.DEFAULT_TENANT_NAME || process.env.SCHOOL_NAME || 'Default School').trim();

            await pool.query(
                `INSERT INTO tenants (code, name, status, is_default)
                 SELECT ?, ?, 'active', 1
                 WHERE NOT EXISTS (
                    SELECT 1 FROM tenants WHERE LOWER(code) = LOWER(?)
                 )`,
                [defaultTenantCode, defaultTenantName, defaultTenantCode]
            );

            await pool.query(
                `UPDATE tenants
                 SET is_default = CASE WHEN LOWER(code) = LOWER(?) THEN 1 ELSE 0 END`,
                [defaultTenantCode]
            );

            const [tenantRows] = await pool.query(
                `SELECT id
                 FROM tenants
                 WHERE status = 'active'
                 ORDER BY is_default DESC, id ASC
                 LIMIT 1`
            );
            const defaultTenantId = Number(tenantRows?.[0]?.id || 0);

            const tenantScopedTables = [
                'admins',
                'students',
                'teachers',
                'sections',
                'enrollments',
                'school_years',
                'classes',
                'grades',
                'notifications',
                'registration_codes',
                'teacher_section_assignments',
                'teacher_subject_assignments',
                'adviser_section_assignments'
            ];

            for (const tableName of tenantScopedTables) {
                const added = await ensureTenantColumn(tableName);
                if (!added) continue;
                if (defaultTenantId > 0) {
                    await pool.query(
                        `UPDATE \`${tableName}\`
                         SET tenant_id = ?
                         WHERE tenant_id IS NULL`,
                        [defaultTenantId]
                    );
                }
            }
        } catch (err) {
            console.warn('MySQL init: failed to bootstrap multi-tenant schema', err.code || err.message);
        }

        // ensure important columns and helper tables exist even if schema was manually created
        try {
            // add missing columns by inspecting information_schema first (avoids syntax differences)
            const [cols] = await pool.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'enrollments'");
            const colNames = cols.map(c => c.COLUMN_NAME.toLowerCase());
            if (!colNames.includes('status')) {
                await pool.query("ALTER TABLE enrollments ADD COLUMN status VARCHAR(20) DEFAULT 'Pending'");
            }
            if (!colNames.includes('remarks')) {
                await pool.query("ALTER TABLE enrollments ADD COLUMN remarks TEXT");
            }
            if (!colNames.includes('enrollment_date')) {
                await pool.query("ALTER TABLE enrollments ADD COLUMN enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
            }
            if (!colNames.includes('enrollment_data')) {
                await pool.query("ALTER TABLE enrollments ADD COLUMN enrollment_data JSON NULL AFTER student_id");
            }
        } catch (err) {
            console.warn('MySQL init: could not alter enrollments table', err.code || err.message);
        }

        // create advisers table if missing (legacy separate advisers vs teachers)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS advisers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    adviser_id VARCHAR(50) UNIQUE NOT NULL,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    phone VARCHAR(20),
                    account_status VARCHAR(20) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create advisers table', err.code || err.message);
        }

        // create adviser_section_assignments if missing
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS adviser_section_assignments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    adviser_id INT NOT NULL,
                    section_id INT NOT NULL,
                    school_year_id INT NOT NULL,
                    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY(adviser_id, section_id, school_year_id),
                    FOREIGN KEY (adviser_id) REFERENCES advisers(id) ON DELETE CASCADE,
                    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
                    FOREIGN KEY (school_year_id) REFERENCES school_years(id)
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create adviser_section_assignments', err.code || err.message);
        }

        // teacher_section_assignments may already exist but make sure unique index exists
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS teacher_section_assignments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    teacher_id INT NOT NULL,
                    section_id INT NOT NULL,
                    school_year_id INT NOT NULL,
                    assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY(teacher_id, section_id, school_year_id),
                    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
                    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
                    FOREIGN KEY (school_year_id) REFERENCES school_years(id)
                )
            `);
        } catch (err) {
            // ignore if table already managed elsewhere
        }

        // teacher_subject_assignments for subject teacher / adviser teaching loads
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    teacher_id INT NOT NULL,
                    section_id INT NOT NULL,
                    subject VARCHAR(255) NOT NULL,
                    school_year_id INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_teacher_subject_assignments (teacher_id, section_id, subject, school_year_id),
                    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
                    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
                    FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create teacher_subject_assignments', err.code || err.message);
        }

        // admin settings table for cross-device dashboard preferences
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS admin_settings (
                    admin_id INT PRIMARY KEY,
                    settings_json LONGTEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_admin_settings_admin
                        FOREIGN KEY (admin_id) REFERENCES admins(id)
                        ON DELETE CASCADE
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create admin_settings table', err.code || err.message);
        }

        // audit logs table
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    tenant_id INT NULL,
                    admin_id INT NULL,
                    user_id INT NULL,
                    user_role VARCHAR(100) NULL,
                    action VARCHAR(255) NOT NULL,
                    details TEXT NULL,
                    ip_address VARCHAR(100) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_audit_tenant (tenant_id),
                    INDEX idx_audit_admin (admin_id),
                    INDEX idx_audit_created_at (created_at)
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create audit_logs table', err.code || err.message);
        }

        // backup policy and logs tables
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS backup_policies (
                    admin_id INT PRIMARY KEY,
                    enabled TINYINT(1) DEFAULT 0,
                    interval_hours INT DEFAULT 24,
                    retention_count INT DEFAULT 30,
                    scope_json LONGTEXT NOT NULL,
                    last_run_at DATETIME NULL,
                    next_run_at DATETIME NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    CONSTRAINT fk_backup_policies_admin
                        FOREIGN KEY (admin_id) REFERENCES admins(id)
                        ON DELETE CASCADE
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create backup_policies table', err.code || err.message);
        }

        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS backup_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_id INT NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size BIGINT DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'success',
                    trigger_type VARCHAR(20) DEFAULT 'manual',
                    scope_json LONGTEXT,
                    error_message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_backup_logs_admin_created (admin_id, created_at),
                    CONSTRAINT fk_backup_logs_admin
                        FOREIGN KEY (admin_id) REFERENCES admins(id)
                        ON DELETE CASCADE
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create backup_logs table', err.code || err.message);
        }

        // admin notifications table
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS admin_notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    admin_id INT NOT NULL,
                    type VARCHAR(80) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    related_data LONGTEXT,
                    is_read TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    read_at TIMESTAMP NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_admin_notifications_admin (admin_id, is_read, created_at),
                    CONSTRAINT fk_admin_notifications_admin
                        FOREIGN KEY (admin_id) REFERENCES admins(id)
                        ON DELETE CASCADE
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create admin_notifications table', err.code || err.message);
        }

        // messaging preferences table (cross-device pin/mute/delete)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS messaging_preferences (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_type VARCHAR(20) NOT NULL,
                    user_id INT NOT NULL,
                    peer_id VARCHAR(100) NOT NULL,
                    is_pinned TINYINT(1) DEFAULT 0,
                    is_muted TINYINT(1) DEFAULT 0,
                    is_deleted TINYINT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_msg_pref_user_peer (user_type, user_id, peer_id),
                    INDEX idx_msg_pref_user (user_type, user_id)
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create messaging_preferences table', err.code || err.message);
        }

        // chat messages storage (persists websocket chat across messaging server restarts)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    sender_id VARCHAR(100) NOT NULL,
                    sender_name VARCHAR(255) NULL,
                    recipient_id VARCHAR(100) NOT NULL,
                    recipient_name VARCHAR(255) NULL,
                    message_text TEXT NOT NULL,
                    sent_at BIGINT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_chat_messages_sender (sender_id),
                    INDEX idx_chat_messages_recipient (recipient_id),
                    INDEX idx_chat_messages_sent_at (sent_at)
                )
            `);
        } catch (err) {
            console.warn('MySQL init: failed to create chat_messages table', err.code || err.message);
        }

        // nothing else to do here; return so Postgres-specific section is skipped
        return;
    }

    try {
        // Teachers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id SERIAL PRIMARY KEY,
                teacher_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                department VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255),
                role VARCHAR(50),
                account_status VARCHAR(20) DEFAULT 'active',
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Ensure new columns exist for previously-initialized databases
        await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password VARCHAR(255)`);
        await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role VARCHAR(50)`);
        await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active'`);
        await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

        // Classes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS classes (
                id SERIAL PRIMARY KEY,
                class_name VARCHAR(50) NOT NULL,
                grade_level VARCHAR(50) NOT NULL,
                teacher_id INTEGER REFERENCES teachers(id),
                capacity INTEGER NOT NULL DEFAULT 40,
                enrollment INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Students table (enhanced with auth fields)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
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

        // Student Enrollments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id SERIAL PRIMARY KEY,
                enrollment_id VARCHAR(50) UNIQUE NOT NULL,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                enrollment_data JSONB NOT NULL,
                enrollment_files JSONB,
                status VARCHAR(20) DEFAULT 'Pending',
                remarks TEXT,
                enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Grades table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS grades (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                subject VARCHAR(100) NOT NULL,
                grade_value INTEGER NOT NULL,
                quarter VARCHAR(10) NOT NULL,
                recorded_date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Admins table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                name VARCHAR(100) NOT NULL,
                role VARCHAR(50) NOT NULL,
                account_status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // School Years table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS school_years (
                id SERIAL PRIMARY KEY,
                school_year VARCHAR(50) UNIQUE NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Sections table (JHS and SHS sections)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sections (
                id SERIAL PRIMARY KEY,
                section_code VARCHAR(100) UNIQUE NOT NULL,
                type VARCHAR(10) NOT NULL,
                grade VARCHAR(10) NOT NULL,
                section_name VARCHAR(100) NOT NULL,
                adviser_id INTEGER REFERENCES teachers(id),
                programme VARCHAR(50),
                track VARCHAR(50),
                electives TEXT,
                class_type VARCHAR(50),
                session VARCHAR(50),
                status VARCHAR(20) DEFAULT 'Active',
                remarks TEXT,
                school_year_id INTEGER REFERENCES school_years(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add school_year_id to enrollments table if it doesn't exist
        await pool.query(`
            ALTER TABLE enrollments 
            ADD COLUMN IF NOT EXISTS school_year_id INTEGER REFERENCES school_years(id)
        `);

        // Add school_year_id to students table if it doesn't exist
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS school_year_id INTEGER REFERENCES school_years(id)
        `);

        // Add section_id to students table if it doesn't exist
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES sections(id)
        `);

        // Add personal information columns to students table if they don't exist
        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS birthdate DATE
        `);

        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS gender VARCHAR(50)
        `);

        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS address TEXT
        `);

        await pool.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(255)
        `);

        // Create index for faster queries
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_school_year ON enrollments(school_year_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_students_school_year ON students(school_year_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_school_years_active ON school_years(is_active)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sections_school_year ON sections(school_year_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_sections_code ON sections(section_code)`);

        // Notifications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                related_data JSONB,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes for notification queries
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_student_read ON notifications(student_id, is_read)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`);

        // Advisers table (separate from teachers)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS advisers (
                id SERIAL PRIMARY KEY,
                adviser_id VARCHAR(50) UNIQUE NOT NULL,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                account_status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Adviser Section Assignments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS adviser_section_assignments (
                id SERIAL PRIMARY KEY,
                adviser_id INTEGER NOT NULL REFERENCES advisers(id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
                assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(adviser_id, section_id, school_year_id)
            );
        `);

        // Teacher Section Assignments (for assigning sections to teachers when role=adviser)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teacher_section_assignments (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
                assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(teacher_id, section_id, school_year_id)
            );
        `);

        // Teacher Subject Assignments (store which teacher teaches which subject in which section)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
                id SERIAL PRIMARY KEY,
                teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                subject VARCHAR(200) NOT NULL,
                school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(teacher_id, section_id, subject, school_year_id)
            );
        `);

        // Adviser Notes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS adviser_notes (
                id SERIAL PRIMARY KEY,
                adviser_id INTEGER NOT NULL REFERENCES advisers(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                note_type VARCHAR(50) NOT NULL,
                note_content TEXT NOT NULL,
                is_confidential BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Adviser Attendance table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS adviser_attendance (
                id SERIAL PRIMARY KEY,
                adviser_id INTEGER NOT NULL REFERENCES advisers(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                school_year_id INTEGER NOT NULL REFERENCES school_years(id),
                attendance_date DATE NOT NULL,
                status VARCHAR(20) NOT NULL,
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, section_id, attendance_date)
            );
        `);

        // Adviser Notifications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS adviser_notifications (
                id SERIAL PRIMARY KEY,
                adviser_id INTEGER NOT NULL REFERENCES advisers(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                related_data JSONB,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Create indexes for adviser queries
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_advisers_email ON advisers(email)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_adviser_section_assignments ON adviser_section_assignments(adviser_id, school_year_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_adviser_notes_adviser_student ON adviser_notes(adviser_id, student_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_adviser_attendance_adviser ON adviser_attendance(adviser_id, attendance_date)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_adviser_notifications_adviser ON adviser_notifications(adviser_id, is_read)`);

        // Registration codes table (invite codes for teacher registration)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registration_codes (
                id SERIAL PRIMARY KEY,
                code VARCHAR(20) UNIQUE NOT NULL,
                description TEXT,
                status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'used', 'revoked', 'expired')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                used_at TIMESTAMP,
                used_by INTEGER,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (used_by) REFERENCES teachers(id) ON DELETE SET NULL
            );
        `);

        // Indexes for registration codes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_registration_codes_code ON registration_codes(code)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_registration_codes_status ON registration_codes(status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_registration_codes_used ON registration_codes(used_at)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_registration_codes_expires ON registration_codes(expires_at)`);

        console.log('Database tables initialized successfully!');
    } catch (err) {
        if (err.code === '3D000') {
            console.error('\n❌ Database does not exist!');
            console.error('\nTo fix this, run:');
            console.error('  npm run setup-db\n');
            process.exit(1);
        }
        console.error('Error initializing database:', err);
    }
}

module.exports = initializeDatabase;

// Run initialization if this script is executed directly
if (require.main === module) {
    initializeDatabase().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

