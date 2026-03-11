const express = require('express');
const pool = require('../db');
const router = express.Router();

// Get all classes
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT c.*, t.name as teacher_name FROM classes c LEFT JOIN teachers t ON c.teacher_id = t.id ORDER BY c.created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single class
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM classes WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create class
router.post('/', async (req, res) => {
    const { class_name, grade_level, teacher_id, capacity } = req.body;
    
    if (!class_name || !grade_level) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const [rows] = await pool.query(
            'INSERT INTO classes (class_name, grade_level, teacher_id, capacity) VALUES (?, ?, ?, ?)',
            [class_name, grade_level, teacher_id || null, capacity || 40]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update class
router.put('/:id', async (req, res) => {
    const { class_name, grade_level, teacher_id, capacity, enrollment } = req.body;
    
    try {
        const [rows] = await pool.query(
            'UPDATE classes SET class_name = ?, grade_level = ?, teacher_id = ?, capacity = ?, enrollment = ? WHERE id = ?',
            [class_name, grade_level, teacher_id || null, capacity, enrollment, req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete class
router.delete('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('DELETE FROM classes WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        res.json({ message: 'Class deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;



