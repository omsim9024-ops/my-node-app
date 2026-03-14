/**
 * Guidance Dashboard API Routes
 * Handles guidance requests, messages, risk flags, and sessions
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

// Ensure guidance tables exist (create if missing) to avoid runtime errors
async function ensureGuidanceTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guidance_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                preferred_date DATE,
                preferred_time TIME,
                message TEXT,
                status VARCHAR(32) DEFAULT 'Pending',
                internal_notes TEXT,
                appointment_date DATE,
                appointment_time TIME,
                guidance_counselor_id INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL
            )
        `);
        // guidance_messages table (if missing) — lightweight schema to avoid future errors
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guidance_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guidance_request_id INT REFERENCES guidance_requests(id) ON DELETE CASCADE,
                sender_id INT,
                sender_type VARCHAR(32),
                message_content TEXT,
                is_visible_to_student BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP NULL
            )
        `);
        // student_risk_flags table — for tracking at-risk students
        await pool.query(`
            CREATE TABLE IF NOT EXISTS student_risk_flags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                risk_type VARCHAR(100) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                flagged_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        // guidance_sessions table — for scheduling and tracking guidance sessions
        await pool.query(`
            CREATE TABLE IF NOT EXISTS guidance_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guidance_request_id INT REFERENCES guidance_requests(id) ON DELETE CASCADE,
                guidance_counselor_id INT,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                session_date DATE NOT NULL,
                session_time TIME,
                session_location VARCHAR(255),
                session_notes TEXT,
                is_completed BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error('[Guidance API] Error ensuring guidance tables exist:', err);
    }
}

// Run table creation once at module load
ensureGuidanceTables();

// ============================================
// 1. GUIDANCE REQUESTS
// ============================================

// Get all guidance requests for a counselor
router.get('/requests', async (req, res) => {
    try {
        const counselorId = req.query.counselor_id;
        const status = req.query.status;

        let query = `
            SELECT 
                gr.id,
                gr.student_id,
                gr.reason,
                gr.preferred_date,
                gr.preferred_time,
                gr.message,
                gr.status,
                gr.internal_notes,
                gr.appointment_date,
                gr.appointment_time,
                gr.created_at,
                gr.updated_at,
                gr.completed_at,
                s.first_name,
                s.last_name,
                s.grade_level,
                sc.section_name,
                JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.track')) as track
            FROM guidance_requests gr
            JOIN students s ON gr.student_id = s.id
            LEFT JOIN sections sc ON s.section_id = sc.id
            LEFT JOIN enrollments e ON s.id = e.student_id AND e.status = 'Approved'
            WHERE 1=1
        `;
        
        const params = [];
        if (counselorId) {
            query += ' AND gr.guidance_counselor_id = ?';
            params.push(counselorId);
        }
        if (status) {
            query += ' AND gr.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY gr.created_at DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[Guidance API] Error fetching requests:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get single guidance request by ID
router.get('/requests/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const [rows] = await pool.query(`
            SELECT 
                gr.id,
                gr.student_id,
                gr.reason,
                gr.preferred_date,
                gr.preferred_time,
                gr.message,
                gr.status,
                gr.internal_notes,
                gr.appointment_date,
                gr.appointment_time,
                gr.created_at,
                gr.updated_at,
                gr.completed_at,
                s.first_name,
                s.last_name,
                s.grade_level,
                sc.section_name,
                JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.track')) as track
            FROM guidance_requests gr
            JOIN students s ON gr.student_id = s.id
            LEFT JOIN sections sc ON s.section_id = sc.id
            LEFT JOIN enrollments e ON s.id = e.student_id AND e.status = 'Approved'
            WHERE gr.id = ?
        `, [requestId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('[Guidance API] Error fetching request:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get student's guidance requests
router.get('/requests/student/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;

        const [rows] = await pool.query(`
            SELECT 
                id,
                reason,
                preferred_date,
                preferred_time,
                message,
                status,
                appointment_date,
                appointment_time,
                created_at,
                updated_at,
                completed_at
            FROM guidance_requests
            WHERE student_id = ?
            ORDER BY created_at DESC
        `, [studentId]);

        res.json(rows);
    } catch (err) {
        console.error('[Guidance API] Error fetching student requests:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create guidance request (from student)
router.post('/requests', async (req, res) => {
    try {
        const { student_id, reason, preferred_date, preferred_time, message } = req.body;

        if (!student_id || !reason) {
            return res.status(400).json({ error: 'student_id and reason are required' });
        }

        const [rows] = await pool.query(`
            INSERT INTO guidance_requests 
            (student_id, reason, preferred_date, preferred_time, message, status)
            VALUES (?, ?, ?, ?, ?, 'Pending')`, [student_id, reason, preferred_date, preferred_time, message]);

        console.log('[Guidance API] ✅ Guidance request created:', result.insertId)
        res.json({ success: true, request: rows[0] });
    } catch (err) {
        console.error('[Guidance API] Error creating request:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update guidance request status (counselor)
router.patch('/requests/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status, internal_notes, appointment_date, appointment_time, guidance_counselor_id } = req.body;

        // Build update dynamically for MySQL using '?' placeholders
        const setParts = ['updated_at = CURRENT_TIMESTAMP'];
        const params = [];

        if (status) {
            setParts.push('status = ?');
            params.push(status);
            if (status === 'Completed') setParts.push('completed_at = CURRENT_TIMESTAMP');
        }
        if (internal_notes !== undefined) {
            setParts.push('internal_notes = ?');
            params.push(internal_notes);
        }
        if (appointment_date) {
            setParts.push('appointment_date = ?');
            params.push(appointment_date);
        }
        if (appointment_time) {
            setParts.push('appointment_time = ?');
            params.push(appointment_time);
        }
        if (guidance_counselor_id) {
            setParts.push('guidance_counselor_id = ?');
            params.push(guidance_counselor_id);
        }

        params.push(requestId);
        const sql = `UPDATE guidance_requests SET ${setParts.join(', ')} WHERE id = ?`;
        const [result] = await pool.query(sql, params);

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const [rows] = await pool.query('SELECT * FROM guidance_requests WHERE id = ?', [requestId]);
        console.log('[Guidance API] ✅ Request updated:', requestId);
        res.json({ success: true, request: rows[0] });
    } catch (err) {
        console.error('[Guidance API] Error updating request:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 2. GUIDANCE MESSAGES
// ============================================

// Get messages for a request
router.get('/messages/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.query.user_id;

        let query = `
            SELECT 
                id,
                guidance_request_id,
                sender_id,
                sender_type,
                message_content,
                is_visible_to_student,
                created_at,
                read_at
            FROM guidance_messages
            WHERE guidance_request_id = ?
        `;
        
        const params = [requestId];
        
        // If it's a student viewing, only show visible messages
        if (userId && req.query.is_student === 'true') {
            query += ` AND is_visible_to_student = true`;
        }

        query += ` ORDER BY created_at ASC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('[Guidance API] Error fetching messages:', err);
        res.status(500).json({ error: err.message });
    }
});

// Drop foreign key constraint if it exists (to fix sender_id constraint issues)
async function removeMessageConstraintIfExists() {
    try {
        await pool.query(`
            ALTER TABLE IF EXISTS guidance_messages 
            DROP CONSTRAINT IF EXISTS guidance_messages_sender_id_fkey
        `);
    } catch (err) {
        // Constraint might not exist, that's okay
    }
}

// Run constraint removal once at module load
removeMessageConstraintIfExists();

// Send message
router.post('/messages', async (req, res) => {
    try {
        const { guidance_request_id, sender_id, sender_type, message_content, is_visible_to_student } = req.body;

        // sender_id is now optional - messages can be sent system-wide or without user attribution
        if (!guidance_request_id || !message_content) {
            return res.status(400).json({ error: 'guidance_request_id and message_content are required' });
        }

        const [rows] = await pool.query(`
            INSERT INTO guidance_messages 
            (guidance_request_id, sender_id, sender_type, message_content, is_visible_to_student)
            VALUES (?, ?, ?, ?, ?)`, [guidance_request_id, sender_id || null, sender_type || 'counselor', message_content, is_visible_to_student ?? true]);

        console.log('[Guidance API] ✅ Message sent:', rows[0].id);
        res.json({ success: true, message: rows[0] });
    } catch (err) {
        console.error('[Guidance API] Error sending message:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 3. RISK FLAGS
// ============================================

// Get at-risk students
router.get('/risk-flags', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT DISTINCT
                srf.id,
                srf.student_id,
                srf.flag_type,
                srf.flag_reason,
                srf.severity,
                srf.is_active,
                srf.created_at,
                s.first_name,
                s.last_name,
                s.grade_level,
                sc.section_name,
                JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.track'))
            FROM student_risk_flags srf
            JOIN students s ON srf.student_id = s.id
            LEFT JOIN sections sc ON s.section_id = sc.id
            LEFT JOIN enrollments e ON s.id = e.student_id AND e.status = 'Approved'
            WHERE srf.is_active = true
            ORDER BY srf.severity DESC, srf.created_at DESC
        `);

        res.json(rows);
    } catch (err) {
        console.error('[Guidance API] Error fetching risk flags:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create risk flag
router.post('/risk-flags', async (req, res) => {
    try {
        const { student_id, flag_type, flag_reason, severity } = req.body;

        if (!student_id || !flag_type) {
            return res.status(400).json({ error: 'student_id and flag_type are required' });
        }

        const [rows] = await pool.query(`
            INSERT INTO student_risk_flags 
            (student_id, flag_type, flag_reason, severity, is_active)
            VALUES (?, ?, ?, ?, true)`, [student_id, flag_type, flag_reason, severity || 'Medium']);

        console.log('[Guidance API] ✅ Risk flag created:', rows[0].id);
        res.json({ success: true, flag: rows[0] });
    } catch (err) {
        console.error('[Guidance API] Error creating risk flag:', err);
        res.status(500).json({ error: err.message });
    }
});

// Resolve risk flag
router.patch('/risk-flags/:flagId', async (req, res) => {
    try {
        const { flagId } = req.params;
        const { resolved_by } = req.body;

        const [rows] = await pool.query(`
            UPDATE student_risk_flags 
            SET is_active = false, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
            WHERE id = ?`, [resolved_by, flagId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Flag not found' });
        }

        console.log('[Guidance API] ✅ Risk flag resolved:', rows[0].id);
        res.json({ success: true, flag: rows[0] });
    } catch (err) {
        console.error('[Guidance API] Error resolving flag:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// 4. GUIDANCE DASHBOARD STATS
// ============================================

// Get guidance dashboard overview
router.get('/dashboard/stats', async (req, res) => {
    try {
        const counselorId = req.query.counselor_id;

        // Get total cases assigned to this counselor
        let totalCasesResult = [[{ count: 0 }]];
        try {
            totalCasesResult = await pool.query(`
                SELECT COUNT(*) as count FROM guidance_requests 
                WHERE guidance_counselor_id = ?
            `, [counselorId]);
        } catch (err) {
            console.warn('[Guidance API] Warning: Could not fetch total cases:', err.message);
        }

        // Get pending requests for this counselor
        let pendingResult = [[{ count: 0 }]];
        try {
            pendingResult = await pool.query(`
                SELECT COUNT(*) as count FROM guidance_requests 
                WHERE guidance_counselor_id = ? AND status = 'Pending'
            `, [counselorId]);
        } catch (err) {
            console.warn('[Guidance API] Warning: Could not fetch pending requests:', err.message);
        }

        // Get count of active at-risk students (system-wide)
        let atRiskResult = [[{ count: 0 }]];
        try {
            atRiskResult = await pool.query(`
                SELECT COUNT(DISTINCT student_id) as count FROM student_risk_flags 
                WHERE is_active = true
            `);
        } catch (err) {
            console.warn('[Guidance API] Warning: Could not fetch at-risk students:', err.message);
        }

        // Get sessions scheduled for today
        let sessionsResult = [[{ count: 0 }]];
        try {
            sessionsResult = await pool.query(`
                SELECT COUNT(*) as count FROM guidance_sessions 
                WHERE session_date = CURRENT_DATE
            `);
        } catch (err) {
            console.warn('[Guidance API] Warning: Could not fetch sessions today:', err.message);
        }

        res.json({
            totalActiveCases: parseInt(totalCasesResult[0][0].count) || 0,
            pendingRequests: parseInt(pendingResult[0][0].count) || 0,
            atRiskStudents: parseInt(atRiskResult[0][0].count) || 0,
            sessionsToday: parseInt(sessionsResult[0][0].count) || 0
        });

        console.log('[Guidance API] ✅ Dashboard stats retrieved successfully');
    } catch (err) {
        console.error('[Guidance API] Error fetching stats:', err);
        res.status(500).json({ 
            error: err.message,
            totalActiveCases: 0,
            pendingRequests: 0,
            atRiskStudents: 0,
            sessionsToday: 0
        });
    }
});

module.exports = router;



