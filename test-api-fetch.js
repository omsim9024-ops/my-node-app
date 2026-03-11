#!/usr/bin/env node
/**
 * Test script to verify students are being returned by the API
 */

fetch('http://192.168.110.12:3002/api/students')
    .then(res => res.json())
    .then(students => {
        console.log(`Total students: ${students.length}\n`);
        if (students.length > 0) {
            console.log('First student:', JSON.stringify(students[0], null, 2));
            console.log('\nAll students (summary):');
            students.forEach((s, i) => {
                console.log(`${i+1}. ID: ${s.id}, Name: "${s.name}", FirstName: "${s.first_name}", LastName: "${s.last_name}", Grade: ${s.grade}, Level: ${s.level}, Gender: ${s.gender}, Track: ${s.track}, Status: ${s.enrollment_status}`);
            });
        } else {
            console.log('NO STUDENTS FOUND!');
        }
    })
    .catch(err => {
        console.error('Error fetching students:', err.message);
    });

