// ================= NAVIGATION + HAMBURGER =================
document.addEventListener("DOMContentLoaded", () => {

    const navToggle = document.getElementById("nav-toggle") || document.querySelector(".nav-toggle");
    const navMenu = document.getElementById("nav-menu");
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".section");

    // Always start hidden
    if (navMenu) navMenu.classList.add("hidden");

    // Hamburger toggle (desktop + mobile) with ARIA and Escape handling
    if (navToggle && navMenu) {
        // Accessibility hooks
        navToggle.setAttribute('aria-controls', 'nav-menu');
        navToggle.setAttribute('aria-expanded', 'false');

        navToggle.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = navMenu.classList.toggle('open');
            // ensure hidden reflects open state
            navMenu.classList.toggle('hidden', !isOpen);
            navToggle.setAttribute('aria-expanded', String(isOpen));
        });

        // Close when clicking outside
        document.addEventListener("click", (e) => {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove('open');
                navMenu.classList.add('hidden');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });

        // Close with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                navMenu.classList.remove('open');
                navMenu.classList.add('hidden');
                navToggle.setAttribute('aria-expanded', 'false');
                navToggle.focus();
            }
        });
    }

    // Nav link switching
    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();

            navLinks.forEach(l => l.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            link.classList.add("active");

            const sectionId = link.dataset.section;
            const target = document.getElementById(sectionId);
            if (target) {
                target.classList.add("active");
                // Smooth scroll to section and focus for accessibility
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // After scrolling, set focus without scrolling further
                setTimeout(() => {
                    target.setAttribute('tabindex', '-1');
                    try { target.focus({ preventScroll: true }); } catch (err) { target.focus(); }
                }, 450);

                // Update URL hash without instant jump
                try {
                    history.replaceState(null, '', `#${sectionId}`);
                } catch (err) {
                    // ignore if not supported
                }
            }

            // Close menu after click (mobile) and update ARIA
            if (navMenu) {
                navMenu.classList.remove('open');
                navMenu.classList.add("hidden");
                if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // Default Home active
    const home = document.getElementById("home");
    const homeLink = document.querySelector('[data-section="home"]');

    if (home && homeLink) {
        home.classList.add("active");
        homeLink.classList.add("active");
    }

});

    // Handle admin login form
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;

            // Simple authentication check (in production, use proper backend authentication)
            if (username === 'admin' && password === 'admin123') {
                alert('Login successful! Redirecting to admin panel...');
                // You can redirect to the admin management dashboard
                // For now, we'll just reset the form
                adminLoginForm.reset();
            } else {
                alert('Invalid username or password.');
                adminLoginForm.reset();
            }
        });
    }

    // Set home as active section by default
    const homeSection = document.getElementById('home');
    const homeLink = document.querySelector('[data-section="home"]');
    if (homeSection && homeLink) {
        homeSection.classList.add('active');
        homeLink.classList.add('active');
    }

    // Ensure main can be focused when Skip link used
    const main = document.getElementById('main');
    const skip = document.querySelector('.skip-link');
    if (skip && main) {
        skip.addEventListener('click', () => {
            setTimeout(() => main.focus(), 10);
        });
    }




function updateActivityLog() {
    const activityLog = document.getElementById('activityLog');
    if (appData.activityLog.length === 0) {
        activityLog.innerHTML = '<p class="empty-message">No recent activity</p>';
    } else {
        activityLog.innerHTML = appData.activityLog
            .map(activity => `<p>${activity}</p>`)
            .join('');
    }
}

function updateDashboard() {
    document.getElementById('totalStudents').textContent = appData.students.length;
    document.getElementById('totalClasses').textContent = appData.classes.length;
    document.getElementById('totalTeachers').textContent = appData.teachers.length;

    // Calculate average grade
    if (appData.grades.length > 0) {
        const avgGrade = (appData.grades.reduce((sum, grade) => sum + grade.value, 0) / appData.grades.length).toFixed(2);
        document.getElementById('averageGrade').textContent = avgGrade;
    } else {
        document.getElementById('averageGrade').textContent = '--';
    }
}

// Section Navigation
const navButtons = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.section');

navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sectionId = button.getAttribute('data-section');
        
        // Remove active class from all buttons and sections
        navButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(sec => sec.classList.remove('active'));

        // Add active class to clicked button and corresponding section
        button.classList.add('active');
        document.getElementById(sectionId).classList.add('active');
    });
});

// ============ STUDENT MANAGEMENT ============
const studentForm = document.getElementById('studentForm');
const studentsList = document.getElementById('studentsList');
const studentSearch = document.getElementById('studentSearch');

studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const student = {
        student_id: document.getElementById('studentId').value,
        name: document.getElementById('studentName').value,
        grade_level: document.getElementById('studentGrade').value,
        email: document.getElementById('studentEmail').value,
        phone: document.getElementById('studentPhone').value || null
    };

    try {
        await apiCall('/students', 'POST', student);
        addActivity(`Added student: ${student.name}`);
        await loadStudents();
        await updateGradeStudentDropdown();
        updateDashboard();
        studentForm.reset();
    } catch (error) {
        alert('Error adding student: ' + error.message);
    }
});

async function loadStudents() {
    try {
        appData.students = await apiCall('/students');
        updateStudentsList();
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

function updateStudentsList(filter = '') {
    const filtered = appData.students.filter(student =>
        student.name.toLowerCase().includes(filter.toLowerCase()) ||
        student.student_id.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        studentsList.innerHTML = '<p class="empty-message">No students found</p>';
        return;
    }

    studentsList.innerHTML = filtered.map(student => `
        <div class="data-item">
            <div class="data-item-info">
                <div class="data-item-title">${student.name}</div>
                <div class="data-item-detail"><strong>ID:</strong> ${student.student_id}</div>
                <div class="data-item-detail"><strong>Grade:</strong> ${student.grade_level}</div>
                <div class="data-item-detail"><strong>Email:</strong> ${student.email}</div>
                <div class="data-item-detail"><strong>Phone:</strong> ${student.phone || 'N/A'}</div>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-danger" onclick="deleteStudent(${student.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteStudent(studentId) {
    if (confirm('Are you sure you want to delete this student?')) {
        try {
            const student = appData.students.find(s => s.id === studentId);
            await apiCall(`/students/${studentId}`, 'DELETE');
            addActivity(`Deleted student: ${student.name}`);
            await loadStudents();
            await updateGradeStudentDropdown();
            updateDashboard();
        } catch (error) {
            alert('Error deleting student: ' + error.message);
        }
    }
}

studentSearch.addEventListener('input', (e) => {
    updateStudentsList(e.target.value);
});

async function updateGradeStudentDropdown() {
    try {
        const students = await apiCall('/students');
        const gradeStudent = document.getElementById('gradeStudent');
        gradeStudent.innerHTML = '<option value="">Select Student</option>' +
            students.map(student => 
                `<option value="${student.id}">${student.name} (${student.student_id})</option>`
            ).join('');
    } catch (error) {
        console.error('Error loading students for grade dropdown:', error);
    }
}

// ============ CLASS MANAGEMENT ============
const classForm = document.getElementById('classForm');
const classesList = document.getElementById('classesList');

classForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newClass = {
        class_name: document.getElementById('className').value,
        grade_level: document.getElementById('classGrade').value,
        teacher_id: document.getElementById('classTeacher').value || null,
        capacity: parseInt(document.getElementById('classCapacity').value)
    };

    try {
        const createdClass = await apiCall('/classes', 'POST', newClass);
        addActivity(`Added class: ${newClass.class_name}`);
        await loadClasses();
        updateDashboard();
        classForm.reset();
    } catch (error) {
        alert('Error adding class: ' + error.message);
    }
});

async function loadClasses() {
    try {
        appData.classes = await apiCall('/classes');
        updateClassesList();
    } catch (error) {
        console.error('Error loading classes:', error);
    }
}

function updateClassesList() {
    if (appData.classes.length === 0) {
        classesList.innerHTML = '<p class="empty-message">No classes added yet</p>';
        return;
    }

    classesList.innerHTML = appData.classes.map(cls => `
        <div class="data-item">
            <div class="data-item-info">
                <div class="data-item-title">${cls.class_name}</div>
                <div class="data-item-detail"><strong>Grade:</strong> ${cls.grade_level}</div>
                <div class="data-item-detail"><strong>Teacher:</strong> ${cls.teacher_name || 'Not assigned'}</div>
                <div class="data-item-detail"><strong>Capacity:</strong> ${cls.enrollment || 0}/${cls.capacity} students</div>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-danger" onclick="deleteClass(${cls.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteClass(classId) {
    if (confirm('Are you sure you want to delete this class?')) {
        try {
            const cls = appData.classes.find(c => c.id === classId);
            await apiCall(`/classes/${classId}`, 'DELETE');
            addActivity(`Deleted class: ${cls.class_name}`);
            await loadClasses();
            updateDashboard();
        } catch (error) {
            alert('Error deleting class: ' + error.message);
        }
    }
}

async function updateClassTeacherDropdown() {
    try {
        const teachers = await apiCall('/teachers');
        const classTeacher = document.getElementById('classTeacher');
        classTeacher.innerHTML = '<option value="">Select Teacher</option>' +
            teachers.map(teacher => 
                `<option value="${teacher.id}">${teacher.name}</option>`
            ).join('');
    } catch (error) {
        console.error('Error loading teachers for class dropdown:', error);
    }
}

// ============ GRADE MANAGEMENT ============
const gradeForm = document.getElementById('gradeForm');
const gradesList = document.getElementById('gradesList');
const gradesSearch = document.getElementById('gradesSearch');

gradeForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const grade = {
        student_id: parseInt(document.getElementById('gradeStudent').value),
        subject: document.getElementById('gradeCourse').value,
        grade_value: parseInt(document.getElementById('gradeValue').value),
        quarter: document.getElementById('gradePeriod').value
    };

    try {
        await apiCall('/grades', 'POST', grade);
        const student = appData.students.find(s => s.id === grade.student_id);
        addActivity(`Recorded grade for ${student.name}: ${grade.subject} - ${grade.grade_value}`);
        await loadGrades();
        updateDashboard();
        gradeForm.reset();
    } catch (error) {
        alert('Error recording grade: ' + error.message);
    }
});

async function loadGrades() {
    try {
        appData.grades = await apiCall('/grades');
        updateGradesList();
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

function updateGradesList(filter = '') {
    const filtered = appData.grades.filter(grade =>
        grade.student_name.toLowerCase().includes(filter.toLowerCase()) ||
        grade.subject.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        gradesList.innerHTML = '<p class="empty-message">No grades recorded yet</p>';
        return;
    }

    gradesList.innerHTML = filtered.map(grade => `
        <div class="data-item">
            <div class="data-item-info">
                <div class="data-item-title">${grade.student_name}</div>
                <div class="data-item-detail"><strong>Subject:</strong> ${grade.subject}</div>
                <div class="data-item-detail"><strong>Grade:</strong> ${grade.grade_value}/100</div>
                <div class="data-item-detail"><strong>Period:</strong> ${grade.quarter} | <strong>Date:</strong> ${new Date(grade.recorded_date).toLocaleDateString()}</div>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-danger" onclick="deleteGrade(${grade.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteGrade(gradeId) {
    if (confirm('Are you sure you want to delete this grade?')) {
        try {
            const grade = appData.grades.find(g => g.id === gradeId);
            await apiCall(`/grades/${gradeId}`, 'DELETE');
            addActivity(`Deleted grade record for ${grade.student_name}`);
            await loadGrades();
            updateDashboard();
        } catch (error) {
            alert('Error deleting grade: ' + error.message);
        }
    }
}

gradesSearch.addEventListener('input', (e) => {
    updateGradesList(e.target.value);
});

// ============ TEACHER MANAGEMENT ============
const teacherForm = document.getElementById('teacherForm');
const teachersList = document.getElementById('teachersList');
const teacherSearch = document.getElementById('teacherSearch');

teacherForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const teacher = {
        teacher_id: document.getElementById('teacherId').value,
        name: document.getElementById('teacherName').value,
        department: document.getElementById('teacherDept').value,
        email: document.getElementById('teacherEmail').value,
        phone: document.getElementById('teacherPhone').value || null
    };

    try {
        await apiCall('/teachers', 'POST', teacher);
        addActivity(`Added teacher: ${teacher.name}`);
        await loadTeachers();
        await updateClassTeacherDropdown();
        updateDashboard();
        teacherForm.reset();
    } catch (error) {
        alert('Error adding teacher: ' + error.message);
    }
});

async function loadTeachers() {
    try {
        appData.teachers = await apiCall('/teachers');
        updateTeachersList();
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

function updateTeachersList(filter = '') {
    const filtered = appData.teachers.filter(teacher =>
        teacher.name.toLowerCase().includes(filter.toLowerCase()) ||
        teacher.teacher_id.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        teachersList.innerHTML = '<p class="empty-message">No teachers found</p>';
        return;
    }

    teachersList.innerHTML = filtered.map(teacher => `
        <div class="data-item">
            <div class="data-item-info">
                <div class="data-item-title">${teacher.name}</div>
                <div class="data-item-detail"><strong>ID:</strong> ${teacher.teacher_id}</div>
                <div class="data-item-detail"><strong>Department:</strong> ${teacher.department}</div>
                <div class="data-item-detail"><strong>Email:</strong> ${teacher.email}</div>
                <div class="data-item-detail"><strong>Phone:</strong> ${teacher.phone || 'N/A'}</div>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-danger" onclick="deleteTeacher(${teacher.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteTeacher(teacherId) {
    if (confirm('Are you sure you want to delete this teacher?')) {
        try {
            const teacher = appData.teachers.find(t => t.id === teacherId);
            await apiCall(`/teachers/${teacherId}`, 'DELETE');
            addActivity(`Deleted teacher: ${teacher.name}`);
            await loadTeachers();
            await updateClassTeacherDropdown();
            await loadClasses();
            updateDashboard();
        } catch (error) {
            alert('Error deleting teacher: ' + error.message);
        }
    }
}

teacherSearch.addEventListener('input', (e) => {
    updateTeachersList(e.target.value);
});

// // ============ INITIALIZATION ============
// document.addEventListener('DOMContentLoaded', async () => {
//     try {
//         // Load all data from API
//         await loadTeachers();
//         await loadStudents();
//         await loadClasses();
//         await loadGrades();
        
//         updateDashboard();
//         updateActivityLog();
        
//         addActivity('School Management System initialized');
//     } catch (error) {
//         console.error('Error during initialization:', error);
//         addActivity('Error initializing system: ' + error.message);
//     }
// });

const reveals = document.querySelectorAll(".about-card, .info-card");

window.addEventListener("scroll", () => {
    reveals.forEach(el => {
        const top = el.getBoundingClientRect().top;
        if (top < window.innerHeight - 100) {
            el.classList.add("active");
        }
    });
});
