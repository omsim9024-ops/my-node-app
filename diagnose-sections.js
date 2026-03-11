const db = require('./db');

async function diagnose() {
    try {
        console.log('\n=== DIAGNOSTIC CHECK ===\n');
        
        // Check approved enrollments
        const enrollments = await db.query(`
            SELECT id, student_id, section_id, status 
            FROM enrollments 
            WHERE status = 'Approved' 
            LIMIT 5
        `);
        
        console.log('Approved Enrollments (sample):');
        enrollments.rows.forEach(e => {
            console.log(`  - ID: ${e.id}, Student: ${e.student_id}, Section ID: ${e.section_id || 'NULL'}, Status: ${e.status}`);
        });
        
        // Count enrollments by section_id
        const sectionStats = await db.query(`
            SELECT section_id, COUNT(*) as count 
            FROM enrollments 
            WHERE status = 'Approved' 
            GROUP BY section_id
        `);
        
        console.log('\nEnrollments by Section ID:');
        sectionStats.rows.forEach(row => {
            console.log(`  - Section ID ${row.section_id}: ${row.count} enrollments`);
        });
        
        // Check sections table
        const sections = await db.query(`
            SELECT id, name, grade_level 
            FROM sections 
            LIMIT 5
        `);
        
        console.log('\nAvailable Sections (sample):');
        sections.rows.forEach(s => {
            console.log(`  - ID: ${s.id}, Name: "${s.name}", Grade: ${s.grade_level}`);
        });
        
        // Check for sections with students
        const sectionsWithStudents = await db.query(`
            SELECT s.id, s.name, COUNT(e.id) as student_count
            FROM sections s
            LEFT JOIN enrollments e ON s.id = e.section_id AND e.status = 'Approved'
            GROUP BY s.id, s.name
            HAVING COUNT(e.id) > 0
        `);
        
        console.log('\nSections with Assigned Students:');
        if (sectionsWithStudents.rows.length === 0) {
            console.log('  ⚠️  NO STUDENTS ASSIGNED TO ANY SECTION!');
        } else {
            sectionsWithStudents.rows.forEach(s => {
                console.log(`  - Section "${s.name}" (ID: ${s.id}): ${s.student_count} students`);
            });
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

diagnose();


