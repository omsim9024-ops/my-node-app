const express = require('express');
const pool = require('../db');
const router = express.Router();

// Get all grades
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT g.*, s.name as student_name, s.student_id FROM grades g JOIN students s ON g.student_id = s.id ORDER BY g.created_at DESC'
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get grades by student
router.get('/student/:student_id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT g.*, s.name as student_name FROM grades g JOIN students s ON g.student_id = s.id WHERE s.student_id = ? ORDER BY g.created_at DESC',
            [req.params.student_id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single grade
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM grades WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Grade not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create grade
router.post('/', async (req, res) => {
    const { student_id, subject, grade_value, quarter } = req.body;
    
    if (!student_id || !subject || grade_value === undefined || !quarter) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (grade_value < 0 || grade_value > 100) {
        return res.status(400).json({ error: 'Grade must be between 0 and 100' });
    }

    try {
        const [rows] = await pool.query(
            'INSERT INTO grades (student_id, subject, grade_value, quarter) VALUES (?, ?, ?, ?)',
            [student_id, subject, grade_value, quarter]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ error: 'Student not found' });
        }
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update grade
router.put('/:id', async (req, res) => {
    const { subject, grade_value, quarter } = req.body;
    
    if (grade_value < 0 || grade_value > 100) {
        return res.status(400).json({ error: 'Grade must be between 0 and 100' });
    }

    try {
        const [rows] = await pool.query(
            'UPDATE grades SET subject = ?, grade_value = ?, quarter = ? WHERE id = ?',
            [subject, grade_value, quarter, req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Grade not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete grade
router.delete('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('DELETE FROM grades WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Grade not found' });
        }
        res.json({ message: 'Grade deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Calculate average grade for all students
router.get('/stats/average', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT AVG(grade_value) as average_grade FROM grades'
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;



