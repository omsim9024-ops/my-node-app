const pool = require('./db');

async function checkEnrollmentData() {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                student_id,
                enrollment_data,
                created_at
            FROM enrollments
            LIMIT 5
        `);
        
        console.log('\n=== ENROLLMENT DATA INSPECTION ===');
        console.log('Total enrollments checked: 5');
        
        result.rows.forEach((enrollment, idx) => {
            console.log(`\n--- Enrollment ${idx + 1} ---`);
            console.log('Student ID:', enrollment.student_id);
            console.log('Created:', enrollment.created_at);
            
            const data = enrollment.enrollment_data || {};
            console.log('Enrollment Data Type:', typeof data);
            if (typeof data === 'string') {
                try {
                    const parsed = JSON.parse(data);
                    console.log('Parsed Data Keys:', Object.keys(parsed));
                    console.log('First Name:', parsed.firstName || 'N/A');
                    console.log('Academic Electives:', JSON.stringify(parsed.academicElectives || []));
                    console.log('TechPro Electives:', JSON.stringify(parsed.techproElectives || []));
                    console.log('Doorway Academic:', JSON.stringify(parsed.doorwayAcademic || []));
                    console.log('Doorway TechPro:', JSON.stringify(parsed.doorwayTechPro || []));
                } catch (e) {
                    console.log('Could not parse:', e.message);
                }
            } else if (typeof data === 'object') {
                console.log('Data Keys:', Object.keys(data));
                console.log('First Name:', data.firstName || 'N/A');
                console.log('Academic Electives:', JSON.stringify(data.academicElectives || []));
                console.log('TechPro Electives:', JSON.stringify(data.techproElectives || []));
                console.log('Doorway Academic:', JSON.stringify(data.doorwayAcademic || []));
                console.log('Doorway TechPro:', JSON.stringify(data.doorwayTechPro || []));
            }
        });
        
        console.log('\n=== END INSPECTION ===\n');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkEnrollmentData();


