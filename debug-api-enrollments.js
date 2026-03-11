// Debug script to check what /api/enrollments is returning
async function debugEnrollments() {
    console.log('=== DEBUGGING /api/enrollments ===');
    
    try {
        // Try fetching without status filter first
        const allResp = await fetch('http://localhost:3001/api/enrollments');
        console.log('Response status:', allResp.status);
        
        if (!allResp.ok) {
            console.log('ERROR: Response not OK');
            return;
        }
        
        const allData = await allResp.json();
        console.log('Total enrollments:', Array.isArray(allData) ? allData.length : 'Not an array');
        
        if (Array.isArray(allData) && allData.length > 0) {
            console.log('\n=== FIRST ENROLLMENT OBJECT ===');
            const first = allData[0];
            console.log('Full object:', JSON.stringify(first, null, 2));
            
            console.log('\n=== ENROLLMENT KEYS ===');
            console.log(Object.keys(first));
            
            console.log('\n=== ENROLLMENT DATA ===');
            console.log('enrollment_data type:', typeof first.enrollment_data);
            console.log('enrollment_data value:', first.enrollment_data);
            
            if (first.enrollment_data) {
                let parsed = first.enrollment_data;
                if (typeof parsed === 'string') {
                    try {
                        parsed = JSON.parse(parsed);
                    } catch (e) {
                        console.log('Could not parse enrollment_data as JSON');
                    }
                }
                console.log('Parsed enrollment_data:', JSON.stringify(parsed, null, 2));
                
                // Check for electives fields
                console.log('\n=== LOOKING FOR ELECTIVES ===');
                if (typeof parsed === 'object' && parsed !== null) {
                    const keys = Object.keys(parsed);
                    const electiveKeys = keys.filter(k => 
                        k.toLowerCase().includes('elective') || 
                        k.toLowerCase().includes('subject')
                    );
                    console.log('Keys containing elective/subject:', electiveKeys);
                    electiveKeys.forEach(k => {
                        console.log(`${k}:`, parsed[k]);
                    });
                }
            }
            
            // Find enrollments with status Approved
            console.log('\n=== CHECKING STATUSES ===');
            const statuses = Array.from(new Set(allData.map(e => e.status)));
            console.log('Available statuses:', statuses);
            
            const approved = allData.filter(e => (e.status || '').toLowerCase() === 'approved');
            console.log('Approved enrollments:', approved.length);
            
            if (approved.length > 0) {
                console.log('FIRST APPROVED ENROLLMENT:');
                console.log(JSON.stringify(approved[0], null, 2));
            }
        } else {
            console.log('No enrollments returned or not an array');
        }
    } catch (err) {
        console.error('ERROR fetching enrollments:', err);
    }
}

// Run it
debugEnrollments();


