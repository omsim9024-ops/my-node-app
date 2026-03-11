const express = require('express');
const router = express.Router();

// GET /api/messaging/groups?userId=...
router.get('/', async (req, res) => {
    const pool = req.dbPool;
    const userId = String(req.query.userId || '').trim();
    if (!userId) {
        return res.status(400).json({ error: 'userId query parameter is required' });
    }
    try {
        const [rows] = await pool.query(
            `SELECT g.id, g.name, GROUP_CONCAT(m.user_id) AS member_list
             FROM chat_groups g
             JOIN chat_group_members m ON m.group_id = g.id
             WHERE g.id IN (
                 SELECT group_id FROM chat_group_members WHERE user_id = ?
             )
             GROUP BY g.id, g.name`,
            [userId]
        );
        const groups = (rows || []).map(r => ({
            id: r.id,
            name: r.name,
            members: r.member_list ? String(r.member_list).split(',') : []
        }));
        res.json({ groups });
    } catch (err) {
        console.error('[MessagingGroups] list error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/messaging/groups/:id
router.get('/:id', async (req, res) => {
    const pool = req.dbPool;
    const gid = Number(req.params.id || 0);
    if (!gid) {
        return res.status(400).json({ error: 'invalid group id' });
    }
    try {
        const [[groupRow]] = await pool.query('SELECT id, name FROM chat_groups WHERE id = ?', [gid]);
        if (!groupRow) {
            return res.status(404).json({ error: 'group not found' });
        }
        const [members] = await pool.query('SELECT user_id FROM chat_group_members WHERE group_id = ?', [gid]);
        res.json({ id: groupRow.id, name: groupRow.name, members: (members || []).map(m => m.user_id) });
    } catch (err) {
        console.error('[MessagingGroups] fetch error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/messaging/groups
router.post('/', async (req, res) => {
    const pool = req.dbPool;
    const { name, members } = req.body || {};
    const creator = req.body.creatorId || '';
    if (!name || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ error: 'name and members array are required' });
    }
    try {
        // ensure creator is included
        const uniq = new Set(members.map(String));
        if (creator) uniq.add(String(creator));
        const memberList = Array.from(uniq);
        const [result] = await pool.query('INSERT INTO chat_groups (name, creator_id) VALUES (?, ?)', [String(name), String(creator)]);
        const gid = result.insertId;
        const rows = memberList.map(u => [gid, String(u)]);
        if (rows.length) {
            await pool.query('INSERT INTO chat_group_members (group_id, user_id) VALUES ?', [rows]);
        }
        // after creation send real-time notification to each member (if connected)
        try {
            const server = require('../server');
            const scopedList = memberList.map(u => server.tenantScopedUserKey(req.tenant.id, u));
            const payload = JSON.stringify({ type: 'group_created', group: { id: gid, name, members: memberList } });
            scopedList.forEach(scoped => {
                const ws = server.messagingClients.get(scoped);
                if (ws && ws.readyState === ws.OPEN) {
                    ws.send(payload);
                }
            });
        } catch (_e) {
            // listener may not be available or server not exported yet
        }
        res.status(201).json({ groupId: gid, name, members: memberList });
    } catch (err) {
        console.error('[MessagingGroups] create error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// add or update group members
router.put('/:id/members', async (req, res) => {
    const pool = req.dbPool;
    const gid = Number(req.params.id || 0);
    const { members } = req.body || {};
    if (!gid || !Array.isArray(members)) {
        return res.status(400).json({ error: 'invalid request' });
    }
    try {
        const rows = members.map(u => [gid, String(u)]);
        if (rows.length) {
            // ignore duplicates
            await pool.query('INSERT IGNORE INTO chat_group_members (group_id, user_id) VALUES ?', [rows]);
        }
        // notify newly-added users of group membership
        try {
            const server = require('../server');
            const payload = JSON.stringify({ type: 'group_members_added', groupId: gid, members });
            members.forEach(u => {
                const scoped = server.tenantScopedUserKey(req.tenant.id, u);
                const ws = server.messagingClients.get(scoped);
                if (ws && ws.readyState === ws.OPEN) {
                    ws.send(payload);
                }
            });
        } catch (_e) {}
        res.json({ success: true });
    } catch (err) {
        console.error('[MessagingGroups] update members error', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
