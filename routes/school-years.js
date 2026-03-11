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

// Get all school years
router.get('/', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(
            `SELECT * FROM school_years 
             WHERE tenant_id = ?
             ORDER BY start_date DESC`
            ,
            [tenantId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching school years:', err);
        res.status(500).json({ error: 'Failed to fetch school years' });
    }
});

// Get active school year
router.get('/active', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(
            `SELECT * FROM school_years 
             WHERE tenant_id = ? AND is_active = true 
             LIMIT 1`
            ,
            [tenantId]
        );
        
        if (rows.length === 0) {
            return res.json(null);
        }
        
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching active school year:', err);
        res.status(500).json({ error: 'Failed to fetch active school year' });
    }
});

// Create a new school year
router.post('/', async (req, res) => {
    // debug: log incoming payload (could be undefined if parse failed)
    console.log('[school-years POST] body received:', req.body);

    const { school_year, start_date, end_date } = req.body || {};
    
    if (!school_year || !start_date || !end_date) {
        console.warn('[school-years POST] validation failed, fields missing');
        return res.status(400).json({ 
            error: 'Missing required fields: school_year, start_date, end_date' 
        });
    }
    
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        // Check if school year already exists
        const [existingRows] = await pool.query(
            'SELECT id FROM school_years WHERE tenant_id = ? AND school_year = ?',
            [tenantId, school_year]
        );
        
        if (existingRows && existingRows.length > 0) {
            return res.status(409).json({ 
                error: 'School year already exists' 
            });
        }
        
        // Validate dates
        const start = new Date(start_date);
        const end = new Date(end_date);
        
        if (start >= end) {
            return res.status(400).json({ 
                error: 'Start date must be before end date' 
            });
        }
        
        const [rows] = await pool.query(
            `INSERT INTO school_years (tenant_id, school_year, start_date, end_date, is_active) 
             VALUES (?, ?, ?, ?, false)`,
            [tenantId, school_year, start_date, end_date]
        );
        
        const [createdRows] = await pool.query(
            'SELECT * FROM school_years WHERE id = ? AND tenant_id = ? LIMIT 1',
            [rows.insertId, tenantId]
        );

        res.status(201).json({
            success: true,
            message: 'School year created successfully',
            data: createdRows[0] || null
        });
    } catch (err) {
        console.error('Error creating school year:', err);
        res.status(500).json({ error: 'Failed to create school year' });
    }
});

// Set a school year as active
router.put('/:id/activate', async (req, res) => {
    const { id } = req.params;
    
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        // Check if the school year exists
        const [checkRows] = await pool.query(
            'SELECT id FROM school_years WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );
        
        if (!checkRows || checkRows.length === 0) {
            return res.status(404).json({ error: 'School year not found' });
        }
        
        // Deactivate all other school years
        await pool.query(
            'UPDATE school_years SET is_active = 0 WHERE tenant_id = ? AND id != ?',
            [tenantId, id]
        );
        
        // Activate this school year
        await pool.query(
            'UPDATE school_years SET is_active = 1 WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );
        
        // Fetch the newly activated row for the client
        const [activatedRows] = await pool.query(
            'SELECT * FROM school_years WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );
        
        res.json({
            success: true,
            message: 'School year activated successfully',
            data: activatedRows[0] || null
        });
    } catch (err) {
        console.error('Error activating school year:', err);
        res.status(500).json({ error: 'Failed to activate school year' });
    }
});

// Update a school year
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { school_year, start_date, end_date } = req.body;
    
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [existingRows] = await pool.query(
            'SELECT id FROM school_years WHERE id = ? AND tenant_id = ? LIMIT 1',
            [id, tenantId]
        );

        if (!existingRows || existingRows.length === 0) {
            return res.status(404).json({ error: 'School year not found' });
        }

        let query = 'UPDATE school_years SET updated_at = CURRENT_TIMESTAMP';
        const params = [];
        
        if (school_year) {
            // Check if new school year already exists
            const [dupRows] = await pool.query(
                'SELECT id FROM school_years WHERE tenant_id = ? AND school_year = ? AND id != ? LIMIT 1',
                [tenantId, school_year, id]
            );
            
            if (dupRows && dupRows.length > 0) {
                return res.status(409).json({ 
                    error: 'School year already exists' 
                });
            }
            
            query += ', school_year = ?';
            params.push(school_year);
        }
        
        if (start_date) {
            query += ', start_date = ?';
            params.push(start_date);
        }
        
        if (end_date) {
            query += ', end_date = ?';
            params.push(end_date);
        }
        
        query += ' WHERE id = ? AND tenant_id = ?';
        params.push(id, tenantId);
        
        const [updateResult] = await pool.query(query, params);
        
        if (!updateResult || updateResult.affectedRows === 0) {
            return res.status(404).json({ error: 'School year not found' });
        }

        const [updatedRows] = await pool.query(
            'SELECT * FROM school_years WHERE id = ? AND tenant_id = ? LIMIT 1',
            [id, tenantId]
        );
        
        res.json({
            success: true,
            message: 'School year updated successfully',
            data: updatedRows[0] || null
        });
    } catch (err) {
        console.error('Error updating school year:', err);
        res.status(500).json({ error: 'Failed to update school year' });
    }
});

// Delete a school year
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        // Check if school year is active
        const [checkRows] = await pool.query(
            'SELECT is_active FROM school_years WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );
        
        if (!checkRows || checkRows.length === 0) {
            return res.status(404).json({ error: 'School year not found' });
        }
        
        if (checkRows[0].is_active) {
            return res.status(400).json({ 
                error: 'Cannot delete active school year. Deactivate it first.' 
            });
        }
        
        const [deleteResult] = await pool.query(
            'DELETE FROM school_years WHERE id = ? AND tenant_id = ?',
            [id, tenantId]
        );
        
        res.json({
            success: true,
            message: 'School year deleted successfully',
            data: { affectedRows: deleteResult.affectedRows }
        });
    } catch (err) {
        console.error('Error deleting school year:', err);
        res.status(500).json({ error: 'Failed to delete school year' });
    }
});

module.exports = router;



