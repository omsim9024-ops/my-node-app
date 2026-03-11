const db = require('./db');

async function checkSectionData() {
    try {
        // Use MySQL JSON functions and avoid columns that might not exist
    const result = await db.query(
            `SELECT id, student_id, 
                    JSON_UNQUOTE(JSON_EXTRACT(enrollment_data,'$.section')) AS json_section, 
                    JSON_UNQUOTE(JSON_EXTRACT(enrollment_data,'$.sectionSelected')) AS json_section_selected
             FROM enrollments 
             WHERE status = 'Approved' 
             LIMIT 5` // no semicolon inside query string
        );
        
        console.log('Enrollment section data:');
        result[0].forEach(row => {
            console.log(`ID ${row.id}:`);
            console.log(`  enrollment_data.section: ${row.json_section}`);
            console.log(`  enrollment_data.sectionSelected: ${row.json_section_selected}`);
        });
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit(0);
    }
}

checkSectionData();


