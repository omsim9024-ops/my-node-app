#!/usr/bin/env node
/**
 * Test script to verify the students API returns the correct data format
 */

const pool = require('./db');

async function testStudentsAPI() {
    try {
        console.log('Testing Students API Query...\n');
        
        const [result] = await pool.query(`
            SELECT 
                s.id,
                s.student_id,
                CONCAT(s.first_name, ' ', s.last_name) as name,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.grade_level,
                CASE 
                    WHEN s.grade_level REGEXP '^[0-9]+' THEN CAST(SUBSTRING(s.grade_level,1,2) AS UNSIGNED)
                    ELSE NULL
                END as grade,
                CASE 
                    WHEN s.grade_level REGEXP '^[0-9]+' THEN 
                        CASE 
                            WHEN CAST(SUBSTRING(s.grade_level,1,2) AS UNSIGNED) >= 11 THEN 'SHS'
                            ELSE 'JHS'
                        END
                    ELSE NULL
                END as level,
                s.class_id,
                s.account_status,
                s.registration_date,
                s.created_at,
                s.school_year_id,
                c.class_name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.sex')), '') as gender,
                UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.track')), '')) as track,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data, '$.elective')), '') as elective,
                e.status as enrollment_status
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN enrollments e ON s.id = e.student_id
            ORDER BY s.created_at DESC
            LIMIT 5
        `);
        
        console.log(`Found ${result.length} students\n`);
        
        if (result.length > 0) {
            console.log('Sample student data:');
            console.log(JSON.stringify(result[0], null, 2));
            
            console.log('\n\nAll students (summary):');
            result.forEach((row, index) => {
                console.log(`${index + 1}. ${row.name} (ID: ${row.student_id}) - Grade: ${row.grade}, Level: ${row.level}, Gender: ${row.gender}, Track: ${row.track}`);
            });
        } else {
            console.log('No students found in database');
        }
        
        // Test the level determination logic
        console.log('\n\nTesting level determination logic:');
        const testGrades = ['7', '8', '9', '10', '11', '12'];
        testGrades.forEach(grade => {
            const level = parseInt(grade) >= 11 ? 'SHS' : 'JHS';
            console.log(`Grade ${grade} -> ${level}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testStudentsAPI();

