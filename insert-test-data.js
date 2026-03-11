const pool = require('./db');

async function insertTestEnrollments() {
    try {
        // Test enrollment data (matches the form structure)
        const testEnrollments = [
            {
                student_name: 'John Michael Santos',
                email: 'john.santos@example.com',
                grade: '11',
                track: 'ACADEMIC',
                gender: 'Male',
                status: 'Approved'
            },
            {
                student_name: 'Maria Grace Cruz',
                email: 'maria.cruz@example.com',
                grade: '11',
                track: 'TECHPRO',
                gender: 'Female',
                status: 'Approved'
            },
            {
                student_name: 'Juan Alberto Reyes',
                email: 'juan.reyes@example.com',
                grade: '10',
                track: 'ACADEMIC',
                gender: 'Male',
                status: 'Approved'
            },
            {
                student_name: 'Rosa Maria Torres',
                email: 'rosa.torres@example.com',
                grade: '10',
                track: 'DOORWAY',
                gender: 'Female',
                status: 'Approved'
            },
            {
                student_name: 'Carlos Vincent Mendoza',
                email: 'carlos.mendoza@example.com',
                grade: '12',
                track: 'ACADEMIC',
                gender: 'Male',
                status: 'Approved'
            },
            {
                student_name: 'Patricia Anne Lopez',
                email: 'patricia.lopez@example.com',
                grade: '9',
                track: 'ACADEMIC',
                gender: 'Female',
                status: 'Approved'
            }
        ];

        for (const testData of testEnrollments) {
            const nameParts = testData.student_name.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');
            const studentId = 'STU' + Math.random().toString().slice(2, 10);

            // First, insert or update the student (MySQL compatible)
            const studentQuery = `
                INSERT INTO students (student_id, first_name, last_name, email, grade_level, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE email = VALUES(email), updated_at = CURRENT_TIMESTAMP
            `;

            const [studentResult] = await pool.query(studentQuery, [
                studentId,
                firstName,
                lastName,
                testData.email,
                testData.grade
            ]);

            // If insert created a new row, insertId will be present; otherwise find the id
            let newStudentId = studentResult.insertId;
            if (!newStudentId) {
                const [rows] = await pool.query('SELECT id FROM students WHERE student_id = ?', [studentId]);
                if (rows && rows.length) newStudentId = rows[0].id;
            }

            // Now insert the enrollment with the valid student_id
            const enrollmentData = {
                firstName: firstName,
                lastName: lastName,
                email: testData.email,
                gradeLevel: testData.grade,
                track: testData.track,
                sex: testData.gender,
                birthdate: '2010-05-15',
                phone: '09123456789',
                motherTongue: 'Tagalog',
                lrn: 'LRN' + Math.random().toString().slice(2, 14),
                placeOfBirth: 'Metro Manila',
                currentSitio: 'Sitio 1',
                currentBarangay: 'San Miguel',
                currentMunicipality: 'Pasig',
                currentProvince: 'Metro Manila',
                currentZipCode: '1600',
                permanentSitio: 'Sitio 1',
                permanentBarangay: 'San Miguel',
                permanentMunicipality: 'Pasig',
                permanentProvince: 'Metro Manila',
                permanentZipCode: '1600',
                isIP: 'no',
                is4Ps: 'no',
                hasPWD: 'no',
                returningLearner: 'no',
                semester: 'FIRST',
                learningModality: 'MODULAR-PRINT'
            };

            const enrollmentId = 'ENR' + Date.now() + Math.random().toString().slice(2, 8);
            
            const enrollmentQuery = `
                INSERT IGNORE INTO enrollments (enrollment_id, student_id, enrollment_data, status, enrollment_date, created_at, updated_at)
                VALUES (?, ?, ?, ?, NOW(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;

            await pool.query(enrollmentQuery, [
                enrollmentId,
                newStudentId,
                JSON.stringify(enrollmentData),
                testData.status
            ]);

            console.log(`✓ Inserted enrollment for ${testData.student_name} (${testData.status})`);
        }

        console.log('\n✓ Test data inserted successfully!');
        console.log('Now refresh your browser and click "Load Reports (server)" button.');
        process.exit(0);
    } catch (error) {
        console.error('Error inserting test data:', error);
        process.exit(1);
    }
}

insertTestEnrollments();

