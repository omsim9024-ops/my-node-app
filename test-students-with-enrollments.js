#!/usr/bin/env node
/**
 * Test script to verify students are returned from both students table and enrollments
 */

const pool = require('./db');

async function testStudentsAPI() {
    try {
        console.log('Testing Students API Query with Enrollments...\n');
        
        const [result] = await pool.query(`
            -- Get students from students table
            SELECT 
                CAST(s.id AS CHAR) as id,
                s.student_id COLLATE utf8mb4_general_ci as student_id,
                CONCAT(s.first_name, ' ', s.last_name) COLLATE utf8mb4_general_ci as name,
                'from_students_table' COLLATE utf8mb4_general_ci as source
            FROM students s 
            
            UNION ALL
            
            -- Get students from enrollments that aren't in students table
            SELECT 
                CAST(e.student_id AS CHAR) COLLATE utf8mb4_general_ci as id,
                CAST(e.student_id AS CHAR) COLLATE utf8mb4_general_ci as student_id,
                COALESCE(
                    CONCAT(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.firstName')), ' ', JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.lastName'))),
                    CONCAT('Student ', e.student_id)
                ) COLLATE utf8mb4_general_ci as name,
                'from_enrollments_table' COLLATE utf8mb4_general_ci as source
            FROM enrollments e
            WHERE e.student_id NOT IN (SELECT id FROM students)
            
            ORDER BY source DESC, id DESC
        `);
        
        console.log(`Found ${result.length} students (from both sources)\n`);
        
        if (result.length > 0) {
            result.forEach((row, index) => {
                console.log(`${index + 1}. ID: ${row.id}, Name: "${row.name}", Source: ${row.source}`);
            });
        } else {
            console.log('NO STUDENTS FOUND!');
        }
        
        console.log('\n\nNow testing full query with all fields...\n');
        
        const [fullResult] = await pool.query(`
            SELECT 
                CAST(s.id AS CHAR) as id,
                s.student_id COLLATE utf8mb4_general_ci as student_id,
                CONCAT(s.first_name, ' ', s.last_name) COLLATE utf8mb4_general_ci as name,
                s.first_name,
                s.last_name,
                s.email,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.sex')), '') as gender,
                UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.track')), '')) as track,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.gradeLevel')), s.grade_level) as grade_level,
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
                e.status as enrollment_status
            FROM students s 
            LEFT JOIN enrollments e ON s.id = e.student_id
            
            UNION ALL
            
            SELECT 
                CAST(e.student_id AS CHAR) COLLATE utf8mb4_general_ci as id,
                CAST(e.student_id AS CHAR) COLLATE utf8mb4_general_ci as student_id,
                COALESCE(
                    CONCAT(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.firstName')), ' ', JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.lastName'))),
                    CONCAT('Student ', e.student_id)
                ) COLLATE utf8mb4_general_ci as name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.firstName')), '') as first_name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.lastName')), '') as last_name,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.email')), '') as email,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.sex')), '') as gender,
                UPPER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.track')), '')) as track,
                COALESCE(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.gradeLevel')), '') as grade_level,
                CASE 
                    WHEN JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.gradeLevel')) REGEXP '^[0-9]+' THEN 
                        CAST(SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.gradeLevel')),1,2) AS UNSIGNED)
                    ELSE NULL
                END as grade,
                CASE 
                    WHEN JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.gradeLevel')) REGEXP '^[0-9]+' THEN 
                        CASE 
                            WHEN CAST(SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(e.enrollment_data,'$.gradeLevel')),1,2) AS UNSIGNED) >= 11 THEN 'SHS'
                            ELSE 'JHS'
                        END
                    ELSE NULL
                END as level,
                e.status as enrollment_status
            FROM enrollments e
            WHERE e.student_id NOT IN (SELECT id FROM students)
            
            ORDER BY grade_level DESC
        `);
        
        console.log(`Total with all fields: ${fullResult.length}\n`);
        
        fullResult.forEach((row, index) => {
            console.log(`${index + 1}. Name: "${row.name}", Grade: ${row.grade}, Level: ${row.level}, Gender: ${row.gender}, Track: ${row.track}, Status: ${row.enrollment_status}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

testStudentsAPI();

