const pool = require('./db');

async function checkEnrollmentStatus() {
    try {
        // Get ALL enrollments to see their status
        const result = await pool.query(`
            SELECT id, student_id, status, created_at
            FROM enrollments
            ORDER BY student_id
        `);
        
        console.log('\n=== ALL ENROLLMENTS STATUS ===');
        console.log('Total enrollments:', result.rows.length);
        
        const statusCounts = {};
        result.rows.forEach(e => {
            const status = e.status || 'NULL';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
            console.log(`Enrollment ID: ${e.id}, Student: ${e.student_id}, Status: "${status}"`);
        });
        
        console.log('\n=== STATUS SUMMARY ===');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`${status}: ${count} enrollments`);
        });
        
        // Now check specifically for Citizenship students
        console.log('\n=== CITIZENSHIP STUDENTS WITH STATUS ===');
        const citizenshipResult = await pool.query(`
            SELECT e.id, e.student_id, e.status, e.enrollment_data::text ILIKE '%Citizenship%' as has_citizenship
            FROM enrollments e
            WHERE e.enrollment_data::text ILIKE '%Citizenship%'
            ORDER BY e.student_id
        `);
        
        citizenshipResult.rows.forEach(e => {
            console.log(`Student ${e.student_id}: Status = "${e.status}"`);
        });
        
        // Check: how many APPROVED enrollments with Citizenship exist?
        const approvedCitizenship = await pool.query(`
            SELECT COUNT(*) as count
            FROM enrollments e
            WHERE e.status = 'Approved' AND e.enrollment_data::text ILIKE '%Citizenship%'
        `);
        
        console.log('\n=== KEY FINDING ===');
        console.log('APPROVED enrollments with Citizenship:', approvedCitizenship.rows[0].count);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkEnrollmentStatus();


