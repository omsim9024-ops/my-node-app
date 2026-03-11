# Student Dashboard - Dynamic Data Implementation

## Overview
The Student Dashboard has been updated to remove all hardcoded data. Now it dynamically loads data from storage or API endpoints, showing "no data available" messages when information isn't present.

## Changes Made

### 1. **Grades Section** 
**Before:** Hardcoded table with 5 subjects and sample grades  
**After:** Dynamic container that:
- Displays a "Grades data is not yet available" message by default
- Can render grades from `studentGrades` localStorage data
- Shows grading scale only when data is available

### 2. **Schedule Section**
**Before:** Hardcoded 5-day schedule with specific times and classes  
**After:** Dynamic container that:
- Displays a "Schedule data is not yet available" message by default
- Can render a full weekly schedule from `studentSchedule` localStorage data
- Handles days with no classes gracefully

### 3. **Dashboard Stats**
**Before:** Hardcoded GPA (3.2), Subjects (6), Classes (4), Attendance (94%)  
**After:** Shows "--" for all stats by default
- Ready to be populated with real data from API
- Will update dynamically when data is loaded

### 4. **HTML Changes**
- Replaced hardcoded `<table>` with container `<div id="gradesTableContainer">`
- Replaced hardcoded schedule grid with container `<div id="scheduleGridContainer">`
- Added proper structure for dynamic rendering

### 5. **JavaScript Enhancements**
New functions added to `student-dashboard.js`:

```javascript
// Load dynamic data
loadDynamicData()

// Load and render grades
loadGrades()
renderGradesTable(gradesData)

// Load and render schedule
loadSchedule()
renderSchedule(scheduleData)
```

### 6. **CSS Styling**
Added `.no-data` class for styling empty states:
- Centered text
- Dashed border
- Light gray background
- Clear messaging

## Data Format

### Grades Data Structure
```json
[
    {
        "subject": "Mathematics",
        "teacher": "Mr. Santos",
        "q1": 85,
        "q2": 88,
        "midterm": "--",
        "average": 86.5
    }
]
```

### Schedule Data Structure
```json
{
    "Monday": [
        {
            "time": "7:30 - 8:30",
            "subject": "English",
            "room": "Room 101",
            "teacher": "Ms. Garcia"
        }
    ]
}
```

## How to Populate Data

### Option 1: Using localStorage (for Testing)
```javascript
// Load sample data
localStorage.setItem('studentGrades', JSON.stringify(gradesArray));
localStorage.setItem('studentSchedule', JSON.stringify(scheduleObject));

// Refresh the page
location.reload();
```

### Option 2: From Backend API
```javascript
// When student logs in, fetch their data
async function loadStudentData() {
    const studentId = studentData.studentID;
    
    // Fetch grades
    const gradesResponse = await fetch(`/api/students/${studentId}/grades`);
    const grades = await gradesResponse.json();
    localStorage.setItem('studentGrades', JSON.stringify(grades));
    
    // Fetch schedule
    const scheduleResponse = await fetch(`/api/students/${studentId}/schedule`);
    const schedule = await scheduleResponse.json();
    localStorage.setItem('studentSchedule', JSON.stringify(schedule));
    
    // Reload dashboard
    location.reload();
}
```

### Option 3: Render Directly
```javascript
// Call the render functions directly with data
renderGradesTable(gradesData);
renderSchedule(scheduleData);
```

## Sample Data File
A `sample-data.js` file has been created with complete example data. Use it for testing:

```javascript
// In browser console while logged into dashboard
populateWithSampleData();
```

## Integration with Backend

When you're ready to integrate with your Node.js/PostgreSQL backend:

1. Create API endpoints:
   - `GET /api/students/:studentId/grades`
   - `GET /api/students/:studentId/schedule`
   - `GET /api/students/:studentId/stats`

2. Update login to fetch data:
   ```javascript
   // In student-login.js after successful login
   const studentData = { ... };
   
   // Fetch and store student data
   const response = await fetch(`/api/students/${studentId}/profile`);
   const fullData = await response.json();
   localStorage.setItem('studentData', JSON.stringify(fullData));
   ```

3. Update dashboard to refresh data:
   ```javascript
   // In student-dashboard.js
   async function refreshStudentData() {
       const studentId = JSON.parse(localStorage.getItem('studentData')).studentID;
       
       const gradesRes = await fetch(`/api/students/${studentId}/grades`);
       const grades = await gradesRes.json();
       renderGradesTable(grades);
       
       const scheduleRes = await fetch(`/api/students/${studentId}/schedule`);
       const schedule = await scheduleRes.json();
       renderSchedule(schedule);
   }
   ```

## Current State

✅ **No hardcoded data** - All sections use dynamic rendering  
✅ **Graceful empty states** - Shows helpful messages when data isn't available  
✅ **Ready for integration** - Backend API calls can be added easily  
✅ **Flexible data loading** - Supports localStorage or API sources  
✅ **Sample data provided** - Testing file available for development  

## Testing

To test the dynamic features:

1. Login to student dashboard
2. Notice all stats show "--" and data sections show "not available" messages
3. Use `sample-data.js` to populate with test data:
   ```javascript
   // Open browser console and run:
   populateWithSampleData();
   ```
4. Refresh the page - all data will now display

## Next Steps

1. Create backend API endpoints for student grades and schedule
2. Update student login to fetch and cache data
3. Update student dashboard to fetch fresh data on page load
4. Add data refresh functionality (auto-refresh, manual refresh button)
5. Add error handling for failed API calls


