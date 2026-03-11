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

function normalizeIdentifier(value) {
    const normalized = String(value || '').trim();
    return normalized;
}

function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function resolveStudentPrimaryId(studentIdentifier, tenantId) {
    const identifier = normalizeIdentifier(studentIdentifier);
    if (!identifier) return null;

    const numericId = Number.parseInt(identifier, 10);
    const isNumeric = Number.isFinite(numericId) && String(numericId) === identifier;

    if (isNumeric) {
        const [rowsById] = await pool.query(
            'SELECT id FROM students WHERE id = ? AND tenant_id = ? LIMIT 1',
            [numericId, tenantId]
        );
        if (rowsById.length > 0) return Number(rowsById[0].id);
    }

    const [rowsByStudentId] = await pool.query(
        'SELECT id FROM students WHERE student_id = ? AND tenant_id = ? LIMIT 1',
        [identifier, tenantId]
    );
    if (rowsByStudentId.length > 0) return Number(rowsByStudentId[0].id);

    if (looksLikeEmail(identifier)) {
        const [rowsByEmail] = await pool.query(
            'SELECT id FROM students WHERE email = ? AND tenant_id = ? LIMIT 1',
            [identifier, tenantId]
        );
        if (rowsByEmail.length > 0) return Number(rowsByEmail[0].id);
    }

    return null;
}

async function ensureAdminNotificationsTable() {
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
            INDEX idx_admin_notifications_admin (admin_id, is_read, created_at),
            CONSTRAINT fk_admin_notifications_admin
                FOREIGN KEY (admin_id) REFERENCES admins(id)
                ON DELETE CASCADE
        )
    `);
}

async function ensureTeacherNotificationsTable() {
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

function parseLimit(limitParam, fallback = 50, max = 200) {
    const parsed = parseInt(limitParam, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
}

// Get all notifications for a student
router.get('/student/:student_id', async (req, res) => {
    const { student_id } = req.params;
    const limit = parseLimit(req.query.limit, 50, 200);
    const { unread_only = false } = req.query;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const resolvedStudentId = await resolveStudentPrimaryId(student_id, tenantId);
        if (!resolvedStudentId) {
            return res.json([]);
        }

        let query = 'SELECT * FROM notifications WHERE student_id = ?';
        const params = [resolvedStudentId];

        if (unread_only === 'true') {
            query += ' AND is_read = false';
        }

        query += ' ORDER BY created_at DESC LIMIT ' + limit;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Get unread notification count for a student
router.get('/student/:student_id/unread-count', async (req, res) => {
    const { student_id } = req.params;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const resolvedStudentId = await resolveStudentPrimaryId(student_id, tenantId);
        if (!resolvedStudentId) {
            return res.json({ unread_count: 0 });
        }

        const [rows] = await pool.query(
            'SELECT COUNT(*) as unread_count FROM notifications WHERE student_id = ? AND is_read = false',
            [resolvedStudentId]
        );
        res.json({ unread_count: parseInt(rows[0].unread_count) });
    } catch (err) {
        console.error('Error fetching unread count:', err);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// Create a notification
router.post('/', async (req, res) => {
    const { student_id, type, title, message, related_data } = req.body;

    if (!student_id || !type || !title || !message) {
        return res.status(400).json({ error: 'Missing required fields: student_id, type, title, message' });
    }

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const resolvedStudentId = await resolveStudentPrimaryId(student_id, tenantId);
        if (!resolvedStudentId) {
            return res.status(404).json({ error: 'Student not found for current tenant' });
        }

        let relatedDataValue = related_data || {};
        if (typeof relatedDataValue === 'string') {
            try {
                relatedDataValue = JSON.parse(relatedDataValue);
            } catch (_err) {
                relatedDataValue = { raw: related_data };
            }
        }

        const [result] = await pool.query(
            `INSERT INTO notifications (student_id, type, title, message, related_data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [resolvedStudentId, type, title, message, JSON.stringify(relatedDataValue || {})]
        );

        const [inserted] = await pool.query('SELECT * FROM notifications WHERE id = ? LIMIT 1', [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            notification: inserted[0] || null
        });
    } catch (err) {
        console.error('Error creating notification:', err);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

// Mark a notification as read
router.put('/:notification_id/read', async (req, res) => {
    const { notification_id } = req.params;

    try {
        const [result] = await pool.query(
            `UPDATE notifications 
             SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [notification_id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const [updated] = await pool.query('SELECT * FROM notifications WHERE id = ? LIMIT 1', [notification_id]);

        res.json({
            success: true,
            message: 'Notification marked as read',
            notification: updated[0] || null
        });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read for a student
router.put('/student/:student_id/read-all', async (req, res) => {
    const { student_id } = req.params;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const resolvedStudentId = await resolveStudentPrimaryId(student_id, tenantId);
        if (!resolvedStudentId) {
            return res.json({ success: true, message: 'Marked 0 notifications as read', count: 0 });
        }

        const [result] = await pool.query(
            `UPDATE notifications 
             SET is_read = true, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE student_id = ? AND is_read = false`,
            [resolvedStudentId]
        );

        res.json({
            success: true,
            message: `Marked ${result.affectedRows || 0} notifications as read`,
            count: result.affectedRows || 0
        });
    } catch (err) {
        console.error('Error marking all notifications as read:', err);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// Delete a notification
router.delete('/:notification_id', async (req, res) => {
    const { notification_id } = req.params;

    try {
        const [result] = await pool.query(
            'DELETE FROM notifications WHERE id = ?',
            [notification_id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting notification:', err);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// Delete all notifications for a student
router.delete('/student/:student_id/delete-all', async (req, res) => {
    const { student_id } = req.params;

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const resolvedStudentId = await resolveStudentPrimaryId(student_id, tenantId);
        if (!resolvedStudentId) {
            return res.json({ success: true, message: 'Deleted 0 notifications', count: 0 });
        }

        const [result] = await pool.query(
            'DELETE FROM notifications WHERE student_id = ?',
            [resolvedStudentId]
        );

        res.json({
            success: true,
            message: `Deleted ${result.affectedRows || 0} notifications`,
            count: result.affectedRows || 0
        });
    } catch (err) {
        console.error('Error deleting all notifications:', err);
        res.status(500).json({ error: 'Failed to delete notifications' });
    }
});

router.get('/teacher/:teacher_id', async (req, res) => {
    const teacherId = parseInt(req.params.teacher_id, 10);
    const limit = parseLimit(req.query.limit, 50, 200);
    const unreadOnly = String(req.query.unread_only || 'false') === 'true';

    if (!teacherId || Number.isNaN(teacherId)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
    }

    try {
        await ensureTeacherNotificationsTable();

        let query = 'SELECT * FROM teacher_notifications WHERE teacher_id = ?';
        const params = [teacherId];
        if (unreadOnly) query += ' AND is_read = 0';
        query += ' ORDER BY created_at DESC LIMIT ' + limit;

        const [rows] = await pool.query(query, params);
        return res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching teacher notifications:', err);
        return res.status(500).json({ error: 'Failed to fetch teacher notifications' });
    }
});

router.get('/teacher/:teacher_id/unread-count', async (req, res) => {
    const teacherId = parseInt(req.params.teacher_id, 10);
    if (!teacherId || Number.isNaN(teacherId)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
    }

    try {
        await ensureTeacherNotificationsTable();
        const [rows] = await pool.query(
            'SELECT COUNT(*) AS unread_count FROM teacher_notifications WHERE teacher_id = ? AND is_read = 0',
            [teacherId]
        );
        return res.status(200).json({ unread_count: parseInt(rows[0]?.unread_count || 0, 10) });
    } catch (err) {
        console.error('Error fetching teacher unread count:', err);
        return res.status(500).json({ error: 'Failed to fetch teacher unread count' });
    }
});

router.post('/teacher', async (req, res) => {
    const { teacher_id, type, title, message, related_data } = req.body || {};
    const teacherId = parseInt(teacher_id, 10);

    if (!teacherId || Number.isNaN(teacherId) || !type || !title || !message) {
        return res.status(400).json({ error: 'Missing required fields: teacher_id, type, title, message' });
    }

    try {
        await ensureTeacherNotificationsTable();
        const [result] = await pool.query(
            `INSERT INTO teacher_notifications (teacher_id, type, title, message, related_data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [teacherId, type, title, message, JSON.stringify(related_data || {})]
        );

        const [rows] = await pool.query('SELECT * FROM teacher_notifications WHERE id = ? LIMIT 1', [result.insertId]);
        return res.status(201).json({ success: true, notification: rows[0] || null });
    } catch (err) {
        console.error('Error creating teacher notification:', err);
        return res.status(500).json({ error: 'Failed to create teacher notification' });
    }
});

router.put('/teacher/:teacher_id/:notification_id/read', async (req, res) => {
    const teacherId = parseInt(req.params.teacher_id, 10);
    const notificationId = parseInt(req.params.notification_id, 10);

    if (!teacherId || Number.isNaN(teacherId) || !notificationId || Number.isNaN(notificationId)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    try {
        await ensureTeacherNotificationsTable();
        const [result] = await pool.query(
            `UPDATE teacher_notifications
             SET is_read = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND teacher_id = ?`,
            [notificationId, teacherId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        return res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        console.error('Error marking teacher notification as read:', err);
        return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

router.put('/teacher/:teacher_id/read-all', async (req, res) => {
    const teacherId = parseInt(req.params.teacher_id, 10);
    if (!teacherId || Number.isNaN(teacherId)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
    }

    try {
        await ensureTeacherNotificationsTable();
        const [result] = await pool.query(
            `UPDATE teacher_notifications
             SET is_read = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE teacher_id = ? AND is_read = 0`,
            [teacherId]
        );
        return res.status(200).json({ success: true, count: result.affectedRows || 0 });
    } catch (err) {
        console.error('Error marking all teacher notifications as read:', err);
        return res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

router.delete('/teacher/:teacher_id/:notification_id', async (req, res) => {
    const teacherId = parseInt(req.params.teacher_id, 10);
    const notificationId = parseInt(req.params.notification_id, 10);

    if (!teacherId || Number.isNaN(teacherId) || !notificationId || Number.isNaN(notificationId)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    try {
        await ensureTeacherNotificationsTable();
        const [result] = await pool.query(
            'DELETE FROM teacher_notifications WHERE id = ? AND teacher_id = ?',
            [notificationId, teacherId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        return res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (err) {
        console.error('Error deleting teacher notification:', err);
        return res.status(500).json({ error: 'Failed to delete notification' });
    }
});

router.get('/admin/:admin_id', async (req, res) => {
    const adminId = parseInt(req.params.admin_id, 10);
    const limit = parseLimit(req.query.limit, 50, 200);
    const unreadOnly = String(req.query.unread_only || 'false') === 'true';

    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    try {
        await ensureAdminNotificationsTable();

        let query = 'SELECT * FROM admin_notifications WHERE admin_id = ?';
        const params = [adminId];
        if (unreadOnly) query += ' AND is_read = 0';
        query += ' ORDER BY created_at DESC LIMIT ' + limit;

        const [rows] = await pool.query(query, params);
        return res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching admin notifications:', err);
        return res.status(500).json({ error: 'Failed to fetch admin notifications' });
    }
});

router.get('/admin/:admin_id/unread-count', async (req, res) => {
    const adminId = parseInt(req.params.admin_id, 10);
    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    try {
        await ensureAdminNotificationsTable();
        const [rows] = await pool.query(
            'SELECT COUNT(*) AS unread_count FROM admin_notifications WHERE admin_id = ? AND is_read = 0',
            [adminId]
        );
        return res.status(200).json({ unread_count: parseInt(rows[0]?.unread_count || 0, 10) });
    } catch (err) {
        console.error('Error fetching admin unread count:', err);
        return res.status(500).json({ error: 'Failed to fetch admin unread count' });
    }
});

router.post('/admin', async (req, res) => {
    const { admin_id, type, title, message, related_data } = req.body || {};
    const adminId = parseInt(admin_id, 10);

    if (!adminId || Number.isNaN(adminId) || !type || !title || !message) {
        return res.status(400).json({ error: 'Missing required fields: admin_id, type, title, message' });
    }

    try {
        await ensureAdminNotificationsTable();
        const [result] = await pool.query(
            `INSERT INTO admin_notifications (admin_id, type, title, message, related_data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [adminId, type, title, message, JSON.stringify(related_data || {})]
        );

        const [rows] = await pool.query('SELECT * FROM admin_notifications WHERE id = ? LIMIT 1', [result.insertId]);
        return res.status(201).json({ success: true, notification: rows[0] || null });
    } catch (err) {
        console.error('Error creating admin notification:', err);
        return res.status(500).json({ error: 'Failed to create admin notification' });
    }
});

router.put('/admin/:admin_id/:notification_id/read', async (req, res) => {
    const adminId = parseInt(req.params.admin_id, 10);
    const notificationId = parseInt(req.params.notification_id, 10);

    if (!adminId || Number.isNaN(adminId) || !notificationId || Number.isNaN(notificationId)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    try {
        await ensureAdminNotificationsTable();
        const [result] = await pool.query(
            `UPDATE admin_notifications
             SET is_read = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND admin_id = ?`,
            [notificationId, adminId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        return res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (err) {
        console.error('Error marking admin notification as read:', err);
        return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

router.put('/admin/:admin_id/read-all', async (req, res) => {
    const adminId = parseInt(req.params.admin_id, 10);
    if (!adminId || Number.isNaN(adminId)) {
        return res.status(400).json({ error: 'Invalid admin ID' });
    }

    try {
        await ensureAdminNotificationsTable();
        const [result] = await pool.query(
            `UPDATE admin_notifications
             SET is_read = 1, read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE admin_id = ? AND is_read = 0`,
            [adminId]
        );
        return res.status(200).json({ success: true, count: result.affectedRows || 0 });
    } catch (err) {
        console.error('Error marking all admin notifications as read:', err);
        return res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

router.delete('/admin/:admin_id/:notification_id', async (req, res) => {
    const adminId = parseInt(req.params.admin_id, 10);
    const notificationId = parseInt(req.params.notification_id, 10);

    if (!adminId || Number.isNaN(adminId) || !notificationId || Number.isNaN(notificationId)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    try {
        await ensureAdminNotificationsTable();
        const [result] = await pool.query(
            'DELETE FROM admin_notifications WHERE id = ? AND admin_id = ?',
            [notificationId, adminId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        return res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (err) {
        console.error('Error deleting admin notification:', err);
        return res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;



