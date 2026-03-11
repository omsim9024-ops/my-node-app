// Master Teacher Dashboard API Base
// Dynamically use the current origin (hostname:port) where the page is served
if (typeof BACKEND_ORIGIN === 'undefined') {
    var BACKEND_ORIGIN = window.location.origin;
}
// If your backend is running on a different host/port, set FORCED_API_BASE
// to that full origin (e.g. 'http://192.168.110.12:3000').
// Set to empty string ('') to disable forcing and use automatic discovery.
const FORCED_API_BASE = (typeof window !== 'undefined' && window.__FORCED_API_BASE__) ? window.__FORCED_API_BASE__ : '';
if (typeof API_BASE === 'undefined') {
    var API_BASE = (typeof FORCED_API_BASE !== 'undefined' && FORCED_API_BASE !== null && FORCED_API_BASE !== '') ? FORCED_API_BASE : BACKEND_ORIGIN;
} else {
    // Update existing API_BASE if FORCED_API_BASE is set
    if (typeof FORCED_API_BASE !== 'undefined' && FORCED_API_BASE !== null && FORCED_API_BASE !== '') {
        API_BASE = FORCED_API_BASE;
    }
}

// API Fetch wrapper (note: this is defined later in the file, so we'll reference it when needed)
async function apiFetch(path, options = {}) {
    const url = API_BASE ? `${API_BASE}${path}` : path;
    return fetch(url, options);
}

// SHS Subject Definitions - Core, Academic Electives, and TechPro Electives
window.SHS_CORE_SUBJECTS = [
    'Effective Communication / Mabisang Komunikasyon',
    'Life Skills',
    'Pag-aaral ng Kasaysayan at Lipunang Pilipino',
    'General Mathematics',
    'General Science'
];

window.SHS_ACADEMIC_ELECTIVES = {
    'Arts, Social Sciences, & Humanities': [
        'Citizenship and Civic Engagement',
        'Creative Industries (Visual, Media, Applied, and Traditional Art)',
        'Creative Industries (Music, Dance, Theater)',
        'Creative Writing',
        'Cultivating Filipino Identity Through the Arts',
        'Filipino sa Isports',
        'Filipino sa Sining at Disenyo',
        'Filipino sa Teknikal-Propesyonal',
        'Introduction to the Philosophy of the Human Person',
        'Leadership and Management in the Arts',
        'Malikhaing Pagsulat',
        'Philippine Politics and Governance',
        'The Social Sciences in Theory and Practice',
        'Wika at Komunikasyon sa Akademikong Filipino'
    ],
    'Business & Entrepreneurship': [
        'Basic Accounting',
        'Business Finance and Income Taxation',
        'Contemporary Marketing and Business Economics',
        'Entrepreneurship',
        'Introduction to Organization and Management'
    ],
    'Sports, Health, & Wellness': [
        'Exercise and Sports Programming',
        'Introduction to Human Movement',
        'Physical Education (Fitness and Recreation)',
        'Physical Education (Sports and Dance)',
        'Safety and First Aid',
        'Sports Coaching',
        'Sports Officiating',
        'Sports Activity Management'
    ],
    'Science, Technology, Engineering, & Mathematics': [
        'Advanced Mathematics 1-2',
        'Biology 1-2',
        'Biology 3-4',
        'Chemistry 1-2',
        'Chemistry 3-4',
        'Database Management',
        'Earth and Space Science 1-2',
        'Earth and Space Science 3-4',
        'Empowerment Technologies',
        'Finite Mathematics',
        'Fundamentals of Data Analytics and Management',
        'General Science (Physical Science)',
        'General Science (Earth and Life Science)',
        'Pre-Calculus 1-2',
        'Physics 1-2',
        'Physics 3-4',
        'Trigonometry 1-2'
    ],
    'Field Experience': [
        'Arts Apprenticeship - Theater Arts',
        'Arts Apprenticeship - Dance',
        'Arts Apprenticeship - Music',
        'Arts Apprenticeship - Literary Arts',
        'Arts Apprenticeship - Visual, Media, Applied, and Traditional Art',
        'Creative Production and Presentation',
        'Design and Innovation Research Methods',
        'Field Exposure (In-Campus)',
        'Field Exposure (Off-Campus)',
        'Work Immersion'
    ]
};

window.SHS_TECHPRO_ELECTIVES = {
    'Information & Computer Technology': [
        'Animation (NC II)',
        'Broadband Installation (Fixed Wireless Systems) (NC II)',
        'Computer Programming (Java) (NC III)',
        'Computer Programming (Oracle Database) (NC III)',
        'Computer Systems Servicing (NC II)',
        'Contact Center Services (NC II)',
        'Illustration (NC II)',
        'Programming (.NET Technology) (NC III)',
        'Visual Graphic Design (NC III)'
    ],
    'Industrial Arts': [
        'Automotive Servicing (Engine and Chassis) (NC II)',
        'Automotive Servicing (Electrical) (NC II)',
        'Carpentry (NC I and NC II)',
        'Construction Operations (Masonry NC I and Tiles Plumbing NC II)',
        'Commercial Air-Conditioning Installation and Servicing (NC III)',
        'Domestic Refrigeration and Air-Conditioning Servicing (NC II)',
        'Driving and Automotive Servicing (Driving NC II and Automotive Servicing NC I)',
        'Electrical Installation Maintenance (NC II)',
        'Electronics Product and Assembly Servicing (NC II)',
        'Manual Metal Arc Welding (NC II)',
        'Mechatronics (NC II)',
        'Motorcycle and Small Engine Servicing (NC II)',
        'Photovoltaic System Installation (NC II)',
        'Technical Drafting (NC II)'
    ],
    'Agriculture & Fishery Arts': [
        'Agricultural Crops Production (NC II)',
        'Agro-Entrepreneurship (NC II)',
        'Aquaculture (NC II)',
        'Fish Capture Operation (NC II)',
        'Food Processing (NC II)',
        'Organic Agriculture Production (NC II)',
        'Poultry Production - Chicken (NC II)',
        'Ruminants Production (NC II)',
        'Swine Production (NC II)'
    ],
    'Family & Consumer Science': [
        'Aesthetic Services (Beauty Care) (NC II)',
        'Bakery Operations (NC II)',
        'Caregiving (Adult Care) (NC II)',
        'Caregiving (Child Care) (NC II)',
        'Events Management Services (NC III)',
        'Food and Beverages Operations (NC II)',
        'Garments Artisanry (NC II)',
        'Hairdressing Services (NC II)',
        'Handicraft (Weaving) (NC II)',
        'Hotel Operations (Front Office Services) (NC II)',
        'Hotel Operations (Housekeeping Services) (NC II)',
        'Kitchen Operations (NC II)',
        'Tourism Services (NC II)'
    ],
    'Maritime': [
        'Marine Engineering at the Support Level (Non-NC)',
        'Marine Transportation at the Support Level (Non-NC)',
        'Ships Catering Services (NC I)'
    ]
};

// Global variables
if (typeof allTeachers === 'undefined') window.allTeachers = [];
if (typeof filteredTeachers === 'undefined') window.filteredTeachers = [];

// Placeholder functions that will be populated by external scripts
async function loadTeachersForAdmin() {
    console.log('[Master Teacher Dashboard] loadTeachersForAdmin called');
}

function showNotification(message, type = 'error') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification ${type}`;
        setTimeout(() => {
            notification.classList.remove('success', 'error');
        }, 4000);
    }
}

// Mobile hamburger menu
document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => {
            if (sidebar) {
                sidebar.classList.toggle('active');
                hamburgerBtn.classList.toggle('active');
            }
        });
    }
    
    // Check authentication
    const adminData = localStorage.getItem('adminData');
    if (!adminData) {
        console.warn('[Master Teacher Dashboard] No admin data found, redirecting to login');
        window.location.href = 'auth.html?role=admin';
        return;
    }

    const admin = JSON.parse(adminData);
    const adminNameEl = document.getElementById('adminName');
    if (adminNameEl) {
        adminNameEl.textContent = admin.name || 'Master Teacher';
    }

    console.log('[Master Teacher Dashboard] Initialization complete');
});

