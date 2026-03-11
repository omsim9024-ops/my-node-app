const pool = require('./db');

async function clearTestData() {
    try {
        // Delete enrollments created by insert-test-data.js (those without real student names)
        const deleteEnrollmentsQuery = `
            DELETE FROM enrollments 
            WHERE enrollment_id LIKE 'ENR%' 
            AND enrollment_date > NOW() - INTERVAL '1 day';
        `;

        const result = await pool.query(deleteEnrollmentsQuery);
        console.log(`✓ Deleted ${result.rowCount} test enrollments`);

        // Delete test students (those created by insert-test-data.js)
        const deleteStudentsQuery = `
            DELETE FROM students 
            WHERE student_id LIKE 'STU%' 
            AND created_at > NOW() - INTERVAL '1 day';
        `;

        const studentResult = await pool.query(deleteStudentsQuery);
        console.log(`✓ Deleted ${studentResult.rowCount} test students`);

        console.log('\n✓ Test data cleared successfully!');
        console.log('Real user enrollments will now appear in reports once approved.');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing test data:', error);
        process.exit(1);
    }
}

clearTestData();


