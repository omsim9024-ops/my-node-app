const express = require('express');
const pool = require('../db');
const router = express.Router();

// Helper function to get active school year
async function getActiveSchoolYear() {
    try {
        const [rows] = await pool.query(
            'SELECT id FROM school_years WHERE is_active = true LIMIT 1'
        );
        return rows.length > 0 ? rows[0].id : null;
    } catch (err) {
        console.error('Error fetching active school year:', err);
        return null;
    }
}

// Create a new enrollment
router.post('/', async (req, res) => {
    const { student_id, enrollment_data, enrollment_files } = req.body;
    
    if (!student_id || !enrollment_data) {
        return res.status(400).json({ error: 'Missing required fields: student_id, enrollment_data' });
    }

    try {
        // Generate enrollment ID
        const enrollment_id = 'ENR-' + Date.now();
        
        // Get active school year
        const schoolYearId = await getActiveSchoolYear();
        
        // Insert enrollment into database
        const [rows] = await pool.query(
            `INSERT INTO enrollments 
             (enrollment_id, student_id, enrollment_data, enrollment_files, status, enrollment_date, school_year_id) 
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
            [enrollment_id, student_id, JSON.stringify(enrollment_data), JSON.stringify(enrollment_files || {}), 'Pending', schoolYearId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Enrollment submitted successfully',
            enrollment: rows[0]
        });
    } catch (err) {
        console.error('Error creating enrollment:', err);
        res.status(500).json({ error: 'Failed to submit enrollment' });
    }
});

// Get all enrollments for a student (more specific route - must come before /:id)
router.get('/student/:student_id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM enrollments WHERE student_id = ? ORDER BY enrollment_date DESC',
            [req.params.student_id]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching enrollments:', err);
        res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
});

// Get all enrollments (admin) - must come before /:id route
router.get('/', async (req, res) => {
    try {
        const status = req.query.status;
        const filterByActiveYear = req.query.activeYear !== 'false'; // Default to true
        
        let query = `SELECT e.*, s.first_name, s.last_name, s.email, sec.section_name
                     FROM enrollments e 
                     LEFT JOIN students s ON e.student_id = s.id
                     LEFT JOIN sections sec ON e.section_id = sec.id`;
        const params = [];
        let whereConditions = [];
        let paramIndex = 1;
        
        // Filter by active school year if requested
        if (filterByActiveYear) {
            whereConditions.push(`e.school_year_id = (SELECT id FROM school_years WHERE is_active = true LIMIT 1)`);
        }
        
        // Add status filter if provided
        if (status && status !== 'all') {
            whereConditions.push(`e.status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY e.enrollment_date DESC`;
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching all enrollments:', err);
        res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
});

// Get enrollment statistics - must come BEFORE /:id route
router.get('/stats', async (req, res) => {
    try {
        const filterByActiveYear = req.query.activeYear !== 'false'; // Default to true
        
        let whereClause = '';
        if (filterByActiveYear) {
            whereClause = `WHERE e.school_year_id = (SELECT id FROM school_years WHERE is_active = true LIMIT 1)`;
        }
        
        const [rows] = await pool.query(
            `SELECT 
                COUNT(*) as totalEnrollments,
                COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pendingCount,
                COUNT(CASE WHEN status = 'Approved' THEN 1 END) as approvedCount,
                COUNT(CASE WHEN status = 'Rejected' THEN 1 END) as rejectedCount
             FROM enrollments e
             ${whereClause}`
        );
        
        const stats = rows[0];
        
        let enrollmentQuery = 'SELECT DISTINCT student_id FROM enrollments WHERE student_id IS NOT NULL';
        if (filterByActiveYear) {
            enrollmentQuery += ` AND school_year_id = (SELECT id FROM school_years WHERE is_active = true LIMIT 1)`;
        }
        const enrollments = await pool.query(enrollmentQuery);
        
        res.json({
            totalStudents: enrollments.rows.length,
            totalEnrollments: parseInt(stats.totalenrollments),
            pendingCount: parseInt(stats.pendingcount),
            approvedCount: parseInt(stats.approvedcount),
            rejectedCount: parseInt(stats.rejectedcount),
            attendanceRate: '--'
        });
    } catch (err) {
        console.error('Error fetching enrollment stats:', err);
        res.status(500).json({ error: 'Failed to fetch enrollment statistics' });
    }
});

// Update enrollment data by student identifier (id or LRN) - admin editable
router.patch('/by-student/:identifier', async (req, res) => {
    const identifier = req.params.identifier;
    const updates = req.body || {};

    console.log('[Enrollments] === INCOMING PATCH REQUEST ===');
    console.log('[Enrollments] Identifier:', identifier);
    console.log('[Enrollments] Raw req.body:', JSON.stringify(req.body, null, 2));
    console.log('[Enrollments] updates object keys:', Object.keys(updates));
    console.log('[Enrollments] updates.section_id in object?', 'section_id' in updates);
    console.log('[Enrollments] updates.class_id in object?', 'class_id' in updates);

    try {
        // Find matching enrollments by student_id or enrollment_data->>'lrn'
        const [rows] = await pool.query(
            `SELECT * FROM enrollments WHERE student_id::text = ? OR (enrollment_data->>'lrn') = ?`,
            [identifier]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No enrollments found for the given identifier' });
        }

        const updatedEnrollments = [];
        for (const row of rows) {
            let data = row.enrollment_data;
            try { data = typeof data === 'string' ? JSON.parse(data) : data; } catch(e) { data = {} }

            // Merge provided updates into enrollment_data JSON
            if (updates.enrollment_data && typeof updates.enrollment_data === 'object') {
                // shallow merge: copy fields from provided enrollment_data into data
                Object.keys(updates.enrollment_data).forEach(k => {
                    data[k] = updates.enrollment_data[k];
                });
            }

            // Backwards-compatible top-level fields
            if (updates.fullName) {
                const parts = updates.fullName.split(' ');
                data.firstName = parts.shift() || data.firstName || '';
                data.lastName = parts.join(' ') || data.lastName || '';
            }
            if (updates.lrn) data.lrn = updates.lrn;
            if (updates.grade) data.grade_level = updates.grade;
            if (updates.track) data.track = updates.track;
            if (updates.birthdate) data.birthdate = updates.birthdate;
            if (updates.gender) data.gender = updates.gender;
            if (typeof updates.currentAddress !== 'undefined') data.currentAddress = updates.currentAddress;
            if (typeof updates.currentCountry !== 'undefined') data.currentCountry = updates.currentCountry;
            if (typeof updates.currentProvince !== 'undefined') data.currentProvince = updates.currentProvince;
            if (typeof updates.currentMunicipality !== 'undefined') data.currentMunicipality = updates.currentMunicipality;
            if (typeof updates.currentBarangay !== 'undefined') data.currentBarangay = updates.currentBarangay;
            if (typeof updates.currentSitio !== 'undefined') data.currentSitio = updates.currentSitio;
            if (updates.status) row.status = updates.status;

            // Persist updated enrollment_data and also update top-level enrollment columns
            // Build dynamic SET clause to include any top-level fields provided in the update
            try {
                const setParts = ['enrollment_data = ?', 'status = COALESCE(?, status)'];
                const values = [JSON.stringify(data), updates.status || null];

                // Map common update keys to enrollment table columns
                if (updates.fullName) {
                    const parts = String(updates.fullName || '').trim().split(/\s+/);
                    const first = parts.shift() || null;
                    const last = parts.join(' ') || null;
                    if (first) { setParts.push('firstname = ?'); values.push(first); }
                    if (last)  { setParts.push('lastname = ?'); values.push(last); }
                }
                if (typeof updates.firstName !== 'undefined') { setParts.push('firstname = ?'); values.push(updates.firstName); }
                if (typeof updates.lastName !== 'undefined')  { setParts.push('lastname = ?');  values.push(updates.lastName); }
                if (typeof updates.middleName !== 'undefined') { setParts.push('middle_name = ?'); values.push(updates.middleName); }
                if (typeof updates.lrn !== 'undefined')        { setParts.push('lrn_no = ?'); values.push(updates.lrn); }
                if (typeof updates.psa_no !== 'undefined')    { setParts.push('psa_no = ?'); values.push(updates.psa_no); }
                if (typeof updates.with_lrn !== 'undefined')  { setParts.push('with_lrn = ?'); values.push(updates.with_lrn); }
                if (typeof updates.birthdate !== 'undefined') { setParts.push('birthdate = ?'); values.push(updates.birthdate); }

                // Finalize query
                const sql = `UPDATE enrollments SET ${setParts.join(', ')} WHERE id = ?`;
                values.push(row.id);

                const upd = await pool.query(sql, values);
                // mysql2 returns result info; push a minimal representation
                updatedEnrollments.push({ id: row.id, changedRows: upd[0] && upd[0].affectedRows ? upd[0].affectedRows : 0 });
            } catch (e) {
                console.error('[Enrollments] ❌ Failed to persist enrollment top-level fields:', e.message);
                // fallback: attempt to at least update enrollment_data/status
                try {
                    const upd = await pool.query(
                        'UPDATE enrollments SET enrollment_data = ?, status = COALESCE(?, status) WHERE id = ?',
                        [JSON.stringify(data), updates.status || null, row.id]
                    );
                    updatedEnrollments.push({ id: row.id, changedRows: upd[0] && upd[0].affectedRows ? upd[0].affectedRows : 0 });
                } catch (e2) {
                    console.error('[Enrollments] ❌ Fallback update also failed:', e2.message);
                }
            }

            // CRITICAL: If section_id is being cleared (track change), also clear it from enrollments table
            console.log('[Enrollments] === SECTION CLEARING CHECK ===');
            console.log('[Enrollments] updates.section_id exists?', 'section_id' in updates);
            console.log('[Enrollments] updates.section_id value:', updates.section_id);
            console.log('[Enrollments] typeof updates.section_id:', typeof updates.section_id);
            console.log('[Enrollments] Is it null?', updates.section_id === null);
            console.log('[Enrollments] Condition will match?', (typeof updates.section_id !== 'undefined' && updates.section_id === null));
            
            if (typeof updates.section_id !== 'undefined' && updates.section_id === null) {
                console.log('[Enrollments] ✅ ENTERING SECTION CLEARING CODE');
                console.log('[Enrollments] ✅ CLEARING SECTION FROM ENROLLMENTS TABLE - section_id was set to null (track change)');
                try {
                    const clearSectionResult = await pool.query(
                        'UPDATE enrollments SET section_id = NULL WHERE id = ?',
                        [row.id]
                    );
                    console.log('[Enrollments] ✅ Enrollments.section_id cleared:', clearSectionResult.rows[0]);
                } catch (e) {
                    console.error('[Enrollments] ❌ Failed to clear section_id from enrollments table:', e.message);
                }
            } else {
                console.log('[Enrollments] ℹ️ Section clearing condition NOT met - skipping section_id clear');
            }

            // Also try to update students table if there is a student_id
            if (row.student_id) {
                console.log('[Enrollments] === UPDATING STUDENT TABLE ===');
                console.log('[Enrollments] student_id:', row.student_id);
                console.log('[Enrollments] Updates received:', updates);
                
                const studentFields = [];
                const studentValues = [];
                let idx = 1;

                // Derive candidate values from merged enrollment_data (data) first, fallback to updates
                const candFirst = data.firstName || data.first_name || updates.firstName || null;
                const candLast = data.lastName || data.last_name || updates.lastName || null;
                const candEmail = data.email || updates.email || null;
                const candGrade = data.grade_level || updates.grade || null;
                // NOTE: birthdate is NOT in students table - it's in enrollments.enrollment_data, so we don't update it here

                if (candFirst) { studentFields.push(`first_name = $${idx++}`); studentValues.push(candFirst); }
                if (candLast) { studentFields.push(`last_name = $${idx++}`); studentValues.push(candLast); }
                if (candEmail) { studentFields.push(`email = $${idx++}`); studentValues.push(candEmail); }
                if (candGrade) { studentFields.push(`grade_level = $${idx++}`); studentValues.push(candGrade); }

                console.log('[Enrollments] Fields added so far:', studentFields.length);

                // Handle section_id: Update when explicitly provided (including null to clear assignment)
                if (typeof updates.section_id !== 'undefined') {
                    console.log('[Enrollments] ✅ SECTION_ID FOUND - Updating section_id:', updates.section_id);
                    studentFields.push(`section_id = $${idx++}`);
                    studentValues.push(updates.section_id);
                }

                // Handle class_id: Update when explicitly provided
                if (typeof updates.class_id !== 'undefined') {
                    console.log('[Enrollments] ✅ CLASS_ID FOUND - Updating class_id:', updates.class_id);
                    studentFields.push(`class_id = $${idx++}`);
                    studentValues.push(updates.class_id);
                }

                console.log('[Enrollments] Total fields to update:', studentFields.length);
                console.log('[Students] Fields:', studentFields);
                console.log('[Enrollments] Values:', studentValues);

                if (studentFields.length > 0) {
                    studentValues.push(row.student_id);
                    const q = `UPDATE students SET ${studentFields.join(', ')} WHERE id = $${idx}`;
                    console.log('[Enrollments] 🚀 EXECUTING QUERY:', q);
                    console.log('[Enrollments] 📦 WITH VALUES:', studentValues);
                    try {
                        const updateResult = await pool.query(q, studentValues);
                        console.log('[Enrollments] ✅ Student updated successfully');
                        console.log('[Enrollments] Updated record:', updateResult.rows[0]);
                    } catch (e) {
                        console.error('[Enrollments] ❌ ERROR updating student record:', e.message);
                        console.error('[Enrollments] Full error:', e);
                    }
                } else {
                    console.log('[Enrollments] ⚠️  NO FIELDS TO UPDATE - studentFields is empty!');
                }
            } else {
                console.log('[Enrollments] ⚠️  NO STUDENT_ID - Skipping students table update');
            }
        }

        res.json({ success: true, updated: updatedEnrollments.length, enrollments: updatedEnrollments });
    } catch (err) {
        console.error('Error updating enrollments by student:', err);
        res.status(500).json({ error: 'Failed to update enrollment data' });
    }
});

// Delete enrollment (admin only) - must come before GET /:id
router.delete('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'DELETE FROM enrollments WHERE id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }
        
        res.json({
            success: true,
            message: 'Enrollment deleted successfully',
            enrollment: rows[0]
        });
    } catch (err) {
        console.error('Error deleting enrollment:', err);
        res.status(500).json({ error: 'Failed to delete enrollment' });
    }
});

// Update enrollment status and remarks (admin only) - must come before GET /:id
router.put('/:id', async (req, res) => {
    const { status, remarks } = req.body;
    
    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    try {
        const [rows] = await pool.query(
            'UPDATE enrollments SET status = ?, remarks = ? WHERE id = ?',
            [status, remarks || null, req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }
        
        res.json({
            success: true,
            message: 'Enrollment updated successfully',
            enrollment: rows[0]
        });
    } catch (err) {
        console.error('Error updating enrollment:', err);
        res.status(500).json({ error: 'Failed to update enrollment' });
    }
});

// Update enrollment status (PATCH - for approve/reject)
router.patch('/:id', async (req, res) => {
    const { status, remarks } = req.body;
    
    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    try {
        const [rows] = await pool.query(
            'UPDATE enrollments SET status = ?, remarks = ? WHERE id = ?',
            [status, remarks || null, req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }
        
        res.json({
            success: true,
            message: 'Enrollment updated successfully',
            enrollment: rows[0]
        });
    } catch (err) {
        console.error('Error updating enrollment:', err);
        res.status(500).json({ error: 'Failed to update enrollment' });
    }
});

// Get specific enrollment - must come AFTER DELETE and PUT
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM enrollments WHERE id = ?',
            [req.params.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }
        
        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching enrollment:', err);
        res.status(500).json({ error: 'Failed to fetch enrollment' });
    }
});

module.exports = router;



