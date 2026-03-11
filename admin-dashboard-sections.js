// Admin Dashboard - Sections Management
// Handles creation and management of class sections for JHS and SHS

console.log('[Sections] Initializing sections management...');

// Section data store
let sectionsData = {
    jhs: [],
    shs: []
};

// Full sections list for filtering/searching
let allSections = [];

let teachers = [];
let activeSchoolYear = null; // Will be set from active school year

async function sectionsRequest(path, options = {}) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const forcedBase = (typeof window !== 'undefined' && window.__FORCED_API_BASE__) ? String(window.__FORCED_API_BASE__) : '';
    const configuredBase = (typeof window !== 'undefined' && window.API_BASE) ? String(window.API_BASE) : '';
    const sameOriginBase = (typeof window !== 'undefined' && window.location && window.location.origin) ? String(window.location.origin) : '';

    const baseCandidates = [forcedBase, configuredBase, sameOriginBase, '']
        .map(base => String(base || '').trim())
        .filter((base, index, arr) => arr.indexOf(base) === index);

    let lastError = null;

    const tenantCode = (() => {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
            if (fromQuery) return fromQuery;
        } catch (_e) { }
        return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
    })();

    for (const base of baseCandidates) {
        const urlObj = new URL(base ? `${base.replace(/\/$/, '')}${normalizedPath}` : normalizedPath, window.location.origin);
        if (tenantCode) {
            urlObj.searchParams.set('school', tenantCode);
        }

        const mergedHeaders = {
            ...(options.headers || {}),
            ...(tenantCode ? { 'x-tenant-code': tenantCode } : {})
        };

        const requestOptions = {
            ...options,
            headers: mergedHeaders,
            credentials: options.credentials || 'include'
        };

        try {
            const res = await fetch(urlObj.toString(), requestOptions);
            if (res.ok) {
                return res.json();
            }

            const errText = await res.text().catch(() => '');
            const shouldRetryCreate =
                options &&
                String(options.method || 'GET').toUpperCase() === 'POST' &&
                /\/api\/sections\/create-(jhs|shs)$/i.test(normalizedPath) &&
                res.status === 400 &&
                /missing required fields/i.test(errText || '');

            if (!shouldRetryCreate) {
                throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
            }

            lastError = new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
        } catch (err) {
            lastError = err;
        }
    }

    if (typeof apiFetch === 'function') {
        const res = await apiFetch(normalizedPath, options);
        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
        }
        return res.json();
    }

    throw lastError || new Error('No response from sections API');
}

// Electives mapping by track with categories (expose on window to avoid duplicate declarations)
window.electivesMap = window.electivesMap || {
    'Academic': {
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
    },
    'TechPro': {
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
            'Carpentry (NC I and NC II)',
            'Construction Operations (Masonry NC I and Tiles Plumbing NC II)',
            'Commercial Air-Conditioning Installation and Servicing (NC III)',
            'Domestic Refrigeration and Air- Conditioning Servicing (NC II)',
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
    },
    'Doorway': {}
};

// Provide a convenient global alias so other code can reference
// `electivesMap` without risking a ReferenceError in strict/module contexts.
const electivesMap = window.electivesMap;

/**
 * Initialize sections management when DOM is ready
 */
async function initializeSectionsManagement() {
    console.log('[Sections] DOM ready, initializing...');
    
    // Load electives from enrollment form
    loadElectivesFromEnrollmentForm();
    
    // Fetch initial data
    loadTeachers();
    await getActiveSchoolYear();
    loadExistingSections();
    
    // Setup event listeners
    setupSchoolLevelSelector();
    setupJHSForm();
    setupSHSForm();
    setupBulkCreator();
    setupEditModal();
    
    // Setup modal event listeners
    setupSectionCreationModal();
    
    // Setup search and filter controls
    setupSearchAndFilters();
}

/**
 * Load electives from the enrollment form's ELECTIVES object
 */
function loadElectivesFromEnrollmentForm() {
    // Note: Electives are now populated by shs-track-config.js 
    // which provides flat arrays for Academic, TechPro, and Doorway tracks
    // The getElectivesByCategory() function in shs-track-config.js handles
    // retrieving categorized data when needed for display
    
    console.log('[Sections] Electives loaded from shs-track-config.js');
    if (electivesMap) {
        console.log('[Sections] electivesMap initialized with keys:', Object.keys(electivesMap));
    }
}

/**
 * Setup school level selector (JHS vs SHS)
 */
function setupSchoolLevelSelector() {
    const levelBtns = document.querySelectorAll('.level-btn');
    
    // Guard: only proceed if buttons exist
    if (!levelBtns || levelBtns.length === 0) {
        console.log('[Sections] No level buttons found');
        return;
    }
    
    levelBtns.forEach(btn => {
        if (!btn) return; // Skip null buttons
        
        btn.addEventListener('click', () => {
            // Remove active class from all buttons (with null check)
            levelBtns.forEach(b => {
                if (b) b.classList.remove('active');
            });
            // Add active class to clicked button
            if (btn) btn.classList.add('active');
            
            const level = btn.getAttribute('data-level');
            
            // Show/hide forms with null checks
            const jhsFormEl = document.getElementById('jhsForm');
            const shsFormEl = document.getElementById('shsForm');
            
            if (jhsFormEl) jhsFormEl.classList.remove('active');
            if (shsFormEl) shsFormEl.classList.remove('active');
            
            if (level === 'jhs' && jhsFormEl) {
                jhsFormEl.classList.add('active');
            } else if (level === 'shs' && shsFormEl) {
                shsFormEl.classList.add('active');
            }
        });
    });
}

/**
 * Setup JHS form events
 */
function setupJHSForm() {
    const form = document.querySelector('form[data-level="jhs"]');
    if (!form) return;
    
    // Grade and section name inputs
    const gradeInput = document.getElementById('jhs-grade');
    const sectionNameInput = document.getElementById('jhs-section-name');
    
    // Update section code preview on input
    [gradeInput, sectionNameInput].forEach(el => {
        if (el) {
            el.addEventListener('change', updateJHSCodePreview);
            el.addEventListener('input', updateJHSCodePreview);
        }
    });
    
    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitJHSForm();
    });
}

/**
 * Setup SHS form events
 */
function setupSHSForm() {
    const form = document.querySelector('form[data-level="shs"]');
    if (!form) return;
    
    // Track selector for electives
    const trackInput = document.getElementById('shs-track');
    if (trackInput) {
        trackInput.addEventListener('change', updateSHSElectives);
    }
    
    // Update section code preview
    const gradeInput = document.getElementById('shs-grade');
    const sectionNameInput = document.getElementById('shs-section-name');
    const electivesContainer = document.getElementById('shs-electives-container');
    
    [gradeInput, sectionNameInput].forEach(el => {
        if (el) {
            el.addEventListener('change', updateSHSCodePreview);
            el.addEventListener('input', updateSHSCodePreview);
        }
    });
    
    // Listen to checkbox changes for email
    if (electivesContainer) {
        electivesContainer.addEventListener('change', updateSHSCodePreview);
    }
    
    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitSHSForm();
    });
}

/**
 * Setup bulk creator
 */
function setupBulkCreator() {
    const toggleBtn = document.getElementById('toggleBulkCreator');
    const bulkForm = document.getElementById('bulkCreatorForm');
    const bulkCreateBtn = document.getElementById('bulkCreateBtn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            bulkForm.style.display = bulkForm.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    if (bulkCreateBtn) {
        bulkCreateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performBulkCreate();
        });
    }
}

/**
 * Update JHS section code preview
 */
function updateJHSCodePreview() {
    const grade = document.getElementById('jhs-grade').value;
    const sectionName = document.getElementById('jhs-section-name').value || 'SECTION';
    const preview = document.getElementById('jhs-code-preview');
    
    if (!preview) return;
    
    const gradeCode = grade ? `G${grade}` : 'G0';
    const sectionCode = sectionName.toUpperCase().replace(/\s+/g, '');
    
    preview.querySelector('.code-label').textContent = `JHS-${gradeCode}-`;
    preview.querySelector('.code-dynamic').textContent = sectionCode;
}

/**
 * Update SHS section code preview
 */
function updateSHSCodePreview() {
    const grade = document.getElementById('shs-grade').value;
    const track = document.getElementById('shs-track').value;
    const sectionName = document.getElementById('shs-section-name').value || 'SECTION';
    const preview = document.getElementById('shs-code-preview');
    
    if (!preview) return;
    
    const gradeCode = grade ? `G${grade}` : 'G0';
    const trackCode = track ? track.substring(0, 4).toUpperCase() : 'XXXX';
    
    // Get selected electives
    const checkboxes = document.querySelectorAll('#shs-electives-container input[type="checkbox"]:checked');
    let electiveCode = '';
    
    if (checkboxes.length > 0) {
        electiveCode = checkboxes[0].value.substring(0, 3).toUpperCase();
    }
    
    const sectionCode = sectionName.toUpperCase().replace(/\s+/g, '');
    
    const codeLabel = `SHS-${gradeCode}-${trackCode}${electiveCode ? '-' + electiveCode : ''}-`;
    preview.querySelector('.code-label').textContent = codeLabel;
    preview.querySelector('.code-dynamic').textContent = sectionCode;
    
    // Check for duplicates
    checkSHSDuplicate();
}

/**
 * Update SHS electives based on selected track
 */
function updateSHSElectives() {
    const track = document.getElementById('shs-track').value;
    const container = document.getElementById('shs-electives-container');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!track) {
        container.innerHTML = '<div class="checkbox-message">Select a track first to see available electives</div>';
        return;
    }
    
    // Get categorized electives using the helper function (preserves category groupings)
    let trackElectives = {};
    if (typeof getElectivesByCategory === 'function') {
        trackElectives = getElectivesByCategory(track) || {};
    } else {
        // Fallback if helper not available
        trackElectives = electivesMap[track] || {};
    }
    
    // For Doorway track, flatten the nested structure (Academic and TechPro categories merged)
    if (track === 'Doorway' && trackElectives['Academic']) {
        const flattened = {};
        // Add all Academic categories with prefix
        if (typeof trackElectives['Academic'] === 'object' && !Array.isArray(trackElectives['Academic'])) {
            Object.entries(trackElectives['Academic']).forEach(([cat, items]) => {
                flattened[`Academic - ${cat}`] = items;
            });
        }
        // Add all TechPro categories with prefix
        if (typeof trackElectives['TechPro'] === 'object' && !Array.isArray(trackElectives['TechPro'])) {
            Object.entries(trackElectives['TechPro']).forEach(([cat, items]) => {
                flattened[`TechPro - ${cat}`] = items;
            });
        }
        trackElectives = flattened;
    }
    
    // If we got a flat array (shouldn't happen with getElectivesByCategory, but safeguard)
    if (Array.isArray(trackElectives)) {
        trackElectives = { 'Electives': trackElectives };
    }

    if (!trackElectives || Object.keys(trackElectives).length === 0) {
        container.innerHTML = '<div class="checkbox-message">No electives available for this track</div>';
        return;
    }

    // Create wrapper for categories grid
    const categoriesWrapper = document.createElement('div');
    categoriesWrapper.className = 'electives-categories-wrapper';

    // Create electives organized by category in columns
    Object.entries(trackElectives).forEach(([category, items]) => {
        if (!Array.isArray(items)) items = [];
        // Create category column container
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'electives-category';
        
        // Create category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'electives-category-header';
        categoryHeader.innerHTML = `<h4>${category}</h4>`;
        categoryDiv.appendChild(categoryHeader);

        // Create items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'electives-category-items';

        // Add checkboxes for each elective
        items.forEach(elective => {
            const label = document.createElement('label');
            label.className = 'elective-checkbox';
            
            // Create safe ID by replacing special characters
            const safeId = `elective-${elective}`.replace(/[^a-zA-Z0-9-_]/g, '-');
            
            label.innerHTML = `
                <input 
                    type="checkbox" 
                    id="${safeId}" 
                    value="${elective}" 
                    name="electives"
                />
                <span>${elective}</span>
            `;
            itemsContainer.appendChild(label);
        });

        categoryDiv.appendChild(itemsContainer);
        categoriesWrapper.appendChild(categoryDiv);
    });
    
    container.appendChild(categoriesWrapper);
    
    // Update code preview
    updateSHSCodePreview();
}

/**
 * Check for duplicate SHS sections
 */
function checkSHSDuplicate() {
    const grade = document.getElementById('shs-grade').value;
    const track = document.getElementById('shs-track').value;
    const sectionName = document.getElementById('shs-section-name').value;
    const checkboxes = document.querySelectorAll('#shs-electives-container input[type="checkbox"]:checked');
    
    const statusEl = document.getElementById('shs-duplicate-status');
    if (!statusEl) return;
    
    if (!grade || !track || !sectionName || checkboxes.length === 0) {
        statusEl.style.display = 'none';
        return;
    }
    
    // Check if combination exists
    const selectedElectives = Array.from(checkboxes).map(cb => cb.value).join(',');
    const isDuplicate = sectionsData.shs.some(s =>
        String(s.grade || '') === String(grade || '') &&
        String(s.track || '') === String(track || '') &&
        String((s.section_name || s.sectionName || '')).toLowerCase() === String(sectionName || '').toLowerCase() &&
        String(s.electives || '') === selectedElectives
    );
    
    if (isDuplicate) {
        statusEl.style.display = 'block';
    } else {
        statusEl.style.display = 'none';
    }
}

/**
 * Submit JHS form
 */
function submitJHSForm() {
    const form = document.querySelector('form[data-level="jhs"]');
    if (!form) return;
    
    const formData = {
        sectionCode: `JHS-G${document.getElementById('jhs-grade').value}-${document.getElementById('jhs-section-name').value.toUpperCase().replace(/\s+/g, '')}`,
        grade: document.getElementById('jhs-grade').value,
        sectionName: document.getElementById('jhs-section-name').value,
        adviser: document.getElementById('jhs-adviser').value,
        programme: document.getElementById('jhs-program').value || 'Regular',
        status: document.getElementById('jhs-status').value,
        remarks: document.getElementById('jhs-remarks').value,
        schoolYearId: activeSchoolYear
    };
    
    // Validation
    if (!activeSchoolYear) {
        console.warn('[Sections] activeSchoolYear not loaded on client; backend will resolve active school year.');
    }
    if (!formData.grade || !formData.sectionName) {
        showMessage('error', '❌ Please fill all required fields');
        return;
    }
    
    // Send to API
    sectionsRequest('/api/sections/create-jhs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(data => {
        if (data.error) {
            showMessage('error', `❌ ${data.error}`);
            return;
        }
        
        // Show success message
        showMessage('success', `✅ JHS Section created: ${data.section_code}`);
        
        // Reset form
        form.reset();
        updateJHSCodePreview();
        
        // Reload sections table
        loadExistingSections();
    })
    .catch(err => {
        console.error('Error creating section:', err);
        showMessage('error', `❌ ${err.message || 'Error creating section. Please try again.'}`);
    });
}

/**
 * Submit SHS form
 */
function submitSHSForm() {
    const form = document.querySelector('form[data-level="shs"]');
    if (!form) return;
    
    const selectedElectives = Array.from(
        document.querySelectorAll('#shs-electives-container input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    
    const grade = document.getElementById('shs-grade').value;
    const track = document.getElementById('shs-track').value;
    const sectionName = document.getElementById('shs-section-name').value;
    const trackCode = track.substring(0, 4).toUpperCase();
    const electiveCode = selectedElectives.length > 0 ? selectedElectives[0].substring(0, 3).toUpperCase() : 'XYZ';
    
    const formData = {
        sectionCode: `SHS-G${grade}-${trackCode}-${electiveCode}-${sectionName.toUpperCase().replace(/\s+/g, '')}`,
        grade: grade,
        track: track,
        electives: selectedElectives.join(','),
        sectionName: sectionName,
        adviser: document.getElementById('shs-adviser').value,
        classType: document.getElementById('shs-class-type').value || 'Regular',
        session: document.getElementById('shs-session').value || 'Not specified',
        remarks: document.getElementById('shs-remarks').value,
        schoolYearId: activeSchoolYear
    };
    
    // Validation
    if (!activeSchoolYear) {
        console.warn('[Sections] activeSchoolYear not loaded on client; backend will resolve active school year.');
    }
    if (!formData.grade || !formData.track || 
        selectedElectives.length === 0 || !formData.sectionName) {
        showMessage('error', '❌ Please fill all required fields');
        return;
    }
    
    // Send to API
    sectionsRequest('/api/sections/create-shs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(data => {
        if (data.error) {
            if (data.error.includes('already exists')) {
                document.getElementById('shs-duplicate-status').style.display = 'block';
            }
            showMessage('error', `❌ ${data.error}`);
            return;
        }
        
        // Show success message
        showMessage('success', `✅ SHS Section created: ${data.section_code}`);
        
        // Reset form
        form.reset();
        updateSHSCodePreview();
        updateSHSElectives();
        
        // Reload sections table
        loadExistingSections();
    })
    .catch(err => {
        console.error('Error creating section:', err);
        showMessage('error', `❌ ${err.message || 'Error creating section. Please try again.'}`);
    });
}

/**
 * Perform bulk creation of SHS sections
 */
function performBulkCreate() {
    const sectionNames = document.getElementById('bulk-section-names').value;
    
    if (!sectionNames.trim()) {
        showMessage('error', '❌ Please enter at least one section name');
        return;
    }
    
    // Get current form values
    const grade = document.getElementById('shs-grade').value;
    const track = document.getElementById('shs-track').value;
    const adviser = document.getElementById('shs-adviser').value;
    const selectedElectives = Array.from(
        document.querySelectorAll('#shs-electives-container input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    
    // Validation (adviser optional)
    if (!grade || !track || selectedElectives.length === 0) {
        showMessage('error', '❌ Please configure: Grade, Track, and Electives before bulk creating');
        return;
    }
    
    if (!activeSchoolYear) {
        console.warn('[Sections] activeSchoolYear not loaded on client; backend will resolve active school year.');
    }
    
    // Parse section names
    const names = sectionNames.split(',').map(n => n.trim()).filter(n => n);
    let createdCount = 0;
    let processedCount = 0;
    const apiBase = window.API_BASE || '';
    
    names.forEach((sectionName, index) => {
        const trackCode = track.substring(0, 4).toUpperCase();
        const electiveCode = selectedElectives[0].substring(0, 3).toUpperCase();
        
        const formData = {
            sectionCode: `SHS-G${grade}-${trackCode}-${electiveCode}-${sectionName.toUpperCase().replace(/\s+/g, '')}`,
            grade: grade,
            track: track,
            electives: selectedElectives.join(','),
            sectionName: sectionName,
            adviser: adviser,
            classType: document.getElementById('shs-class-type').value || 'Regular',
            session: document.getElementById('shs-session').value || 'Not specified',
            remarks: `Bulk created on ${new Date().toLocaleDateString()}`,
            schoolYearId: activeSchoolYear
        };
        
        sectionsRequest('/api/sections/create-shs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        })
        .then(data => {
            processedCount++;
            if (!data.error) {
                createdCount++;
            }
            
            // When all requests completed
            if (processedCount === names.length) {
                if (createdCount > 0) {
                    showMessage('success', `✅ Bulk created ${createdCount} section(s)`);
                    document.getElementById('bulk-section-names').value = '';
                    document.getElementById('bulkCreatorForm').style.display = 'none';
                    loadExistingSections();
                } else {
                    showMessage('error', '❌ No sections created (all combinations already exist or error occurred)');
                }
            }
        })
        .catch(err => {
            console.error('Error creating section:', err);
            processedCount++;
            if (processedCount === names.length) {
                showMessage('error', `❌ Some sections failed to create. ${createdCount} created successfully.`);
                loadExistingSections();
            }
        });
    });
}

/**
 * Load existing sections and display them
 */
function loadExistingSections() {
    const table = document.getElementById('sectionsTable');
    if (!table) return;
    
    // Show loading state
    table.innerHTML = '<p class="no-data">Loading sections...</p>';
    
    const endpoint = activeSchoolYear
        ? `/api/sections/by-school-year/${activeSchoolYear}`
        : '/api/sections';

    // Fetch sections from API
    sectionsRequest(endpoint)
        .then(sections => {
            if (!Array.isArray(sections)) {
                throw new Error('Invalid sections response format');
            }
            // Update local store for reference
            allSections = sections || [];
            sectionsData.jhs = sections.filter(s => s.type === 'JHS');
            sectionsData.shs = sections.filter(s => s.type === 'SHS');
            
            const allSectionsData = sections;
            
            if (allSectionsData.length === 0) {
                table.innerHTML = '<p class="no-data">No sections created yet.</p>';
                updateResultsInfo(0);
                return;
            }
            
            // Sort by default and display
            sortSections(allSections, 'section_code');
            displayFilteredSections(allSections);
            updateResultsInfo(allSectionsData.length);
        })
        .catch(err => {
            console.error('Error loading sections:', err);
            table.innerHTML = '<p class="no-data">Error loading sections. Please refresh the page.</p>';
        });
}

/**
 * Setup search and filter event listeners
 */
function setupSearchAndFilters() {
    const searchInput = document.getElementById('sectionSearchInput');
    const levelFilter = document.getElementById('levelFilter');
    const gradeFilter = document.getElementById('gradeFilter');
    const sortBy = document.getElementById('sortBy');
    const resetBtn = document.getElementById('resetFilters');
    
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndSort);
    if (levelFilter) levelFilter.addEventListener('change', applyFiltersAndSort);
    if (gradeFilter) gradeFilter.addEventListener('change', applyFiltersAndSort);
    if (sortBy) sortBy.addEventListener('change', applyFiltersAndSort);
    if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
}

/**
 * Apply all filters and sorting
 */
function applyFiltersAndSort() {
    const searchTerm = (document.getElementById('sectionSearchInput') || {}).value || '';
    const levelFilter = (document.getElementById('levelFilter') || {}).value || '';
    const gradeFilter = (document.getElementById('gradeFilter') || {}).value || '';
    const sortOption = (document.getElementById('sortBy') || {}).value || 'section_code';
    
    // Start with all sections
    let filtered = [...allSections];
    
    // Apply search filter
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(section => {
            return (
                (section.section_code || '').toLowerCase().includes(term) ||
                (section.section_name || '').toLowerCase().includes(term) ||
                (section.adviser_name || '').toLowerCase().includes(term) ||
                getSectionElectivesDisplay(section).toLowerCase().includes(term)
            );
        });
    }
    
    // Apply level filter
    if (levelFilter) {
        filtered = filtered.filter(section => section.type === levelFilter);
    }
    
    // Apply grade filter
    if (gradeFilter) {
        filtered = filtered.filter(section => String(section.grade) === gradeFilter);
    }
    
    // Apply sorting
    sortSections(filtered, sortOption);
    
    // Display results
    displayFilteredSections(filtered);
    updateResultsInfo(filtered.length);
}

/**
 * Sort sections by specified field
 */
function sortSections(sections, sortBy) {
    const sortMap = {
        'section_code': (a, b) => (a.section_code || '').localeCompare(b.section_code || ''),
        'section_code_desc': (a, b) => (b.section_code || '').localeCompare(a.section_code || ''),
        'level': (a, b) => {
            if (a.type !== b.type) return (a.type === 'JHS' ? -1 : 1);
            return (a.section_code || '').localeCompare(b.section_code || '');
        },
        'grade': (a, b) => (a.grade || 0) - (b.grade || 0),
        'adviser': (a, b) => (a.adviser_name || '').localeCompare(b.adviser_name || ''),
        'electives': (a, b) => getSectionElectivesDisplay(a).localeCompare(getSectionElectivesDisplay(b))
    };
    
    const compareFn = sortMap[sortBy] || sortMap['section_code'];
    sections.sort(compareFn);
}

function getSectionElectivesDisplay(section) {
    if (!section || section.type !== 'SHS') return '—';

    const raw = [
        section.electives,
        section.elective_subjects,
        section.electiveSubjects,
        section.elective
    ].find(value => value !== undefined && value !== null && String(value).trim() !== '');

    if (!raw) return '—';

    if (Array.isArray(raw)) {
        const values = raw.map(value => String(value || '').trim()).filter(Boolean);
        return values.length ? values.join(', ') : '—';
    }

    const text = String(raw).trim();
    if (!text) return '—';

    return text
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
        .join(', ') || '—';
}

/**
 * Display filtered sections
 */
function displayFilteredSections(filteredSections) {
    const table = document.getElementById('sectionsTable');
    if (!table) return;
    
    if (filteredSections.length === 0) {
        table.innerHTML = '<p class="no-data">No sections match your search criteria.</p>';
        return;
    }
    
    let html = `
        <table class="sections-table">
            <thead>
                <tr>
                    <th>Section Code</th>
                    <th>Level</th>
                    <th>Grade</th>
                    <th>Section Name</th>
                    <th>Elective Subjects</th>
                    <th>Adviser</th>
                    <th>Status</th>
                    <th>School Year</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    filteredSections.forEach(section => {
        const statusBadge = section.status === 'Active' 
            ? 'section-badge' 
            : 'section-badge inactive';
        const electivesDisplay = getSectionElectivesDisplay(section);
        
        html += `
            <tr>
                <td><strong>${section.section_code}</strong></td>
                <td>${section.type}</td>
                <td>${section.type === 'JHS' ? section.grade : 'G' + section.grade}</td>
                <td>${section.section_name}</td>
                <td>${electivesDisplay}</td>
                <td>${section.adviser_name || 'N/A'}</td>
                <td><span class="${statusBadge}">${section.status || 'Active'}</span></td>
                <td>${section.school_year || 'N/A'}</td>
                <td>
                    <button class="btn btn-small" onclick="editSection(${section.id})">Edit</button>
                    <button class="btn btn-small btn-danger" onclick="deleteSection(${section.id})">Delete</button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    table.innerHTML = html;
}

/**
 * Update results info display
 */
function updateResultsInfo(count) {
    const resultsInfo = document.getElementById('resultsInfo');
    const resultsCount = document.getElementById('resultsCount');
    
    if (!resultsInfo || !resultsCount) return;
    
    if (allSections.length === 0) {
        resultsInfo.style.display = 'none';
        return;
    }
    
    resultsCount.textContent = count;
    resultsInfo.style.display = 'block';
    
    if (count === 0) {
        resultsInfo.classList.add('no-results');
    } else {
        resultsInfo.classList.remove('no-results');
    }
}

/**
 * Reset all filters to default
 */
function resetAllFilters() {
    document.getElementById('sectionSearchInput').value = '';
    document.getElementById('levelFilter').value = '';
    document.getElementById('gradeFilter').value = '';
    document.getElementById('sortBy').value = 'section_code';
    
    applyFiltersAndSort();
}

/**
 * Show message notification
 */
function showMessage(type, text) {
    const messagesContainer = document.getElementById('sectionMessages');
    if (!messagesContainer) return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `message-item ${type}`;
    
    const iconMap = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️'
    };
    
    messageEl.innerHTML = `
        <span class="message-icon">${iconMap[type]}</span>
        <span>${text}</span>
    `;
    
    messagesContainer.appendChild(messageEl);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageEl.style.animation = 'slideDown 0.3s ease reverse';
        setTimeout(() => messageEl.remove(), 300);
    }, 5000);
}

// Removed old prompt-based editSection to avoid duplicate definitions.
// Use the modal-based edit flow (see the later `editSection` and `submitEditForm`).

/**
 * Delete a section by id.
 */
function deleteSection(id) {
    if (!confirm('Are you sure you want to delete this section? This cannot be undone.')) return;
    sectionsRequest(`/api/sections/${id}`, {
        method: 'DELETE'
    })
    .then(data => {
        if (data.error) {
            showMessage('error', `❌ ${data.error}`);
            return;
        }
        showMessage('success', '✅ Section deleted');
        loadExistingSections();
    })
    .catch(err => {
        console.error('Error deleting section:', err);
        showMessage('error', '❌ Error deleting section');
    });
}

/**
 * Load teachers from API
 */
function loadTeachers() {
    sectionsRequest('/api/teachers')
        .then(teachersData => {
            teachers = teachersData || [];
            
            // Populate adviser dropdowns
            [
                document.getElementById('jhs-adviser'),
                document.getElementById('shs-adviser'),
                document.getElementById('modal-jhs-adviser'),
                document.getElementById('modal-shs-adviser'),
                document.getElementById('edit-adviser')
            ].forEach(select => {
                if (select) {
                    // Clear existing options
                    select.innerHTML = '<option value="">-- Select Adviser --</option>';
                    // Add teacher options
                    teachers.forEach(teacher => {
                        const option = document.createElement('option');
                        option.value = teacher.name;
                        option.textContent = teacher.name;
                        select.appendChild(option);
                    });
                }
            });
        })
        .catch(err => {
            console.error('[Sections] Error loading teachers:', err);
            // Fallback with mock data
            const mockTeachers = [
                { name: 'Mr. Juan Dela Cruz' },
                { name: 'Ms. Maria Santos' },
                { name: 'Mr. Pedro Rodriguez' },
                { name: 'Ms. Rosa Garcia' },
                { name: 'Mr. Antonio Lopez' }
            ];
            
            teachers = mockTeachers;
            
            [
                document.getElementById('jhs-adviser'),
                document.getElementById('shs-adviser'),
                document.getElementById('modal-jhs-adviser'),
                document.getElementById('modal-shs-adviser'),
                document.getElementById('edit-adviser')
            ].forEach(select => {
                if (select) {
                    select.innerHTML = '<option value="">-- Select Adviser --</option>';
                    teachers.forEach(teacher => {
                        const option = document.createElement('option');
                        option.value = teacher.name;
                        option.textContent = teacher.name;
                        select.appendChild(option);
                    });
                }
            });
        });
}

/**
 * Setup edit modal event handlers
 */
function setupEditModal() {
    const modal = document.getElementById('sectionEditModal');
    if (!modal) return;

    const closeBtn = document.getElementById('closeEditModal');
    const cancelBtn = document.getElementById('editCancelBtn');
    const saveBtn = document.getElementById('editSaveBtn');

    closeBtn && closeBtn.addEventListener('click', closeEditModal);
    cancelBtn && cancelBtn.addEventListener('click', closeEditModal);
    saveBtn && saveBtn.addEventListener('click', submitEditForm);

    // Close when clicking outside modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeEditModal();
    });
}

/**
 * Setup section creation modal event handlers
 */
function setupSectionCreationModal() {
    const modal = document.getElementById('sectionCreationModal');
    if (!modal) return;

    // Add button listeners
    const addJHSBtn = document.getElementById('addJHSSection');
    const addSHSBtn = document.getElementById('addSHSSection');
    const closeBtn = document.getElementById('closeSectionModal');
    const cancelBtn = document.getElementById('cancelSectionModal');
    const saveBtn = document.getElementById('saveSectionModal');

    addJHSBtn && addJHSBtn.addEventListener('click', () => openSectionModal('jhs'));
    addSHSBtn && addSHSBtn.addEventListener('click', () => openSectionModal('shs'));
    closeBtn && closeBtn.addEventListener('click', closeSectionModal);
    cancelBtn && cancelBtn.addEventListener('click', closeSectionModal);
    saveBtn && saveBtn.addEventListener('click', saveSectionFromModal);

    // Close when clicking outside modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSectionModal();
    });

    // Setup form event listeners for real-time updates
    setupModalFormListeners();
}

/**
 * Setup event listeners for modal forms (real-time updates)
 */
function setupModalFormListeners() {
    // JHS form listeners
    const jhsGrade = document.getElementById('modal-jhs-grade');
    const jhsSectionName = document.getElementById('modal-jhs-section-name');
    if (jhsGrade) jhsGrade.addEventListener('change', updateModalJHSCodePreview);
    if (jhsGrade) jhsGrade.addEventListener('input', updateModalJHSCodePreview);
    if (jhsSectionName) jhsSectionName.addEventListener('change', updateModalJHSCodePreview);
    if (jhsSectionName) jhsSectionName.addEventListener('input', updateModalJHSCodePreview);

    // SHS form listeners
    const shsGrade = document.getElementById('modal-shs-grade');
    const shsTrack = document.getElementById('modal-shs-track');
    const shsSectionName = document.getElementById('modal-shs-section-name');
    const shselectivesContainer = document.getElementById('modal-shs-electives-container');
    const shsForm = document.getElementById('modalSHSForm');

    if (shsGrade) shsGrade.addEventListener('change', updateModalSHSCodePreview);
    if (shsGrade) shsGrade.addEventListener('input', updateModalSHSCodePreview);
    
    if (shsTrack) {
        // Use both 'change' and 'input' events to ensure we catch track selection
        const handleTrackChange = (e) => { 
            console.log('[Sections Modal] Track change/input event fired. New value:', shsTrack.value);
            if (typeof updateModalSHSElectives === 'function') {
                updateModalSHSElectives(); 
            }
            if (typeof updateModalSHSCodePreview === 'function') {
                updateModalSHSCodePreview(); 
            }
        };
        
        shsTrack.addEventListener('change', handleTrackChange);
        shsTrack.addEventListener('input', handleTrackChange);
    }
    
    // Add delegated listener to form for track changes (additional failsafe)
    if (shsForm) {
        shsForm.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'modal-shs-track') {
                console.log('[Sections Modal] Form delegated change event - Track:', e.target.value);
                if (typeof updateModalSHSElectives === 'function') {
                    updateModalSHSElectives();
                }
                if (typeof updateModalSHSCodePreview === 'function') {
                    updateModalSHSCodePreview();
                }
            }
        });
    }
    
    if (shsSectionName) shsSectionName.addEventListener('change', updateModalSHSCodePreview);
    if (shsSectionName) shsSectionName.addEventListener('input', updateModalSHSCodePreview);
    if (shselectivesContainer) shselectivesContainer.addEventListener('change', updateModalSHSCodePreview);
}

/**
 * Open section creation modal for a specific level
 */
function openSectionModal(level) {
    console.log('[Sections Modal] Opening modal for level:', level);
    
    const modal = document.getElementById('sectionCreationModal');
    const modalTitle = document.getElementById('modalTitle');
    const jhsForm = document.getElementById('modalJHSForm');
    const shsForm = document.getElementById('modalSHSForm');

    if (!modal) return;

    // Set title and show appropriate form
    if (level === 'jhs') {
        modalTitle.textContent = '🧒 Create Junior High Section';
        jhsForm.style.display = 'block';
        shsForm.style.display = 'none';
        updateModalJHSCodePreview();
    } else if (level === 'shs') {
        modalTitle.textContent = '🎓 Create Senior High Section';
        jhsForm.style.display = 'none';
        shsForm.style.display = 'block';
        
        // Reset track selection to trigger initial electives state
        const trackSelect = document.getElementById('modal-shs-track');
        if (trackSelect) {
            trackSelect.value = '';
        }
        
        // Reset electives container to show initial message
        const electivesContainer = document.getElementById('modal-shs-electives-container');
        if (electivesContainer) {
            electivesContainer.innerHTML = '<div class="checkbox-message">Select a track first to see available electives</div>';
        }
        
        updateModalSHSCodePreview();
    }

    // Show modal
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    
    // Keep SHS UI in sync on open.
    if (level === 'shs') {
        updateModalSHSElectives();
        updateModalSHSCodePreview();
    }
}

/**
 * Close section creation modal
 */
function closeSectionModal() {
    console.log('[Sections Modal] Closing modal');
    const modal = document.getElementById('sectionCreationModal');
    if (!modal) return;

    // Hide modal
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'auto'; // Restore scrolling

    // Reset forms
    const jhsForm = document.querySelector('#modalJHSForm');
    const shsForm = document.querySelector('#modalSHSForm');
    if (jhsForm) jhsForm.reset();
    if (shsForm) shsForm.reset();
    
    // Reset electives container to initial state
    const electivesContainer = document.getElementById('modal-shs-electives-container');
    if (electivesContainer) {
        electivesContainer.innerHTML = '<div class="checkbox-message">Select a track first to see available electives</div>';
    }

    // Reset code previews
    updateModalJHSCodePreview();
    updateModalSHSCodePreview();
}

/**
 * Update modal JHS section code preview
 */
function updateModalJHSCodePreview() {
    const grade = document.getElementById('modal-jhs-grade').value;
    const sectionName = document.getElementById('modal-jhs-section-name').value || 'SECTION';
    const preview = document.getElementById('modal-jhs-code-preview');

    if (!preview) return;

    const gradeCode = grade ? `G${grade}` : 'G0';
    const sectionCode = sectionName.toUpperCase().replace(/\s+/g, '');

    preview.querySelector('.code-label').textContent = `JHS-${gradeCode}-`;
    preview.querySelector('.code-dynamic').textContent = sectionCode;
}

/**
 * Update modal SHS section code preview
 */
function updateModalSHSCodePreview() {
    const grade = document.getElementById('modal-shs-grade').value;
    const track = document.getElementById('modal-shs-track').value;
    const sectionName = document.getElementById('modal-shs-section-name').value || 'SECTION';
    const preview = document.getElementById('modal-shs-code-preview');

    if (!preview) return;

    const gradeCode = grade ? `G${grade}` : 'G0';
    const trackCode = track ? track.substring(0, 4).toUpperCase() : 'XXXX';

    // Get selected electives
    const checkboxes = document.querySelectorAll('#modal-shs-electives-container input[type="checkbox"]:checked');
    let electiveCode = '';

    if (checkboxes.length > 0) {
        electiveCode = checkboxes[0].value.substring(0, 3).toUpperCase();
    }

    const sectionCode = sectionName.toUpperCase().replace(/\s+/g, '');

    const codeLabel = `SHS-${gradeCode}-${trackCode}${electiveCode ? '-' + electiveCode : ''}-`;
    preview.querySelector('.code-label').textContent = codeLabel;
    preview.querySelector('.code-dynamic').textContent = sectionCode;

    // Check for duplicates
    checkModalSHSDuplicate();
}

/**
 * Update modal SHS electives based on selected track
 */
function updateModalSHSElectives() {
    const track = document.getElementById('modal-shs-track').value;
    const container = document.getElementById('modal-shs-electives-container');

    console.log('========== updateModalSHSElectives START ==========');
    console.log('[Sections Modal] Track selected:', track);

    if (!container) {
        console.error('[Sections Modal] ❌ Electives container not found!');
        return;
    }

    container.innerHTML = '';

    if (!track) {
        console.log('[Sections Modal] No track selected, showing initial message');
        container.innerHTML = '<div class="checkbox-message">Select a track first to see available electives</div>';
        console.log('========== updateModalSHSElectives END (no track) ==========');
        return;
    }

    console.log('[Sections Modal] Step 1: Getting categorized electives for track "' + track + '"...');
    
    // Get categorized electives using the helper function (preserves category groupings)
    let trackElectives = {};
    if (typeof getElectivesByCategory === 'function') {
        trackElectives = getElectivesByCategory(track) || {};
        console.log('[Sections Modal] ✓ Got categorized electives via getElectivesByCategory(), keys:', Object.keys(trackElectives).length);
    } else {
        console.warn('[Sections Modal] getElectivesByCategory not available, using fallback');
        trackElectives = electivesMap[track] || {};
    }

    // For Doorway track, flatten the nested structure (Academic and TechPro categories merged)
    console.log('[Sections Modal] Step 2: Checking for nested structure (Doorway)...');
    if (track === 'Doorway' && trackElectives['Academic']) {
        console.log('[Sections Modal] ⭐ Doorway detected with nested structure, flattening...');
        const flattened = {};
        // Add all Academic categories with prefix
        if (typeof trackElectives['Academic'] === 'object' && !Array.isArray(trackElectives['Academic'])) {
            console.log('[Sections Modal]   Flattening Academic categories...');
            Object.entries(trackElectives['Academic']).forEach(([cat, items]) => {
                flattened[`Academic - ${cat}`] = items;
                console.log(`[Sections Modal]     + Academic - ${cat} (${Array.isArray(items) ? items.length : 0} items)`);
            });
        }
        // Add all TechPro categories with prefix
        if (typeof trackElectives['TechPro'] === 'object' && !Array.isArray(trackElectives['TechPro'])) {
            console.log('[Sections Modal]   Flattening TechPro categories...');
            Object.entries(trackElectives['TechPro']).forEach(([cat, items]) => {
                flattened[`TechPro - ${cat}`] = items;
                console.log(`[Sections Modal]     + TechPro - ${cat} (${Array.isArray(items) ? items.length : 0} items)`);
            });
        }
        trackElectives = flattened;
        console.log('[Sections Modal] ✅ Doorway flattened - total categories:', Object.keys(trackElectives).length);
    }

    // Normalize flat-array shape into a category->items object for rendering.
    console.log('[Sections Modal] Step 3: Normalizing electives format...');
    if (Array.isArray(trackElectives)) {
        console.log('[Sections Modal] trackElectives is array, converting to object format...');
        trackElectives = { 'Electives': trackElectives };
    }

    console.log('[Sections Modal] Step 4: Checking if we have electives to render...');
    console.log('[Sections Modal] trackElectives categories:', Object.keys(trackElectives).length);

    if (!trackElectives || Object.keys(trackElectives).length === 0) {
        console.warn('[Sections Modal] ❌ No electives available for track:', track);
        container.innerHTML = '<div class="checkbox-message">No electives available for this track</div>';
        console.log('========== updateModalSHSElectives END (no electives) ==========');
        return;
    }

    console.log('[Sections Modal] Step 5: Creating DOM elements for categories...');
    // Create wrapper for categories grid
    const categoriesWrapper = document.createElement('div');
    categoriesWrapper.className = 'electives-categories-wrapper';
    let categoryCount = 0;
    let itemCount = 0;

    // Create electives organized by category in columns
    Object.entries(trackElectives).forEach(([category, items]) => {
        if (!Array.isArray(items)) {
            console.warn(`[Sections Modal] ⚠️ Category "${category}" items is not an array:`, typeof items);
            items = [];
        }
        console.log(`[Sections Modal]   Processing category: "${category}" with ${items.length} items`);
        categoryCount++;
        itemCount += items.length;

        // Create category column container
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'electives-category';

        // Create category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'electives-category-header';
        categoryHeader.innerHTML = `<h4>${category}</h4>`;
        categoryDiv.appendChild(categoryHeader);

        // Create items container
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'electives-category-items';

        // Add checkboxes for each elective
        items.forEach(elective => {
            const label = document.createElement('label');
            label.className = 'elective-checkbox';
            
            // Create safe ID by replacing special characters
            const safeId = `modal-elective-${elective}`.replace(/[^a-zA-Z0-9-_]/g, '-');
            
            label.innerHTML = `
                <input 
                    type="checkbox" 
                    id="${safeId}" 
                    value="${elective}" 
                    name="electives"
                />
                <span>${elective}</span>
            `;
            itemsContainer.appendChild(label);
        });

        categoryDiv.appendChild(itemsContainer);
        categoriesWrapper.appendChild(categoryDiv);
    });
    
    console.log(`[Sections Modal] Step 6: Appending ${categoryCount} categories with ${itemCount} total items to container`);
    container.appendChild(categoriesWrapper);

    // Update code preview
    updateModalSHSCodePreview();
    console.log('========== updateModalSHSElectives END (success) ==========');
}

/**
 * Check for duplicate SHS sections in modal
 */
function checkModalSHSDuplicate() {
    const grade = document.getElementById('modal-shs-grade').value;
    const track = document.getElementById('modal-shs-track').value;
    const sectionName = document.getElementById('modal-shs-section-name').value;
    const checkboxes = document.querySelectorAll('#modal-shs-electives-container input[type="checkbox"]:checked');

    const statusEl = document.getElementById('modal-shs-duplicate-status');
    if (!statusEl) return;

    if (!grade || !track || !sectionName || checkboxes.length === 0) {
        statusEl.style.display = 'none';
        return;
    }

    // Check if combination exists
    const selectedElectives = Array.from(checkboxes).map(cb => cb.value).join(',');
    const isDuplicate = sectionsData.shs.some(s =>
        String(s.grade || '') === String(grade || '') &&
        String(s.track || '') === String(track || '') &&
        String((s.section_name || s.sectionName || '')).toLowerCase() === String(sectionName || '').toLowerCase() &&
        String(s.electives || '') === selectedElectives
    );

    if (isDuplicate) {
        statusEl.style.display = 'block';
    } else {
        statusEl.style.display = 'none';
    }
}

/**
 * Save section from modal
 */
function saveSectionFromModal() {
    const modal = document.getElementById('sectionCreationModal');
    const jhsForm = document.getElementById('modalJHSForm');
    const shsForm = document.getElementById('modalSHSForm');

    if (!modal) return;

    // Determine which form is active
    if (jhsForm.style.display !== 'none') {
        // Submit JHS form
        submitModalJHSForm();
    } else if (shsForm.style.display !== 'none') {
        // Submit SHS form
        submitModalSHSForm();
    }
}

/**
 * Submit JHS form from modal
 */
function submitModalJHSForm() {
    const grade = document.getElementById('modal-jhs-grade').value;
    const sectionName = document.getElementById('modal-jhs-section-name').value;
    const adviserName = document.getElementById('modal-jhs-adviser').value;
    const programme = document.getElementById('modal-jhs-program').value || 'Regular';
    const status = document.getElementById('modal-jhs-status').value;
    const remarks = document.getElementById('modal-jhs-remarks').value;
    const sectionCode = `JHS-G${grade}-${sectionName.toUpperCase().replace(/\s+/g, '')}`;

    const formData = {
        sectionCode,
        section_code: sectionCode,
        grade,
        sectionName,
        section_name: sectionName,
        adviser: adviserName,
        adviser_name: adviserName,
        programme,
        program_type: programme,
        status,
        remarks,
        schoolYearId: activeSchoolYear,
        school_year_id: activeSchoolYear
    };

    // Validation
    if (!activeSchoolYear) {
        console.warn('[Sections Modal] activeSchoolYear not loaded on client; backend will resolve active school year.');
    }
    if (!formData.grade || !formData.sectionName || !String(formData.sectionName).trim()) {
        showMessage('error', '❌ Please fill all required fields');
        return;
    }

    // Send to API
    sectionsRequest('/api/sections/create-jhs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(data => {
        if (data.error) {
            showMessage('error', `❌ ${data.error}`);
            return;
        }

        // Show success message
        showMessage('success', `✅ JHS Section created: ${data.section_code}`);

        // Close modal
        closeSectionModal();

        // Reload sections table
        loadExistingSections();
    })
    .catch(err => {
        console.error('Error creating section:', err);
        showMessage('error', `❌ ${err.message || 'Error creating section. Please try again.'}`);
    });
}

/**
 * Submit SHS form from modal
 */
function submitModalSHSForm() {
    const selectedElectives = Array.from(
        document.querySelectorAll('#modal-shs-electives-container input[type="checkbox"]:checked')
    ).map(cb => cb.value);

    const grade = document.getElementById('modal-shs-grade').value;
    const track = document.getElementById('modal-shs-track').value;
    const sectionName = document.getElementById('modal-shs-section-name').value;
    const trackCode = track.substring(0, 4).toUpperCase();
    const electiveCode = selectedElectives.length > 0 ? selectedElectives[0].substring(0, 3).toUpperCase() : 'XYZ';

    // Diagnostic logging to help identify why modal save may fail
    console.log('[Sections Modal] submitModalSHSForm called');
    console.log('[Sections Modal] selectedElectives (count):', selectedElectives.length, selectedElectives.slice(0,5));
    console.log('[Sections Modal] modal fields -> grade, track, sectionName:',
        document.getElementById('modal-shs-grade')?.value,
        document.getElementById('modal-shs-track')?.value,
        document.getElementById('modal-shs-section-name')?.value
    );
    console.log('[Sections Modal] activeSchoolYear:', activeSchoolYear);

    const adviserName = document.getElementById('modal-shs-adviser').value;
    const classType = document.getElementById('modal-shs-class-type').value || 'Regular';
    const session = document.getElementById('modal-shs-session').value || 'Not specified';
    const remarks = document.getElementById('modal-shs-remarks').value;
    const electives = selectedElectives.join(',');
    const sectionCode = `SHS-G${grade}-${trackCode}-${electiveCode}-${sectionName.toUpperCase().replace(/\s+/g, '')}`;

    const formData = {
        sectionCode,
        section_code: sectionCode,
        grade: grade,
        track: track,
        electives,
        sectionName: sectionName,
        section_name: sectionName,
        adviser: adviserName,
        adviser_name: adviserName,
        classType,
        class_type: classType,
        session,
        remarks,
        schoolYearId: activeSchoolYear,
        school_year_id: activeSchoolYear
    };

    // Validation
    if (!activeSchoolYear) {
        console.warn('[Sections Modal] activeSchoolYear not loaded on client; backend will resolve active school year.');
    }
    if (!formData.grade || !formData.track || 
        selectedElectives.length === 0 || !formData.sectionName || !String(formData.sectionName).trim()) {
        showMessage('error', '❌ Please fill all required fields');
        return;
    }

    // Send to API
    sectionsRequest('/api/sections/create-shs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(data => {
        if (data.error) {
            if (data.error.includes('already exists')) {
                document.getElementById('modal-shs-duplicate-status').style.display = 'block';
            }
            showMessage('error', `❌ ${data.error}`);
            return;
        }

        // Show success message
        showMessage('success', `✅ SHS Section created: ${data.section_code}`);

        // Close modal
        closeSectionModal();

        // Reload sections table
        loadExistingSections();
    })
    .catch(err => {
        console.error('Error creating section:', err);
        showMessage('error', `❌ ${err.message || 'Error creating section. Please try again.'}`);
    });
}

/**
 * Open edit modal for a section
 */
function editSection(id) {
    sectionsRequest(`/api/sections/${id}`)
        .then(section => {
            if (!section || !section.id) {
                showMessage('error', '❌ Section not found');
                return;
            }

            // Populate modal fields
            document.getElementById('edit-section-id').value = section.id;
            document.getElementById('edit-level').value = section.type || '';
            document.getElementById('edit-grade').value = section.grade || '';
            document.getElementById('edit-section-name').value = section.section_name || '';
            document.getElementById('edit-adviser').value = section.adviser_name || '';
            document.getElementById('edit-program').value = section.programme || '';
            document.getElementById('edit-status').value = section.status || 'Active';
            document.getElementById('edit-remarks').value = section.remarks || '';

            // Show modal
            const modal = document.getElementById('sectionEditModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'flex';
                modal.style.pointerEvents = 'auto';
                modal.setAttribute('aria-hidden', 'false');
            }
        })
        .catch(err => {
            console.error('Error fetching section:', err);
            showMessage('error', '❌ Error fetching section details');
        });
}

function closeEditModal() {
    const modal = document.getElementById('sectionEditModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}

function submitEditForm() {
    const id = document.getElementById('edit-section-id').value;
    if (!id) return showMessage('error', '❌ Missing section id');

    const payload = {
        grade: document.getElementById('edit-grade').value || undefined,
        sectionName: document.getElementById('edit-section-name').value || undefined,
        adviser: document.getElementById('edit-adviser').value || undefined,
        programme: document.getElementById('edit-program').value || undefined,
        status: document.getElementById('edit-status').value || undefined,
        remarks: document.getElementById('edit-remarks').value || undefined
    };

    sectionsRequest(`/api/sections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(data => {
        console.log('[Sections] PUT response:', data);
        if (data.error) {
            showMessage('error', `❌ ${data.error}`);
            return;
        }

        // Check whether returned row shows updated values
        const changed = (
            (payload.sectionName && data.section_name === payload.sectionName) ||
            (payload.grade && String(data.grade) === String(payload.grade)) ||
            (payload.adviser && (data.adviser_name === payload.adviser || data.adviser_id === null)) ||
            (payload.programme && data.programme === payload.programme) ||
            (payload.status && data.status === payload.status) ||
            (payload.remarks && data.remarks === payload.remarks)
        );

        if (!changed) {
            showMessage('warning', '⚠️ Section update returned success but no fields appear changed. Check console for response.');
        } else {
            showMessage('success', '✅ Section updated');
        }

        closeEditModal();
        loadExistingSections();
    })
    .catch(err => {
        console.error('Error updating section:', err);
        showMessage('error', '❌ Error updating section');
    });
}

/**
 * Get the currently active school year from the School Years management
 */
function getActiveSchoolYear() {
    // Fetch active school year from API
    return sectionsRequest('/api/school-years/active')
        .then(data => {
            if (data && data.id) {
                activeSchoolYear = data.id;
                console.log('[Sections] Active school year set to ID:', activeSchoolYear, 'Year:', data.school_year);
                return activeSchoolYear;
            }

            console.warn('[Sections] No active school year found in database');
            activeSchoolYear = null;
            return null;
        })
        .catch(err => {
            console.error('[Sections] Error getting active school year:', err);
            activeSchoolYear = null;
            return null;
        });
}

let sectionsYearRefreshBound = false;
function bindSchoolYearRefreshForSections() {
    if (sectionsYearRefreshBound) return;
    sectionsYearRefreshBound = true;

    const refresh = async () => {
        await getActiveSchoolYear();
        loadExistingSections();
    };

    window.addEventListener('schoolYearActivated', refresh);
    window.addEventListener('dashboard:school-year-changed', refresh);
    window.addEventListener('storage', (event) => {
        if (!event || !event.key) return;
        if (event.key === 'activeSchoolYear' || event.key === 'activeSchoolYearChangedAt') {
            refresh();
        }
    });
}

bindSchoolYearRefreshForSections();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSectionsManagement);
} else {
    initializeSectionsManagement();
}



