const express = require('express');
const pool = require('../db');
const router = express.Router();

// Create Adviser Account (Admin only)
router.post('/create', async (req, res) => {
    const { adviser_id, first_name, last_name, email, password, phone, department } = req.body;

    // Validation
    if (!adviser_id || !first_name || !last_name || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    // department is optional; if provided it will be copied into teachers table

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        // Check if adviser_id already exists
        const [existingIds] = await pool.query(
            'SELECT id FROM advisers WHERE adviser_id = ?',
            [adviser_id]
        );

        if (existingIds.length > 0) {
            return res.status(409).json({ error: 'Adviser ID already exists' });
        }

        // Check if email already exists
        const [existingEmails] = await pool.query(
            'SELECT id FROM advisers WHERE email = ?',
            [email]
        );

        if (existingEmails.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Insert new adviser
        const result = await pool.query(
            `INSERT INTO advisers 
             (adviser_id, first_name, last_name, email, password, phone, account_status, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [adviser_id, first_name, last_name, email, password, phone || null, 'active']
        );

        // if department supplied, also create matching teacher row with that department
        if (department) {
            try {
                const defaultDept = String(department).trim() || 'Unassigned';
                const columns = await pool.query('SHOW COLUMNS FROM teachers');
                const tenantId = Number(req?.tenant?.id || 0) || null;
                const hasTenant = Array.isArray(columns[0]) && columns[0].some(c => c.Field === 'tenant_id');
                const insertTeacherSql = hasTenant
                    ? 'INSERT IGNORE INTO teachers (teacher_id, name, department, email, tenant_id, created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)'
                    : 'INSERT IGNORE INTO teachers (teacher_id, name, department, email, created_at) VALUES (?,?,?, ?,CURRENT_TIMESTAMP)';
                const teacherParams = hasTenant
                    ? [adviser_id, `${first_name} ${last_name}`, defaultDept, email, tenantId]
                    : [adviser_id, `${first_name} ${last_name}`, defaultDept, email];
                await pool.query(insertTeacherSql, teacherParams);
            } catch (_err) {
                console.warn('[adviser-auth] failed to sync teacher row with dept on admin create', _err);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Adviser account created successfully',
            adviser: {
                adviser_id,
                first_name,
                last_name,
                email,
                phone: phone || null,
                account_status: 'active'
            }
        });
    } catch (err) {
        console.error('Adviser creation error:', err);
        res.status(500).json({ error: 'Adviser creation failed' });
    }
});


// Public Adviser/Teacher Registration (used by unified auth page)
router.post('/register', async (req, res) => {
    console.log('[adviser-auth] register body:', req.body);
    const { adviser_id, first_name, last_name, email, password, phone, registrationCode, department } = req.body;
    console.log('[adviser-auth] incoming registration dept:', department);
    let normalizedId = String(adviser_id || '').trim();
    const normalizedFirst = String(first_name || '').trim();
    const normalizedLast = String(last_name || '').trim();
    const normalizedEmail = String(email || '').trim();
    const normalizedPassword = String(password || '').trim();
    const normalizedCode = String(registrationCode || '').trim().toUpperCase();
    const normalizedDept = String(department || '').trim() || 'Unassigned';
    console.log('[adviser-auth] normalized registration dept:', normalizedDept);

    // basic validation
    if (!normalizedFirst || !normalizedLast || !normalizedEmail || !normalizedPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // generate a default ID if none was provided
    if (!normalizedId) {
        normalizedId = 'TCH-' + Date.now();
    }
    if (normalizedPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // validate registration code if provided
    if (normalizedCode) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM registration_codes WHERE code = ? LIMIT 1',
                [normalizedCode]
            );
            if (rows.length === 0) {
                return res.status(400).json({ error: 'Invalid registration code' });
            }
            const codeRec = rows[0];
            const now = new Date();
            if (codeRec.expires_at && new Date(codeRec.expires_at) < now) {
                return res.status(400).json({ error: 'Registration code has expired' });
            }
            if (codeRec.status && String(codeRec.status).toLowerCase() === 'revoked') {
                return res.status(400).json({ error: 'Registration code is not valid' });
            }
        } catch (err) {
            console.error('Code validation error:', err);
            return res.status(500).json({ error: 'Failed to validate registration code' });
        }
    }

    try {
        // Check if adviser_id already exists
        const [existingIds] = await pool.query(
            'SELECT id FROM advisers WHERE adviser_id = ?',
            [normalizedId]
        );
        if (existingIds.length > 0) {
            return res.status(409).json({ error: 'Adviser ID already exists' });
        }
        // Check if email already exists
        const [existingEmails] = await pool.query(
            'SELECT id FROM advisers WHERE email = ?',
            [normalizedEmail]
        );
        if (existingEmails.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Insert new adviser
        const result = await pool.query(
            `INSERT INTO advisers 
             (adviser_id, first_name, last_name, email, password, phone, account_status, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [normalizedId, normalizedFirst, normalizedLast, normalizedEmail, normalizedPassword, phone || null, 'active']
        );

        // also ensure a matching teacher record exists so the ratings database
        // has the user in the teachers table (was missing previously)
        try {
            const columns = await pool.query('SHOW COLUMNS FROM teachers');
            // write minimal teacher row, ignore duplicates
            const tenantId = Number(req?.tenant?.id || 0) || null;
            const hasTenant = Array.isArray(columns[0]) && columns[0].some(c => c.Field === 'tenant_id');
            // teachers.department is NOT NULL; use the normalized department value
            const defaultDept = normalizedDept || 'Unassigned';
            const insertTeacherSql = hasTenant
                ? 'INSERT IGNORE INTO teachers (teacher_id, name, department, email, tenant_id, created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)'
                : 'INSERT IGNORE INTO teachers (teacher_id, name, department, email, created_at) VALUES (?,?,?, ?,CURRENT_TIMESTAMP)';
            const teacherParams = hasTenant
                ? [normalizedId, `${normalizedFirst} ${normalizedLast}`, defaultDept, normalizedEmail, tenantId]
                : [normalizedId, `${normalizedFirst} ${normalizedLast}`, defaultDept, normalizedEmail];
            await pool.query(insertTeacherSql, teacherParams);
        } catch (syncErr) {
            console.warn('Failed to insert matching teacher row during adviser registration', syncErr);
        }

        // increment code usage if applicable
        if (normalizedCode) {
            try {
                await pool.query(
                    'UPDATE registration_codes SET usage_count = COALESCE(usage_count,0) + 1 WHERE code = ?',
                    [normalizedCode]
                );
            } catch (err) {
                console.error('Failed to update registration code usage:', err);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Adviser account created successfully',
            adviser: {
                adviser_id: normalizedId,
                first_name: normalizedFirst,
                last_name: normalizedLast,
                email: normalizedEmail,
                phone: phone || null,
                account_status: 'active'
            }
        });
    } catch (err) {
        console.error('Adviser registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Adviser Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        // first attempt: look up in the explicit advisers table
        let [rows] = await pool.query(
            `SELECT id, adviser_id, first_name, last_name, email, account_status 
             FROM advisers 
             WHERE email = ? AND password = ? AND account_status = 'active'`,
            [email, password]
        );

        let adviser;
        if (rows.length === 0) {
            // fall back to the teachers table for users who were granted an adviser
            // role but never had a dedicated advisers record.  This query mirrors the
            // behaviour of the teacher login route and only accepts teachers whose
            // normalized role contains "adviser".
            const [teachRows] = await pool.query(
                `SELECT id, teacher_id AS adviser_id, name AS full_name, email, role
                 FROM teachers
                 WHERE (email = ? OR teacher_id = ?) AND password = ? AND LOWER(role) LIKE '%adviser%' AND account_status = 'active'
                 LIMIT 1`,
                [email, email, password]
            );
            if (teachRows.length === 0) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }
            const t = teachRows[0];
            // split name into first/last if possible
            const parts = String(t.full_name || '').split(' ').filter(Boolean);
            adviser = {
                id: t.id,
                adviser_id: t.adviser_id,
                first_name: parts.shift() || '',
                last_name: parts.join(' '),
                email: t.email
            };
        } else {
            adviser = rows[0];
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            adviser: {
                id: adviser.id,
                adviser_id: adviser.adviser_id,
                first_name: adviser.first_name,
                last_name: adviser.last_name,
                email: adviser.email
            }
        });
    } catch (err) {
        console.error('Adviser login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get Adviser Profile
router.get('/profile/:adviser_id', async (req, res) => {
    const { adviser_id } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT id, adviser_id, first_name, last_name, email, phone, account_status, created_at, updated_at 
             FROM advisers 
             WHERE id = ?`,
            [adviser_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Adviser not found' });
        }

        res.json({
            success: true,
            adviser: rows[0]
        });
    } catch (err) {
        console.error('Error fetching adviser profile:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update Adviser Password
router.put('/change-password/:adviser_id', async (req, res) => {
    const { adviser_id } = req.params;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
        return res.status(400).json({ error: 'Old and new password required' });
    }

    if (new_password.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    try {
        // Verify old password
        const adviser = await pool.query(
            'SELECT id FROM advisers WHERE id = ? AND password = ?',
            [adviser_id, old_password]
        );

        if (adviser.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid current password' });
        }

        // Update password
        await pool.query(
            'UPDATE advisers SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [new_password, adviser_id]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (err) {
        console.error('Error changing password:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Get Adviser's Assigned Sections
router.get('/sections/:adviser_id', async (req, res) => {
    const { adviser_id } = req.params;
    const { school_year_id } = req.query;

    try {
        let query = `
            SELECT 
                asa.id as assignment_id,
                s.id as section_id,
                s.section_code,
                s.section_name,
                s.grade,
                s.track,
                s.programme,
                sy.school_year,
                sy.id as school_year_id
            FROM adviser_section_assignments asa
            JOIN sections s ON asa.section_id = s.id
            JOIN school_years sy ON asa.school_year_id = sy.id
            WHERE asa.adviser_id = ?
        `;
        const params = [adviser_id];

        if (school_year_id) {
            query += ' AND asa.school_year_id = ?';
            params.push(school_year_id);
        }

        query += ' ORDER BY sy.school_year DESC, s.section_code ASC';

        const [rows] = await pool.query(query, params);

        res.json({
            success: true,
            sections: rows
        });
    } catch (err) {
        console.error('Error fetching adviser sections:', err);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
});

// Get Adviser's Teaching Assignments (by matching email to teacher account)
// This works for both:
// 1. Advisers in the advisers table (traditional advisers)
// 2. Teachers with role='Adviser' in the teachers table (new system)
router.get('/teaching-assignments/:adviser_id', async (req, res) => {
    const { adviser_id } = req.params;
    console.log('[GET /teaching-assignments] adviser_id param:', adviser_id);

    try {
        let adviserEmail = null;
        let teacherIdToUse = null;

        // FIRST: Try to find in advisers table (traditional system)
        const [adviserRows] = await pool.query(
            `SELECT id, adviser_id, email FROM advisers 
             WHERE CAST(id AS CHAR) = ? OR adviser_id = ?`,
            [String(adviser_id), String(adviser_id)]
        );

        if (adviserRows.length > 0) {
            const adviser = adviserRows[0];
            adviserEmail = adviser.email;
            console.log('[GET /teaching-assignments] Found in advisers table - ID:', adviser.id, ', email:', adviserEmail);
            
            // Try to find corresponding teacher
            const [teacherRowsByEmail] = await pool.query(
                'SELECT id, teacher_id FROM teachers WHERE LOWER(email) = LOWER(?)',
                [adviserEmail]
            );
            
            if (teacherRowsByEmail.length > 0) {
                teacherIdToUse = teacherRowsByEmail[0].id;
                console.log('[GET /teaching-assignments] Found corresponding teacher with email:', adviserEmail, ', teacher_id:', teacherIdToUse);
            }
        } else {
            // SECOND: Try to find in teachers table directly (new system where teachers have adviser role)
            const [teacherRowsById] = await pool.query(
                `SELECT id, teacher_id, email FROM teachers 
                 WHERE CAST(id AS CHAR) = ? OR teacher_id = ?`,
                [String(adviser_id), String(adviser_id)]
            );
            
            if (teacherRowsById.length > 0) {
                const teacher = teacherRowsById[0];
                teacherIdToUse = teacher.id;
                adviserEmail = teacher.email;
                console.log('[GET /teaching-assignments] Found in teachers table - ID:', teacher.id, ', email:', adviserEmail);
            }
        }

        if (!teacherIdToUse) {
            console.log('[GET /teaching-assignments] No adviser/teacher found with id:', adviser_id);
            return res.json({ success: true, assignments: [] });
        }

        // Get subject assignments for this teacher
        let assignmentRows = [];
        try {
            const [rows] = await pool.query(`
                SELECT 
                    tsa.id,
                    tsa.section_id,
                    tsa.subject,
                    s.section_code,
                    s.section_name,
                    s.grade,
                    tsa.school_year_id,
                    sy.school_year
                FROM teacher_subject_assignments tsa
                LEFT JOIN sections s ON s.id = tsa.section_id
                LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
                WHERE tsa.teacher_id = ?
                ORDER BY sy.school_year DESC, s.grade, s.section_code, tsa.subject
            `, [teacherIdToUse]);
            assignmentRows = rows;
        } catch (queryErr) {
            if (queryErr && queryErr.code === 'ER_NO_SUCH_TABLE') {
                console.warn('[GET /teaching-assignments] teacher_subject_assignments table not found; returning empty assignments list');
                return res.json({ success: true, assignments: [] });
            }
            throw queryErr;
        }

        console.log('[GET /teaching-assignments] Subject assignments found:', assignmentRows.length);
        assignmentRows.forEach(a => {
            console.log(`  - ${a.subject} in ${a.section_code} (Grade ${a.grade})`);
        });

        res.json({
            success: true,
            assignments: assignmentRows
        });
    } catch (err) {
        console.error('Error fetching adviser teaching assignments:', err);
        res.status(500).json({ error: 'Failed to fetch teaching assignments' });
    }
});

// Assign Section to Adviser (Admin only)
router.post('/assign-section', async (req, res) => {
    const { adviser_id, section_id, school_year_id } = req.body;

    if (!adviser_id || !section_id || !school_year_id) {
        return res.status(400).json({ error: 'Adviser ID, Section ID, and School Year ID required' });
    }

    try {
        // Check if assignment already exists
        const existing = await pool.query(
            'SELECT id FROM adviser_section_assignments WHERE adviser_id = ? AND section_id = ? AND school_year_id = ?',
            [adviser_id, section_id, school_year_id]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Section already assigned to this adviser' });
        }

        // Insert assignment
        const [rows] = await pool.query(
            `INSERT INTO adviser_section_assignments 
             (adviser_id, section_id, school_year_id, assigned_date, created_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [adviser_id, section_id, school_year_id]
        );

        res.status(201).json({
            success: true,
            message: 'Section assigned successfully',
            assignment: rows[0]
        });
    } catch (err) {
        console.error('Error assigning section:', err);
        res.status(500).json({ error: 'Failed to assign section' });
    }
});

// Remove Adviser from Section (Admin only)
router.delete('/remove-section/:assignment_id', async (req, res) => {
    const { assignment_id } = req.params;

    try {
        const [rows] = await pool.query(
            'DELETE FROM adviser_section_assignments WHERE id = ?',
            [assignment_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        res.json({
            success: true,
            message: 'Section assignment removed successfully'
        });
    } catch (err) {
        console.error('Error removing section assignment:', err);
        res.status(500).json({ error: 'Failed to remove assignment' });
    }
});

// Get All Adviser Section Assignments (Admin only)
router.get('/all-assignments/list', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                asa.id as assignment_id,
                COALESCE(a.id, t.id) as adviser_id,
                a.adviser_id,
                a.first_name,
                a.last_name,
                COALESCE(CONCAT(a.first_name, ' ', a.last_name), t.name) as adviser_name,
                s.id as section_id,
                s.section_code,
                s.section_name,
                s.grade,
                s.track,
                s.programme,
                sy.id as school_year_id,
                sy.school_year,
                asa.assigned_date
            FROM adviser_section_assignments asa
            LEFT JOIN advisers a ON asa.adviser_id = a.id
            LEFT JOIN teachers t ON asa.adviser_id = t.id
            JOIN sections s ON asa.section_id = s.id
            JOIN school_years sy ON asa.school_year_id = sy.id
            ORDER BY COALESCE(a.last_name, t.name), COALESCE(a.first_name, ''), sy.school_year DESC, s.section_code ASC
        `);

        res.json({
            success: true,
            assignments: rows
        });
    } catch (err) {
        console.error('Error fetching all adviser assignments:', err);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

// Get All Advisers (Admin only)
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, adviser_id, first_name, last_name, email, phone, account_status, created_at, updated_at 
             FROM advisers 
             ORDER BY last_name, first_name ASC`
        );

        res.json({
            success: true,
            advisers: rows
        });
    } catch (err) {
        console.error('Error fetching advisers:', err);
        res.status(500).json({ error: 'Failed to fetch advisers' });
    }
});

// Update Adviser Status (Admin only)
router.put('/status/:adviser_id', async (req, res) => {
    const { adviser_id } = req.params;
    const { account_status } = req.body;

    if (!account_status || !['active', 'inactive'].includes(account_status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const [rows] = await pool.query(
            'UPDATE advisers SET account_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [account_status, adviser_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Adviser not found' });
        }

        res.json({
            success: true,
            message: 'Adviser status updated',
            adviser: rows[0]
        });
    } catch (err) {
        console.error('Error updating adviser status:', err);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

module.exports = router;



