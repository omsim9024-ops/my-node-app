/**
 * Browser console debugging script
 * Run this in the browser console (F12) to debug the sections loading
 */

// Test 1: Check if the select element exists
console.log('=== Test 1: Check Select Element ===');
const select = document.getElementById('assignSection');
console.log('Select element found:', !!select);
if (select) {
    console.log('Current options:', select.options.length);
    console.log('Select HTML:', select.outerHTML.substring(0, 200));
}

// Test 2: Check activeSchoolYearId
console.log('\n=== Test 2: Check Global Variables ===');
console.log('activeSchoolYearId:', typeof activeSchoolYearId !== 'undefined' ? activeSchoolYearId : 'NOT DEFINED');
console.log('activeSchoolYearLabel:', typeof activeSchoolYearLabel !== 'undefined' ? activeSchoolYearLabel : 'NOT DEFINED');

// Test 3: Try fetching sections directly
console.log('\n=== Test 3: Fetch Sections Directly ===');
async function testFetchSections() {
    try {
        console.log('Fetching /api/sections...');
        const response =  await fetch('/api/sections');
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        const data = await response.json();
        console.log('Data type:', typeof data);
        console.log('Is array:', Array.isArray(data));
        console.log('Data length:', Array.isArray(data) ? data.length : 'N/A');
        
        if (Array.isArray(data) && data.length > 0) {
            console.log('First item:', data[0]);
        }
        
        // Try populating the select
        if (select && Array.isArray(data)) {
            console.log('\nAttempting to populate select...');
            select.innerHTML = '<option value="">-- Test --</option>';
            data.slice(0, 3).forEach((section, idx) => {
                const opt = document.createElement('option');
                opt.value = section.id;
                opt.textContent = `${section.section_code} - ${section.section_name}`;
                select.appendChild(opt);
                console.log(`Added option ${idx + 1}: ${opt.textContent}`);
            });
            console.log('Total options now:', select.options.length);
        }
        
    } catch (err) {
        console.error('Error:', err);
    }
}

testFetchSections();

// Test 4: Check if loadSectionsForAssignment is defined
console.log('\n=== Test 4: Check Function Definition ===');
console.log('loadSectionsForAssignment defined:', typeof loadSectionsForAssignment);
console.log('loadActiveSchoolYear defined:', typeof loadActiveSchoolYear);
console.log('apiFetch defined:', typeof apiFetch);

// Test 5: Log all console messages
console.log('\n=== Test 5: Ready to Check Logs ===');
console.log('The browser console now contains detailed logs.');
console.log('Look for logs starting with [loadSectionsForAssignment] or [loadActiveSchoolYear]');
console.log('to see the exact flow and identify where the issue is.');


