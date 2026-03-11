/**
 * SAMPLE DATA STRUCTURE FOR TESTING
 * 
 * This file demonstrates how to populate the student dashboard with data.
 * You can use this format when integrating with your backend API.
 * 
 * To use this data:
 * 1. Uncomment the code in the browser console while logged in
 * 2. Or call these functions from your backend API response
 */

// Sample Grades Data
const sampleGradesData = [
    {
        subject: "Mathematics",
        teacher: "Mr. Santos",
        q1: 85,
        q2: 88,
        midterm: "--",
        average: 86.5
    },
    {
        subject: "English",
        teacher: "Ms. Garcia",
        q1: 82,
        q2: 84,
        midterm: "--",
        average: 83
    },
    {
        subject: "Science",
        teacher: "Mr. Cruz",
        q1: 90,
        q2: 92,
        midterm: "--",
        average: 91
    },
    {
        subject: "Social Studies",
        teacher: "Ms. Reyes",
        q1: 87,
        q2: 89,
        midterm: "--",
        average: 88
    },
    {
        subject: "Physical Education",
        teacher: "Coach Rodriguez",
        q1: 95,
        q2: 93,
        midterm: "--",
        average: 94
    }
];

// Sample Schedule Data
const sampleScheduleData = {
    "Monday": [
        {
            time: "7:30 - 8:30",
            subject: "English",
            room: "Room 101",
            teacher: "Ms. Garcia"
        },
        {
            time: "8:30 - 9:30",
            subject: "Mathematics",
            room: "Room 203",
            teacher: "Mr. Santos"
        },
        {
            time: "10:00 - 11:00",
            subject: "Science",
            room: "Lab A",
            teacher: "Mr. Cruz"
        }
    ],
    "Tuesday": [
        {
            time: "7:30 - 8:30",
            subject: "Physical Education",
            room: "Gym",
            teacher: "Coach Rodriguez"
        },
        {
            time: "9:00 - 10:00",
            subject: "Social Studies",
            room: "Room 105",
            teacher: "Ms. Reyes"
        },
        {
            time: "10:30 - 11:30",
            subject: "Mathematics",
            room: "Room 203",
            teacher: "Mr. Santos"
        }
    ],
    "Wednesday": [
        {
            time: "7:30 - 8:30",
            subject: "Science",
            room: "Lab A",
            teacher: "Mr. Cruz"
        },
        {
            time: "8:30 - 9:30",
            subject: "English",
            room: "Room 101",
            teacher: "Ms. Garcia"
        },
        {
            time: "10:00 - 11:00",
            subject: "Social Studies",
            room: "Room 105",
            teacher: "Ms. Reyes"
        }
    ],
    "Thursday": [
        {
            time: "7:30 - 8:30",
            subject: "Mathematics",
            room: "Room 203",
            teacher: "Mr. Santos"
        },
        {
            time: "9:00 - 10:00",
            subject: "English",
            room: "Room 101",
            teacher: "Ms. Garcia"
        },
        {
            time: "10:30 - 11:30",
            subject: "Science",
            room: "Lab A",
            teacher: "Mr. Cruz"
        }
    ],
    "Friday": [
        {
            time: "7:30 - 8:30",
            subject: "Physical Education",
            room: "Gym",
            teacher: "Coach Rodriguez"
        },
        {
            time: "9:00 - 10:00",
            subject: "Social Studies",
            room: "Room 105",
            teacher: "Ms. Reyes"
        },
        {
            time: "10:30 - 11:30",
            subject: "Lab Work",
            room: "Lab A",
            teacher: "Mr. Cruz"
        }
    ]
};

/**
 * HOW TO USE THIS DATA:
 * 
 * Option 1: Save to localStorage (for testing)
 * localStorage.setItem('studentGrades', JSON.stringify(sampleGradesData));
 * localStorage.setItem('studentSchedule', JSON.stringify(sampleScheduleData));
 * Then refresh the student dashboard page
 * 
 * Option 2: Integrate with your backend API
 * When a student logs in, fetch this data from your server and save it:
 * fetch('/api/students/grades')
 *     .then(response => response.json())
 *     .then(data => {
 *         localStorage.setItem('studentGrades', JSON.stringify(data));
 *         location.reload();
 *     });
 * 
 * Option 3: Pass data directly to rendering functions
 * renderGradesTable(sampleGradesData);
 * renderSchedule(sampleScheduleData);
 */

// Function to populate dashboard with sample data
function populateWithSampleData() {
    localStorage.setItem('studentGrades', JSON.stringify(sampleGradesData));
    localStorage.setItem('studentSchedule', JSON.stringify(sampleScheduleData));
    console.log('✅ Sample data loaded! Refresh the page to see the changes.');
}

// Usage: Call this function in browser console while logged in to the student dashboard
// populateWithSampleData();

