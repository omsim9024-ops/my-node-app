const pool = require('./db');

async function checkEnrollmentsWithCitizenshipElective() {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                student_id,
                enrollment_data,
                created_at
            FROM enrollments
            WHERE enrollment_data::text ILIKE '%Citizenship and Civic Engagement%'
        `);
        
        console.log('\n=== ENROLLMENT DATA - CITIZENSHIP ELECTIVES ===');
        console.log('Total found: ', result.rows.length);
        
        result.rows.forEach((enrollment, idx) => {
            console.log(`\n--- Enrollment ${idx + 1} ---`);
            const data = enrollment.enrollment_data || {};
            console.log('Student ID:', enrollment.student_id);
            console.log('First Name:', data.firstName || 'N/A');
            console.log('Sex:', data.sex || 'N/A');
            console.log('Academic Electives:', JSON.stringify(data.academicElectives || []));
            console.log('Doorway Academic:', JSON.stringify(data.doorwayAcademic || []));
        });
        
        console.log('\n=== END ===\n');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkEnrollmentsWithCitizenshipElective();


