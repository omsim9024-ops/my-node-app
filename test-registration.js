const pool = require('./db');

async function testRegistration() {
    try {
        console.log('Testing registration endpoint...\n');
        
        const testEmail = 'testuser' + Date.now() + '@example.com';
        const testData = {
            firstName: 'John',
            lastName: 'Doe',
            email: testEmail,
            password: 'password123',
            gradeLevel: '10'
        };
        
        console.log('Test data:', testData);
        console.log('\nAttempting database insert...');
        
        // Simulate what the register endpoint does
        const existingStudent = await pool.query(
            'SELECT id FROM students WHERE email = $1',
            [testData.email]
        );
        
        console.log('Email check result:', existingStudent.rows.length === 0 ? 'Email available' : 'Email exists');
        
        if (existingStudent.rows.length > 0) {
            console.log('Email already registered!');
            await pool.end();
            return;
        }
        
        const generated_student_id = 'MNS-' + Date.now();
        
        const result = await pool.query(
            `INSERT INTO students 
             (student_id, first_name, last_name, email, password, grade_level, account_status, registration_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
             RETURNING id, student_id, first_name, last_name, email, grade_level`,
            [generated_student_id, testData.firstName, testData.lastName, testData.email, testData.password, testData.gradeLevel, 'active']
        );
        
        console.log('\n✅ Insert successful!');
        console.log('Created student:', result.rows[0]);
        
        await pool.end();
    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('Error code:', err.code);
        await pool.end();
    }
}

testRegistration();

