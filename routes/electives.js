const express = require('express');
const pool = require('../db');
const router = express.Router();

// Get electives for a specific section
router.get('/section/:sectionId', async (req, res) => {
    const { sectionId } = req.params;

    try {
        // Fetch the section with its electives field
        const [rows] = await pool.query(
            'SELECT id, section_name, electives FROM sections WHERE id = ?',
            [sectionId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Section not found', electives: [] });
        }

        const section = rows[0];
        let electives = [];

        // Parse the electives field - stored as comma-separated string with subjects in parentheses
        if (section.electives) {
            try {
                if (typeof section.electives === 'string') {
                    // Smart parser: split on commas only when not inside parentheses
                    // e.g., "Creative Industries (Music, Dance, Theater),Subject2,Subject3"
                    // Should split into: ["Creative Industries (Music, Dance, Theater)", "Subject2", "Subject3"]
                    
                    const parts = [];
                    let current = '';
                    let parenDepth = 0;
                    
                    for (let i = 0; i < section.electives.length; i++) {
                        const char = section.electives[i];
                        
                        if (char === '(') {
                            parenDepth++;
                            current += char;
                        } else if (char === ')') {
                            parenDepth--;
                            current += char;
                        } else if (char === ',' && parenDepth === 0) {
                            // Only split on comma if we're not inside parentheses
                            if (current.trim()) {
                                parts.push(current.trim());
                            }
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    
                    // Don't forget the last item
                    if (current.trim()) {
                        parts.push(current.trim());
                    }
                    
                    electives = parts.map(name => ({ 
                        subject_name: name, 
                        name: name, 
                        subject: name 
                    }));
                    
                    console.log(`[GET /electives/section/:sectionId] Parsed ${parts.length} electives from string:`, parts.slice(0, 3), parts.length > 3 ? '...' : '');
                } else if (Array.isArray(section.electives)) {
                    // Already an array
                    electives = section.electives.map(e => {
                        if (typeof e === 'string') {
                            return { subject_name: e, name: e, subject: e };
                        }
                        return e;
                    });
                }
            } catch (parseErr) {
                console.warn(`[GET /electives/section/:sectionId] Error parsing electives for section ${sectionId}:`, parseErr);
                // Fallback: treat as comma-delimited string
                const parts = section.electives.toString().split(',').map(s => s.trim()).filter(Boolean);
                electives = parts.map(name => ({ subject_name: name, name: name, subject: name }));
            }
        }

        console.log(`[GET /electives/section/:sectionId] Section ${sectionId} (${section.section_name}): ${electives.length} electives found`);
        res.json(electives);
    } catch (err) {
        console.error(`[GET /electives/section/:sectionId] Error:`, err);
        res.status(500).json({ error: 'Server error', electives: [] });
    }
});

module.exports = router;



