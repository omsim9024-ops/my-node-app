const http = require('http');

function testApiWithAuth(path, teacherData) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': teacherData.cookie || ''
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log(`\n=== ${path} ===`);
                console.log('Status:', res.statusCode);
                console.log('Headers:', res.headers);
                console.log('Response:', data.substring(0, 500) + (data.length > 500 ? '...' : ''));
                resolve({ statusCode: res.statusCode, data: data, headers: res.headers });
            });
        });

        req.on('error', (err) => {
            console.error('Error:', err.message);
            reject(err);
        });

        req.end();
    });
}

async function loginTeacher(email, password) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ email, password });
        
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/teacher-auth/login?school=default-school',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                const cookies = res.headers['set-cookie'] || [];
                const cookie = cookies.find(c => c.startsWith('teacher_session=')) || '';
                console.log('\n=== LOGIN ===');
                console.log('Status:', res.statusCode);
                console.log('Response:', data);
                console.log('Cookie:', cookie.substring(0, 50) + '...');
                resolve({ cookie, data, statusCode: res.statusCode });
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function runTests() {
    try {
        // First login with the teacher we found
        const teacher = await loginTeacher('icil@gmail.com', '12345678');
        
        if (teacher.statusCode === 200) {
            console.log('\n✅ Login successful, testing authenticated endpoints...');
            
            await testApiWithAuth('/api/teacher-auth/subject-assignments/12?school=default-school', teacher);
            await testApiWithAuth('/api/adviser-auth/teaching-assignments/12?school=default-school', teacher);
            await testApiWithAuth('/api/enrollments?school=default-school', teacher);
        } else {
            console.log('\n❌ Login failed, testing unauthenticated endpoints...');
            await testApiWithAuth('/api/school-years/active?school=default-school', {});
            await testApiWithAuth('/api/teachers?school=default-school', {});
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
}

runTests();

