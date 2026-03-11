const express = require('express');
const pool = require('../db');
const { resolveTenantForRequest } = require('../middleware/tenant-context');
const router = express.Router();

async function resolveTenantId(req, res) {
    const existingTenantId = Number(req.tenantId || req.tenant?.id || 0);
    if (existingTenantId > 0) return existingTenantId;

    const tenant = await resolveTenantForRequest(req, { allowDefault: true, requireActive: true });
    if (!tenant || !tenant.id) {
        res.status(503).json({ error: 'No active tenant is configured' });
        return null;
    }

    req.tenant = tenant;
    req.tenantId = Number(tenant.id);
    return req.tenantId;
}

// Register a new student account
router.post('/register', async (req, res) => {
    console.log('Register endpoint hit. Headers:', req.headers);
    const { firstName, lastName, email, password, gradeLevel, studentID, registrationCode } = req.body;
    const normalizedFirstName = String(firstName || req.body.first_name || '').trim();
    const normalizedLastName = String(lastName || req.body.last_name || '').trim();
    const normalizedEmail = String(email || req.body.user_email || '').trim();
    const normalizedPassword = String(password || req.body.user_password || '').trim();
    const normalizedGradeLevel = gradeLevel ? String(gradeLevel).trim() : null;
    const normalizedStudentId = String(studentID || req.body.student_id || '').trim();
    const normalizedCode = String(registrationCode || '').trim().toUpperCase();
    console.log('Register payload:', req.body);
    
    // Validation
    if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !normalizedPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (normalizedPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (normalizedStudentId && !/^\d{12}$/.test(normalizedStudentId)) {
        return res.status(400).json({ error: 'LRN must be exactly 12 digits' });
    }

    // if registration code provided, validate it
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
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        // Check if email already exists
        const [existingStudents] = await pool.query(
            'SELECT id FROM students WHERE email = ? AND tenant_id = ?',
            [normalizedEmail, tenantId]
        );

        if (existingStudents.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Generate student ID if not provided
        const generated_student_id = normalizedStudentId || 'MNS-' + Date.now();

        // Insert new student
        const [result] = await pool.query(
            `INSERT INTO students 
             (tenant_id, student_id, first_name, last_name, email, password, grade_level, account_status, registration_date) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [tenantId, generated_student_id, normalizedFirstName, normalizedLastName, normalizedEmail, normalizedPassword, normalizedGradeLevel, 'active']
        );

        // Get the newly inserted student
        const [students] = await pool.query(
            'SELECT id, student_id, first_name, last_name, email, grade_level FROM students WHERE id = ? AND tenant_id = ?',
            [result.insertId, tenantId]
        );
        const student = students[0];

        // if a registration code was used, increment its usage count
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
            message: 'Account created successfully',
            student: {
                id: student.id,
                student_id: student.student_id,
                firstName: student.first_name,
                lastName: student.last_name,
                email: student.email,
                gradeLevel: student.grade_level
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email or Student ID already exists' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Student login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(
            `SELECT id, student_id, first_name, last_name, email, grade_level, account_status, phone, birthdate, gender, address, place_of_birth
             FROM students 
             WHERE email = ? AND password = ? AND tenant_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [email, password, tenantId]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const student = rows[0];

        if (student.account_status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        // try to pull a known LRN from any existing enrollment record
        let lrnValue = null;
        try {
            const [lrnRows] = await pool.query(
                'SELECT lrn_no FROM enrollments WHERE student_id = ? AND tenant_id = ? AND lrn_no IS NOT NULL ORDER BY id DESC LIMIT 1',
                [student.id, tenantId]
            );
            if (Array.isArray(lrnRows) && lrnRows.length) {
                lrnValue = String(lrnRows[0].lrn_no || '').trim() || null;
            }
        } catch (_e) {
            // ignore failure, not critical
        }
        // fallback: try matching by email in enrollment_data if we still don't have LRN
        if (!lrnValue && student.email) {
            try {
                const [lrnRows2] = await pool.query(
                    `SELECT lrn_no FROM enrollments
                     WHERE tenant_id = ?
                       AND enrollment_data LIKE ?
                       AND lrn_no IS NOT NULL
                     ORDER BY id DESC
                     LIMIT 1`,
                    [tenantId, `%"email":"${student.email}"%`]
                );
                if (Array.isArray(lrnRows2) && lrnRows2.length) {
                    lrnValue = String(lrnRows2[0].lrn_no || '').trim() || null;
                }
            } catch (_e) {
                // ignore again
            }
        }

        res.json({
            success: true,
            message: 'Login successful',
            student: {
                id: student.id,
                student_id: student.student_id,
                lrn: lrnValue,
                firstName: student.first_name,
                lastName: student.last_name,
                email: student.email,
                gradeLevel: student.grade_level,
                phone: student.phone,
                birthdate: student.birthdate,
                gender: student.gender,
                address: student.address,
                placeOfBirth: student.place_of_birth
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get student profile
router.get('/:id', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(
            `SELECT id, student_id, first_name, last_name, email, grade_level, 
                    phone, account_status, registration_date, birthdate, gender, address, place_of_birth
             FROM students 
             WHERE id = ? AND tenant_id = ?`,
            [req.params.id, tenantId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = rows[0];
        res.json({
            id: student.id,
            student_id: student.student_id,
            firstName: student.first_name,
            lastName: student.last_name,
            email: student.email,
            gradeLevel: student.grade_level,
            phone: student.phone,
            accountStatus: student.account_status,
            registrationDate: student.registration_date,
            birthdate: student.birthdate,
            gender: student.gender,
            address: student.address,
            placeOfBirth: student.place_of_birth
        });
    } catch (err) {
        console.error('Error fetching student profile:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update student profile
router.put('/:id', async (req, res) => {
    const { firstName, lastName, phone, gradeLevel, birthdate, gender, address, placeOfBirth } = req.body;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        await pool.query(
            `UPDATE students 
             SET first_name = COALESCE(?, first_name),
                 last_name = COALESCE(?, last_name),
                 phone = COALESCE(?, phone),
                 grade_level = COALESCE(?, grade_level),
                 birthdate = COALESCE(?, birthdate),
                 gender = COALESCE(?, gender),
                 address = COALESCE(?, address),
                 place_of_birth = COALESCE(?, place_of_birth)
             WHERE id = ? AND tenant_id = ?`,
            [firstName || null, lastName || null, phone || null, gradeLevel || null, birthdate || null, gender || null, address || null, placeOfBirth || null, req.params.id, tenantId]
        );

        const [rows] = await pool.query(
            `SELECT id, student_id, first_name, last_name, email, grade_level, phone, birthdate, gender, address, place_of_birth
             FROM students 
             WHERE id = ? AND tenant_id = ?`,
            [req.params.id, tenantId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = rows[0];
        res.json({
            success: true,
            message: 'Profile updated successfully',
            student: {
                id: student.id,
                firstName: student.first_name,
                lastName: student.last_name,
                email: student.email,
                gradeLevel: student.grade_level,
                phone: student.phone,
                birthdate: student.birthdate,
                gender: student.gender,
                address: student.address,
                placeOfBirth: student.place_of_birth
            }
        });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Check if student has enrollment
router.get('/:id/enrollment-status', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(
            'SELECT id, enrollment_id, status FROM enrollments WHERE student_id = ? AND tenant_id = ? ORDER BY enrollment_date DESC LIMIT 1',
            [req.params.id, tenantId]
        );

        res.json({
            hasEnrollment: rows.length > 0,
            enrollment: rows.length > 0 ? rows[0] : null
        });
    } catch (err) {
        console.error('Error checking enrollment status:', err);
        res.status(500).json({ error: 'Failed to check enrollment status' });
    }
});

module.exports = router;



