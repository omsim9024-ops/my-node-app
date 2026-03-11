// Script to verify teacher section assignments in the database
// NOTE: this script currently uses PostgreSQL-specific JSON functions
// (json_agg, json_build_object, ::json). It will not run correctly against
// a MySQL server such as AMPPS. You can either ignore it or rewrite the
// queries for MySQL if needed.
const pool = require('./db');

async function verify() {
    try {
        console.log('\n=== TEACHER SECTION ASSIGNMENTS VERIFICATION ===\n');
        
        // Check if any assignments exist
        const allAssignments = await pool.query(`
            SELECT 
                tsa.*,
                t.name as teacher_name,
                s.section_code,
                s.section_name,
                s.grade,
                sy.school_year
            FROM teacher_section_assignments tsa
            JOIN teachers t ON t.id = tsa.teacher_id
            JOIN sections s ON s.id = tsa.section_id
            LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
            ORDER BY t.name, s.grade, s.section_code
        `)
        
        console.log('Total assignments found:', allAssignments.rows.length, '\n');
        
        if (allAssignments.rows.length > 0) {
            console.log('Assignments:');
            allAssignments.rows.forEach(row => {
                console.log(`  - ${row.teacher_name} → ${row.section_code} (${row.section_name}) | School Year: ${row.school_year || 'NULL'}`);
            });
        }
        
        console.log('\n=== TEACHERS WITH ADVISER ROLE ===\n');
        
        const advisers = await pool.query(`
            SELECT 
                id,
                name,
                role,
                created_at
            FROM teachers 
            WHERE role = 'Adviser'
            ORDER BY name
        `);
        
        console.log('Total advisers:', advisers.rows.length, '\n');
        
        for (const adviser of advisers.rows) {
            const assignments = await pool.query(`
                SELECT 
                    tsa.*,
                    s.section_code,
                    s.section_name,
                    s.grade,
                    sy.school_year
                FROM teacher_section_assignments tsa
                LEFT JOIN sections s ON s.id = tsa.section_id
                LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
                WHERE tsa.teacher_id = $1
            `, [adviser.id])
            
            console.log(`${adviser.name} (ID: ${adviser.id})`);
            if (assignments.rows.length > 0) {
                assignments.rows.forEach(a => {
                    console.log(`  → ${a.section_code} (${a.section_name}) | SY: ${a.school_year}`);
                });
            } else {
                console.log('  → NO ASSIGNMENTS');
            }
        }
        
        console.log('\n=== TEST: SUBJECT ASSIGNMENTS QUERY ===\n');
        
        // Test subject assignments query
        const testSubjectQuery = await pool.query(`
            SELECT 
                t.id, 
                t.teacher_id, 
                t.name, 
                t.role,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'section_id', tsubj.section_id,
                            'subject', tsubj.subject,
                            'section_code', s.section_code,
                            'section_name', s.section_name,
                            'grade', s.grade,
                            'school_year_id', tsubj.school_year_id,
                            'school_year', sy.school_year
                        ) ORDER BY s.grade, s.section_code, tsubj.subject
                    )
                    FROM teacher_subject_assignments tsubj
                    LEFT JOIN sections s ON s.id = tsubj.section_id
                    LEFT JOIN school_years sy ON sy.id = tsubj.school_year_id
                    WHERE tsubj.teacher_id = t.id),
                    '[]'::json
                ) as subject_assignments
            FROM teachers t
            ORDER BY t.created_at DESC
            LIMIT 10
        `);
        
        console.log('Subject assignments for teachers:');
        testSubjectQuery.rows.forEach(row => {
            console.log(`\n${row.name} (${row.teacher_id})`);
            if (row.subject_assignments && row.subject_assignments.length > 0) {
                console.log('  Subjects:');
                row.subject_assignments.forEach(a => {
                    console.log(`    - ${a.subject} in ${a.section_code} (Grade ${a.grade})`);
                });
            } else {
                console.log('  Subject: NO ASSIGNMENTS');
            }
        });
        
        console.log('\n=== TEST: COMBINED LIST QUERY ===\n');
        
        // Test the new /list endpoint query with both
        const testCombinedQuery = await pool.query(`
            SELECT 
                t.id, 
                t.teacher_id, 
                t.name, 
                t.role,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'section_id', tsa.section_id,
                            'section_code', s.section_code,
                            'section_name', s.section_name,
                            'grade', s.grade,
                            'assigned_date', tsa.assigned_date,
                            'school_year_id', tsa.school_year_id,
                            'school_year', sy.school_year
                        ) ORDER BY s.grade, s.section_code
                    )
                    FROM teacher_section_assignments tsa
                    LEFT JOIN sections s ON s.id = tsa.section_id
                    LEFT JOIN school_years sy ON sy.id = tsa.school_year_id
                    WHERE tsa.teacher_id = t.id),
                    '[]'::json
                ) as assigned_sections,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'section_id', tsubj.section_id,
                            'subject', tsubj.subject,
                            'section_code', s.section_code,
                            'section_name', s.section_name,
                            'grade', s.grade,
                            'school_year_id', tsubj.school_year_id,
                            'school_year', sy.school_year
                        ) ORDER BY s.grade, s.section_code, tsubj.subject
                    )
                    FROM teacher_subject_assignments tsubj
                    LEFT JOIN sections s ON s.id = tsubj.section_id
                    LEFT JOIN school_years sy ON sy.id = tsubj.school_year_id
                    WHERE tsubj.teacher_id = t.id),
                    '[]'::json
                ) as subject_assignments
            FROM teachers t
            ORDER BY t.created_at DESC
            LIMIT 10
        `);
        
        console.log('Combined data for all teachers:');
        testCombinedQuery.rows.forEach(row => {
            console.log(`\n${row.name} (${row.teacher_id}) - Role: ${row.role}`);
            console.log('  Adviser sections:', row.assigned_sections.length > 0 ? row.assigned_sections.map(s => s.section_code).join(', ') : 'NONE');
            console.log('  Subject assignments:', row.subject_assignments.length > 0 ? row.subject_assignments.map(a => `${a.subject} (${a.section_code})`).join(', ') : 'NONE');
        });
        
        await pool.end();
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

verify();

