/**
 * Diagnostic script to identify issues with admin dashboard
 * Run this with: node diagnose-admin-dashboard.js
 */

const pool = require('./db');

async function runDiagnostics() {
    try {
        console.log('\n=== ADMIN DASHBOARD DIAGNOSTICS ===\n');

        // 1. Check active school year
        console.log('1. Checking school years...');
        const schoolYears = await pool.query(
            'SELECT id, school_year, start_date, end_date, is_active FROM school_years ORDER BY start_date DESC'
        );
        console.log(`   Found ${schoolYears.rows.length} school year(s):`);
        schoolYears.rows.forEach(sy => {
            console.log(`   - ${sy.school_year} (${sy.start_date} to ${sy.end_date}) - ${sy.is_active ? 'ACTIVE' : 'inactive'}`);
        });

        if (schoolYears.rows.length === 0) {
            console.log('   ⚠️  NO SCHOOL YEARS FOUND - This will cause enrollments to not display!');
        } else if (!schoolYears.rows.some(sy => sy.is_active)) {
            console.log('   ⚠️  NO ACTIVE SCHOOL YEAR SET - This will cause enrollments to not display!');
        }

        // 2. Check total enrollments
        console.log('\n2. Checking enrollments...');
        const allEnrollments = await pool.query(
            'SELECT COUNT(*) as count, status FROM enrollments GROUP BY status UNION ALL SELECT COUNT(*) as count, \'TOTAL\' as status FROM enrollments'
        );
        console.log(`   Enrollment breakdown:`);
        allEnrollments.rows.forEach(row => {
            console.log(`   - ${row.status}: ${row.count}`);
        });

        // 3. Check enrollments for active school year
        console.log('\n3. Checking enrollments for ACTIVE school year...');
        const activeEnrollments = await pool.query(
            `SELECT COUNT(*) as count FROM enrollments 
             WHERE school_year_id = (SELECT id FROM school_years WHERE is_active = true LIMIT 1)`
        );
        console.log(`   Enrollments in active school year: ${activeEnrollments.rows[0].count}`);

        // 4. Check students
        console.log('\n4. Checking students...');
        const students = await pool.query('SELECT COUNT(*) as count FROM students');
        console.log(`   Total students: ${students.rows[0].count}`);

        // 5. Check admin users
        console.log('\n5. Checking admin users...');
        const admins = await pool.query('SELECT id, email, name, role FROM admins');
        console.log(`   Found ${admins.rows.length} admin(s):`);
        admins.rows.forEach(admin => {
            console.log(`   - ${admin.name} (${admin.email}) - ${admin.role}`);
        });

        // 6. Sample enrollments
        console.log('\n6. Sample enrollments (latest 3):');
        const sampleEnrollments = await pool.query(
            `SELECT e.id, e.enrollment_id, e.status, e.enrollment_date, s.first_name, s.last_name 
             FROM enrollments e 
             LEFT JOIN students s ON e.student_id = s.id 
             ORDER BY e.enrollment_date DESC LIMIT 3`
        );
        if (sampleEnrollments.rows.length === 0) {
            console.log('   No enrollments found');
        } else {
            sampleEnrollments.rows.forEach(e => {
                console.log(`   - ${e.enrollment_id}: ${e.first_name} ${e.last_name} (${e.status}) on ${e.enrollment_date}`);
            });
        }

        console.log('\n=== END DIAGNOSTICS ===\n');
    } catch (err) {
        console.error('Diagnostic error:', err);
    } finally {
        await pool.end();
    }
}

runDiagnostics();


