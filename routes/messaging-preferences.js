const express = require('express');
const pool = require('../db');

const router = express.Router();

const ALLOWED_USER_TYPES = new Set(['admin', 'teacher']);

function normalizeUserType(input) {
    const value = String(input || '').toLowerCase().trim();
    if (value === 'guidance' || value === 'master') return 'admin';
    if (value === 'adviser' || value === 'advisor' || value === 'subject_teacher' || value === 'subject teacher') return 'teacher';
    return value;
}

async function ensureMessagingPreferencesTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS messaging_preferences (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_type VARCHAR(20) NOT NULL,
            user_id INT NOT NULL,
            peer_id VARCHAR(100) NOT NULL,
            is_pinned TINYINT(1) DEFAULT 0,
            is_muted TINYINT(1) DEFAULT 0,
            is_deleted TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_msg_pref_user_peer (user_type, user_id, peer_id),
            INDEX idx_msg_pref_user (user_type, user_id)
        )
    `);
}

router.get('/:userType/:userId', async (req, res) => {
    const userType = normalizeUserType(req.params.userType);
    const userId = parseInt(req.params.userId, 10);

    if (!ALLOWED_USER_TYPES.has(userType)) {
        return res.status(400).json({ error: 'Invalid user type' });
    }

    if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
        await ensureMessagingPreferencesTable();

        const [rows] = await pool.query(
            `SELECT peer_id, is_pinned, is_muted, is_deleted
             FROM messaging_preferences
             WHERE user_type = ? AND user_id = ?`,
            [userType, userId]
        );

        const prefs = { pinned: {}, muted: {}, deleted: {} };
        (rows || []).forEach((row) => {
            const peerId = String(row.peer_id || '');
            if (!peerId) return;
            if (Number(row.is_pinned || 0) === 1) prefs.pinned[peerId] = true;
            if (Number(row.is_muted || 0) === 1) prefs.muted[peerId] = true;
            if (Number(row.is_deleted || 0) === 1) prefs.deleted[peerId] = true;
        });

        return res.status(200).json({ success: true, preferences: prefs });
    } catch (err) {
        console.error('Error loading messaging preferences:', err);
        return res.status(500).json({ error: 'Failed to load messaging preferences' });
    }
});

router.put('/:userType/:userId/:peerId', async (req, res) => {
    const userType = normalizeUserType(req.params.userType);
    const userId = parseInt(req.params.userId, 10);
    const peerId = String(req.params.peerId || '').trim();
    const payload = req.body || {};

    if (!ALLOWED_USER_TYPES.has(userType)) {
        return res.status(400).json({ error: 'Invalid user type' });
    }

    if (!userId || Number.isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (!peerId) {
        return res.status(400).json({ error: 'Invalid peer ID' });
    }

    const hasPinned = Object.prototype.hasOwnProperty.call(payload, 'pinned');
    const hasMuted = Object.prototype.hasOwnProperty.call(payload, 'muted');
    const hasDeleted = Object.prototype.hasOwnProperty.call(payload, 'deleted');

    if (!hasPinned && !hasMuted && !hasDeleted) {
        return res.status(400).json({ error: 'At least one preference is required (pinned, muted, deleted)' });
    }

    try {
        await ensureMessagingPreferencesTable();

        const [existingRows] = await pool.query(
            `SELECT is_pinned, is_muted, is_deleted
             FROM messaging_preferences
             WHERE user_type = ? AND user_id = ? AND peer_id = ?
             LIMIT 1`,
            [userType, userId, peerId]
        );

        const existing = (existingRows && existingRows[0]) || {};
        const nextPinned = hasPinned ? (payload.pinned ? 1 : 0) : Number(existing.is_pinned || 0);
        const nextMuted = hasMuted ? (payload.muted ? 1 : 0) : Number(existing.is_muted || 0);
        const nextDeleted = hasDeleted ? (payload.deleted ? 1 : 0) : Number(existing.is_deleted || 0);

        await pool.query(
            `INSERT INTO messaging_preferences (user_type, user_id, peer_id, is_pinned, is_muted, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                is_pinned = VALUES(is_pinned),
                is_muted = VALUES(is_muted),
                is_deleted = VALUES(is_deleted),
                updated_at = CURRENT_TIMESTAMP`,
            [userType, userId, peerId, nextPinned, nextMuted, nextDeleted]
        );

        return res.status(200).json({
            success: true,
            preference: {
                peer_id: peerId,
                pinned: nextPinned === 1,
                muted: nextMuted === 1,
                deleted: nextDeleted === 1
            }
        });
    } catch (err) {
        console.error('Error saving messaging preference:', err);
        return res.status(500).json({ error: 'Failed to save messaging preference' });
    }
});

module.exports = router;



