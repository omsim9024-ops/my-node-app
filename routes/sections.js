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

async function tableHasColumn(tableName, columnName) {
        const [rows] = await pool.query(
                `SELECT 1
                 FROM information_schema.columns
                 WHERE table_schema = DATABASE()
                     AND table_name = ?
                     AND column_name = ?
                 LIMIT 1`,
                [tableName, columnName]
        );
        return Array.isArray(rows) && rows.length > 0;
}

async function resolveSchoolYearId(explicitSchoolYearId, tenantId) {
    if (explicitSchoolYearId) {
        const [explicitRows] = await pool.query(
            `SELECT id
             FROM school_years
             WHERE id = ? AND tenant_id = ?
             LIMIT 1`,
            [explicitSchoolYearId, tenantId]
        );
        return explicitRows.length ? explicitRows[0].id : null;
    }
    const [activeRows] = await pool.query(
        `SELECT id FROM school_years WHERE is_active = true AND tenant_id = ? LIMIT 1`,
        [tenantId]
    );
    return (activeRows && activeRows.length > 0) ? activeRows[0].id : null;
}

function pickValue(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return value;
        }
    }
    return null;
}

// Get all sections
router.get('/', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const filterByActiveYear = req.query.activeYear !== 'false';
        const activeYearCondition = filterByActiveYear
            ? ` AND s.school_year_id = (
                SELECT id
                FROM school_years
                WHERE tenant_id = ? AND is_active = true
                LIMIT 1
            )`
            : '';

        const [rows] = await pool.query(`
            SELECT s.*, COALESCE(t.name, t_assign.name, t_asa.name, CONCAT(a_asa.first_name, ' ', a_asa.last_name)) as adviser_name, sy.school_year
            FROM sections s
            LEFT JOIN teachers t ON s.adviser_id = t.id AND t.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(teacher_id) AS teacher_id
                FROM teacher_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) tsa ON tsa.section_id = s.id
            LEFT JOIN teachers t_assign ON tsa.teacher_id = t_assign.id AND t_assign.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(adviser_id) AS adviser_id
                FROM adviser_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) asa_map ON asa_map.section_id = s.id
            LEFT JOIN advisers a_asa ON asa_map.adviser_id = a_asa.id
            LEFT JOIN teachers t_asa ON asa_map.adviser_id = t_asa.id AND t_asa.tenant_id = s.tenant_id
            LEFT JOIN school_years sy ON s.school_year_id = sy.id AND sy.tenant_id = s.tenant_id
            WHERE s.tenant_id = ? ${activeYearCondition}
            ORDER BY s.type, s.grade, s.section_name
        `, filterByActiveYear ? [tenantId, tenantId, tenantId, tenantId] : [tenantId, tenantId, tenantId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching sections:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get sections by school year
router.get('/by-school-year/:schoolYearId', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(`
            SELECT s.*, COALESCE(t.name, t_assign.name, t_asa.name, CONCAT(a_asa.first_name, ' ', a_asa.last_name)) as adviser_name, sy.school_year
            FROM sections s
            LEFT JOIN teachers t ON s.adviser_id = t.id AND t.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(teacher_id) AS teacher_id
                FROM teacher_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) tsa ON tsa.section_id = s.id
            LEFT JOIN teachers t_assign ON tsa.teacher_id = t_assign.id AND t_assign.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(adviser_id) AS adviser_id
                FROM adviser_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) asa_map ON asa_map.section_id = s.id
            LEFT JOIN advisers a_asa ON asa_map.adviser_id = a_asa.id
            LEFT JOIN teachers t_asa ON asa_map.adviser_id = t_asa.id AND t_asa.tenant_id = s.tenant_id
            LEFT JOIN school_years sy ON s.school_year_id = sy.id AND sy.tenant_id = s.tenant_id
            WHERE s.school_year_id = ? AND s.tenant_id = ?
            ORDER BY s.type, s.grade, s.section_name
        `, [tenantId, tenantId, req.params.schoolYearId, tenantId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching sections by school year:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create JHS section
router.post('/create-jhs', async (req, res) => {
    const sectionCode = pickValue(req.body.sectionCode, req.body.section_code);
    const grade = pickValue(req.body.grade, req.body.grade_level);
    const sectionName = pickValue(req.body.sectionName, req.body.section_name);
    const adviser = pickValue(req.body.adviser, req.body.adviser_name);
    const programme = pickValue(req.body.programme, req.body.program_type, req.body.program) || 'Regular';
    const status = pickValue(req.body.status) || 'Active';
    const remarks = pickValue(req.body.remarks) || '';
    const schoolYearId = pickValue(req.body.schoolYearId, req.body.school_year_id);

    if (!sectionCode || !grade || !sectionName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, tenantId);
        // If no active school year is set, still allow creation with NULL school_year_id.
        // This prevents hard-blocking section creation for setups that haven't configured years yet.

        // Get teacher ID from adviser name (adviser is optional)
        let adviserId = null;
        if (adviser) {
            const [teacherResult] = await pool.query(
                'SELECT id FROM teachers WHERE name = ? AND tenant_id = ? LIMIT 1',
                [adviser, tenantId]
            );
            adviserId = teacherResult.length > 0 ? teacherResult[0].id : null;
        }

        // Check for duplicate section code
        const [duplicateCheck] = await pool.query(
            'SELECT id FROM sections WHERE section_code = ? AND tenant_id = ?',
            [sectionCode, tenantId]
        );
        if (duplicateCheck.length > 0) {
            return res.status(400).json({ error: 'Section code already exists' });
        }

        const [insertResult] = await pool.query(
            `INSERT INTO sections (
                section_code, type, grade, section_name, adviser_id,
                programme, status, remarks, school_year_id, tenant_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sectionCode, 'JHS', grade, sectionName, adviserId, programme, status, remarks, resolvedSchoolYearId, tenantId]
        );
        // Fetch the created record
        const [created] = await pool.query('SELECT * FROM sections WHERE id = ? AND tenant_id = ?', [insertResult.insertId, tenantId]);
        res.status(201).json(created[0]);
    } catch (err) {
        console.error('Error creating JHS section:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create SHS section
router.post('/create-shs', async (req, res) => {
    const sectionCode = pickValue(req.body.sectionCode, req.body.section_code);
    const grade = pickValue(req.body.grade, req.body.grade_level);
    const track = pickValue(req.body.track);
    const electives = pickValue(req.body.electives);
    const sectionName = pickValue(req.body.sectionName, req.body.section_name);
    const adviser = pickValue(req.body.adviser, req.body.adviser_name);
    const classType = pickValue(req.body.classType, req.body.class_type) || 'Regular';
    const session = pickValue(req.body.session) || 'Not specified';
    const remarks = pickValue(req.body.remarks) || '';
    const schoolYearId = pickValue(req.body.schoolYearId, req.body.school_year_id);

    if (!sectionCode || !grade || !track || !electives || !sectionName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, tenantId);
        // If no active school year is set, still allow creation with NULL school_year_id.
        // This prevents hard-blocking section creation for setups that haven't configured years yet.

        // Get teacher ID from adviser name (adviser is optional)
        let adviserId = null;
        if (adviser) {
            const [teacherResult] = await pool.query(
                'SELECT id FROM teachers WHERE name = ? AND tenant_id = ? LIMIT 1',
                [adviser, tenantId]
            );
            adviserId = teacherResult.length > 0 ? teacherResult[0].id : null;
        }

        // Check for duplicate section code
        const [duplicateCheck] = await pool.query(
            'SELECT id FROM sections WHERE section_code = ? AND tenant_id = ?',
            [sectionCode, tenantId]
        );
        if (duplicateCheck.length > 0) {
            return res.status(400).json({ error: 'Section code already exists' });
        }

        const [insertResult] = await pool.query(
            `INSERT INTO sections (
                section_code, type, grade, track, electives, section_name,
                adviser_id, class_type, session, remarks, school_year_id, tenant_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sectionCode, 'SHS', grade, track, electives, sectionName, adviserId, classType, session, remarks, resolvedSchoolYearId, tenantId]
        );
        // Fetch the created record
        const [created] = await pool.query('SELECT * FROM sections WHERE id = ? AND tenant_id = ?', [insertResult.insertId, tenantId]);
        res.status(201).json(created[0]);
    } catch (err) {
        console.error('Error creating SHS section:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update section
router.put('/:id', async (req, res) => {
    const {
        grade,
        sectionName,
        track,
        electives,
        adviser,
        programme,
        classType,
        session,
        status,
        remarks
    } = req.body;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const fields = [];
        const values = [];

        if (grade !== undefined) {
            fields.push('grade = ?');
            values.push(grade);
        }
        if (sectionName !== undefined) {
            fields.push('section_name = ?');
            values.push(sectionName);
        }
        if (track !== undefined) {
            fields.push('track = ?');
            values.push(track);
        }
        if (electives !== undefined) {
            fields.push('electives = ?');
            values.push(electives);
        }
        if (programme !== undefined) {
            fields.push('programme = ?');
            values.push(programme);
        }
        if (classType !== undefined) {
            fields.push('class_type = ?');
            values.push(classType);
        }
        if (session !== undefined) {
            fields.push('session = ?');
            values.push(session);
        }
        if (status !== undefined) {
            fields.push('status = ?');
            values.push(status);
        }
        if (remarks !== undefined) {
            fields.push('remarks = ?');
            values.push(remarks);
        }

        // Adviser: convert name to adviser_id (nullable)
        if (adviser !== undefined) {
            let adviserId = null;
            if (adviser) {
                const [teacherResult] = await pool.query(
                    'SELECT id FROM teachers WHERE name = ? AND tenant_id = ? LIMIT 1',
                    [adviser, tenantId]
                );
                adviserId = teacherResult.length > 0 ? teacherResult[0].id : null;
            }
            fields.push('adviser_id = ?');
            values.push(adviserId);
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: 'No fields provided for update' });
        }

        // Build query
        values.push(req.params.id, tenantId);
        const query = `UPDATE sections SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`;

        const [rows] = await pool.query(query, values);
        if (!rows || rows.affectedRows === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }
        // Return updated row with adviser_name + school_year for frontend consistency
        const [updated] = await pool.query(`
            SELECT s.*, COALESCE(t.name, t_assign.name, t_asa.name, CONCAT(a_asa.first_name, ' ', a_asa.last_name)) as adviser_name, sy.school_year
            FROM sections s
            LEFT JOIN teachers t ON s.adviser_id = t.id AND t.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(teacher_id) AS teacher_id
                FROM teacher_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) tsa ON tsa.section_id = s.id
            LEFT JOIN teachers t_assign ON tsa.teacher_id = t_assign.id AND t_assign.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(adviser_id) AS adviser_id
                FROM adviser_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) asa_map ON asa_map.section_id = s.id
            LEFT JOIN advisers a_asa ON asa_map.adviser_id = a_asa.id
            LEFT JOIN teachers t_asa ON asa_map.adviser_id = t_asa.id AND t_asa.tenant_id = s.tenant_id
            LEFT JOIN school_years sy ON s.school_year_id = sy.id AND sy.tenant_id = s.tenant_id
            WHERE s.id = ? AND s.tenant_id = ?
        `, [tenantId, tenantId, req.params.id, tenantId]);
        res.json(updated[0]);
    } catch (err) {
        console.error('Error updating section:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete section
router.delete('/:id', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [result] = await pool.query(
            'DELETE FROM sections WHERE id = ? AND tenant_id = ?',
            [req.params.id, tenantId]
        );
        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }
        res.json({ message: 'Section deleted successfully' });
    } catch (err) {
        console.error('Error deleting section:', err);
        // Common FK violation when section is still assigned
        if (err && (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED')) {
            return res.status(400).json({ error: 'Cannot delete section because it is currently assigned to students or related records.' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// ===== Specific /:id/* routes must come BEFORE generic /:id route =====

// Get students assigned to a section
router.get('/:id/students', async (req, res) => {
    const sectionId = req.params.id;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(`
            SELECT s.id, s.student_id, s.first_name, s.last_name, s.grade_level, s.email
            FROM students s
            WHERE s.section_id = ? AND s.tenant_id = ?
            ORDER BY s.first_name, s.last_name
        `, [sectionId, tenantId]);

        res.json(rows);
    } catch (err) {
        console.error('[GET /:id/students] Error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// Assign students to a section (by enrollment IDs)
router.post('/:id/assign-students', async (req, res) => {
    const sectionId = req.params.id;
    const studentIdsInput = req.body?.student_ids || req.body?.enrollmentIds || req.body?.studentIds;

    console.log('[POST /assign-students] Starting assignment');
    console.log('[POST /assign-students] Section ID:', sectionId);
    console.log('[POST /assign-students] Enrollment IDs to assign:', studentIdsInput);

    // Validate section exists
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        req.tenantId = tenantId;

        const [sectionCheck] = await pool.query('SELECT id FROM sections WHERE id = ? AND tenant_id = ?', [sectionId, tenantId]);
        if (sectionCheck.length === 0) {
            console.error('[POST /assign-students] Section not found:', sectionId);
            return res.status(404).json({ error: 'Section not found' });
        }
    } catch (err) {
        console.error('[POST /assign-students] Error checking section:', err);
        return res.status(500).json({ error: 'Server error' });
    }

    // Validate enrollment_ids is an array
    if (!Array.isArray(studentIdsInput) || studentIdsInput.length === 0) {
        console.error('[POST /assign-students] Invalid IDs payload:', studentIdsInput);
        return res.status(400).json({ error: 'student_ids (or enrollmentIds/studentIds) must be a non-empty array' });
    }

    const student_ids = studentIdsInput;

    try {
        // Load section metadata for JSON persistence
        const [sectionRows] = await pool.query(
            'SELECT id, section_code, section_name FROM sections WHERE id = ? AND tenant_id = ? LIMIT 1',
            [sectionId, req.tenantId]
        );
        const section = sectionRows && sectionRows[0] ? sectionRows[0] : null;
        const sectionCode = section ? section.section_code : null;
        const sectionName = section ? section.section_name : null;

        const placeholders = student_ids.map(() => '?').join(',');
        const hasSectionIdColumn = await tableHasColumn('enrollments', 'section_id');
        const hasClassIdColumn = await tableHasColumn('enrollments', 'class_id');

        let query = `
            UPDATE enrollments
            SET enrollment_data = JSON_SET(
                COALESCE(enrollment_data, JSON_OBJECT()),
                '$.section_id', CAST(? AS UNSIGNED),
                '$.sectionId', CAST(? AS UNSIGNED),
                '$.section_code', ?,
                '$.sectionCode', ?,
                '$.section_name', ?,
                '$.sectionName', ?
            )`;

        const params = [
            sectionId,
            sectionId,
            sectionCode,
            sectionCode,
            sectionName,
            sectionName
        ];

        if (hasSectionIdColumn) {
            query += `, section_id = ?`;
            params.push(sectionId);
        }

        if (hasClassIdColumn) {
            query += `, class_id = ?`;
            params.push(sectionId);
        }

        query += `, updated_at = CURRENT_TIMESTAMP
            WHERE id IN (${placeholders}) AND tenant_id = ?`;

        params.push(...student_ids);
        params.push(req.tenantId);

        console.log('[POST /assign-students] Executing update query with params:', params);
        const [result] = await pool.query(query, params);
        
        console.log('[POST /assign-students] Update successful. Rows affected:', result.affectedRows);
        
        res.json({
            success: true,
            message: `Successfully assigned ${result.affectedRows || 0} enrollment(s) to section ${sectionId}`,
            assigned_count: result.affectedRows || 0
        });
    } catch (err) {
        console.error('[POST /assign-students] Error:', err.message);
        console.error('[POST /assign-students] Full error:', err);
        res.status(500).json({ error: 'Failed to assign students', details: err.message });
    }
});

// Remove a student from a section
router.delete('/:sectionId/students/:studentId', async (req, res) => {
    const { sectionId, studentId } = req.params;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        // Verify the student is assigned to this section
        const [studentCheck] = await pool.query(
            'SELECT * FROM students WHERE id = ? AND section_id = ? AND tenant_id = ?',
            [studentId, sectionId, tenantId]
        );

        if (studentCheck.length === 0) {
            return res.status(404).json({ error: 'Student not assigned to this section' });
        }

        // Remove student from section by setting section_id to NULL
        const result = await pool.query(
            'UPDATE students SET section_id = NULL WHERE id = ? AND tenant_id = ?',
            [studentId, tenantId]
        );

        res.json({
            success: true,
            message: 'Student removed from section successfully',
            removed_student: { id: studentId }
        });
    } catch (err) {
            console.error('[DELETE /:sectionId/students/:studentId] Error:', err.message);
        res.status(500).json({ error: 'Failed to remove student from section' });
    }
});

// ===== Generic /:id routes come AFTER specific ones =====

// Get single section
router.get('/:id', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(`
            SELECT s.*, COALESCE(t.name, t_assign.name, t_asa.name, CONCAT(a_asa.first_name, ' ', a_asa.last_name)) as adviser_name, sy.school_year
            FROM sections s
            LEFT JOIN teachers t ON s.adviser_id = t.id AND t.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(teacher_id) AS teacher_id
                FROM teacher_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) tsa ON tsa.section_id = s.id
            LEFT JOIN teachers t_assign ON tsa.teacher_id = t_assign.id AND t_assign.tenant_id = s.tenant_id
            LEFT JOIN (
                SELECT section_id, MIN(adviser_id) AS adviser_id
                FROM adviser_section_assignments
                WHERE tenant_id = ?
                GROUP BY section_id
            ) asa_map ON asa_map.section_id = s.id
            LEFT JOIN advisers a_asa ON asa_map.adviser_id = a_asa.id
            LEFT JOIN teachers t_asa ON asa_map.adviser_id = t_asa.id AND t_asa.tenant_id = s.tenant_id
            LEFT JOIN school_years sy ON s.school_year_id = sy.id AND sy.tenant_id = s.tenant_id
            WHERE s.id = ? AND s.tenant_id = ?
        `, [tenantId, tenantId, req.params.id, tenantId]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Section not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching section:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;



