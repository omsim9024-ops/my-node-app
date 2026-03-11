const express = require('express');
const pool = require('../db');
const router = express.Router();

let registrationSchemaCache = null;
let teacherRouteTableCache = null;
let roleRequestSchemaCache = null;

function getTenantCacheKey(req) {
    const tenantId = Number(req?.tenant?.id || 0);
    const tenantCode = String(req?.tenant?.code || '').trim().toLowerCase();
    if (tenantId > 0) return `tenant:${tenantId}`;
    if (tenantCode) return `code:${tenantCode}`;
    return 'tenant:unknown';
}

function shouldApplyTenantIdFilter(req, hasTenantColumn) {
    const tenantId = Number(req?.tenant?.id || 0);
    if (!hasTenantColumn || !tenantId) return false;
    const isolationMode = String(req?.tenant?.isolationMode || '').trim().toLowerCase();
    return isolationMode !== 'database-per-tenant';
}

function normalizeTeacherRole(roleValue) {
    const raw = String(roleValue || '').toLowerCase().trim();
    if (!raw) return '';
    if (raw === 'adviser' || raw === 'advisor') return 'adviser';
    if (raw === 'subject teacher' || raw === 'subject_teacher' || raw === 'subject') return 'subject_teacher';
    if (raw === 'teacher') return '';
    return raw;
}

async function getTableColumns(tableName) {
    try {
        const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
        return new Set((columns || []).map((column) => String(column.Field || '').toLowerCase()));
    } catch (_err) {
        return new Set();
    }
}

async function getRegistrationSchema(req) {
    if (!(registrationSchemaCache instanceof Map)) {
        registrationSchemaCache = new Map();
    }

    const tenantKey = getTenantCacheKey(req);
    if (registrationSchemaCache.has(tenantKey)) {
        return registrationSchemaCache.get(tenantKey);
    }

    const [columns] = await pool.query('SHOW COLUMNS FROM registration_codes');
    const set = new Set(columns.map(col => String(col.Field || '').toLowerCase()));
    const schema = {
        hasStatus: set.has('status'),
        hasUsedAt: set.has('used_at'),
        hasUsedBy: set.has('used_by'),
        hasIsActive: set.has('is_active'),
        hasUsageCount: set.has('usage_count'),
        hasUsageLimit: set.has('usage_limit')
    };
    registrationSchemaCache.set(tenantKey, schema);
    return schema;
}

async function getTeacherRouteTableSchema(req) {
    if (!(teacherRouteTableCache instanceof Map)) {
        teacherRouteTableCache = new Map();
    }

    const tenantKey = getTenantCacheKey(req);
    if (teacherRouteTableCache.has(tenantKey)) {
        return teacherRouteTableCache.get(tenantKey);
    }

    const tableChecks = ['teacher_section_assignments', 'teacher_subject_assignments'];
    const schema = {};

    for (const tableName of tableChecks) {
        try {
            const [rows] = await pool.query(`SHOW TABLES LIKE ?`, [tableName]);
            schema[tableName] = Array.isArray(rows) && rows.length > 0;
        } catch (err) {
            schema[tableName] = false;
        }
    }

    const tenantColumnChecks = [
        'teachers',
        'sections',
        'school_years',
        'teacher_section_assignments',
        'teacher_subject_assignments'
    ];

    for (const tableName of tenantColumnChecks) {
        try {
            const [columns] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE 'tenant_id'`);
            schema[`${tableName}_has_tenant_id`] = Array.isArray(columns) && columns.length > 0;
        } catch (_err) {
            schema[`${tableName}_has_tenant_id`] = false;
        }
    }

    teacherRouteTableCache.set(tenantKey, schema);
    return schema;
}

async function ensureTeacherRoleRequestsTable(req) {
    if (!(roleRequestSchemaCache instanceof Map)) {
        roleRequestSchemaCache = new Map();
    }

    const tenantKey = getTenantCacheKey(req);
    if (roleRequestSchemaCache.has(tenantKey)) {
        return;
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS teacher_role_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT NOT NULL,
            tenant_id INT NULL,
            requested_role VARCHAR(40) NOT NULL,
            preferred_subject VARCHAR(120) NULL,
            preferred_section VARCHAR(120) NULL,
            notes TEXT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            admin_message TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_teacher_role_requests_teacher (teacher_id, status, updated_at),
            INDEX idx_teacher_role_requests_tenant (tenant_id, updated_at)
        )
    `);

    roleRequestSchemaCache.set(tenantKey, true);
}

async function ensureAdminNotificationsTableForRoleRequests() {
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
            INDEX idx_admin_notifications_admin (admin_id, is_read, created_at)
        )
    `);
}

async function ensureTeacherNotificationsTableForRoleRequests() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS teacher_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT NOT NULL,
            type VARCHAR(80) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            related_data LONGTEXT,
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMP NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_teacher_notifications_teacher (teacher_id, is_read, created_at)
        )
    `);
}

async function resolveTeacherRecord(identifier, req) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;

    const tableSchema = await getTeacherRouteTableSchema(req);
    const tenantId = Number(req?.tenant?.id || 0) || null;
    const filterTeachersByTenant = shouldApplyTenantIdFilter(req, tableSchema.teachers_has_tenant_id);

    const isNumeric = /^\d+$/.test(raw);
    const numericIdentifier = isNumeric ? Number.parseInt(raw, 10) : null;

    if (isNumeric) {
        const [rowsById] = await pool.query(
            `SELECT id, teacher_id, name, email, role FROM teachers WHERE id = ? ${filterTeachersByTenant ? 'AND tenant_id = ?' : ''} LIMIT 1`,
            filterTeachersByTenant ? [numericIdentifier, tenantId] : [numericIdentifier]
        );
        if (rowsById.length) return rowsById[0];

        const [rowsByTeacherCodeNumeric] = await pool.query(
            `SELECT id, teacher_id, name, email, role
             FROM teachers
             WHERE (teacher_id = ? OR teacher_id = ? OR CAST(teacher_id AS UNSIGNED) = ?) ${filterTeachersByTenant ? 'AND tenant_id = ?' : ''}
             LIMIT 1`,
            filterTeachersByTenant
                ? [raw, String(numericIdentifier), numericIdentifier, tenantId]
                : [raw, String(numericIdentifier), numericIdentifier]
        );
        if (rowsByTeacherCodeNumeric.length) return rowsByTeacherCodeNumeric[0];
    }

    const [rowsByTeacherCodeOrEmail] = await pool.query(
        `SELECT id, teacher_id, name, email, role
         FROM teachers
         WHERE (teacher_id = ? OR email = ?) ${filterTeachersByTenant ? 'AND tenant_id = ?' : ''}
         LIMIT 1`,
        filterTeachersByTenant ? [raw, raw, tenantId] : [raw, raw]
    );

    if (rowsByTeacherCodeOrEmail.length) return rowsByTeacherCodeOrEmail[0];
    return null;
}

// if the identifier refers to an adviser but that person has not yet been
// promoted to a "teacher" record, return their adviser row.  This allows the
// role-request endpoints to create a teacher entry on behalf of the adviser.
async function resolveAdviserRecord(identifier, req) {
    const raw = String(identifier || '').trim();
    if (!raw) return null;

    const tableSchema = await getTeacherRouteTableSchema(req); // same tenant logic applies
    const tenantId = Number(req?.tenant?.id || 0) || null;
    const filterByTenant = shouldApplyTenantIdFilter(req, tableSchema.advisers_has_tenant_id);

    const isNumeric = /^\d+$/.test(raw);
    const numericIdentifier = isNumeric ? Number.parseInt(raw, 10) : null;

    // search by primary key, adviser_id or email
    // The advisers table stores first_name and last_name instead of a single name column.
    // Build a full name alias so callers can continue to use `name`.
    let query = `SELECT id,
                        adviser_id AS teacher_id,
                        CONCAT(first_name, ' ', last_name) AS name,
                        email
                 FROM advisers
                 WHERE `;
    const params = [];

    if (isNumeric) {
        query += `(id = ? OR adviser_id = ? OR email = ?)`;
        params.push(numericIdentifier, raw, raw);
    } else {
        query += `(adviser_id = ? OR email = ?)`;
        params.push(raw, raw);
    }

    if (filterByTenant) {
        query += ' AND tenant_id = ?';
        params.push(tenantId);
    }

    query += ' LIMIT 1';

    const [rows] = await pool.query(query, params);
    return rows[0] || null;
}

async function resolveAdminRecipientIds(req, tenantId) {
    const adminColumns = await getTableColumns('admins');
    if (!adminColumns.size) return [];

    const where = [];
    const params = [];

    if (adminColumns.has('account_status')) {
        where.push("account_status = 'active'");
    }

    if (adminColumns.has('tenant_id') && tenantId) {
        where.push('tenant_id = ?');
        params.push(tenantId);
    }

    const sql = `SELECT id FROM admins ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
    const [rows] = await pool.query(sql, params);
    return (rows || [])
        .map((row) => Number.parseInt(row.id, 10))
        .filter((id) => Number.isFinite(id) && id > 0);
}

// Teacher registration (self-signup)
// Now requires a valid registration code from admin
router.post('/register', async (req, res) => {
    const { teacher_id, name, department, email, password, phone, registration_code } = req.body;
    
    if (!teacher_id || !name || !department || !email || !password || !registration_code) {
        return res.status(400).json({ error: 'Missing required fields (including registration code)' });
    }

    try {
        const registrationSchema = await getRegistrationSchema(req);
        const tableSchema = await getTeacherRouteTableSchema(req);
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const hasTeacherTenantColumn = !!tableSchema.teachers_has_tenant_id;

        // First, validate the registration code
        const fields = ['id', 'code', 'expires_at'];
        if (registrationSchema.hasStatus) fields.push('status');
        if (registrationSchema.hasUsedAt) fields.push('used_at');
        if (registrationSchema.hasIsActive) fields.push('is_active');
        if (registrationSchema.hasUsageCount) fields.push('usage_count');
        if (registrationSchema.hasUsageLimit) fields.push('usage_limit');

        const [codeResults] = await pool.query(
            `SELECT ${fields.join(', ')} 
             FROM registration_codes 
             WHERE code = ? LIMIT 1`,
            [registration_code.toUpperCase()]
        );
        
        if (codeResults.length === 0) {
            return res.status(400).json({ error: 'Invalid registration code' });
        }
        
        const codeRecord = codeResults[0];

        // codes are intended to be reusable; previous uses do not invalidate the code.
        // (we still track usage_count for stats but we do not block registration.)
        // Check if expired
        if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
            return res.status(400).json({ error: 'This registration code has expired' });
        }
        
        // Check if revoked
        const isRevoked = registrationSchema.hasStatus
            ? String(codeRecord.status || '').toLowerCase() !== 'active'
            : (registrationSchema.hasIsActive ? Number(codeRecord.is_active || 0) !== 1 : false);

        if (isRevoked) {
            return res.status(400).json({ error: 'This registration code is no longer valid' });
        }
        
        // Code is valid, proceed with registration
        const registerSql = hasTeacherTenantColumn
            ? `INSERT INTO teachers (teacher_id, name, department, email, password, phone, tenant_id, created_at)
               VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`
            : `INSERT INTO teachers (teacher_id, name, department, email, password, phone, created_at)
               VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)`;
        const registerParams = hasTeacherTenantColumn
            ? [teacher_id, name, department, email, password, phone || null, tenantId]
            : [teacher_id, name, department, email, password, phone || null];

        const result = await pool.query(registerSql, registerParams);

        const teacherId = result[0].insertId;
        
        // Optionally bump usage_count but leave code active
        try {
            const setClauses = [];
            const updateParams = [];

            if (registrationSchema.hasUsageCount) setClauses.push('usage_count = COALESCE(usage_count,0) + 1');
            // do not touch status, used_at, used_by or is_active

            if (setClauses.length > 0) {
                updateParams.push(codeRecord.id);
                await pool.query(
                    `UPDATE registration_codes 
                     SET ${setClauses.join(', ')}
                     WHERE id = ?`,
                    updateParams
                );
            }

        } catch (codeErr) {
            console.error('Warning: Could not update code usage count:', codeErr);
            // Continue anyway - registration is complete
        }

        res.status(201).json({ 
            success: true, 
            teacher: {
                teacher_id,
                name,
                department,
                email,
                phone: phone || null
            },
            message: 'Registration successful'
        });
    } catch (err) {
        console.error('Teacher register error:', err);
        if (err.code === '23505' || err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Teacher ID or email already exists' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Teacher login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    try {
        const tableSchema = await getTeacherRouteTableSchema(req);
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterTeachersByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teachers_has_tenant_id);

        const loginSql = filterTeachersByTenantId
            ? `SELECT id, teacher_id, name, department, email, password, role, account_status, tenant_id
               FROM teachers
               WHERE email = ? AND (tenant_id = ? OR tenant_id IS NULL)
               ORDER BY CASE WHEN tenant_id = ? THEN 0 ELSE 1 END, id DESC
               LIMIT 1`
            : `SELECT id, teacher_id, name, department, email, password, role, account_status, tenant_id
               FROM teachers
               WHERE email = ?
               LIMIT 1`;
        const loginParams = filterTeachersByTenantId
            ? [email, tenantId, tenantId]
            : [email];

        const [rows] = await pool.query(loginSql, loginParams);
        if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        const teacher = rows[0];
        if (teacher.account_status !== 'active') return res.status(403).json({ error: 'Account inactive' });
        if (teacher.password !== password) return res.status(401).json({ error: 'Invalid credentials' });

        if (filterTeachersByTenantId && tableSchema.teachers_has_tenant_id && tenantId && (teacher.tenant_id == null)) {
            try {
                await pool.query(
                    'UPDATE teachers SET tenant_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id IS NULL',
                    [tenantId, teacher.id]
                );
                teacher.tenant_id = tenantId;
            } catch (bindErr) {
                console.warn('Teacher login succeeded but tenant backfill failed:', bindErr && bindErr.message ? bindErr.message : bindErr);
            }
        }

        // update last login timestamp
        try { await pool.query('UPDATE teachers SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [teacher.id]); } catch(e){}

        const normalizedRole = normalizeTeacherRole(teacher.role);
        res.json({ success: true, teacher: { id: teacher.id, teacher_id: teacher.teacher_id, name: teacher.name, email: teacher.email, role: normalizedRole } });
    } catch (err) {
        console.error('Teacher login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Admin: list all teachers (those who signed up/logged in)
router.get('/list', async (req, res) => {
    try {
        const tableSchema = await getTeacherRouteTableSchema(req);
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterTeachersByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teachers_has_tenant_id);

        let teachersQuery = 'SELECT id, teacher_id, name, department, email, phone, role, account_status, created_at FROM teachers';
        const teachersParams = [];
        if (filterTeachersByTenantId) {
            teachersQuery += ' WHERE tenant_id = ?';
            teachersParams.push(tenantId);
        }
        teachersQuery += ' ORDER BY created_at DESC';

        const [teachers] = await pool.query(teachersQuery, teachersParams);

        for (const t of teachers) {
            t.assigned_sections = [];
            t.subject_assignments = [];

            if (tableSchema.teacher_section_assignments) {
                try {
                    const filterSectionAssignmentsByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teacher_section_assignments_has_tenant_id);
                    const [assigned] = await pool.query(
                        `SELECT tsa.section_id, s.section_code, s.section_name, s.grade,
                                tsa.assigned_date, tsa.school_year_id, sy.school_year
                         FROM teacher_section_assignments tsa
                         LEFT JOIN sections s ON s.id = tsa.section_id
                         LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
                         WHERE tsa.teacher_id = ?
                         ${filterSectionAssignmentsByTenantId ? 'AND tsa.tenant_id = ?' : ''}
                         ORDER BY s.grade, s.section_code`,
                        filterSectionAssignmentsByTenantId ? [t.id, tenantId] : [t.id]
                    );
                    t.assigned_sections = Array.isArray(assigned) ? assigned : [];
                } catch (sectionErr) {
                    console.error(`[GET /list] Error loading assigned sections for teacher ${t.id}:`, sectionErr);
                    t.assigned_sections = [];
                }
            }

            if (tableSchema.teacher_subject_assignments) {
                try {
                    const filterSubjectAssignmentsByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teacher_subject_assignments_has_tenant_id);
                    const [subjectAssign] = await pool.query(
                        `SELECT tsubj.section_id, tsubj.subject, s.section_code, s.section_name,
                                s.grade, tsubj.school_year_id, sy.school_year
                         FROM teacher_subject_assignments tsubj
                         LEFT JOIN sections s ON s.id = tsubj.section_id
                         LEFT JOIN school_years sy ON sy.id = tsubj.school_year_id
                         WHERE tsubj.teacher_id = ?
                         ${filterSubjectAssignmentsByTenantId ? 'AND tsubj.tenant_id = ?' : ''}
                         ORDER BY s.grade, s.section_code, tsubj.subject`,
                        filterSubjectAssignmentsByTenantId ? [t.id, tenantId] : [t.id]
                    );
                    t.subject_assignments = Array.isArray(subjectAssign) ? subjectAssign : [];
                } catch (subjectErr) {
                    console.error(`[GET /list] Error loading subject assignments for teacher ${t.id}:`, subjectErr);
                    t.subject_assignments = [];
                }
            }
        }

        res.json({ success: true, teachers });
    } catch (err) {
        console.error('Error fetching teachers:', err);
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

// Admin: assign role to teacher and optionally assign sections when role=adviser
router.put('/assign-role', async (req, res) => {
    const { teacher_id, role, sections, school_year_id, advisory_section_id, advisory_section_ids, teaching_sections } = req.body;
    const normalizedRole = normalizeTeacherRole(role);
    const rawSectionValues = [];
    if (Array.isArray(sections)) rawSectionValues.push(...sections);
    if (Array.isArray(advisory_section_ids)) rawSectionValues.push(...advisory_section_ids);
    if (Array.isArray(teaching_sections)) rawSectionValues.push(...teaching_sections);
    if (advisory_section_id !== undefined && advisory_section_id !== null && advisory_section_id !== '') {
        rawSectionValues.push(advisory_section_id);
    }

    const normalizedSections = Array.from(new Set(
        rawSectionValues
            .map(value => Number(value))
            .filter(value => Number.isFinite(value) && value > 0)
    ));

    const normalizedSchoolYearId = Number(school_year_id);
    let effectiveSchoolYearId = Number.isFinite(normalizedSchoolYearId) && normalizedSchoolYearId > 0
        ? normalizedSchoolYearId
        : null;

    console.log('[PUT /assign-role] Received request:', {
        tenant_key: getTenantCacheKey(req),
        teacher_id,
        role,
        normalizedRole,
        sections: normalizedSections,
        school_year_id: effectiveSchoolYearId
    });
    
    if (!teacher_id || !normalizedRole) return res.status(400).json({ error: 'teacher_id and valid role required' });

    try {
        const tableSchema = await getTeacherRouteTableSchema(req);
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterTeachersByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teachers_has_tenant_id);
        const filterSectionAssignmentsByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teacher_section_assignments_has_tenant_id);
        const filterSubjectAssignmentsByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teacher_subject_assignments_has_tenant_id);
        const filterSchoolYearsByTenantId = shouldApplyTenantIdFilter(req, tableSchema.school_years_has_tenant_id);

        if (!effectiveSchoolYearId && Array.isArray(req.body.subject_loads) && req.body.subject_loads.length > 0) {
            try {
                const activeYearSql = filterSchoolYearsByTenantId
                    ? `SELECT id FROM school_years WHERE is_active = 1 AND tenant_id = ? ORDER BY id DESC LIMIT 1`
                    : `SELECT id FROM school_years WHERE is_active = 1 ORDER BY id DESC LIMIT 1`;
                const activeYearParams = filterSchoolYearsByTenantId ? [tenantId] : [];
                const [activeYearRows] = await pool.query(activeYearSql, activeYearParams);
                const activeYearId = Number(activeYearRows?.[0]?.id || 0);
                if (activeYearId > 0) {
                    effectiveSchoolYearId = activeYearId;
                }
            } catch (_err) {}
        }

        let verifiedSubjectAssignments = [];
        let verifiedSubjectCount = 0;
        const updateTeachersSql = filterTeachersByTenantId
            ? 'UPDATE teachers SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?'
            : 'UPDATE teachers SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const updateTeachersParams = filterTeachersByTenantId
            ? [normalizedRole, teacher_id, tenantId]
            : [normalizedRole, teacher_id];
        const [upd] = await pool.query(updateTeachersSql, updateTeachersParams);
        if (!upd || upd.affectedRows === 0) return res.status(404).json({ error: 'Teacher not found' });
        console.log('[PUT /assign-role] Teacher updated with role:', normalizedRole);

        // if assigning adviser role and sections provided, insert into teacher_section_assignments
        if (tableSchema.teacher_section_assignments && normalizedRole === 'adviser' && normalizedSections.length > 0 && effectiveSchoolYearId) {
            console.log(`[PUT /assign-role] Assigning ${normalizedSections.length} section(s) to teacher ${teacher_id} for school year ${effectiveSchoolYearId}`);
            for (const sectionId of normalizedSections) {
                try {
                    // use INSERT IGNORE to avoid duplicates because of unique constraint
                          const insertSectionSql = filterSectionAssignmentsByTenantId
                        ? `INSERT IGNORE INTO teacher_section_assignments (teacher_id, section_id, school_year_id, tenant_id, assigned_date, created_at)
                           VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`
                        : `INSERT IGNORE INTO teacher_section_assignments (teacher_id, section_id, school_year_id, assigned_date, created_at)
                           VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`;
                          const insertSectionParams = filterSectionAssignmentsByTenantId
                        ? [teacher_id, sectionId, effectiveSchoolYearId, tenantId]
                        : [teacher_id, sectionId, effectiveSchoolYearId];

                    await pool.query(insertSectionSql, insertSectionParams);
                    console.log(`[PUT /assign-role] Section ${sectionId} assignment succeeded`);
                } catch (e) {
                    console.error(`[PUT /assign-role] Error assigning section ${sectionId} to teacher:`, e);
                }
            }
            // Verify the assignments were saved
            const verifySectionSql = filterSectionAssignmentsByTenantId
                ? 'SELECT * FROM teacher_section_assignments WHERE teacher_id = ? AND school_year_id = ? AND tenant_id = ?'
                : 'SELECT * FROM teacher_section_assignments WHERE teacher_id = ? AND school_year_id = ?';
            const verifySectionParams = filterSectionAssignmentsByTenantId
                ? [teacher_id, effectiveSchoolYearId, tenantId]
                : [teacher_id, effectiveSchoolYearId];
            const [verify] = await pool.query(
                verifySectionSql,
                verifySectionParams
            );
            console.log('[PUT /assign-role] Verification: Found', verify.length, 'assignments after insert');
        } else {
            console.log('[PUT /assign-role] Not assigning sections - role:', normalizedRole, 'sections:', normalizedSections, 'school_year_id:', effectiveSchoolYearId);
        }

        // If subject_loads provided, persist them to teacher_subject_assignments
        // Expected shape: [{ subject: 'Math', sections: [1,2] }, ...]
        if (tableSchema.teacher_subject_assignments && Array.isArray(req.body.subject_loads) && req.body.subject_loads.length > 0 && effectiveSchoolYearId) {
            try {
                // Option: remove existing subject assignments for this teacher & school year to replace with new set
                const deleteSubjectSql = filterSubjectAssignmentsByTenantId
                    ? `DELETE FROM teacher_subject_assignments WHERE teacher_id = ? AND school_year_id = ? AND tenant_id = ?`
                    : `DELETE FROM teacher_subject_assignments WHERE teacher_id = ? AND school_year_id = ?`;
                const deleteSubjectParams = filterSubjectAssignmentsByTenantId
                    ? [teacher_id, effectiveSchoolYearId, tenantId]
                    : [teacher_id, effectiveSchoolYearId];

                await pool.query(deleteSubjectSql, deleteSubjectParams);

                let attemptedPairs = 0;
                let persistedRows = 0;

                for (const load of req.body.subject_loads) {
                    const subj = load.subject || '';
                    const secs = Array.isArray(load.sections) ? load.sections : [];
                    for (const sid of secs) {
                        const numericSectionId = Number(sid);
                        const normalizedSubject = String(subj || '').trim();
                        if (!Number.isFinite(numericSectionId) || numericSectionId <= 0 || !normalizedSubject) {
                            continue;
                        }
                        attemptedPairs += 1;
                        try {
                                     const insertSubjectSql = filterSubjectAssignmentsByTenantId
                                ? `INSERT IGNORE INTO teacher_subject_assignments (teacher_id, section_id, subject, school_year_id, tenant_id, created_at)
                                   VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)`
                                : `INSERT IGNORE INTO teacher_subject_assignments (teacher_id, section_id, subject, school_year_id, created_at)
                                   VALUES (?,?,?,?,CURRENT_TIMESTAMP)`;
                                     const insertSubjectParams = filterSubjectAssignmentsByTenantId
                                ? [teacher_id, numericSectionId, normalizedSubject, effectiveSchoolYearId, tenantId]
                                : [teacher_id, numericSectionId, normalizedSubject, effectiveSchoolYearId];
                            const [insertResult] = await pool.query(insertSubjectSql, insertSubjectParams);
                            persistedRows += Number(insertResult?.affectedRows || 0);
                        } catch (e) {
                            console.error('Error saving subject assignment:', e);
                        }
                    }
                }

                    const verifySubjectSql = filterSubjectAssignmentsByTenantId
                    ? `SELECT COUNT(*) AS total
                       FROM teacher_subject_assignments
                              WHERE teacher_id = ? AND school_year_id = ? AND tenant_id = ?`
                    : `SELECT COUNT(*) AS total
                       FROM teacher_subject_assignments
                       WHERE teacher_id = ? AND school_year_id = ?`;
                const verifySubjectParams = filterSubjectAssignmentsByTenantId
                    ? [teacher_id, effectiveSchoolYearId, tenantId]
                    : [teacher_id, effectiveSchoolYearId];
                const [verifyRows] = await pool.query(verifySubjectSql, verifySubjectParams);
                const storedCount = Number(verifyRows?.[0]?.total || 0);
                verifiedSubjectCount = storedCount;

                const verifyAssignmentsSql = filterSubjectAssignmentsByTenantId
                    ? `SELECT tsa.section_id, tsa.subject, tsa.school_year_id, s.section_code, s.section_name, sy.school_year
                       FROM teacher_subject_assignments tsa
                       LEFT JOIN sections s ON s.id = tsa.section_id
                       LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
                       WHERE tsa.teacher_id = ? AND tsa.school_year_id = ? AND tsa.tenant_id = ?
                       ORDER BY s.grade, s.section_code, tsa.subject`
                    : `SELECT tsa.section_id, tsa.subject, tsa.school_year_id, s.section_code, s.section_name, sy.school_year
                       FROM teacher_subject_assignments tsa
                       LEFT JOIN sections s ON s.id = tsa.section_id
                       LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
                       WHERE tsa.teacher_id = ? AND tsa.school_year_id = ?
                       ORDER BY s.grade, s.section_code, tsa.subject`;
                const verifyAssignmentsParams = filterSubjectAssignmentsByTenantId
                    ? [teacher_id, effectiveSchoolYearId, tenantId]
                    : [teacher_id, effectiveSchoolYearId];
                const [savedRows] = await pool.query(verifyAssignmentsSql, verifyAssignmentsParams);
                verifiedSubjectAssignments = Array.isArray(savedRows) ? savedRows : [];

                console.log('[PUT /assign-role] Subject assignment verification:', {
                    teacher_id,
                    school_year_id: effectiveSchoolYearId,
                    attempted_pairs: attemptedPairs,
                    insert_affected_rows: persistedRows,
                    stored_count: storedCount,
                    tenant_id: tenantId
                });

                if (attemptedPairs > 0 && storedCount === 0) {
                    return res.status(500).json({
                        error: 'No subject assignments were stored. Please verify sections/subjects and tenant configuration.'
                    });
                }
            } catch (e) {
                console.error('Error processing subject_loads:', e);
                return res.status(500).json({ error: 'Failed to save subject assignments' });
            }
        }

        const updatedTeacherSql = filterTeachersByTenantId
            ? 'SELECT * FROM teachers WHERE id = ? AND tenant_id = ?'
            : 'SELECT * FROM teachers WHERE id = ?';
        const updatedTeacherParams = filterTeachersByTenantId
            ? [teacher_id, tenantId]
            : [teacher_id];
        const [updatedRows] = await pool.query(updatedTeacherSql, updatedTeacherParams);
        if (updatedRows && updatedRows[0]) {
            updatedRows[0].role = normalizeTeacherRole(updatedRows[0].role);
        }
        res.json({
            success: true,
            teacher: updatedRows[0],
            subject_assignments_saved: verifiedSubjectCount,
            subject_assignments: verifiedSubjectAssignments,
            school_year_id: effectiveSchoolYearId
        });
    } catch (err) {
        console.error('Error assigning role:', err);
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

// Get teacher's assigned sections
router.get('/sections/:teacher_id', async (req, res) => {
    const tid = req.params.teacher_id;
    try {
        const tableSchema = await getTeacherRouteTableSchema(req);
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterSectionAssignmentsByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teacher_section_assignments_has_tenant_id);
        const [rows] = await pool.query(`SELECT tsa.*, s.section_code, s.section_name, sy.school_year
            FROM teacher_section_assignments tsa
            JOIN sections s ON s.id = tsa.section_id
            LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
            WHERE tsa.teacher_id = ?
            ${filterSectionAssignmentsByTenantId ? 'AND tsa.tenant_id = ?' : ''}`,
            filterSectionAssignmentsByTenantId ? [tid, tenantId] : [tid]);
        res.json({ success: true, assignments: rows });
    } catch (err) {
        console.error('Error fetching teacher sections:', err);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

// Get teacher's subject assignments
router.get('/subject-assignments/:teacher_id', async (req, res) => {
    const tid = req.params.teacher_id;
    try {
        const tableSchema = await getTeacherRouteTableSchema(req);
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterSubjectAssignmentsByTenantId = shouldApplyTenantIdFilter(req, tableSchema.teacher_subject_assignments_has_tenant_id);
        if (!tableSchema.teacher_subject_assignments) {
            return res.json({ success: true, assignments: [] });
        }

        const [rows] = await pool.query(`SELECT tsa.*, s.section_code, s.section_name, sy.school_year
            FROM teacher_subject_assignments tsa
            JOIN sections s ON s.id = tsa.section_id
            LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
            WHERE tsa.teacher_id = ?
            ${filterSubjectAssignmentsByTenantId ? 'AND tsa.tenant_id = ?' : ''}`,
            filterSubjectAssignmentsByTenantId ? [tid, tenantId] : [tid]);
        res.json({ success: true, assignments: rows });
    } catch (err) {
        console.error('Error fetching teacher subject assignments:', err);
        res.status(500).json({ error: 'Failed to fetch subject assignments' });
    }
});

// Teacher login (used by auth page when role=adviser)
router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    try {
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterTeachersByTenantId = shouldApplyTenantIdFilter(req, await getTeacherRouteTableSchema(req));
        let sql = 'SELECT id, teacher_id, name, department, email, role, account_status, password FROM teachers WHERE email = ?';
        const params = [email];
        if (filterTeachersByTenantId && tenantId) {
            sql += ' AND tenant_id = ?';
            params.push(tenantId);
        }
        sql += ' LIMIT 1';
        const [rows] = await pool.query(sql, params);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const teacher = rows[0];
        if (teacher.account_status && String(teacher.account_status).toLowerCase() !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }
        // simple plaintext compare; adjust if password hashing used
        if (String(password) !== String(teacher.password)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        res.json({
            success: true,
            message: 'Login successful',
            teacher: {
                id: teacher.id,
                teacher_id: teacher.teacher_id,
                name: teacher.name,
                email: teacher.email,
                role: teacher.role || ''
            }
        });
    } catch (err) {
        console.error('Teacher login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Check current role and status by email (for dashboard role-change detection)
router.get('/current-role/:email', async (req, res) => {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
        const [rows] = await pool.query(
            'SELECT id, teacher_id, name, email, role, account_status FROM teachers WHERE email = ? LIMIT 1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        const teacher = rows[0];
        const normalizedRole = normalizeTeacherRole(teacher.role);
        res.json({
            success: true,
            teacher: {
                id: teacher.id,
                teacher_id: teacher.teacher_id,
                name: teacher.name,
                email: teacher.email,
                role: normalizedRole,
                account_status: teacher.account_status
            }
        });
    } catch (err) {
        console.error('Error fetching teacher role:', err);
        res.status(500).json({ error: 'Failed to fetch role' });
    }
});

// Admin: Update section assignments for a teacher (delete all, then re-add selected ones)
router.put('/update-sections', async (req, res) => {
    const { teacher_id, sections, school_year_id, role } = req.body;
    
    if (!teacher_id || !school_year_id) {
        return res.status(400).json({ error: 'teacher_id and school_year_id required' });
    }

    try {
        const tableSchema = await getTeacherRouteTableSchema(req);
        // Verify teacher exists
        const [teacherRows] = await pool.query('SELECT id FROM teachers WHERE id = ? LIMIT 1', [teacher_id]);
        if (!teacherRows || teacherRows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        if (!tableSchema.teacher_section_assignments) {
            return res.status(500).json({ error: 'Section assignment table is not available' });
        }

        // Update teacher role if provided
        if (role) {
            console.log(`[update-sections] Updating teacher ${teacher_id} role to: ${role}`);
            await pool.query(
                `UPDATE teachers SET role = ? WHERE id = ?`,
                [role, teacher_id]
            );
        }

        // Delete all existing assignments for this teacher in this school year
        console.log(`[update-sections] Deleting existing assignments for teacher ${teacher_id} in school year ${school_year_id}`);
        await pool.query(
            `DELETE FROM teacher_section_assignments 
             WHERE teacher_id = ? AND school_year_id = ?`,
            [teacher_id, school_year_id]
        );

        // Insert new section assignments
        if (Array.isArray(sections) && sections.length > 0) {
            console.log(`[update-sections] Adding ${sections.length} new section assignment(s) for teacher ${teacher_id}`);
            for (const sectionId of sections) {
                try {
                    await pool.query(
                        `INSERT INTO teacher_section_assignments (teacher_id, section_id, school_year_id, assigned_date, created_at)
                         VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
                        [teacher_id, sectionId, school_year_id]
                    );
                } catch (e) {
                    console.error(`[update-sections] Error assigning section ${sectionId} to teacher ${teacher_id}:`, e);
                }
            }
        }

        // Return updated teacher info
        const [updated] = await pool.query('SELECT * FROM teachers WHERE id = ?', [teacher_id]);
        res.json({ 
            success: true, 
            message: `Section assignments${role ? ' and role' : ''} updated for teacher ${teacher_id}`,
            teacher: updated[0] 
        });
    } catch (err) {
        console.error('Error updating section assignments:', err);
        res.status(500).json({ error: 'Failed to update section assignments' });
    }
});

router.get('/role-request/:teacher_id', async (req, res) => {
    const teacherIdentifier = String(req.params.teacher_id || '').trim();
    if (!teacherIdentifier) {
        return res.status(400).json({ error: 'Invalid teacher identifier' });
    }

    try {
        await ensureTeacherRoleRequestsTable(req);

        // attempt to resolve existing teacher or fall back to adviser
        let teacher = await resolveTeacherRecord(teacherIdentifier, req);
        if (!teacher || !teacher.id) {
            console.log('[role-request] no teacher row for', teacherIdentifier, '- checking advisers');
            const adviser = await resolveAdviserRecord(teacherIdentifier, req);
            if (adviser && adviser.id) {
                console.log('[role-request] found adviser row', adviser);

                // check for a teacher using adviser id or email before inserting
                teacher = await resolveTeacherRecord(adviser.adviser_id || adviser.email || '', req);
                if (!teacher || !teacher.id) {
                    try {
                        const columns = await getTableColumns('teachers');
                        const hasTenant = columns.has('tenant_id');
                        const defaultDept = 'Unassigned';
                        const displayName = adviser.name ||
                            [adviser.first_name, adviser.last_name].filter(Boolean).join(' ').trim() || '';
                        const insertSql = hasTenant
                            ? 'INSERT INTO teachers (teacher_id, name, department, email, tenant_id, created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)'
                            : 'INSERT INTO teachers (teacher_id, name, department, email, created_at) VALUES (?,?,?, ?,CURRENT_TIMESTAMP)';
                        const params = hasTenant
                            ? [adviser.adviser_id || '', displayName, defaultDept, adviser.email || '', Number(req?.tenant?.id || 0) || null]
                            : [adviser.adviser_id || '', displayName, defaultDept, adviser.email || ''];
                        const [result] = await pool.query(insertSql, params);
                        console.log('[role-request] created teacher row id', result.insertId);
                        teacher = {
                            id: result.insertId,
                            teacher_id: adviser.adviser_id || '',
                            name: displayName || adviser.name,
                            email: adviser.email
                        };
                    } catch (inErr) {
                        if (inErr && inErr.code === 'ER_DUP_ENTRY') {
                            console.log('[role-request] duplicate detected while creating teacher, resolving existing');
                            teacher = await resolveTeacherRecord(adviser.adviser_id || adviser.email || '', req);
                        } else {
                            console.error('[role-request] error creating teacher from adviser', inErr);
                        }
                    }
                } else {
                    console.log('[role-request] teacher already exists for adviser, skipping insert');
                }
            } else {
                console.log('[role-request] no adviser record found for', teacherIdentifier);
            }
        }
        if (!teacher || !teacher.id) {
            console.log('[role-request] still no teacher after fallback, returning 404');
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const teacherId = Number(teacher.id);

        const tenantId = Number(req?.tenant?.id || 0) || null;
        const roleRequestColumns = await getTableColumns('teacher_role_requests');
        const hasTenantColumn = roleRequestColumns.has('tenant_id');
        const applyTenantFilter = shouldApplyTenantIdFilter(req, hasTenantColumn);

        const [rows] = await pool.query(
            `SELECT id, teacher_id, requested_role, preferred_subject, preferred_section, notes, status, admin_message, created_at, updated_at
             FROM teacher_role_requests
             WHERE teacher_id = ? ${applyTenantFilter ? 'AND tenant_id = ?' : ''}
             ORDER BY updated_at DESC
             LIMIT 1`,
            applyTenantFilter ? [teacherId, tenantId] : [teacherId]
        );

        return res.status(200).json({
            success: true,
            request: rows[0] || null
        });
    } catch (err) {
        console.error('Error fetching teacher role request:', err);
        return res.status(500).json({ error: 'Failed to fetch role request status' });
    }
});

router.post('/role-request', async (req, res) => {
    const teacherIdentifier = String(req.body?.teacher_id || '').trim();
    const requestedRoleRaw = String(req.body?.requested_role || '').toLowerCase().trim();
    const preferredSubject = String(req.body?.preferred_subject || '').trim() || null;
    const preferredSection = String(req.body?.preferred_section || '').trim() || null;
    const notes = String(req.body?.notes || '').trim() || null;

    const normalizedRole = normalizeTeacherRole(requestedRoleRaw);
    const allowedRoles = new Set(['adviser', 'subject_teacher']);

    if (!teacherIdentifier || !allowedRoles.has(normalizedRole)) {
        return res.status(400).json({ error: 'teacher_id and a valid requested_role are required' });
    }

    try {
        await ensureTeacherRoleRequestsTable(req);

        let teacher = await resolveTeacherRecord(teacherIdentifier, req);
        if (!teacher || !teacher.id) {
            console.log('[role-request][POST] no teacher for', teacherIdentifier, 'falling back to adviser');
            const adviser = await resolveAdviserRecord(teacherIdentifier, req);
            if (adviser && adviser.id) {
                console.log('[role-request][POST] adviser found', adviser);

                // before attempting to insert we may already have a teacher row
                // that matches the adviser by email or teacher_id.  this can
                // happen if the numeric identifier (e.g. "5") doesn't match the
                // teacher record but the email does.  resolving up front avoids a
                // noisy duplicate-key error.
                teacher = await resolveTeacherRecord(adviser.adviser_id || adviser.email || '', req);
                if (!teacher || !teacher.id) {
                    const columns = await getTableColumns('teachers');
                    const hasTenant = columns.has('tenant_id');
                    const defaultDept = 'Unassigned';
                    const displayName = adviser.name ||
                        [adviser.first_name, adviser.last_name].filter(Boolean).join(' ').trim() || '';
                    const insertSql = hasTenant
                        ? 'INSERT INTO teachers (teacher_id, name, department, email, tenant_id, created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)'
                        : 'INSERT INTO teachers (teacher_id, name, department, email, created_at) VALUES (?,?,?, ?,CURRENT_TIMESTAMP)';
                    const params = hasTenant
                        ? [adviser.adviser_id || '', displayName, defaultDept, adviser.email || '', Number(req?.tenant?.id || 0) || null]
                        : [adviser.adviser_id || '', displayName, defaultDept, adviser.email || ''];
                    try {
                        const [result] = await pool.query(insertSql, params);
                        console.log('[role-request][POST] created teacher row id', result.insertId);
                        teacher = {
                            id: result.insertId,
                            teacher_id: adviser.adviser_id || '',
                            name: displayName || adviser.name,
                            email: adviser.email
                        };
                    } catch (inErr) {
                        // duplicate is expected if someone added the teacher via
                        // another flow while we were processing; recover gracefully.
                        if (inErr && inErr.code === 'ER_DUP_ENTRY') {
                            console.log('[role-request][POST] duplicate detected during insert, resolving existing teacher');
                            teacher = await resolveTeacherRecord(adviser.adviser_id || adviser.email || '', req);
                        } else {
                            // only log unexpected errors
                            console.error('[role-request][POST] error creating teacher', inErr);
                        }
                    }
                } else {
                    console.log('[role-request][POST] teacher already exists, skipping insert');
                }
            }
        }
        if (!teacher || !teacher.id) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const teacherId = Number(teacher.id);

        const tenantId = Number(req?.tenant?.id || 0) || null;
        const roleRequestColumns = await getTableColumns('teacher_role_requests');
        const hasTenantColumn = roleRequestColumns.has('tenant_id');
        const applyTenantFilter = shouldApplyTenantIdFilter(req, hasTenantColumn);

        const [existingRows] = await pool.query(
            `SELECT id, status
             FROM teacher_role_requests
             WHERE teacher_id = ? ${applyTenantFilter ? 'AND tenant_id = ?' : ''}
             ORDER BY updated_at DESC
             LIMIT 1`,
            applyTenantFilter ? [teacherId, tenantId] : [teacherId]
        );

        let requestId = null;
        let action = 'created';

        if (existingRows.length && String(existingRows[0].status || '').toLowerCase() === 'pending') {
            requestId = Number(existingRows[0].id);
            await pool.query(
                `UPDATE teacher_role_requests
                 SET requested_role = ?, preferred_subject = ?, preferred_section = ?, notes = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [normalizedRole, preferredSubject, preferredSection, notes, requestId]
            );
            action = 'updated';
        } else {
            const insertSql = hasTenantColumn
                ? `INSERT INTO teacher_role_requests (teacher_id, tenant_id, requested_role, preferred_subject, preferred_section, notes, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
                : `INSERT INTO teacher_role_requests (teacher_id, requested_role, preferred_subject, preferred_section, notes, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
            const insertParams = hasTenantColumn
                ? [teacherId, tenantId, normalizedRole, preferredSubject, preferredSection, notes]
                : [teacherId, normalizedRole, preferredSubject, preferredSection, notes];
            const [insertResult] = await pool.query(insertSql, insertParams);
            requestId = Number(insertResult.insertId);
        }

        try {
            await ensureAdminNotificationsTableForRoleRequests();
            const adminIds = await resolveAdminRecipientIds(req, tenantId);

            if (adminIds.length) {
                const roleLabel = normalizedRole === 'subject_teacher' ? 'Subject Teacher' : 'Adviser';
                const baseMessage = `${teacher.name || 'A teacher'} submitted a role request for ${roleLabel}.`;
                const details = [
                    preferredSubject ? `Preferred subject: ${preferredSubject}` : null,
                    preferredSection ? `Preferred section: ${preferredSection}` : null,
                    notes ? `Notes: ${notes}` : null
                ].filter(Boolean).join(' ');
                const fullMessage = details ? `${baseMessage} ${details}` : baseMessage;
                const relatedData = JSON.stringify({
                    teacher_id: teacherId,
                    teacher_name: teacher.name || null,
                    teacher_email: teacher.email || null,
                    request_id: requestId,
                    requested_role: normalizedRole,
                    preferred_subject: preferredSubject,
                    preferred_section: preferredSection,
                    notes: notes
                });

                for (const adminId of adminIds) {
                    await pool.query(
                        `INSERT INTO admin_notifications (admin_id, type, title, message, related_data, created_at, updated_at)
                         VALUES (?, 'teacher_role_request', 'Teacher Role Request', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [adminId, fullMessage, relatedData]
                    );
                }
            } else {
                console.warn('Role request submitted but no admin recipients were found in admins table for tenant:', tenantId);
            }
        } catch (notifErr) {
            console.warn('Role request submitted but failed to notify admins:', notifErr && notifErr.message ? notifErr.message : notifErr);
        }

        const [requestRows] = await pool.query(
            `SELECT id, teacher_id, requested_role, preferred_subject, preferred_section, notes, status, admin_message, created_at, updated_at
             FROM teacher_role_requests
             WHERE id = ?
             LIMIT 1`,
            [requestId]
        );

        return res.status(200).json({
            success: true,
            action,
            request: requestRows[0] || null
        });
    } catch (err) {
        console.error('Error submitting teacher role request:', err);
        return res.status(500).json({ error: 'Failed to submit role request' });
    }
});

router.get('/role-requests', async (req, res) => {
    const statusFilter = String(req.query?.status || 'pending').trim().toLowerCase();
    const allowedStatus = new Set(['pending', 'approved', 'rejected', 'all']);
    if (!allowedStatus.has(statusFilter)) {
        return res.status(400).json({ error: 'Invalid status filter' });
    }

    const limitRaw = Number.parseInt(req.query?.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

    try {
        await ensureTeacherRoleRequestsTable(req);

        const tenantId = Number(req?.tenant?.id || 0) || null;
        const roleRequestColumns = await getTableColumns('teacher_role_requests');
        const hasTenantColumn = roleRequestColumns.has('tenant_id');
        const applyTenantFilter = shouldApplyTenantIdFilter(req, hasTenantColumn);

        const where = [];
        const params = [];

        if (applyTenantFilter) {
            where.push('r.tenant_id = ?');
            params.push(tenantId);
        }
        if (statusFilter !== 'all') {
            where.push('LOWER(r.status) = ?');
            params.push(statusFilter);
        }

        const sql = `
            SELECT r.id, r.teacher_id, r.requested_role, r.preferred_subject, r.preferred_section, r.notes, r.status, r.admin_message, r.created_at, r.updated_at,
                   t.name AS teacher_name, t.email AS teacher_email, t.role AS teacher_current_role
            FROM teacher_role_requests r
            LEFT JOIN teachers t ON t.id = r.teacher_id
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY CASE WHEN LOWER(r.status) = 'pending' THEN 0 ELSE 1 END, r.updated_at DESC
            LIMIT ${limit}
        `;

        const [rows] = await pool.query(sql, params);
        return res.status(200).json({ success: true, requests: rows || [] });
    } catch (err) {
        console.error('Error listing teacher role requests:', err);
        return res.status(500).json({ error: 'Failed to load role requests' });
    }
});

router.put('/role-request/:request_id/review', async (req, res) => {
    const requestId = Number.parseInt(req.params.request_id, 10);
    const status = String(req.body?.status || '').trim().toLowerCase();
    const adminMessage = String(req.body?.admin_message || '').trim() || null;

    if (!requestId || Number.isNaN(requestId)) {
        return res.status(400).json({ error: 'Invalid request ID' });
    }
    if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    try {
        await ensureTeacherRoleRequestsTable(req);

        const tenantId = Number(req?.tenant?.id || 0) || null;
        const roleRequestColumns = await getTableColumns('teacher_role_requests');
        const hasTenantColumn = roleRequestColumns.has('tenant_id');
        const applyTenantFilter = shouldApplyTenantIdFilter(req, hasTenantColumn);

        const [currentRows] = await pool.query(
            `SELECT id, teacher_id, requested_role, status
             FROM teacher_role_requests
             WHERE id = ? ${applyTenantFilter ? 'AND tenant_id = ?' : ''}
             LIMIT 1`,
            applyTenantFilter ? [requestId, tenantId] : [requestId]
        );

        if (!currentRows.length) {
            return res.status(404).json({ error: 'Role request not found' });
        }

        const current = currentRows[0];

        await pool.query(
            `UPDATE teacher_role_requests
             SET status = ?, admin_message = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [status, adminMessage, requestId]
        );

        if (status === 'approved') {
            const assignedRole = normalizeTeacherRole(current.requested_role || '');
            await pool.query(
                `UPDATE teachers
                 SET role = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? ${shouldApplyTenantIdFilter(req, (await getTeacherRouteTableSchema(req)).teachers_has_tenant_id) ? 'AND tenant_id = ?' : ''}`,
                shouldApplyTenantIdFilter(req, (await getTeacherRouteTableSchema(req)).teachers_has_tenant_id)
                    ? [assignedRole, current.teacher_id, tenantId]
                    : [assignedRole, current.teacher_id]
            );
        }

        try {
            await ensureTeacherNotificationsTableForRoleRequests();
            const title = status === 'approved' ? 'Role Request Approved' : 'Role Request Rejected';
            const message = status === 'approved'
                ? `Your request for ${current.requested_role} has been approved.${adminMessage ? ` ${adminMessage}` : ''}`
                : `Your request for ${current.requested_role} was not approved.${adminMessage ? ` ${adminMessage}` : ''}`;
            await pool.query(
                `INSERT INTO teacher_notifications (teacher_id, type, title, message, related_data, created_at, updated_at)
                 VALUES (?, 'teacher_role_request_reviewed', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [
                    current.teacher_id,
                    title,
                    message,
                    JSON.stringify({
                        request_id: requestId,
                        requested_role: current.requested_role,
                        status,
                        admin_message: adminMessage
                    })
                ]
            );
        } catch (notifErr) {
            console.warn('Role request reviewed but failed to notify teacher:', notifErr && notifErr.message ? notifErr.message : notifErr);
        }

        const [updatedRows] = await pool.query(
            `SELECT id, teacher_id, requested_role, preferred_subject, preferred_section, notes, status, admin_message, created_at, updated_at
             FROM teacher_role_requests
             WHERE id = ?
             LIMIT 1`,
            [requestId]
        );

        return res.status(200).json({ success: true, request: updatedRows[0] || null });
    } catch (err) {
        console.error('Error reviewing teacher role request:', err);
        return res.status(500).json({ error: 'Failed to review role request' });
    }
});

module.exports = router;



