const express = require('express');
const pool = require('../db');
const { resolveTenantForRequest } = require('../middleware/tenant-context');
const router = express.Router();

let studentsSchemaCache = null;

function shouldApplyTenantIdFilter(req, hasTenantColumn) {
    const tenantId = Number(req?.tenant?.id || 0);
    if (!hasTenantColumn || !tenantId) return false;
    const isolationMode = String(req?.tenant?.isolationMode || '').trim().toLowerCase();
    return isolationMode !== 'database-per-tenant';
}

async function getStudentsSchema() {
    if (studentsSchemaCache) return studentsSchemaCache;

    async function hasTenantColumn(tableName) {
        try {
            const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE 'tenant_id'`);
            return Array.isArray(rows) && rows.length > 0;
        } catch (_err) {
            return false;
        }
    }

    studentsSchemaCache = {
        students_has_tenant_id: await hasTenantColumn('students'),
        enrollments_has_tenant_id: await hasTenantColumn('enrollments'),
        classes_has_tenant_id: await hasTenantColumn('classes')
    };

    return studentsSchemaCache;
}

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

// Get all students - transforms data to match frontend expectations
// Includes students from both students table and enrollments table
router.get('/', async (req, res) => {
    try {
        const schema = await getStudentsSchema();
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const filterStudentsByTenant = shouldApplyTenantIdFilter(req, schema.students_has_tenant_id);
        const filterEnrollmentsByTenant = shouldApplyTenantIdFilter(req, schema.enrollments_has_tenant_id);
        const filterClassesByTenant = shouldApplyTenantIdFilter(req, schema.classes_has_tenant_id);

        const classJoinTenantClause = (filterStudentsByTenant && filterClassesByTenant)
            ? ' AND c.tenant_id = s.tenant_id'
            : '';
        const enrollmentJoinTenantClause = (filterStudentsByTenant && filterEnrollmentsByTenant)
            ? ' AND e.tenant_id = s.tenant_id'
            : '';
        const studentsWhereTenantClause = filterStudentsByTenant ? 'WHERE s.tenant_id = ?' : '';
        const studentsParams = filterStudentsByTenant ? [tenantId] : [];

        // fetch students joined with enrollments
        const [rows1] = await pool.query(`
            SELECT 
                s.id,
                s.student_id,
                CONCAT(s.first_name, ' ', s.last_name) as name,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.grade_level,
                CASE 
                    WHEN s.grade_level REGEXP '^[0-9]+' THEN CAST(SUBSTRING(s.grade_level,1,2) AS UNSIGNED)
                    ELSE NULL
                END as grade,
                CASE 
                    WHEN s.grade_level REGEXP '^[0-9]+' THEN 
                        CASE 
                            WHEN CAST(SUBSTRING(s.grade_level,1,2) AS UNSIGNED) >= 11 THEN 'SHS'
                            ELSE 'JHS'
                        END
                    ELSE NULL
                END as level,
                s.class_id,
                s.account_status,
                s.registration_date,
                s.created_at,
                s.school_year_id,
                c.class_name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.sex')), '') as gender,
                UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.track')), '')) as track,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.elective')), '') as elective,
                e.status as enrollment_status
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id${classJoinTenantClause}
            LEFT JOIN enrollments e ON s.id = e.student_id${enrollmentJoinTenantClause}
            ${studentsWhereTenantClause}
        `, studentsParams);

        const enrollmentsWhereTenantClause = filterEnrollmentsByTenant ? 'WHERE e.tenant_id = ?' : '';
        const studentSubqueryTenantClause = filterStudentsByTenant ? ' WHERE tenant_id = ?' : '';
        const rows2Params = [];
        if (filterEnrollmentsByTenant) rows2Params.push(tenantId);
        if (filterStudentsByTenant) rows2Params.push(tenantId);

        // fetch extras from enrollments only
        const [rows2] = await pool.query(`
            SELECT 
                e.student_id as id,
                CAST(e.student_id AS CHAR) as student_id,
                COALESCE(
                    CONCAT(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.firstName')), ' ', JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.lastName'))),
                    CONCAT('Student ', e.student_id)
                ) as name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.firstName')), '') as first_name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.lastName')), '') as last_name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.email')), '') as email,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.phone')), '') as phone,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.gradeLevel')), '') as grade_level,
                CASE 
                    WHEN JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.gradeLevel')) REGEXP '^[0-9]+' THEN 
                        CAST(SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.gradeLevel')),1,2) AS UNSIGNED)
                    ELSE NULL
                END as grade,
                CASE 
                    WHEN JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.gradeLevel')) REGEXP '^[0-9]+' THEN 
                        CASE 
                            WHEN CAST(SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.gradeLevel')),1,2) AS UNSIGNED) >= 11 THEN 'SHS'
                            ELSE 'JHS'
                        END
                    ELSE NULL
                END as level,
                NULL as class_id,
                'active' as account_status,
                e.enrollment_date as registration_date,
                e.created_at,
                e.school_year_id,
                NULL as class_name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.sex')), '') as gender,
                UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.track')), '')) as track,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.elective')), '') as elective,
                e.status as enrollment_status
            FROM enrollments e
            ${enrollmentsWhereTenantClause}
            ${enrollmentsWhereTenantClause ? 'AND' : 'WHERE'} e.student_id NOT IN (SELECT id FROM students${studentSubqueryTenantClause})
        `, rows2Params);

        const rows = rows1.concat(rows2);
        // sort by created_at descending
        rows.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
        res.json(rows);
    } catch (err) {
        console.error('[Students API] Error getting all students:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single student
router.get('/:id', async (req, res) => {
    try {
        const schema = await getStudentsSchema();
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const filterStudentsByTenant = shouldApplyTenantIdFilter(req, schema.students_has_tenant_id);
        const filterEnrollmentsByTenant = shouldApplyTenantIdFilter(req, schema.enrollments_has_tenant_id);
        const filterClassesByTenant = shouldApplyTenantIdFilter(req, schema.classes_has_tenant_id);

        const classJoinTenantClause = (filterStudentsByTenant && filterClassesByTenant)
            ? ' AND c.tenant_id = s.tenant_id'
            : '';
        const enrollmentJoinTenantClause = (filterStudentsByTenant && filterEnrollmentsByTenant)
            ? ' AND e.tenant_id = s.tenant_id'
            : '';
        const studentWhereTenantClause = filterStudentsByTenant ? ' AND s.tenant_id = ?' : '';
        const studentParams = filterStudentsByTenant ? [req.params.id, tenantId] : [req.params.id];

        const [rows] = await pool.query(`
            SELECT 
                s.id,
                s.student_id,
                CONCAT(s.first_name, ' ', s.last_name) as name,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.grade_level,
                CASE 
                    WHEN s.grade_level REGEXP '^[0-9]+' THEN CAST(SUBSTRING(s.grade_level,1,2) AS UNSIGNED)
                    ELSE NULL
                END as grade,
                CASE 
                    WHEN s.grade_level REGEXP '^[0-9]+' THEN 
                        CASE 
                            WHEN CAST(SUBSTRING(s.grade_level,1,2) AS UNSIGNED) >= 11 THEN 'SHS'
                            ELSE 'JHS'
                        END
                    ELSE NULL
                END as level,
                s.class_id,
                s.account_status,
                s.registration_date,
                s.created_at,
                s.school_year_id,
                c.class_name,
                COALESCE(e.enrollment_data->>'$.sex', '') as gender,
                UPPER(COALESCE(e.enrollment_data->>'$.track', '')) as track,
                COALESCE(e.enrollment_data->>'$.elective', '') as elective,
                e.status as enrollment_status
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id${classJoinTenantClause}
            LEFT JOIN enrollments e ON s.id = e.student_id${enrollmentJoinTenantClause}
            WHERE s.id = ?${studentWhereTenantClause}
        `, studentParams);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[Students API] Error getting student:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create student
router.post('/', async (req, res) => {
    const { student_id, name, first_name, last_name, grade_level, email, phone, class_id } = req.body;
    
    // Support both 'name' and 'first_name/last_name' formats
    const fname = first_name || (name ? name.split(' ')[0] : '');
    const lname = last_name || (name ? name.split(' ').slice(1).join(' ') : '');
    
    if (!student_id || !fname || !lname || !grade_level || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const schema = await getStudentsSchema();
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const filterStudentsByTenant = shouldApplyTenantIdFilter(req, schema.students_has_tenant_id);

        const insertSql = filterStudentsByTenant
            ? 'INSERT INTO students (student_id, first_name, last_name, grade_level, email, phone, class_id, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            : 'INSERT INTO students (student_id, first_name, last_name, grade_level, email, phone, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
        const insertParams = filterStudentsByTenant
            ? [student_id, fname, lname, grade_level, email, phone || null, class_id || null, tenantId]
            : [student_id, fname, lname, grade_level, email, phone || null, class_id || null];

        const [rows] = await pool.query(insertSql, insertParams);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Student ID or email already exists' });
        }
        console.error('[Students API] Error creating student:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update student
router.put('/:id', async (req, res) => {
    const { name, first_name, last_name, grade_level, email, phone, class_id, birthdate, gender, address, placeOfBirth } = req.body;
    
    // Support both 'name' and 'first_name/last_name' formats
    const fname = first_name || (name ? name.split(' ')[0] : undefined);
    const lname = last_name || (name ? name.split(' ').slice(1).join(' ') : undefined);
    
    try {
        const schema = await getStudentsSchema();
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const filterStudentsByTenant = shouldApplyTenantIdFilter(req, schema.students_has_tenant_id);
        const updateWhereTenantClause = filterStudentsByTenant ? ' AND tenant_id = ?' : '';
        const updateParams = [
            fname || null,
            lname || null,
            grade_level || null,
            email || null,
            phone || null,
            class_id || null,
            birthdate || null,
            gender || null,
            address || null,
            placeOfBirth || null,
            req.params.id
        ];
        if (filterStudentsByTenant) updateParams.push(tenantId);

        const [rows] = await pool.query(
            `UPDATE students 
             SET first_name = COALESCE(?, first_name), 
                 last_name = COALESCE(?, last_name), 
                 grade_level = COALESCE(?, grade_level), 
                 email = COALESCE(?, email), 
                 phone = COALESCE(?, phone), 
                 class_id = COALESCE(?, class_id),
                 birthdate = COALESCE(?, birthdate),
                 gender = COALESCE(?, gender),
                 address = COALESCE(?, address),
                 place_of_birth = COALESCE(?, place_of_birth)
             WHERE id = ?${updateWhereTenantClause}`,
            updateParams
        );
        if (!rows || rows.affectedRows === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const selectWhereTenantClause = filterStudentsByTenant ? ' AND tenant_id = ?' : '';
        const selectParams = filterStudentsByTenant ? [req.params.id, tenantId] : [req.params.id];

        const [updatedRows] = await pool.query(
            `SELECT id, student_id, first_name, last_name, email, grade_level, phone, birthdate, gender, address, place_of_birth
             FROM students
             WHERE id = ?${selectWhereTenantClause}`,
            selectParams
        );

        res.json(updatedRows[0] || null);
    } catch (err) {
        console.error('[Students API] Error updating student:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete student
router.delete('/:id', async (req, res) => {
    try {
        const schema = await getStudentsSchema();
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const filterStudentsByTenant = shouldApplyTenantIdFilter(req, schema.students_has_tenant_id);
        const deleteSql = filterStudentsByTenant
            ? 'DELETE FROM students WHERE id = ? AND tenant_id = ?'
            : 'DELETE FROM students WHERE id = ?';
        const deleteParams = filterStudentsByTenant ? [req.params.id, tenantId] : [req.params.id];

        const [rows] = await pool.query(deleteSql, deleteParams);
        if (!rows || rows.affectedRows === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json({ message: 'Student deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;



