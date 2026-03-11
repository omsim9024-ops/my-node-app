// Test adviser teaching assignments endpoint
const pool = require('./db');

async function test() {
    try {
        console.log('\n=== TESTING ADVISER TEACHING ASSIGNMENTS ===\n');
        
        // Get all advisers
        const advisers = await pool.query(`
            SELECT id, adviser_id, email, first_name, last_name 
            FROM advisers 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('Found', advisers.rows.length, 'advisers:\n');
        
        for (const adviser of advisers.rows) {
            console.log(`\n--- Adviser: ${adviser.first_name} ${adviser.last_name} ---`);
            console.log(`  ID: ${adviser.id}, adviser_id: ${adviser.adviser_id}, email: ${adviser.email}`);
            
            // Find teacher with same email
            const teacher = await pool.query(
                'SELECT id, teacher_id, email FROM teachers WHERE LOWER(email) = LOWER($1)',
                [adviser.email]
            );
            
            if (teacher.rows.length > 0) {
                const t = teacher.rows[0];
                console.log(`  ✓ Teacher found: ID=${t.id}, teacher_id=${t.teacher_id}`);
                
                // Get subject assignments
                const assignments = await pool.query(`
                    SELECT 
                        tsa.id,
                        tsa.subject,
                        s.section_code,
                        s.section_name,
                        s.grade
                    FROM teacher_subject_assignments tsa
                    LEFT JOIN sections s ON s.id = tsa.section_id
                    WHERE tsa.teacher_id = $1
                `, [t.id]);
                
                if (assignments.rows.length > 0) {
                    console.log(`  ✓ Subject assignments: ${assignments.rows.length}`);
                    assignments.rows.forEach(a => {
                        console.log(`    - ${a.subject} in ${a.section_code} (Grade ${a.grade})`);
                    });
                } else {
                    console.log(`  ✗ No subject assignments found`);
                }
            } else {
                console.log(`  ✗ No teacher found with email: ${adviser.email}`);
            }
        }
        
        await pool.end();
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

test();

