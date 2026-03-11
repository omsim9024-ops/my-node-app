const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAPI() {
    try {
        const response = await fetch('http://localhost:3000/api/enrollments?status=Approved');
        const data = await response.json();
        
        console.log('Total enrollments:', data.length);
        if (data.length > 0) {
            console.log('\nFirst 3 enrollments:');
            data.slice(0, 3).forEach((e, idx) => {
                console.log(`\n${idx + 1}. ${e.first_name} ${e.last_name}`);
                console.log(`   Section ID: ${e.section_id}`);
                console.log(`   Section Name: ${e.section_name}`);
                console.log(`   Status: ${e.status}`);
            });
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
    process.exit(0);
}

testAPI();

