const express = require('express');
const pool = require('../db');
const router = express.Router();

let teachersSchemaCache = null;

function shouldApplyTenantIdFilter(req, hasTenantColumn) {
    const tenantId = Number(req?.tenant?.id || 0);
    if (!hasTenantColumn || !tenantId) return false;
    const isolationMode = String(req?.tenant?.isolationMode || '').trim().toLowerCase();
    return isolationMode !== 'database-per-tenant';
}

async function getTeachersSchema() {
    if (teachersSchemaCache) return teachersSchemaCache;
    try {
        const [tenantColumnRows] = await pool.query("SHOW COLUMNS FROM teachers LIKE 'tenant_id'");
        teachersSchemaCache = {
            teachers_has_tenant_id: Array.isArray(tenantColumnRows) && tenantColumnRows.length > 0
        };
    } catch (_err) {
        teachersSchemaCache = {
            teachers_has_tenant_id: false
        };
    }
    return teachersSchemaCache;
}

// Get all teachers
router.get('/', async (req, res) => {
    try {
        const schema = await getTeachersSchema();
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterByTenant = shouldApplyTenantIdFilter(req, schema.teachers_has_tenant_id);
        const sql = filterByTenant
            ? 'SELECT * FROM teachers WHERE tenant_id = ? ORDER BY created_at DESC'
            : 'SELECT * FROM teachers ORDER BY created_at DESC';
        const params = filterByTenant ? [tenantId] : [];
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single teacher
router.get('/:id', async (req, res) => {
    try {
        const schema = await getTeachersSchema();
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterByTenant = shouldApplyTenantIdFilter(req, schema.teachers_has_tenant_id);
        const sql = filterByTenant
            ? 'SELECT * FROM teachers WHERE id = ? AND tenant_id = ?'
            : 'SELECT * FROM teachers WHERE id = ?';
        const params = filterByTenant ? [req.params.id, tenantId] : [req.params.id];
        const [rows] = await pool.query(sql, params);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create teacher
router.post('/', async (req, res) => {
    const { teacher_id, name, department, email, phone } = req.body;
    
    if (!teacher_id || !name || !department || !email) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const schema = await getTeachersSchema();
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterByTenant = shouldApplyTenantIdFilter(req, schema.teachers_has_tenant_id);

        const sql = filterByTenant
            ? 'INSERT INTO teachers (teacher_id, name, department, email, phone, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
            : 'INSERT INTO teachers (teacher_id, name, department, email, phone) VALUES (?, ?, ?, ?, ?)';
        const params = filterByTenant
            ? [teacher_id, name, department, email, phone || null, tenantId]
            : [teacher_id, name, department, email, phone || null];

        const [result] = await pool.query(sql, params);
        const [createdRows] = await pool.query('SELECT * FROM teachers WHERE id = ? LIMIT 1', [result.insertId]);
        res.status(201).json(createdRows[0] || null);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Teacher ID or email already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update teacher
router.put('/:id', async (req, res) => {
    const { name, department, email, phone } = req.body;
    
    try {
        const schema = await getTeachersSchema();
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterByTenant = shouldApplyTenantIdFilter(req, schema.teachers_has_tenant_id);

        const sql = filterByTenant
            ? 'UPDATE teachers SET name = ?, department = ?, email = ?, phone = ? WHERE id = ? AND tenant_id = ?'
            : 'UPDATE teachers SET name = ?, department = ?, email = ?, phone = ? WHERE id = ?';
        const params = filterByTenant
            ? [name, department, email, phone || null, req.params.id, tenantId]
            : [name, department, email, phone || null, req.params.id];

        const [result] = await pool.query(sql, params);
        if (!result || !result.affectedRows) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        const [updatedRows] = await pool.query('SELECT * FROM teachers WHERE id = ? LIMIT 1', [req.params.id]);
        res.json(updatedRows[0] || null);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete teacher
router.delete('/:id', async (req, res) => {
    try {
        const schema = await getTeachersSchema();
        const tenantId = Number(req?.tenant?.id || 0) || null;
        const filterByTenant = shouldApplyTenantIdFilter(req, schema.teachers_has_tenant_id);
        const sql = filterByTenant
            ? 'DELETE FROM teachers WHERE id = ? AND tenant_id = ?'
            : 'DELETE FROM teachers WHERE id = ?';
        const params = filterByTenant ? [req.params.id, tenantId] : [req.params.id];
        const [result] = await pool.query(sql, params);
        if (!result || !result.affectedRows) {
            return res.status(404).json({ error: 'Teacher not found' });
        }
        res.json({ message: 'Teacher deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;



