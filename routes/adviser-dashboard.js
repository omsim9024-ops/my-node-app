const express = require('express');
const pool = require('../db');
const router = express.Router();

// Get Dashboard Overview for Adviser
router.get('/overview/:adviser_id', async (req, res) => {
    const { adviser_id } = req.params;

    try {
        // Get assigned sections count
        const sectionsResult = await pool.query(
            `SELECT COUNT(DISTINCT section_id) as total_sections 
             FROM adviser_section_assignments 
             WHERE adviser_id = ?`,
            [adviser_id]
        );

        // Get total students in adviser's sections (active school year)
        const studentsResult = await pool.query(
            `SELECT COUNT(DISTINCT s.id) as total_students
             FROM students s
             JOIN adviser_section_assignments asa ON s.section_id = asa.section_id
             JOIN school_years sy ON asa.school_year_id = sy.id
             WHERE asa.adviser_id = ? AND sy.is_active = true`,
            [adviser_id]
        );

        // Get pending notifications
        const notificationsResult = await pool.query(
            `SELECT COUNT(*) as pending_notifications 
             FROM adviser_notifications 
             WHERE adviser_id = ? AND is_read = false`,
            [adviser_id]
        );

        res.json({
            success: true,
            overview: {
                total_sections: parseInt(sectionsResult.rows[0].total_sections) || 0,
                total_students: parseInt(studentsResult.rows[0].total_students) || 0,
                pending_notifications: parseInt(notificationsResult.rows[0].pending_notifications) || 0
            }
        });
    } catch (err) {
        console.error('Error fetching overview:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard overview' });
    }
});

// Get Class List for a Section
router.get('/class-list/:section_id', async (req, res) => {
    const { section_id } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT 
                s.id,
                s.student_id,
                s.first_name,
                s.last_name,
                s.grade_level,
                sec.track,
                sec.electives,
                e.status as enrollment_status
            FROM students s
            JOIN sections sec ON s.section_id = sec.id
            LEFT JOIN enrollments e ON s.id = e.student_id
            WHERE s.section_id = ?
            ORDER BY s.last_name, s.first_name ASC`,
            [section_id]
        );

        res.json({
            success: true,
            students: rows
        });
    } catch (err) {
        console.error('Error fetching class list:', err);
        res.status(500).json({ error: 'Failed to fetch class list' });
    }
});

// Get Student Profile (Read-only)
router.get('/student/:student_id', async (req, res) => {
    const { student_id } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT 
                s.id,
                s.student_id,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.grade_level,
                sec.section_code,
                sec.track,
                sec.programme,
                sec.electives,
                sy.school_year,
                e.status as enrollment_status
            FROM students s
            JOIN sections sec ON s.section_id = sec.id
            JOIN school_years sy ON s.school_year_id = sy.id
            LEFT JOIN enrollments e ON s.id = e.student_id
            WHERE s.id = ?`,
            [student_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.json({
            success: true,
            student: rows[0]
        });
    } catch (err) {
        console.error('Error fetching student profile:', err);
        res.status(500).json({ error: 'Failed to fetch student profile' });
    }
});

// Add Adviser Note
router.post('/notes', async (req, res) => {
    const { adviser_id, student_id, note_type, note_content, is_confidential } = req.body;

    if (!adviser_id || !student_id || !note_type || !note_content) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const [rows] = await pool.query(
            `INSERT INTO adviser_notes 
             (adviser_id, student_id, note_type, note_content, is_confidential, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [adviser_id, student_id, note_type, note_content, is_confidential !== false]
        );

        res.status(201).json({
            success: true,
            message: 'Note added successfully',
            note: rows[0]
        });
    } catch (err) {
        console.error('Error adding note:', err);
        res.status(500).json({ error: 'Failed to add note' });
    }
});

// Get Adviser Notes for Student
router.get('/notes/student/:student_id', async (req, res) => {
    const { student_id } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT 
                id,
                note_type,
                note_content,
                is_confidential,
                created_at,
                updated_at
            FROM adviser_notes
            WHERE student_id = ?
            ORDER BY created_at DESC`,
            [student_id]
        );

        res.json({
            success: true,
            notes: rows
        });
    } catch (err) {
        console.error('Error fetching notes:', err);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// Update Adviser Note
router.put('/notes/:note_id', async (req, res) => {
    const { note_id } = req.params;
    const { note_content, note_type } = req.body;

    if (!note_content) {
        return res.status(400).json({ error: 'Note content required' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE adviser_notes 
             SET note_content = ?, note_type = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [note_content, note_type, note_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // fetch updated note for response
        const [rows] = await pool.query('SELECT * FROM adviser_notes WHERE id = ?', [note_id]);
        const note = rows && rows[0] ? rows[0] : null;

        res.json({
            success: true,
            message: 'Note updated successfully',
            note: note
        });
    } catch (err) {
        console.error('Error updating note:', err);
        res.status(500).json({ error: 'Failed to update note' });
    }
});

// Delete Adviser Note
router.delete('/notes/:note_id', async (req, res) => {
    const { note_id } = req.params;

    try {
        const [result] = await pool.query(
            'DELETE FROM adviser_notes WHERE id = ?',
            [note_id]
        );

        // mysql2 returns an object with affectedRows for DELETE
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting note:', err);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});

// Record Attendance
router.post('/attendance', async (req, res) => {
    const { adviser_id, student_id, section_id, school_year_id, attendance_date, status, remarks } = req.body;

    if (!adviser_id || !student_id || !section_id || !attendance_date || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['Present', 'Absent', 'Late', 'Excused'].includes(status)) {
        return res.status(400).json({ error: 'Invalid attendance status' });
    }

    try {
        // Check if attendance record already exists
        const [existing] = await pool.query(
            'SELECT id FROM adviser_attendance WHERE student_id = ? AND section_id = ? AND attendance_date = ?',
            [student_id, section_id, attendance_date]
        );

        let result;
        if (existing.length > 0) {
            // Update existing record
            [result] = await pool.query(
                `UPDATE adviser_attendance 
                 SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [status, remarks || null, existing[0].id]
            );
        } else {
            // Insert new record
            [result] = await pool.query(
                `INSERT INTO adviser_attendance 
                 (adviser_id, student_id, section_id, school_year_id, attendance_date, status, remarks, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [adviser_id, student_id, section_id, school_year_id, attendance_date, status, remarks || null]
            );
        }

        // respond with the result metadata instead of undefined rows
        res.json({
            success: true,
            message: 'Attendance recorded successfully',
            attendance: result
        });
    } catch (err) {
        console.error('Error recording attendance:', err);
        res.status(500).json({ error: 'Failed to record attendance' });
    }
});

// Get Attendance for Section on Date
router.get('/attendance/section/:section_id/:date', async (req, res) => {
    const { section_id, date } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT 
                aa.id,
                s.id as student_id,
                s.student_id,
                s.first_name,
                s.last_name,
                aa.status,
                aa.remarks,
                aa.attendance_date
            FROM adviser_attendance aa
            JOIN students s ON aa.student_id = s.id
            WHERE aa.section_id = ? AND aa.attendance_date = ?
            ORDER BY s.last_name, s.first_name ASC`,
            [section_id, date]
        );

        res.json({
            success: true,
            attendance: rows
        });
    } catch (err) {
        console.error('Error fetching attendance:', err);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});

// Get Attendance Summary for Student
router.get('/attendance/student/:student_id/:section_id', async (req, res) => {
    const { student_id, section_id } = req.params;

    try {
        // Get counts
        const countsResult = await pool.query(
            `SELECT 
                status,
                COUNT(*) as count
            FROM adviser_attendance
            WHERE student_id = ? AND section_id = ?
            GROUP BY status`,
            [student_id, section_id]
        );

        // Get recent records
        const recordsResult = await pool.query(
            `SELECT 
                attendance_date,
                status,
                remarks
            FROM adviser_attendance
            WHERE student_id = ? AND section_id = ?
            ORDER BY attendance_date DESC
            LIMIT 30`,
            [student_id, section_id]
        );

        const summary = {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0
        };

        countsResult.rows.forEach(row => {
            const key = row.status.toLowerCase();
            summary[key] = parseInt(row.count) || 0;
        });

        res.json({
            success: true,
            summary: summary,
            recent_records: recordsResult.rows
        });
    } catch (err) {
        console.error('Error fetching attendance summary:', err);
        res.status(500).json({ error: 'Failed to fetch attendance summary' });
    }
});

// Get Adviser Notifications
router.get('/notifications/:adviser_id', async (req, res) => {
    const { adviser_id } = req.params;
    const { unread_only } = req.query;

    try {
        let query = `
            SELECT *
            FROM adviser_notifications
            WHERE adviser_id = ?
        `;
        const params = [adviser_id];

        if (unread_only === 'true') {
            query += ' AND is_read = false';
        }

        query += ' ORDER BY created_at DESC LIMIT 50';

        const [rows] = await pool.query(query, params);

        res.json({
            success: true,
            notifications: rows
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Mark Notification as Read
router.put('/notifications/:notification_id', async (req, res) => {
    const { notification_id } = req.params;

    try {
        const [rows] = await pool.query(
            `UPDATE adviser_notifications 
             SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`,
            [notification_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({
            success: true,
            notification: rows[0]
        });
    } catch (err) {
        console.error('Error updating notification:', err);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// ============================================================================
// TEACHER-AS-ADVISER ROUTES (NEW SYSTEM)
// ============================================================================

// Get Dashboard Overview for Teacher assigned as Adviser
router.get('/overview-teacher/:teacher_id', async (req, res) => {
    const { teacher_id } = req.params;

    try {
        // Get assigned sections count
        const sectionsResult = await pool.query(
            `SELECT COUNT(DISTINCT section_id) as total_sections 
             FROM teacher_section_assignments 
             WHERE teacher_id = ?`,
            [teacher_id]
        );

        // Get total students in teacher's sections (active school year)
        const studentsResult = await pool.query(
            `SELECT COUNT(DISTINCT s.id) as total_students
             FROM students s
             JOIN teacher_section_assignments tsa ON s.section_id = tsa.section_id
             JOIN school_years sy ON tsa.school_year_id = sy.id
             WHERE tsa.teacher_id = ? AND sy.is_active = true`,
            [teacher_id]
        );

        res.json({
            success: true,
            overview: {
                total_sections: parseInt(sectionsResult.rows[0].total_sections) || 0,
                total_students: parseInt(studentsResult.rows[0].total_students) || 0,
                pending_notifications: 0
            }
        });
    } catch (err) {
        console.error('Error fetching teacher overview:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard overview' });
    }
});

// Get Teacher's Assigned Sections (includes advisory sections for teachers, and
// also handles pure advisers by looking up their email). The previous version only
// worked when the provided ID existed in the `teachers` table; a standalone
// adviser (no teacher record) would get an empty result. To support both kinds of
// users we first attempt to read an email from the teachers table and if that
// fails we fall back to the advisers table. Once we have an email we use it to
// collect matching adviser IDs, which are unioned with any teacher assignments.
router.get('/sections-teacher/:teacher_id', async (req, res) => {
    const { teacher_id } = req.params;

    try {
        // Determine email associated with this user ID. The ID may belong to a
        // teacher or an adviser, so we check both tables.
        let userEmail = null;
        try {
            const [trows] = await pool.query(
                'SELECT email FROM teachers WHERE id = ? LIMIT 1',
                [teacher_id]
            );
            if (trows.length > 0 && trows[0].email) {
                userEmail = String(trows[0].email).toLowerCase();
            }
        } catch (_ignore) {
            // ignore
        }

        if (!userEmail) {
            // try adviser table as a fallback
            try {
                const [arows] = await pool.query(
                    'SELECT email FROM advisers WHERE id = ? LIMIT 1',
                    [teacher_id]
                );
                if (arows.length > 0 && arows[0].email) {
                    userEmail = String(arows[0].email).toLowerCase();
                }
            } catch (_ignore) {
                // ignore
            }
        }

        // collect adviser IDs that share the same email (could be multiple)
        let adviserIds = [];
        if (userEmail) {
            try {
                const [arows2] = await pool.query(
                    'SELECT id FROM advisers WHERE LOWER(email) = ?',
                    [userEmail]
                );
                adviserIds = arows2.map(r => r.id).filter(id => Number.isFinite(id) && id > 0);
            } catch (_ignore) {
                // ignore
            }
        }

        // also collect teacher IDs that share the same email (so we can return
        // any assignments created via the teacher-assignment workflow).  It's
        // possible the `teacher_id` parameter is actually an adviser table id,
        // so we build a list based on email and then include the original value
        // as well.
        let teacherIds = [];
        if (userEmail) {
            try {
                const [trows2] = await pool.query(
                    'SELECT id FROM teachers WHERE LOWER(email) = ?',
                    [userEmail]
                );
                teacherIds = trows2.map(r => r.id).filter(id => Number.isFinite(id) && id > 0);
            } catch (_ignore) {
                // ignore
            }
        }
        // always ensure the provided identifier is included so direct lookups work
        const numericParam = Number(teacher_id);
        if (Number.isFinite(numericParam) && numericParam > 0 && !teacherIds.includes(numericParam)) {
            teacherIds.unshift(numericParam);
        }

        // build union query: teacher assignments plus (if any) adviser assignments
        let query = `
            SELECT 
                tsa.id as assignment_id,
                s.id as section_id,
                s.section_code,
                s.section_name,
                s.grade,
                s.track,
                s.programme,
                sy.school_year,
                sy.id as school_year_id
            FROM teacher_section_assignments tsa
            JOIN sections s ON tsa.section_id = s.id
            LEFT JOIN school_years sy ON tsa.school_year_id = sy.id
            WHERE tsa.teacher_id IN (${teacherIds.map(_=>'?').join(',')})
        `;

        const params = [...teacherIds];

        if (adviserIds.length) {
            const placeholders = adviserIds.map(_ => '?').join(',');
            query += `
                UNION ALL
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
                LEFT JOIN school_years sy ON asa.school_year_id = sy.id
                WHERE asa.adviser_id IN (${placeholders})
            `;
            params.push(...adviserIds);
        }

        query += '\n            ORDER BY school_year DESC, section_code ASC';

        const [rows] = await pool.query(query, params);

        res.json({
            success: true,
            sections: rows
        });
    } catch (err) {
        console.error('Error fetching teacher sections:', err);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
});

// Get Class List for a Section (Teacher-Adviser Version)
router.get('/class-list-teacher/:teacher_id/:section_id', async (req, res) => {
    const { teacher_id, section_id } = req.params;

    try {
        // Verify teacher is assigned to this section
        const verify = await pool.query(
            'SELECT id FROM teacher_section_assignments WHERE teacher_id = ? AND section_id = ?',
            [teacher_id, section_id]
        );

        if (verify.rows.length === 0) {
            return res.status(403).json({ error: 'Teacher not assigned to this section' });
        }

        const [rows] = await pool.query(
            `SELECT 
                s.id,
                s.student_id,
                s.first_name,
                s.last_name,
                s.grade_level,
                sec.track,
                sec.electives,
                e.status as enrollment_status
            FROM students s
            JOIN sections sec ON s.section_id = sec.id
            LEFT JOIN enrollments e ON s.id = e.student_id
            WHERE s.section_id = ?
            ORDER BY s.last_name, s.first_name ASC`,
            [section_id]
        );

        res.json({
            success: true,
            students: rows
        });
    } catch (err) {
        console.error('Error fetching class list:', err);
        res.status(500).json({ error: 'Failed to fetch class list' });
    }
});

module.exports = router;



