// ===== REAL-TIME UPDATE SYSTEM FOR STUDENT DIRECTORY =====
// Listens to dashboard events and updates the UI in real-time

function setupStudentDirectoryRealtimeUpdates() {
    console.log('[Students] Setting up real-time update listeners...');
    if (!window.DashboardEvents || typeof window.DashboardEvents.on !== 'function') 
        return;
}

// Determine the school year id that should be targeted for updates.  The
// modal save logic already stores schoolYearId in updated.enrollment_data,
// but other callers (status toggles) just need the active year.
function resolveSchoolYearForUpdates() {
    let sy = null;
    if (window.activeSchoolYearId) sy = window.activeSchoolYearId;
    else {
        try {
            const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
            if (stored && stored.id) sy = stored.id;
        } catch (_) {}
    }
    return sy;
}
    // Attempt to persist to server
    (async () => {
        try {
            const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
            // Ensure school year ID is included
            let schoolYearId = null;
            if (updated.enrollment_data && updated.enrollment_data.schoolYearId) {
                schoolYearId = updated.enrollment_data.schoolYearId;
            } else if (window.activeSchoolYearId) {
                schoolYearId = window.activeSchoolYearId;
            } else {
                try {
                    const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
                    if (stored && stored.id) schoolYearId = stored.id;
                } catch (_) {}
            }
            if (schoolYearId) {
                updated.schoolYearId = schoolYearId;
                if (!updated.enrollment_data) updated.enrollment_data = {};
                updated.enrollment_data.schoolYearId = schoolYearId;
            }
            // PATCH endpoint now includes schoolYearId as query param
            const endpoint = schoolYearId
                ? `/api/enrollments/by-student/${encodeURIComponent(idKey)}?schoolYearId=${encodeURIComponent(schoolYearId)}`
                : `/api/enrollments/by-student/${encodeURIComponent(idKey)}`;
            const jsonPayload = JSON.stringify(updated, null, 2);
            const resp = await studentsApiFetch(base + endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: jsonPayload
            });
            if (!resp.ok) {
                const errText = await resp.text();
                const msg = `Server ${resp.status} ${resp.statusText}: ${errText}`;
                throw new Error(msg);
            }
            const result = await resp.json();
            // Sync updated enrollments
            try {
                if (result.enrollments && Array.isArray(result.enrollments)) {
                    result.enrollments.forEach(en => { try { addEnrollmentToStore(en); } catch(e){} });
                }
            } catch (e) { /* ignore */ }
            try {
                if (result.enrollments && Array.isArray(result.enrollments) && Array.isArray(window.allEnrollments)) {
                    result.enrollments.forEach(updatedEnroll => {
                        const idx = window.allEnrollments.findIndex(e => e.id === updatedEnroll.id);
                        if (idx !== -1) {
                            window.allEnrollments[idx] = updatedEnroll;
                        }
                    });
                }
            } catch(syncErr) {}
            try {
                if (student) {
                    const keysToMerge = ['firstName','lastName','middleName','birthdate','gender','email','phone','currentAddress'];
                    keysToMerge.forEach(k => {
                        if (updated[k] !== undefined) {
                            student[k] = updated[k];
                        }
                    });
                    if (updated.enrollment_data) {
                        try {
                            let existing = student.enrollment_data;
                            if (typeof existing === 'string') {
                                existing = JSON.parse(existing);
                            }
                            existing = existing || {};
                            Object.assign(existing, updated.enrollment_data);
                            student.enrollment_data = existing;
                        } catch(e) {}
                    }
                }
            } catch(updateErr) {}
            try {
                const notificationPayload = {
                    student_id: student.id,
                    type: 'profile_edited',
                    title: '✏️ Profile Updated',
                    message: 'Your student profile has been updated by the school administrator. Please review your information on the dashboard.',
                    related_data: {
                        updated_fields: Object.keys(updated.enrollment_data || {}),
                        timestamp: new Date().toISOString()
                    }
                };
                const notifUrl = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
                await studentsApiFetch(notifUrl + '/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(notificationPayload)
                });
            } catch(notifErr) { /* ignore */ }
            if (typeof loadStudents === 'function') await loadStudents();
            applyFilters();
            showNotification('Enrollment details updated successfully.', 'success');
        } catch (err) {
            showNotification('Failed to update enrollment: ' + err.message, 'error');
        }
    })();
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

// helper that returns a fresh deep copy of any available electives
function getModalElectives() {
    // Always start with window.ELECTIVES since it has the canonical category structure.
    const result = { academic: {}, techpro: {} };

    if (window.ELECTIVES && typeof window.ELECTIVES === 'object') {
        if (window.ELECTIVES.academic && typeof window.ELECTIVES.academic === 'object') {
            result.academic = JSON.parse(JSON.stringify(window.ELECTIVES.academic));
        }
        if (window.ELECTIVES.techpro && typeof window.ELECTIVES.techpro === 'object') {
            result.techpro = JSON.parse(JSON.stringify(window.ELECTIVES.techpro));
        }
    }

    // Merge in any values from window.electivesMap (may be arrays or objects, keys
    // might use different casing). Map entries should *override* default electivesMap
    // only if they provide data; otherwise original categories are preserved.
    const map = (window.electivesMap && typeof window.electivesMap === 'object') ? window.electivesMap : {};
    const getMapData = (name) => {
        let data = map[name] || map[name.toLowerCase()] || map[name.charAt(0).toLowerCase() + name.slice(1)];
        if (Array.isArray(data)) {
            // if we have a flat array but also the canonical window.ELECTIVES, try to
            // restore original category grouping so the modal presents items by
            // category instead of lumping everything under "All".
            if (window.ELECTIVES && window.ELECTIVES[name.toLowerCase()]) {
                const categories = window.ELECTIVES[name.toLowerCase()];
                const rebuilt = {};
                Object.keys(categories).forEach(cat => {
                    const matches = categories[cat].filter(item => data.includes(item));
                    if (matches.length) rebuilt[cat] = matches;
                });
                // if nothing matched (unlikely), fall back to full categories
                if (Object.keys(rebuilt).length) return rebuilt;
                return JSON.parse(JSON.stringify(categories));
            }
            // fallback: convert flat list into single category
            return { 'All': [...data] };
        }
        if (data && typeof data === 'object') {
            return { ...data };
        }
        return null;
    };

    const acadMap = getMapData('Academic');
    const techMap = getMapData('TechPro');
    if (acadMap) result.academic = acadMap;
    if (techMap) result.techpro = techMap;

    return {
        academic: JSON.parse(JSON.stringify(result.academic || {})),
        techpro: JSON.parse(JSON.stringify(result.techpro || {}))
    };
}

const SHARED_ADDRESS_DATA = (window.ADDRESS_DATA && typeof window.ADDRESS_DATA === 'object' && Object.keys(window.ADDRESS_DATA).length > 0)
    ? window.ADDRESS_DATA
    : {
        "Philippines": {
            "Davao de Oro": {
                "Compostela": ["Aurora", "Bagongon", "Gabi", "Lagab", "Mangayon", "Mapaca", "Maparat", "New Alegria", "Ngan", "Osmeña", "Panansalan", "Poblacion", "San Jose", "San Miguel", "Siocon", "Tamia"],
                "Laak": [],
                "Mabini": [],
                "Maco": [],
                "Maragusan": [],
                "Mawab": [],
                "Monkayo": [],
                "Montevista": [],
                "Nabunturan": [],
                "New Bataan": [],
                "Pantukan": []
            }
        },
        "United States": {
            "California": {
                "Los Angeles": ["Los Angeles", "Santa Monica", "Long Beach"],
                "San Francisco": ["San Francisco", "Oakland", "Berkeley"],
                "San Diego": ["San Diego", "La Jolla", "Ocean Beach"]
            },
            "New York": {
                "New York City": ["Manhattan", "Brooklyn", "Queens"],
                "Buffalo": ["Buffalo", "Cheektowaga"]
            },
            "Texas": {
                "Houston": ["Houston", "Spring"],
                "Dallas": ["Dallas", "Arlington"]
            }
        },
        "Canada": {
            "Ontario": {
                "Toronto": ["Toronto", "Mississauga"],
                "Ottawa": ["Ottawa", "Gatineau"]
            },
            "British Columbia": {
                "Vancouver": ["Vancouver", "Burnaby"],
                "Victoria": ["Victoria", "Sidney"]
            }
        }
    };

if (!window.PHILIPPINES_ADDRESSES || typeof window.PHILIPPINES_ADDRESSES !== 'object' || Object.keys(window.PHILIPPINES_ADDRESSES).length === 0) {
    window.PHILIPPINES_ADDRESSES = SHARED_ADDRESS_DATA;
}


// Setup academic tab conditional logic and electives
function setupAcademicTab(container) {
    console.log('[Students] setupAcademicTab called, container:', container);
    const gradeLevelSelect = container.querySelector('#academicGradeLevel');
    console.log('[Students] gradeLevelSelect found?', !!gradeLevelSelect);
    const seniorFields = container.querySelector('#seniorHighFields');
    const semesterSelect = container.querySelector('#academicSemester');
    const trackSelect = container.querySelector('#academicTrack');
    const electiveSelection = container.querySelector('#academicElectiveSelection');
    const electivesList = container.querySelector('#academicElectivesList');

    if (!gradeLevelSelect) return;

    // helpers for limits inside modal (names must match the checkbox name attributes below)
    const enforceAcademicLimit = () => {
        const boxes = Array.from(container.querySelectorAll('input[name="academicElectives"]'));
        const checked = boxes.filter(b => b.checked).length;
        boxes.forEach(b => { if (!b.checked) b.disabled = checked >= 2; });
    };
    const enforceTechProLimit = () => {
        const boxes = Array.from(container.querySelectorAll('input[name="techproElectives"]'));
        const checked = boxes.filter(b => b.checked).length;
        boxes.forEach(b => { if (!b.checked) b.disabled = checked >= 1; });
    };
    const enforceDoorwayLimits = () => {
        const acadBoxes = Array.from(container.querySelectorAll('input[name="doorwayAcademic"]'));
        const techBoxes = Array.from(container.querySelectorAll('input[name="doorwayTechPro"]'));
        const acadChecked = acadBoxes.filter(b => b.checked).length;
        const techChecked = techBoxes.filter(b => b.checked).length;
        acadBoxes.forEach(b => { if (!b.checked) b.disabled = acadChecked >= 1; });
        techBoxes.forEach(b => { if (!b.checked) b.disabled = techChecked >= 1; });
    };

    const renderModalElectives = () => {
        if (!electivesList) return;

        // compute grade and track, with extensive logging for debugging
        const rawGrade = String(gradeLevelSelect.value || '').trim();
        const grade = rawGrade.replace(/grade\s*/i, ''); // normalize to number

        // determine track in a predictable way using the select's value first
        let track = '';
        if (trackSelect) {
            track = String(trackSelect.value || '').trim();
            if (!track) {
                const idx = trackSelect.selectedIndex;
                if (idx >= 0 && trackSelect.options[idx]) {
                    track = String(trackSelect.options[idx].text || '').trim();
                }
            }
            track = track.toLowerCase();
            if (track.includes('academic')) track = 'academic';
            else if (track.includes('techpro') || track.includes('tech-pro')) track = 'techpro';
            else if (track.includes('doorway')) track = 'doorway';
        }

        console.log('[Students] renderModalElectives called', { rawGrade, grade, trackSelectValue: trackSelect ? trackSelect.value : null, computedTrack: track });
        // debug current map shape
        const debugMap = getModalElectives();
        console.log('[Students] elective map preview', {
            academicKeys: Object.keys(debugMap.academic),
            techproKeys: Object.keys(debugMap.techpro)
        });

        // only show electives for senior high students
        if (!(grade === '11' || grade === '12')) {
            electiveSelection && electiveSelection.classList.add('hidden');
            electivesList.innerHTML = '';
            if (trackSelect) trackSelect.dataset.selectedElectives = '[]';
            return;
        }
        electiveSelection && electiveSelection.classList.remove('hidden');

        if (!track) {
            electivesList.innerHTML = '<p class="form-subtitle">Please select a track to view electives</p>';
            if (trackSelect) trackSelect.dataset.selectedElectives = '[]';
            return;
        }

        // refresh elective data every time in case the global map was populated later
        let modalData = getModalElectives();
        // if the categories are empty, fallback to the canonical window.ELECTIVES
        if ((!modalData.academic || Object.keys(modalData.academic).length === 0) && window.ELECTIVES && window.ELECTIVES.academic) {
            console.log('[Students] falling back to window.ELECTIVES.academic');
            modalData.academic = JSON.parse(JSON.stringify(window.ELECTIVES.academic));
        }
        if ((!modalData.techpro || Object.keys(modalData.techpro).length === 0) && window.ELECTIVES && window.ELECTIVES.techpro) {
            console.log('[Students] falling back to window.ELECTIVES.techpro');
            modalData.techpro = JSON.parse(JSON.stringify(window.ELECTIVES.techpro));
        }
        if (track === 'academic' && Object.keys(modalData.academic).length === 0) {
            console.warn('[Students] No academic electives available in window.electivesMap or window.ELECTIVES');
        }
        if (track === 'techpro' && Object.keys(modalData.techpro).length === 0) {
            console.warn('[Students] No techpro electives available in window.electivesMap or window.ELECTIVES');
        }

        // build the markup based on latest data
        let html = '<p class="form-subtitle">';
        if (track === 'academic') html += 'Select up to 2 academic electives';
        else if (track === 'techpro') html += 'Select 1 Tech-Pro elective';
        else html += 'Select at least 1 elective each category';
        html += '</p>';

        const makeCheckbox = (value, name) =>
            `<label class="checkbox-label"><input type="checkbox" class="elective-checkbox" name="${name}" value="${value}"> <span>${value}</span></label>`;

        // render categories for the selected track(s)
        if ((track === 'academic' || track === 'doorway') && Object.keys(modalData.academic).length === 0) {
            html += '<p class="form-subtitle" style="color:#c00;">(no academic electives are configured)</p>';
        } else if (track === 'academic' || track === 'doorway') {
            Object.keys(modalData.academic).forEach(cat => {
                const name = track === 'academic' ? 'academicElectives' : 'doorwayAcademic';
                html += `\n<div class="elective-category" data-track="academic">` +
                        `<strong>${cat}</strong>` +
                        `<div class="elective-items">` +
                        modalData.academic[cat].map(v => makeCheckbox(v, name)).join('') +
                        `</div></div>`;
            });
        }
        if ((track === 'techpro' || track === 'doorway') && Object.keys(modalData.techpro).length === 0) {
            if (track === 'doorway') html += '<div style="margin-top:10px;"><em>Tech-Pro</em></div>';
            html += '<p class="form-subtitle" style="color:#c00;">(no Tech-Pro electives are configured)</p>';
        } else if (track === 'techpro' || track === 'doorway') {
            if (track === 'doorway') html += '<div style="margin-top:10px;"><em>Tech-Pro</em></div>';
            Object.keys(modalData.techpro).forEach(cat => {
                const name = track === 'techpro' ? 'techproElectives' : 'doorwayTechPro';
                html += `\n<div class="elective-category" data-track="techpro">` +
                        `<strong>${cat}</strong>` +
                        `<div class="elective-items">` +
                        modalData.techpro[cat].map(v => makeCheckbox(v, name)).join('') +
                        `</div></div>`;
            });
        }

        electivesList.innerHTML = html;
        // pre-check any existing electives saved in dataset
        try {
            const modalEl = document.getElementById('enrollmentDetailModal');
            if (modalEl && modalEl.dataset && modalEl.dataset.existingElectives) {
                const existing = JSON.parse(modalEl.dataset.existingElectives || '[]');
                if (Array.isArray(existing) && existing.length) {
                    electivesList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        if (existing.includes(cb.value)) cb.checked = true;
                    });
                }
            }
        } catch (e) { console.warn('Error pre-checking electives', e); }

        // store the currently-rendered (and possibly pre-checked) electives so that save logic can
        // fall back when this component is replaced later or if checkboxes disappear
        if (trackSelect) {
            const selected = Array.from(electivesList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            trackSelect.dataset.selectedElectives = JSON.stringify(selected);
        }

        // attach change listeners for enforcing limits
        electivesList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (track === 'academic') enforceAcademicLimit();
                if (track === 'techpro') enforceTechProLimit();
                if (track === 'doorway') enforceDoorwayLimits();
                if (trackSelect) {
                    const sel = Array.from(electivesList.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
                    trackSelect.dataset.selectedElectives = JSON.stringify(sel);
                }
            });
        });
        if (track === 'academic') enforceAcademicLimit();
        if (track === 'techpro') enforceTechProLimit();
        if (track === 'doorway') enforceDoorwayLimits();

        setTimeout(() => { electiveSelection && electiveSelection.scrollIntoView({ block:'start' }); }, 20);
    };

    const handleGradeChange = () => {
        // normalize the selected grade much like renderModalElectives does so we
        // don't miss values such as "Grade 11" that might somehow get written
        // into the select element by other parts of the code.
        let raw = String(gradeLevelSelect.value || '').trim();
        raw = raw.replace(/grade\s*/i, ''); // strip word "Grade" if present
        const grade = raw;

        const isSenior = (grade === '11' || grade === '12');
        if (isSenior) {
            seniorFields && seniorFields.classList.remove('hidden');
        } else {
            seniorFields && seniorFields.classList.add('hidden');
            electiveSelection && electiveSelection.classList.add('hidden');
        }
        renderModalElectives();
    };

    // wire up listeners and also use event delegation in case the select element is ever replaced
    gradeLevelSelect.addEventListener('change', handleGradeChange);
    if (trackSelect) {
        console.log('[Students] setupAcademicTab: adding listeners to trackSelect');
        trackSelect.addEventListener('change', renderModalElectives);
        trackSelect.addEventListener('input', renderModalElectives);
        trackSelect.addEventListener('click', renderModalElectives);
    }
    if (semesterSelect) semesterSelect.addEventListener('change', renderModalElectives);

    // container-level delegation catches replacement elements too
    container.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'academicTrack') {
            console.log('[Students] delegated track change', e.target.value);
            renderModalElectives();
        }
        if (e.target && e.target.id === 'academicGradeLevel') {
            handleGradeChange();
        }
    });

    // initialize visibility based on prefilled values
    handleGradeChange();

    // if window.electivesMap is populated asynchronously (another script may load it later)
    // render again after a short delay so checkboxes appear even when data arrives late
    setTimeout(() => {
        console.log('[Students] deferred render of electives');
        renderModalElectives();
    }, 800);
}

function resolveSchoolCodeForStudents() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = String(params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
        if (fromQuery) return fromQuery;
    } catch (_e) { }
    return String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
}

async function studentsApiFetch(pathOrUrl, options = {}) {
    const schoolCode = resolveSchoolCodeForStudents();
    const url = new URL(pathOrUrl, window.location.origin);
    if (schoolCode) {
        url.searchParams.set('school', schoolCode);
    }

    const mergedHeaders = {
        ...(options.headers || {}),
        ...(schoolCode ? { 'x-tenant-code': schoolCode } : {})
    };

    return fetch(url.toString(), {
        credentials: 'include',
        ...options,
        headers: mergedHeaders
    });
}

function ensureStudentsConfirmModal() {
    let modal = document.getElementById('studentsConfirmModal');
    if (modal) return modal;

    if (!document.getElementById('studentsConfirmModalStyle')) {
        const style = document.createElement('style');
        style.id = 'studentsConfirmModalStyle';
        style.textContent = `
            #studentsConfirmModal {
                position: fixed;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                background: var(--modal-backdrop);
                z-index: 10080;
                padding: 20px;
            }
            #studentsConfirmModal.active {
                display: flex;
            }
            #studentsConfirmModal .students-confirm-card {
                width: min(520px, 96vw);
                background: var(--modal-bg);
                color: var(--text-primary);
                border: 1px solid var(--border-primary);
                border-radius: 14px;
                box-shadow: var(--card-shadow);
                overflow: hidden;
            }
            #studentsConfirmModal .students-confirm-header {
                padding: 16px 18px;
                border-bottom: 1px solid var(--border-primary);
                font-size: 18px;
                font-weight: 700;
            }
            #studentsConfirmModal .students-confirm-body {
                padding: 16px 18px;
                color: var(--text-secondary);
                line-height: 1.5;
                word-break: break-word;
            }
            #studentsConfirmModal .students-confirm-actions {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 14px 18px;
                border-top: 1px solid var(--border-primary);
                background: var(--bg-secondary);
            }
            #studentsConfirmModal .students-confirm-actions .btn {
                min-width: 110px;
            }
        `;
        document.head.appendChild(style);
    }

    modal = document.createElement('div');
    modal.id = 'studentsConfirmModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
        <div class="students-confirm-card" role="dialog" aria-modal="true" aria-labelledby="studentsConfirmTitle">
            <div id="studentsConfirmTitle" class="students-confirm-header">Confirm Action</div>
            <div id="studentsConfirmMessage" class="students-confirm-body"></div>
            <div class="students-confirm-actions">
                <button type="button" id="studentsConfirmCancel" class="btn btn-secondary">Cancel</button>
                <button type="button" id="studentsConfirmOk" class="btn btn-primary">Confirm</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    return modal;
}

function showStudentsConfirmDialog(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
        const modal = ensureStudentsConfirmModal();
        const titleEl = document.getElementById('studentsConfirmTitle');
        const messageEl = document.getElementById('studentsConfirmMessage');
        const cancelBtn = document.getElementById('studentsConfirmCancel');
        const okBtn = document.getElementById('studentsConfirmOk');

        if (!modal || !titleEl || !messageEl || !cancelBtn || !okBtn) {
            resolve(false);
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;

        const cleanup = () => {
            modal.classList.remove('active');
            modal.style.pointerEvents = 'none';
            modal.setAttribute('aria-hidden', 'true');
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            modal.removeEventListener('click', onBackdropClick);
            document.removeEventListener('keydown', onKeyDown);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onOk = () => {
            cleanup();
            resolve(true);
        };

        const onBackdropClick = (event) => {
            if (event.target === modal) {
                onCancel();
            }
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onCancel();
            }
        };

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
        modal.addEventListener('click', onBackdropClick);
        document.addEventListener('keydown', onKeyDown);

        modal.classList.add('active');
        modal.style.pointerEvents = 'auto';
        modal.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            okBtn.focus();
        }, 0);
    });
}

const ARCHIVED_STUDENTS_KEY_BASE = 'sms.archivedStudents.v1';

function archivedStudentsStorageKey() {
    const schoolCode = resolveSchoolCodeForStudents();
    return schoolCode ? `${ARCHIVED_STUDENTS_KEY_BASE}:${schoolCode}` : ARCHIVED_STUDENTS_KEY_BASE;
}

function readArchivedStudentsStore() {
    try {
        const raw = localStorage.getItem(archivedStudentsStorageKey());
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function notifyArchivedStudentsUpdated() {
    try {
        const detail = { count: readArchivedStudentsStore().length };
        window.dispatchEvent(new CustomEvent('sms:archived-students-updated', { detail }));
    } catch (_) {}
}

function writeArchivedStudentsStore(records) {
    const normalized = Array.isArray(records) ? records : [];
    localStorage.setItem(archivedStudentsStorageKey(), JSON.stringify(normalized));
    notifyArchivedStudentsUpdated();
}

function normalizeStudentIdentifiers(student) {
    const ids = [
        student && student.id,
        student && student.lrn,
        student && student.student_id,
        student && student.studentId
    ]
        .map((value) => String(value || '').trim())
        .filter((value) => value.length > 0);

    return Array.from(new Set(ids));
}

function buildArchivedStudentRecord(student) {
    const identifiers = normalizeStudentIdentifiers(student);
    const archiveId = identifiers[0] || String(Date.now());
    return {
        archiveId,
        identifiers,
        id: String(student && student.id || ''),
        lrn: String(student && student.lrn || ''),
        fullName: String(student && student.fullName || 'Unknown Student'),
        grade: String(student && student.grade || '--'),
        track: String(student && student.track || '--'),
        status: String(student && student.status || '--'),
        archivedAt: new Date().toISOString()
    };
}

function isArchivedMatch(student, archivedRecord) {
    const studentIds = normalizeStudentIdentifiers(student);
    const archivedIds = Array.isArray(archivedRecord?.identifiers)
        ? archivedRecord.identifiers.map((value) => String(value || '').trim()).filter(Boolean)
        : [String(archivedRecord?.archiveId || '').trim(), String(archivedRecord?.id || '').trim(), String(archivedRecord?.lrn || '').trim()].filter(Boolean);

    return studentIds.some((value) => archivedIds.includes(value));
}

function filterArchivedStudents(students) {
    const archived = readArchivedStudentsStore();
    if (!archived.length) return students;
    return (Array.isArray(students) ? students : []).filter((student) => !archived.some((record) => isArchivedMatch(student, record)));
}

function getArchivedStudentsForSettings() {
    return readArchivedStudentsStore()
        .slice()
        .sort((a, b) => new Date(b.archivedAt || 0).getTime() - new Date(a.archivedAt || 0).getTime());
}

async function restoreArchivedStudent(identifier) {
    const key = String(identifier || '').trim();
    if (!key) return false;

    const archived = readArchivedStudentsStore();
    const next = archived.filter((record) => {
        const recordIds = Array.isArray(record?.identifiers)
            ? record.identifiers.map((value) => String(value || '').trim())
            : [];
        return String(record?.archiveId || '').trim() !== key && !recordIds.includes(key);
    });

    if (next.length === archived.length) return false;

    writeArchivedStudentsStore(next);
    await loadStudents();
    applyFilters();
    showNotification('Student restored to active list', 'success');
    return true;
}

window.__getArchivedStudentsForDirectory = getArchivedStudentsForSettings;
window.__restoreArchivedStudentFromDirectory = restoreArchivedStudent;
window.__restoreAllArchivedStudentsFromDirectory = async function () {
    writeArchivedStudentsStore([]);
    await loadStudents();
    applyFilters();
    showNotification('All archived students restored', 'success');
    return true;
};

// Helper: send updated document to server (best-effort)
async function sendDocumentUpdate(studentId, key, dataUrl) {
    if (!studentId) throw new Error('No student id');
    const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
    try {
        const resp = await studentsApiFetch(base + `/api/students/${encodeURIComponent(studentId)}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, dataUrl })
        });
        if (!resp.ok) throw new Error('Server returned ' + resp.status);
        return await resp.json();
    } catch (err) {
        // bubble up for caller to handle fallback
        throw err;
    }
}

// Helper: request server to remove a document (best-effort)
async function sendDocumentRemove(studentId, key) {
    if (!studentId) throw new Error('No student id');
    const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
    try {
        const resp = await studentsApiFetch(base + `/api/students/${encodeURIComponent(studentId)}/documents/${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });
        if (!resp.ok) throw new Error('Server returned ' + resp.status);
        return await resp.json();
    } catch (err) {
        throw err;
    }
}

// Helper to escape HTML special characters for safety
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup inline editing for profile fields
function setupInlineEditing(container) {
    // Helper function to format field values
    const formatValue = (val) => {
        if (!val || val === undefined || val === null || val === '') return '--';
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
    };
    
    // ===== RETURNING LEARNER CONDITIONAL FIELDS =====
    const returningLearnerFields = container.querySelector('#returningLearnerFields');
    const returningLearnerInputs = Array.from(container.querySelectorAll('input[name="returningLearner"], select#academicReturningLearner'));

    if (returningLearnerFields && returningLearnerInputs.length) {
        const toggleReturningLearnerFields = () => {
            const yesRadio = container.querySelector('input[name="returningLearner"][value="yes"]:checked');
            const select = container.querySelector('#academicReturningLearner');
            const isYes = yesRadio || (select && select.value === 'yes');
            returningLearnerFields.style.display = isYes ? 'block' : 'none';
        };

        returningLearnerInputs.forEach(el => el.addEventListener('change', toggleReturningLearnerFields));
        toggleReturningLearnerFields();
    }
    
    // ===== ADDRESS CASCADING DROPDOWNS =====
    const getCountries = () => Object.keys(window.PHILIPPINES_ADDRESSES || {});
    const getProvinces = (country) => Object.keys(window.PHILIPPINES_ADDRESSES?.[country] || {});
    const getMunicipalities = (country, province) => Object.keys(window.PHILIPPINES_ADDRESSES?.[country]?.[province] || {});
    const getBarangays = (country, province, municipality) => window.PHILIPPINES_ADDRESSES?.[country]?.[province]?.[municipality] || [];
    
    // Current Address cascading
    const currentCountrySelect = container.querySelector('#currentCountry');
    const currentProvinceSelect = container.querySelector('#currentProvince');
    const currentMunicipalitySelect = container.querySelector('#currentMunicipality');
    const currentBarangaySelect = container.querySelector('#currentBarangay');
    
    // Permanent Address cascading
    const permCountrySelect = container.querySelector('#permanentCountry');
    const permProvinceSelect = container.querySelector('#permanentProvince');
    const permMunicipalitySelect = container.querySelector('#permanentMunicipality');
    const permBarangaySelect = container.querySelector('#permanentBarangay');
    
    // Same as Current Address checkbox
    const sameAsCheckbox = container.querySelector('#sameAsCurrentAddress');
    
    if (sameAsCheckbox) {
        sameAsCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Copy current address to permanent address
                const currentSitio = container.querySelector('#currentSitio')?.value;
                const currentCountry = container.querySelector('#currentCountry')?.value;
                const currentProvince = container.querySelector('#currentProvince')?.value;
                const currentMun = container.querySelector('#currentMunicipality')?.value;
                const currentBarangay = container.querySelector('#currentBarangay')?.value;
                const currentZip = container.querySelector('#currentZipCode')?.value;
                
                // Set permanent address fields
                const permSitio = container.querySelector('#permanentSitio');
                if (permSitio) permSitio.value = currentSitio || '';
                
                if (permCountrySelect) {
                    permCountrySelect.value = currentCountry || '';
                    // Trigger change to update provinces
                    permCountrySelect.dispatchEvent(new Event('change'));
                }
                
                if (permProvinceSelect) {
                    setTimeout(() => {
                        permProvinceSelect.value = currentProvince || '';
                        permProvinceSelect.dispatchEvent(new Event('change'));
                    }, 100);
                }
                
                if (permMunicipalitySelect) {
                    setTimeout(() => {
                        permMunicipalitySelect.value = currentMun || '';
                        permMunicipalitySelect.dispatchEvent(new Event('change'));
                    }, 200);
                }
                
                if (permBarangaySelect) {
                    setTimeout(() => {
                        permBarangaySelect.value = currentBarangay || '';
                    }, 300);
                }
                
                const permZip = container.querySelector('#permanentZipCode');
                if (permZip) permZip.value = currentZip || '';
            }
        });
    }
    
    const setSelectOptions = (selectEl, options, preferredValue = '', placeholder = 'Select') => {
        if (!selectEl) return;
        const existingValue = String(selectEl.value || '').trim();
        const preferred = String(preferredValue || '').trim() || existingValue;

        let list = Array.isArray(options) ? [...options] : [];
        if (preferred && !list.some(opt => String(opt).trim() === preferred)) {
            list.unshift(preferred);
        }

        if (list.length === 0) {
            selectEl.innerHTML = `<option value="">${placeholder}</option>`;
            selectEl.value = '';
            return;
        }

        selectEl.innerHTML = list.map(opt => `<option value="${opt}">${opt}</option>`).join('');
        selectEl.value = preferred && list.some(opt => String(opt).trim() === preferred)
            ? preferred
            : String(list[0] || '');
    };

    // Function to update cascading dropdowns
    const updateCascadingDropdowns = (countrySelect, provinceSelect, municipalitySelect, barangaySelect) => {
        if (!countrySelect || !provinceSelect || !municipalitySelect || !barangaySelect) return;

        // Ensure Country has at least one option
        if (!countrySelect.options || countrySelect.options.length === 0) {
            setSelectOptions(countrySelect, ['Philippines'], 'Philippines', 'Select Country');
        }
        
        // Country change
        countrySelect.addEventListener('change', (e) => {
            const country = e.target.value;
            const provinces = getProvinces(country);
            
            // Update provinces
            setSelectOptions(provinceSelect, provinces, provinceSelect.value, 'Select Province');
            
            // Trigger province change to update municipalities
            provinceSelect.dispatchEvent(new Event('change'));
        });
        
        // Province change
        provinceSelect.addEventListener('change', (e) => {
            const country = countrySelect.value;
            const province = e.target.value;
            const municipalities = getMunicipalities(country, province);
            
            // Update municipalities
            setSelectOptions(municipalitySelect, municipalities, municipalitySelect.value, 'Select Municipality/City');
            
            // Trigger municipality change to update barangays
            municipalitySelect.dispatchEvent(new Event('change'));
        });
        
        // Municipality change
        municipalitySelect.addEventListener('change', (e) => {
            const country = countrySelect.value;
            const province = provinceSelect.value;
            const municipality = e.target.value;
            const barangays = getBarangays(country, province, municipality);
            
            // Update barangays
            setSelectOptions(barangaySelect, barangays, barangaySelect.value, 'Select Barangay');
        });

        // Initialize chain once to enforce non-empty visible dropdowns
        countrySelect.dispatchEvent(new Event('change'));
    };
    
    // Setup cascading for current address
    updateCascadingDropdowns(currentCountrySelect, currentProvinceSelect, currentMunicipalitySelect, currentBarangaySelect);
    
    // Setup cascading for permanent address
    updateCascadingDropdowns(permCountrySelect, permProvinceSelect, permMunicipalitySelect, permBarangaySelect);
    
    // Handle inline editing for editable text fields
    const editableFields = container.querySelectorAll('.editable-field');
    editableFields.forEach(fieldRow => {
        const valueSpan = fieldRow.querySelector('.profile-field-value');
        const input = fieldRow.querySelector('.profile-field-input');
        const fieldName = fieldRow.dataset.field;
        
        if (!valueSpan || !input) return;
        
        // Double-click to edit
        valueSpan.addEventListener('dblclick', () => {
            valueSpan.classList.add('hidden');
            input.classList.remove('hidden');
            input.focus();
            input.select();
        });
        
        // Save on blur (click outside)
        const saveEdit = () => {
            const newValue = input.value.trim();
            const oldValue = valueSpan.dataset.value;
            
            if (newValue !== oldValue) {
                valueSpan.textContent = newValue || '--';
                valueSpan.dataset.value = newValue;
                // Store the updated value for later use
                fieldRow.dataset.edited = 'true';
                fieldRow.dataset.newValue = newValue;
                console.log('[Students] Field edited:', fieldName, '=', newValue);
            }
            
            valueSpan.classList.remove('hidden');
            input.classList.add('hidden');
        };
        
        // Save on blur
        input.addEventListener('blur', saveEdit);
        
        // Save on Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            }
        });
        
        // Cancel on Escape key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.value = valueSpan.dataset.value;
                valueSpan.classList.remove('hidden');
                input.classList.add('hidden');
            }
        });
    });
    
    // Handle date picker for Birth Date
    const dateInput = container.querySelector('input[data-field="birthdate"]');
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            const selectedDate = dateInput.value;
            if (selectedDate) {
                // Calculate age
                const birth = new Date(selectedDate);
                const today = new Date();
                let age = today.getFullYear() - birth.getFullYear();
                const monthDiff = today.getMonth() - birth.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                    age--;
                }
                age = age >= 0 ? age : '--';
                
                // Update age display
                const ageDisplay = container.querySelector('#ageDisplay');
                if (ageDisplay) {
                    ageDisplay.textContent = age;
                }
                
                console.log('[Students] Birth Date changed to:', selectedDate, ', Age:', age);
            }
        });
    }
    
    // Handle Mother Tongue dropdown with conditional field
    const motherTongueSelect = container.querySelector('#motherTongueSelect');
    const motherTongueOtherField = container.querySelector('#motherTongueOtherField');
    
    if (motherTongueSelect && motherTongueOtherField) {
        motherTongueSelect.addEventListener('change', () => {
            if (motherTongueSelect.value === 'other') {
                motherTongueOtherField.classList.remove('hidden');
            } else {
                motherTongueOtherField.classList.add('hidden');
            }
            console.log('[Students] Mother Tongue changed to:', motherTongueSelect.value);
        });
    }
}

let allStudents = [];
let filteredStudents = [];
let currentPage = 1;
let currentProfileStudentId = null;
const pageSize = 15;
const ADMIN_EDITED_ELECTIVES_STORAGE_KEY = 'adminEditedElectivesByStudent';

function normalizeElectiveValues(values) {
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values
        .map(v => (v === undefined || v === null ? '' : String(v).trim()))
        .filter(Boolean)));
}

function readAdminEditedElectivesStore() {
    try {
        const raw = localStorage.getItem(ADMIN_EDITED_ELECTIVES_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        return {};
    }
}

function writeAdminEditedElectivesStore(store) {
    try {
        localStorage.setItem(ADMIN_EDITED_ELECTIVES_STORAGE_KEY, JSON.stringify(store || {}));
    } catch (_) { /* ignore storage errors */ }
}

function getAdminEditedElectivesOverride(...keys) {
    const store = readAdminEditedElectivesStore();
    for (const key of keys) {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) continue;
        if (Object.prototype.hasOwnProperty.call(store, normalizedKey)) {
            return {
                hasOverride: true,
                electives: normalizeElectiveValues(store[normalizedKey])
            };
        }
    }
    return { hasOverride: false, electives: [] };
}

function setAdminEditedElectivesOverride(keys, electives) {
    const normalizedElectives = normalizeElectiveValues(electives);
    const store = readAdminEditedElectivesStore();
    (Array.isArray(keys) ? keys : [keys]).forEach(key => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey) return;
        store[normalizedKey] = normalizedElectives;
    });
    writeAdminEditedElectivesStore(store);
}

async function loadStudents() {
    try {
        console.log('Dir: Starting student load...');
        let enrollments = null;
        const schoolCode = String(resolveSchoolCodeForStudents() || '').trim().toLowerCase();
        const activeYearId = Number(
            window.activeSchoolYearId
            || (() => {
                try {
                    const stored = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
                    return stored && stored.id ? Number(stored.id) : 0;
                } catch (_e) {
                    return 0;
                }
            })()
        ) || 0;
        const scopedEnrollmentsKey = schoolCode
            ? `enrollments:${schoolCode}:sy:${activeYearId || 'active'}`
            : `enrollments:sy:${activeYearId || 'active'}`;

        // Try 1: Fetch from API (source of truth)
        if (!enrollments) {
            console.log('Dir: Attempting API fetch from /api/enrollments...');
            try {
                const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
                const endpointCandidates = [
                    '/api/enrollments?view=dashboard&sort=recent',
                    '/api/enrollments?sort=recent',
                    '/api/enrollments'
                ];

                for (const endpoint of endpointCandidates) {
                    const res = await studentsApiFetch(base + endpoint);
                    console.log('Dir: API response status =', res.status, 'for', endpoint);
                    if (!res.ok) continue;

                    const payload = await res.json().catch(() => []);
                    if (Array.isArray(payload)) {
                        enrollments = payload;
                    } else if (payload && Array.isArray(payload.enrollments)) {
                        enrollments = payload.enrollments;
                    }

                    if (Array.isArray(enrollments)) {
                        console.log('Dir: API returned', enrollments.length, 'enrollments from', endpoint);
                        break;
                    }
                }

                if (!Array.isArray(enrollments)) {
                    console.warn('Dir: API fetch variants failed - will try localStorage fallback');
                }
            } catch (apiErr) {
                console.error('Dir: API fetch failed -', apiErr.message);
            }
        }

        if (Array.isArray(enrollments)) {
            if (typeof window.filterEnrollmentsByActiveSchoolYear === 'function') {
                enrollments = window.filterEnrollmentsByActiveSchoolYear(enrollments);
            }
        }

        // Keep caches in sync when API succeeds
        if (Array.isArray(enrollments)) {
            try { window.allEnrollments = enrollments; } catch (_) { }
            try { window.__allEnrollmentsSchoolCode = schoolCode; } catch (_) { }
            try { window.enrollmentDataStore = enrollments; } catch (_) { }
            try { window.__enrollmentDataStoreSchoolCode = schoolCode; } catch (_) { }
            try { localStorage.setItem(scopedEnrollmentsKey, JSON.stringify(enrollments)); } catch (_) { }
        }

        // Try 2: allEnrollments fallback (loaded by main dashboard)
        if (
            !enrollments
            && Array.isArray(window.allEnrollments)
            && window.allEnrollments.length
            && String(window.__allEnrollmentsSchoolCode || '').trim().toLowerCase() === schoolCode
        ) {
            enrollments = window.allEnrollments;
            console.log('Dir: Using allEnrollments fallback =', enrollments.length);
            if (typeof window.filterEnrollmentsByActiveSchoolYear === 'function') {
                enrollments = window.filterEnrollmentsByActiveSchoolYear(enrollments);
            }
        }

        // Try 3: enrollmentDataStore fallback
        if (
            !enrollments
            && Array.isArray(window.enrollmentDataStore)
            && window.enrollmentDataStore.length
            && String(window.__enrollmentDataStoreSchoolCode || '').trim().toLowerCase() === schoolCode
        ) {
            enrollments = window.enrollmentDataStore;
            console.log('Dir: Using enrollmentDataStore fallback =', enrollments.length);
            if (typeof window.filterEnrollmentsByActiveSchoolYear === 'function') {
                enrollments = window.filterEnrollmentsByActiveSchoolYear(enrollments);
            }
        }
        
        // Try 4: school-scoped localStorage fallback
        if (!enrollments) {
            console.log('Dir: Trying localStorage fallback...');
            try {
                const stored = localStorage.getItem(scopedEnrollmentsKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    enrollments = Array.isArray(parsed) ? parsed : (parsed.enrollments || []);
                    console.log('Dir: school-scoped localStorage found', enrollments.length, 'enrollments');
                    if (typeof window.filterEnrollmentsByActiveSchoolYear === 'function') {
                        enrollments = window.filterEnrollmentsByActiveSchoolYear(enrollments);
                    }
                }
            } catch (e) {
                console.warn('Dir: localStorage read failed -', e.message);
            }
        }

        console.log('Dir: Total enrollments to process =', enrollments?.length || 0);
        
        if (!enrollments || enrollments.length === 0) {
            console.warn('Dir: NO ENROLLMENTS FOUND in any data source');
            showNotification('⚠️ No enrollments found. Ensure backend is running or students have submitted enrollments.', 'warning');
            allStudents = [];
        } else {
            allStudents = buildStudentList(enrollments || []);
            allStudents = filterArchivedStudents(allStudents);
            console.log('Dir: Successfully mapped', allStudents.length, 'students');
        }
        
        filteredStudents = [...allStudents];
        currentPage = 1;
        renderStudentTable();
    } catch (err) {
        console.error('Student Directory: load failed -', err);
        showNotification('Failed to load student data: ' + err.message, 'error');
        allStudents = [];
        filteredStudents = [];
        renderStudentTable();
    }
}

function buildStudentList(enrollments) {
    const students = [];
    enrollments.forEach(enrollment => {
        try {
            const pickValue = (...vals) => {
                for (const val of vals) {
                    if (val === undefined || val === null) continue;
                    const text = String(val).trim();
                    if (!text) continue;
                    if (['-', '--', 'null', 'undefined'].includes(text.toLowerCase())) continue;
                    return text;
                }
                return '';
            };

            let data = enrollment.enrollment_data || {};
            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch (e) { /* ignore */ }
            }

            let files = enrollment.enrollment_files || {};
            if (typeof files === 'string') {
                try { files = JSON.parse(files); } catch (e) { /* ignore */ }
            }

            const parseElectiveList = (value) => {
                if (Array.isArray(value)) {
                    return value
                        .map(v => String(v || '').trim())
                        .filter(v => v && !['-', '--', 'null', 'undefined', 'n/a', 'na'].includes(v.toLowerCase()));
                }
                if (typeof value !== 'string') return [];
                const cleaned = value.trim();
                if (!cleaned || ['-', '--', 'null', 'undefined', 'n/a', 'na'].includes(cleaned.toLowerCase())) return [];
                const raw = cleaned
                    .replace(/^\[|\]$/g, '')
                    .replace(/^"|"$/g, '');
                return raw
                    .split(/[,\n;|]+/)
                    .map(v => v.replace(/^"|"$/g, '').trim())
                    .filter(v => v && !['-', '--', 'null', 'undefined', 'n/a', 'na'].includes(v.toLowerCase()));
            };

            const canonicalElectives = parseElectiveList(data.electives);
            const trackSpecificElectives = [
                ...parseElectiveList(data.academicElectives),
                ...parseElectiveList(data.techproElectives),
                ...parseElectiveList(data.doorwayAcademic),
                ...parseElectiveList(data.doorwayTechpro)
            ];
            const fallbackElectives = [
                ...parseElectiveList(enrollment.subjects),
                ...parseElectiveList(enrollment.interest)
            ];
            const allElectives = Array.from(new Set(
                (canonicalElectives.length > 0
                    ? canonicalElectives
                    : (trackSpecificElectives.length > 0 ? trackSpecificElectives : fallbackElectives))
                    .map(v => String(v || '').trim())
                    .filter(Boolean)
            ));
            const adminOverride = getAdminEditedElectivesOverride(
                enrollment.student_id,
                data.studentID,
                data.studentId,
                data.lrn,
                data.LRN
            );
            const resolvedStudentElectives = adminOverride.hasOverride ? adminOverride.electives : allElectives;

            const fullName = `${(data.firstName||data.firstname||'').toString()} ${(data.lastName||data.lastname||'').toString()}`.trim();
            
            // Extract mother tongue from multiple sources (enrollment object or nested data)
            const motherTongue = enrollment.mother_tongue || enrollment.motherTongue || data.mother_tongue || data.motherTongue || '';
            
            // Build current address from multiple possible field names
            const currentSitio = pickValue(enrollment.cu_address_sitio_street, enrollment.currentSitio, data.currentSitio, data.cu_address_sitio_street);
            const currentBarangay = pickValue(enrollment.currentBarangay, data.currentBarangay, data.current_barangay_name, enrollment.cu_address_barangay_name, enrollment.cu_address_barangay_id, data.cu_address_barangay_id);
            const currentMunicipality = pickValue(enrollment.currentMunicipality, data.currentMunicipality, data.current_municipality_name, enrollment.cu_address_municipality_name, enrollment.cu_address_municipality_id, data.cu_address_municipality_id);
            const currentProvince = pickValue(enrollment.currentProvince, data.currentProvince, data.current_province_name, enrollment.cu_address_province_name, enrollment.cu_address_province_id, data.cu_address_province_id);
            const currentCountry = pickValue(enrollment.currentCountry, data.currentCountry, data.country);
            const currentZipCode = pickValue(enrollment.cu_address_zip, enrollment.currentZipCode, data.currentZipCode, data.cu_address_zip);
            const currentAddress = [currentSitio, currentBarangay, currentMunicipality, currentProvince, currentCountry, currentZipCode]
                .filter(x => x && x.toString().trim() !== '')
                .join(', ') || '--';

            let permanentSitio = pickValue(enrollment.pe_address_sitio_street, enrollment.permanentSitio, data.permanentSitio, data.pe_address_sitio_street);
            let permanentBarangay = pickValue(enrollment.permanentBarangay, data.permanentBarangay, data.permanent_barangay_name, enrollment.pe_address_barangay_name, enrollment.pe_address_barangay_id, data.pe_address_barangay_id);
            let permanentMunicipality = pickValue(enrollment.permanentMunicipality, data.permanentMunicipality, data.permanent_municipality_name, enrollment.pe_address_municipality_name, enrollment.pe_address_municipality_id, data.pe_address_municipality_id);
            let permanentProvince = pickValue(enrollment.permanentProvince, data.permanentProvince, data.permanent_province_name, enrollment.pe_address_province_name, enrollment.pe_address_province_id, data.pe_address_province_id);
            let permanentCountry = pickValue(enrollment.permanentCountry, data.permanentCountry, data.country);
            let permanentZipCode = pickValue(enrollment.pe_address_zip, enrollment.permanentZipCode, data.permanentZipCode, data.pe_address_zip);

            const sameAsCurrent = ['1', 'yes', 'true'].includes(String(data.sameAsCurrentAddress ?? enrollment.address_permanent_current ?? '').toLowerCase().trim());
            if (sameAsCurrent) {
                permanentSitio = permanentSitio || currentSitio;
                permanentBarangay = permanentBarangay || currentBarangay;
                permanentMunicipality = permanentMunicipality || currentMunicipality;
                permanentProvince = permanentProvince || currentProvince;
                permanentCountry = permanentCountry || currentCountry;
                permanentZipCode = permanentZipCode || currentZipCode;
            }

            const permanentAddress = [permanentSitio, permanentBarangay, permanentMunicipality, permanentProvince, permanentCountry, permanentZipCode]
                .filter(x => x && x.toString().trim() !== '')
                .join(', ') || '--';
            
            const student = {
                id: enrollment.student_id || data.studentID || data.studentId || data.lrn || '',
                lrn: (data.lrn || data.LRN || data.lrnNumber || '').toString(),
                fullName: fullName,
                firstName: (data.firstName||data.firstname||'').toString(),
                lastName: (data.lastName||data.lastname||'').toString(),
                gender: (data.gender || data.sex || enrollment.sex || '').toString().toLowerCase(),
                birthdate: (data.birthdate || data.dob || enrollment.birthdate || '').toString(),
                placeOfBirth: (data.placeOfBirth || enrollment.place_of_birth || '').toString(),
                grade: (data.grade_level || data.grade || data.gradeLevel || enrollment.grade_to_enroll_id || '').toString(),
                track: (data.track || data.program || enrollment.track || '').toString(),
                status: enrollment.status || 'Pending',
                disabilities: Array.isArray(data.disabilities) ? data.disabilities : (Array.isArray(data.disability) ? data.disability : []),
                ip_group: (data.ipGroup || data.ip_group || enrollment.ip_group || '').toString(),
                four_ps: (data.is4Ps || data.four_ps || enrollment.four_ps || '').toString(),
                mother_tongue: motherTongue.toString(),
                electives: resolvedStudentElectives,
                currentAddress: currentAddress,
                permanentAddress: permanentAddress,
                enrollmentDate: enrollment.created_at || enrollment.enrollment_date || new Date().toISOString(),
                enrollmentFiles: files
            };
            
            // DEBUG: Log track info for each student
            if (student.fullName) {
                console.log(`[StudentList] Student: ${student.fullName}, Track from data: "${data.track}", Track in student: "${student.track}"`);
            }
            
            students.push(student);
        } catch (err) {
            console.warn('Student Directory: failed to map student', err);
        }
    });
    console.log('[StudentList] Total students built:', students.length, 'Sample:', students.length > 0 ? {name: students[0].fullName, track: students[0].track, id: students[0].id} : 'none');
    return students;
}

// Setup dynamic show/hide behavior for fields inside the enrollment edit modal
function setupEnrollmentModalConditionals() {
    const container = document.getElementById('enrollmentDetail') || document;

    const showEl = (el) => { if (!el) return; el.classList && el.classList.remove('hidden'); el.style.display = ''; };
    const hideEl = (el) => { if (!el) return; el.classList && el.classList.add('hidden'); el.style.display = 'none'; };

    function updateStates() {
        try {
            const lrnWrapper = container.querySelector('#lrnField');
            const yesHasLRN = container.querySelector('input[name="hasLRN"][value="yes"]:checked');
            const noHasLRN = container.querySelector('input[name="hasLRN"][value="no"]:checked');
            console.log('[enroll-conds] hasLRN yes?', !!yesHasLRN, 'no?', !!noHasLRN, 'lrnWrapper?', !!lrnWrapper);
            if (yesHasLRN) showEl(lrnWrapper); else hideEl(lrnWrapper);

            const mtSelect = container.querySelector('#motherTongue');
            const mtOther = container.querySelector('#motherTongueOther');
            console.log('[enroll-conds] motherTongue value:', mtSelect ? mtSelect.value : 'N/A');
            if (mtSelect && mtOther) {
                if (mtSelect.value === 'other') showEl(mtOther); else hideEl(mtOther);
            }

            const ipFields = container.querySelector('#ipFields');
            const yesIP = container.querySelector('input[name="isIP"][value="yes"]:checked');
            const noIP = container.querySelector('input[name="isIP"][value="no"]:checked');
            console.log('[enroll-conds] isIP yes?', !!yesIP, 'no?', !!noIP, 'ipFields?', !!ipFields);
            if (yesIP) showEl(ipFields); else hideEl(ipFields);

            const ipGroup = container.querySelector('#ipGroup');
            const ipOther = container.querySelector('#ipOtherField');
            console.log('[enroll-conds] ipGroup value:', ipGroup ? ipGroup.value : 'N/A');
            if (ipGroup && ipOther) {
                if (ipGroup.value === 'other') showEl(ipOther); else hideEl(ipOther);
            }

            const fpsFields = container.querySelector('#fpsFields');
            const yes4 = container.querySelector('input[name="is4Ps"][value="yes"]:checked');
            const no4 = container.querySelector('input[name="is4Ps"][value="no"]:checked');
            console.log('[enroll-conds] is4Ps yes?', !!yes4, 'no?', !!no4, 'fpsFields?', !!fpsFields);
            if (yes4) showEl(fpsFields); else hideEl(fpsFields);

            const disabilityFields = container.querySelector('#disabilityFields');
            const yesPWD = container.querySelector('input[name="hasPWD"][value="yes"]:checked');
            const noPWD = container.querySelector('input[name="hasPWD"][value="no"]:checked');
            console.log('[enroll-conds] hasPWD yes?', !!yesPWD, 'no?', !!noPWD, 'disabilityFields?', !!disabilityFields);
            if (yesPWD) showEl(disabilityFields); else hideEl(disabilityFields);

            // Returning learner fields visibility (radio version)
            const returningFields = container.querySelector('#returningLearnerFields');
            const yesReturn = container.querySelector('input[name="returningLearner"][value="yes"]:checked');
            if (returningFields) {
                if (yesReturn) showEl(returningFields); else hideEl(returningFields);
            }
        } catch (err) { console.warn('updateStates error', err); }
    }

    // Delegate change events from the container for reliable handling
    try {
        const watchedNames = ['hasLRN','motherTongue','isIP','ipGroup','is4Ps','hasPWD','returningLearner'];
        container.addEventListener('change', (e) => {
            const t = e.target;
            if (!t) return;
            const name = t.name || '';
            if (!name) return;
            if (watchedNames.includes(name)) setTimeout(updateStates, 0);
        });

        // Listen for input events (some browsers fire input instead of change for custom widgets)
        container.addEventListener('input', (e) => {
            const t = e.target;
            if (!t) return;
            const name = t.name || '';
            if (watchedNames.includes(name)) setTimeout(updateStates, 0);
        });

        // Listen for clicks (labels or styled elements may receive clicks)
        container.addEventListener('click', (e) => {
            const t = e.target;
            if (!t) return;
            // try to find a named input related to the click target
            let named = t.name || (t.closest ? (t.closest('[name]') ? t.closest('[name]').name : '') : '');
            if (named && watchedNames.includes(named)) setTimeout(updateStates, 0);
        });

        // Run once to set initial visibility
        setTimeout(updateStates, 0);
    } catch (e) {
        console.warn('setupEnrollmentModalConditionals delegate error:', e && e.message);
    }
}

function setupEnrollmentDetailTabs() {
    const modal = document.getElementById('enrollmentDetailModal');
    if (!modal) return;

    const tabContainer = modal.querySelector('.enrollment-modal-tabs');
    if (!tabContainer) return;

    const tabBtns = Array.from(tabContainer.querySelectorAll('.tab-btn'));
    const sections = Array.from(modal.querySelectorAll('.enrollment-detail-section'));

    if (tabBtns.length > 0) {
        tabBtns.forEach((btn, idx) => btn.classList.toggle('active', idx === 0));
    }
    if (sections.length > 0) {
        sections.forEach((section, idx) => section.classList.toggle('active', idx === 0));
    }

    if (tabContainer._studentsTabClickHandler) {
        tabContainer.removeEventListener('click', tabContainer._studentsTabClickHandler);
    }

    const tabClickHandler = (event) => {
        const btn = event.target.closest('.tab-btn');
        if (!btn || !tabContainer.contains(btn)) return;

        const tabName = btn.getAttribute('data-tab');
        if (!tabName) return;

        tabBtns.forEach(b => b.classList.toggle('active', b === btn));
        sections.forEach(section => {
            section.classList.toggle('active', section.getAttribute('data-section') === tabName);
        });
    };

    tabContainer.addEventListener('click', tabClickHandler);
    tabContainer._studentsTabClickHandler = tabClickHandler;
}

function applyFilters() {
    const searchVal = document.getElementById('dirSearchInput')?.value || '';
    const gradeVal = document.getElementById('dirFilterGrade')?.value || '';
    const genderVal = document.getElementById('dirFilterGender')?.value || '';
    const trackVal = document.getElementById('dirFilterTrack')?.value || '';
    const statusVal = String(document.getElementById('dirFilterStatus')?.value || '').toLowerCase();
    const disabilityVal = document.getElementById('dirFilterDisability')?.value || '';
    const ipVal = document.getElementById('dirFilterIP')?.value || '';
    const fourPsVal = document.getElementById('dirFilter4Ps')?.value || '';

    filteredStudents = allStudents.filter(s => {
        if (searchVal && !s.fullName.toLowerCase().includes(searchVal.toLowerCase()) && !s.lrn.includes(searchVal)) return false;
        if (gradeVal && String(s.grade) !== gradeVal) return false;
        if (genderVal && s.gender !== genderVal) return false;
        if (trackVal && !s.track.toLowerCase().includes(trackVal.toLowerCase())) return false;
        if (statusVal && normalizeEnrollmentStatus(s.status) !== statusVal) return false;
        if (disabilityVal && !s.disabilities.some(d => String(d).toLowerCase().includes(disabilityVal.toLowerCase()))) return false;
        if (ipVal && !s.ip_group.toLowerCase().includes(ipVal.toLowerCase())) return false;
        if (fourPsVal === 'yes' && !s.four_ps) return false;
        if (fourPsVal === 'no' && s.four_ps) return false;
        return true;
    });

    currentPage = 1;
    renderStudentTable();
}

function normalizeEnrollmentStatus(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'pending';
    if (raw === 'approved' || raw === 'active') return 'approved';
    if (raw === 'rejected' || raw === 'declined') return 'rejected';
    if (raw === 'pending') return 'pending';
    return raw;
}

function enrollmentStatusLabel(value) {
    const normalized = normalizeEnrollmentStatus(value);
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'rejected') return 'Rejected';
    return 'Pending';
}

function renderStudentTable() {
    const tbody = document.getElementById('dirTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageStudents = filteredStudents.slice(start, end);

    tbody.innerHTML = '';
    if (pageStudents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No students found.</td></tr>';
    } else {
        pageStudents.forEach(student => {
            const row = document.createElement('tr');
            const normalizedStatus = normalizeEnrollmentStatus(student.status);
            const statusClass = normalizedStatus === 'approved' ? 'status-active' : (normalizedStatus === 'pending' ? 'status-pending' : 'status-rejected');
            row.innerHTML = `
                <td>${escapeHtml(student.lrn)}</td>
                <td>${escapeHtml(student.fullName)}</td>
                <td>${escapeHtml((student.gender || '').charAt(0).toUpperCase() + (student.gender || '').slice(1))}</td>
                <td>${escapeHtml(student.grade)}</td>
                <td>${escapeHtml(student.track)}</td>
                <td><span class="status-badge ${statusClass}">${escapeHtml(enrollmentStatusLabel(student.status))}</span></td>
                <td class="actions">
                    <button class="action-btn view-btn" data-id="${escapeHtml(student.id || student.lrn)}" data-lrn="${escapeHtml(student.lrn)}" title="View">👁</button>
                    <button class="action-btn edit-btn" data-id="${escapeHtml(student.id || student.lrn)}" data-lrn="${escapeHtml(student.lrn)}" title="Edit">✏</button>
                    <button class="action-btn archive-btn" data-id="${escapeHtml(student.id || student.lrn)}" data-lrn="${escapeHtml(student.lrn)}" title="Archive">📦</button>
                    <button class="action-btn delete-btn" data-id="${escapeHtml(student.id || student.lrn)}" data-lrn="${escapeHtml(student.lrn)}" title="Delete Permanently">🗑</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    updatePagination();
}

// Update a single student's status badge in the directory table (in-place)
function updateStudentRowStatus(idKey, status) {
    try {
        const id = String(idKey || '').trim();
        if (!id) return;
        const tbody = document.getElementById('dirTableBody');
        if (!tbody) return;

        // Look for an action button with matching data-id or data-lrn
        const selector = `button.action-btn[data-id="${id}"], button.action-btn[data-lrn="${id}"]`;
        const btn = tbody.querySelector(selector);
        if (!btn) return;
        const row = btn.closest('tr');
        if (!row) return;

        const badge = row.querySelector('.status-badge');
        if (badge) {
            badge.textContent = status || '--';
            badge.classList.remove('status-active','status-pending','status-rejected');
            const cls = status === 'Approved' ? 'status-active' : (status === 'Pending' ? 'status-pending' : 'status-rejected');
            badge.classList.add(cls);
        }

        // If profile modal is open, update the status there as well
        const infoStatus = document.getElementById('infoEnrollmentStatus');
        if (infoStatus) infoStatus.textContent = status || '--';
    } catch (e) {
        console.warn('updateStudentRowStatus failed', e);
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredStudents.length / pageSize);
    document.getElementById('dirPageInfo').textContent = `Page ${currentPage} of ${Math.max(1, totalPages)}`;
    document.getElementById('dirPrevBtn').disabled = currentPage === 1;
    document.getElementById('dirNextBtn').disabled = currentPage >= totalPages;
}

function openStudentProfile(studentId) {
    try {
        const normalizedId = String(studentId || '').trim();
        const students = Array.isArray(allStudents) ? allStudents : [];

        const student = students.find(s => {
            const sId = String((s && s.id) || '').trim();
            const sLrn = String((s && s.lrn) || '').trim();
            return sId === normalizedId || sLrn === normalizedId;
        });

        if (!student) {
            showNotification('Student not found', 'warning');
            return;
        }

        const asText = (value, fallback = '--') => {
            if (value === undefined || value === null) return fallback;
            const text = String(value).trim();
            return text ? text : fallback;
        };

        const asArray = (value) => {
            if (Array.isArray(value)) return value.filter(item => String(item || '').trim() !== '');
            if (value === undefined || value === null) return [];
            const text = String(value).trim();
            return text ? [text] : [];
        };

        const gender = String(student.gender || '').trim();
        const formattedGender = gender ? `${gender.charAt(0).toUpperCase()}${gender.slice(1)}` : '--';
        const electives = asArray(student.electives);
        const disabilities = asArray(student.disabilities);
        const enrollmentDate = student.enrollmentDate ? new Date(student.enrollmentDate) : null;
        const enrollmentDateText = enrollmentDate && !isNaN(enrollmentDate.getTime())
            ? enrollmentDate.toLocaleDateString()
            : '--';

        currentProfileStudentId = student.id || student.lrn || null;

        document.getElementById('profileStudentName').textContent = asText(student.fullName, 'Student Profile');
        document.getElementById('infoFullName').textContent = asText(student.fullName);
        document.getElementById('infoStudentID').textContent = asText(student.lrn);
        document.getElementById('infoGender').textContent = formattedGender;

        try {
            const bd = student.birthdate ? new Date(student.birthdate) : null;
            document.getElementById('infoBirthdate').textContent = bd && !isNaN(bd.getTime())
                ? bd.toISOString().split('T')[0]
                : asText(student.birthdate);
        } catch(_){
            document.getElementById('infoBirthdate').textContent = asText(student.birthdate);
        }

        document.getElementById('infoPlaceOfBirth').textContent = asText(student.placeOfBirth);
        document.getElementById('infoMotherTongue').textContent = asText(student.mother_tongue);
        document.getElementById('infoAddress').textContent = asText(student.currentAddress);
        const profilePermanentAddress = document.getElementById('infoPermanentAddress');
        if (profilePermanentAddress) {
            profilePermanentAddress.textContent = asText(student.permanentAddress);
        }

        document.getElementById('infoGrade').textContent = asText(student.grade);
        document.getElementById('infoTrack').textContent = asText(student.track);
        document.getElementById('infoEnrollmentStatus').textContent = asText(student.status);
        document.getElementById('infoElectives').textContent = electives.length > 0 ? electives.join(', ') : 'None';
        document.getElementById('infoDisability').textContent = disabilities.length > 0 ? disabilities.join(', ') : 'None';
        document.getElementById('infoIPGroup').textContent = asText(student.ip_group, 'Not an IP member');
        document.getElementById('info4Ps').textContent = student.four_ps ? 'Yes' : 'No';

        const historyContent = document.getElementById('historyContent');
        if (historyContent) {
            historyContent.innerHTML = `<p>Enrolled: ${enrollmentDateText}</p>`;
        }

        const documentsPane = document.getElementById('tab-documents');
        if (documentsPane) {
            const containerRoot = document.getElementById('documentsContainer') || documentsPane;
            containerRoot.innerHTML = '';

            if (student.enrollmentFiles && Object.keys(student.enrollmentFiles).length > 0) {
                const documentGrid = document.createElement('div');
                documentGrid.className = 'document-grid';

                Object.entries(student.enrollmentFiles).forEach(([key, dataUrl]) => {
                    const docLabel = key === 'psaBirthCert' ? 'PSA Birth Certificate' : key === 'reportCard' ? 'Report Card' : key === 'studentImage' ? 'Photo' : key;
                    const isImage = dataUrl && dataUrl.startsWith('data:image');

                    const container = document.createElement('div');
                    container.className = 'document-preview-container';
                    container.dataset.key = key;

                    if (isImage) {
                        const img = document.createElement('img');
                        img.src = dataUrl;
                        img.alt = docLabel;
                        img.className = 'document-preview-image';
                        img.style.cursor = 'pointer';
                        img.addEventListener('click', function() { viewDocument(dataUrl); });
                        container.appendChild(img);
                    } else {
                        const icon = document.createElement('div');
                        icon.className = 'document-icon';
                        icon.textContent = '📄';
                        container.appendChild(icon);
                    }

                    const label = document.createElement('div');
                    label.className = 'document-label';
                    label.textContent = docLabel;
                    container.appendChild(label);

                    documentGrid.appendChild(container);
                });

                documentsPane.innerHTML = '';
                documentsPane.appendChild(documentGrid);
            } else {
                documentsPane.innerHTML = '<p class="no-data">No documents submitted.</p>';
            }
        }

        const modal = document.getElementById('studentProfileModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
            modal.style.pointerEvents = 'auto';
            modal.setAttribute('aria-hidden', 'false');
        }
    } catch (err) {
        console.error('openStudentProfile failed:', err);
        showNotification('Unable to open student profile right now', 'error');
    }
}

async function openEnrollmentDetail(studentId) {
    console.log('[Students] openEnrollmentDetail called with', studentId);
    // Normalize and trim the ID for comparison
    const normalizedId = String(studentId || '').trim();
    const student = allStudents.find(s => {
        const sId = String(s.id || '').trim();
        const sLrn = String(s.lrn || '').trim();
        return sId === normalizedId || sLrn === normalizedId;
    });
    
    if (!student) { showNotification('Student not found', 'warning'); return; }

    // immediately show the modal so user receives feedback even if building later fails
    const modalEl = document.getElementById('enrollmentDetailModal');
    if (modalEl) {
        modalEl.classList.add('active');
        modalEl.style.display = 'flex';
        modalEl.style.pointerEvents = 'auto';
        modalEl.setAttribute('aria-hidden','false');
    }

    // IMPORTANT: Set currentProfileStudentId so saveEnrollmentDetail() knows which student is being edited
    currentProfileStudentId = student.id || student.lrn;
    console.log('[Students] openEnrollmentDetail: Set currentProfileStudentId to:', currentProfileStudentId);

    document.getElementById('enrollmentStudentInfo').textContent = `${student.fullName} — ${student.lrn || student.id}`;
    const container = document.getElementById('enrollmentDetail');
    // Try to fetch full enrollment data for this student to prefill the form
    let enrollmentData = {};
    let enrollmentRecord = null;
    try {
        const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
        const resp = await studentsApiFetch(base + `/api/enrollments/student/${encodeURIComponent(student.id || student.lrn)}`);
        if (resp.ok) {
            const arr = await resp.json();
            if (Array.isArray(arr) && arr.length > 0) {
                enrollmentRecord = arr[0] || null;
                const raw = arr[0].enrollment_data || {};
                if (typeof raw === 'string') {
                    try { enrollmentData = JSON.parse(raw || '{}') || {}; } catch (_) { enrollmentData = {}; }
                } else {
                    enrollmentData = raw || {};
                }

                const clean = (value) => {
                    if (value === undefined || value === null) return '';
                    const normalized = String(value).trim();
                    return (normalized === '-' || normalized === '--' || normalized === 'null' || normalized === 'undefined') ? '' : normalized;
                };
                const pick = (...vals) => {
                    for (const v of vals) {
                        const c = clean(v);
                        if (c !== '') return c;
                    }
                    return '';
                };

                const semesterRaw = pick(enrollmentData.semester, enrollmentRecord?.semester);
                const normalizedSemester = semesterRaw.toLowerCase().includes('first')
                    ? 'first'
                    : (semesterRaw.toLowerCase().includes('second') ? 'second' : clean(semesterRaw).toLowerCase());

                const trackRaw = pick(enrollmentData.track, enrollmentRecord?.track, enrollmentRecord?.track_name);
                const normalizedTrack = trackRaw.toLowerCase().includes('academic')
                    ? 'academic'
                    : (trackRaw.toLowerCase().includes('techpro') ? 'techpro' : (trackRaw.toLowerCase().includes('doorway') ? 'doorway' : clean(trackRaw).toLowerCase()));

                const ALL_KNOWN_ELECTIVES = [
                    ...Object.values(typeof STUDENT_DIRECTORY_ACADEMIC_ELECTIVES !== 'undefined' ? STUDENT_DIRECTORY_ACADEMIC_ELECTIVES : {}).flat(),
                    ...Object.values(typeof STUDENT_DIRECTORY_TECHPRO_ELECTIVES !== 'undefined' ? STUDENT_DIRECTORY_TECHPRO_ELECTIVES : {}).flat()
                ].map(v => String(v || '').trim());

                const parseElectiveList = (value) => {
                    const raw = Array.isArray(value)
                        ? value
                        : (typeof value === 'string'
                            ? (ALL_KNOWN_ELECTIVES.includes(String(value).trim()) ? [value] : value.split(','))
                            : []);
                    const invalid = new Set(['-', '--', 'none', 'null', 'undefined', 'n/a', 'na']);
                    return Array.from(new Set(
                        raw
                            .map(v => (v === undefined || v === null ? '' : String(v).trim()))
                            .filter(v => v && !invalid.has(v.toLowerCase()))
                    ));
                };

                const adminOverride = getAdminEditedElectivesOverride(student.id, student.lrn, studentId);
                const profileResolvedElectives = parseElectiveList(student.electives || []);
                const enrollmentResolvedElectives = parseElectiveList(enrollmentData.electives);
                let resolvedElectives = adminOverride.hasOverride
                    ? adminOverride.electives
                    : (enrollmentResolvedElectives.length > 0
                        ? enrollmentResolvedElectives
                        : profileResolvedElectives);

                // Keep Enrollment Details modal consistent with Student Profile modal:
                // if profile already has normalized electives, treat those as source of truth.
                // Keep enrollment payload canonical and prevent legacy elective buckets from reintroducing old values.
                enrollmentData.academicElectives = [];
                enrollmentData.techproElectives = [];
                enrollmentData.doorwayAcademic = [];
                enrollmentData.doorwayTechpro = [];
                enrollmentData.electives = resolvedElectives;

                enrollmentData.middleName = pick(enrollmentData.middleName, enrollmentRecord?.middle_name);
                enrollmentData.birthdate = pick(enrollmentData.birthdate, enrollmentRecord?.birthdate, student.birthdate);
                enrollmentData.placeOfBirth = pick(enrollmentData.placeOfBirth, enrollmentRecord?.place_of_birth, student.placeOfBirth);
                enrollmentData.motherTongue = pick(enrollmentData.motherTongue, enrollmentData.mother_tongue, enrollmentRecord?.motherTongue, enrollmentRecord?.mother_tongue, student.mother_tongue).toLowerCase();
                enrollmentData.motherTongueOther = pick(enrollmentData.motherTongueOther, enrollmentData.mother_tongue_other, enrollmentRecord?.mother_tongue_other);
                enrollmentData.semester = normalizedSemester;
                enrollmentData.track = normalizedTrack;
                enrollmentData.electives = resolvedElectives;
                enrollmentData.currentCountry = pick(enrollmentData.currentCountry, enrollmentRecord?.cu_address_country_id, enrollmentRecord?.currentCountry);
                enrollmentData.currentProvince = pick(enrollmentData.currentProvince, enrollmentRecord?.cu_address_province_id, enrollmentRecord?.currentProvince);
                enrollmentData.currentMunicipality = pick(enrollmentData.currentMunicipality, enrollmentRecord?.cu_address_municipality_id, enrollmentRecord?.currentMunicipality);
                enrollmentData.currentBarangay = pick(enrollmentData.currentBarangay, enrollmentRecord?.cu_address_barangay_id, enrollmentRecord?.currentBarangay);
                enrollmentData.permanentCountry = pick(enrollmentData.permanentCountry, enrollmentRecord?.pe_address_country_id, enrollmentRecord?.permanentCountry);
                enrollmentData.permanentProvince = pick(enrollmentData.permanentProvince, enrollmentRecord?.pe_address_province_id, enrollmentRecord?.permanentProvince);
                enrollmentData.permanentMunicipality = pick(enrollmentData.permanentMunicipality, enrollmentRecord?.pe_address_municipality_id, enrollmentRecord?.permanentMunicipality);
                enrollmentData.permanentBarangay = pick(enrollmentData.permanentBarangay, enrollmentRecord?.pe_address_barangay_id, enrollmentRecord?.permanentBarangay);
                enrollmentData.sameAsCurrentAddress = pick(enrollmentData.sameAsCurrentAddress, enrollmentRecord?.address_permanent_current);

                const sameAsCurrentAddress = ['1', 'yes', 'true'].includes(String(enrollmentData.sameAsCurrentAddress || '').toLowerCase());
                if (sameAsCurrentAddress) {
                    enrollmentData.permanentCountry = enrollmentData.permanentCountry || enrollmentData.currentCountry;
                    enrollmentData.permanentProvince = enrollmentData.permanentProvince || enrollmentData.currentProvince;
                    enrollmentData.permanentMunicipality = enrollmentData.permanentMunicipality || enrollmentData.currentMunicipality;
                    enrollmentData.permanentBarangay = enrollmentData.permanentBarangay || enrollmentData.currentBarangay;
                    enrollmentData.permanentSitio = enrollmentData.permanentSitio || enrollmentRecord?.pe_address_sitio_street || enrollmentData.currentSitio;
                    enrollmentData.permanentZipCode = enrollmentData.permanentZipCode || enrollmentRecord?.pe_address_zip || enrollmentData.currentZipCode;
                }

                // Keep documents synchronized from latest enrollment row
                let latestFiles = arr[0].enrollment_files || enrollmentData.enrollmentFiles || {};
                if (typeof latestFiles === 'string') {
                    try { latestFiles = JSON.parse(latestFiles || '{}') || {}; } catch (_) { latestFiles = {}; }
                }
                if (!latestFiles || typeof latestFiles !== 'object') latestFiles = {};
                enrollmentData.enrollmentFiles = latestFiles;
                student.enrollmentFiles = latestFiles;
            }
        }
    } catch (e) { console.warn('Failed to load enrollment data for edit:', e.message); }
    if (container) {
        console.log('[Students] Building editable enrollment detail modal for', student.fullName, student.lrn || student.id);
        try {
            // Display student information in a profile view format organized by tabs
            // (errors within this block will be caught and logged)
            // Helper function to format field values
            const formatValue = (val) => {
                if (!val || val === undefined || val === null || val === '') return '--';
                if (Array.isArray(val)) return val.join(', ');
                return String(val);
            };
            
            // Helper function to create a profile field row
            const createFieldRow = (label, value) => `
                <div class="profile-field-row">
                    <span class="profile-field-label">${label}</span>
                    <span class="profile-field-value">${escapeHtml(formatValue(value))}</span>
                </div>
            `;
            
            // Helper function to create an editable field row (double-click to edit)
            const createEditableFieldRow = (label, value, fieldName) => `
                <div class="profile-field-row editable-field" data-field="${fieldName}">
                    <span class="profile-field-label">${label}</span>
                    <span class="profile-field-value" data-value="${escapeHtml(formatValue(value))}" title="Double-click to edit">${escapeHtml(formatValue(value))}</span>
                    <input type="text" class="profile-field-input hidden" value="${escapeHtml(formatValue(value))}" style="margin-left: auto;">
                </div>
            `;
            
            // Helper function for date picker field
            const createDateField = (label, value, fieldName) => `
                <div class="profile-field-row" data-field="${fieldName}">
                    <span class="profile-field-label">${label}</span>
                    <input type="date" class="profile-date-input" value="${value || ''}" data-field="${fieldName}" style="flex: 1; max-width: 200px;">
                </div>
            `;
            
            // Helper function for dropdown field
            const createSelectField = (label, value, fieldName, options) => `
                <div class="profile-field-row" data-field="${fieldName}">
                    <span class="profile-field-label">${label}</span>
                    <select class="profile-select-input" data-field="${fieldName}" style="flex: 1; max-width: 200px;">
                        <option value="">-- Select --</option>
                        ${options.map(opt => `<option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
                    </select>
                </div>
            `;
            
            // Helper function for mother tongue with conditional field
            const createMotherTongueField = (value, otherValue) => `
                <div class="profile-field-row" data-field="motherTongue">
                    <span class="profile-field-label">MOTHER TONGUE</span>
                    <select class="profile-select-input" data-field="motherTongue" id="motherTongueSelect" style="flex: 1; max-width: 200px;">
                        <option value="">Select Language</option>
                        <!-- Major Philippine Languages -->
                        <optgroup label="Major Languages">
                            <option value="tagalog" ${value === 'tagalog' ? 'selected' : ''}>Tagalog</option>
                            <option value="cebuano" ${value === 'cebuano' ? 'selected' : ''}>Cebuano</option>
                            <option value="ilocano" ${value === 'ilocano' ? 'selected' : ''}>Ilocano</option>
                            <option value="hiligaynon" ${value === 'hiligaynon' ? 'selected' : ''}>Hiligaynon/Ilonggo</option>
                            <option value="bicolano" ${value === 'bicolano' ? 'selected' : ''}>Bicolano</option>
                            <option value="pangasinan" ${value === 'pangasinan' ? 'selected' : ''}>Pangasinan</option>
                            <option value="kapampangan" ${value === 'kapampangan' ? 'selected' : ''}>Kapampangan</option>
                            <option value="maranao" ${value === 'maranao' ? 'selected' : ''}>Maranao</option>
                            <option value="maguindanao" ${value === 'maguindanao' ? 'selected' : ''}>Maguindanao</option>
                            <option value="tausug" ${value === 'tausug' ? 'selected' : ''}>Tausug</option>
                        </optgroup>
                        <!-- Regional Languages -->
                        <optgroup label="Regional Languages">
                            <option value="waray" ${value === 'waray' ? 'selected' : ''}>Waray</option>
                            <option value="masbateno" ${value === 'masbateno' ? 'selected' : ''}>Masbateno</option>
                            <option value="aklanon" ${value === 'aklanon' ? 'selected' : ''}>Aklanon</option>
                            <option value="capiznon" ${value === 'capiznon' ? 'selected' : ''}>Capiznon</option>
                            <option value="romblomanon" ${value === 'romblomanon' ? 'selected' : ''}>Romblomanon</option>
                            <option value="antique" ${value === 'antique' ? 'selected' : ''}>Antique</option>
                            <option value="sama-bajau" ${value === 'sama-bajau' ? 'selected' : ''}>Sama-Bajau</option>
                            <option value="maranao-lanao" ${value === 'maranao-lanao' ? 'selected' : ''}>Maranao (Lanao)</option>
                            <option value="maguindanao-cotabato" ${value === 'maguindanao-cotabato' ? 'selected' : ''}>Maguindanao (Cotabato)</option>
                            <option value="subanon" ${value === 'subanon' ? 'selected' : ''}>Subanon</option>
                            <option value="tiruray" ${value === 'tiruray' ? 'selected' : ''}>Tiruray</option>
                            <option value="subanen" ${value === 'subanen' ? 'selected' : ''}>Subanen</option>
                            <option value="bukidnon" ${value === 'bukidnon' ? 'selected' : ''}>Bukidnon</option>
                            <option value="manobo" ${value === 'manobo' ? 'selected' : ''}>Manobo</option>
                            <option value="magsaysay" ${value === 'magsaysay' ? 'selected' : ''}>Magsaysay</option>
                        </optgroup>
                        <!-- Indigenous and Ethnic Languages -->
                        <optgroup label="Indigenous/Ethnic Languages">
                            <option value="ifugao" ${value === 'ifugao' ? 'selected' : ''}>Ifugao</option>
                            <option value="kalinga" ${value === 'kalinga' ? 'selected' : ''}>Kalinga</option>
                            <option value="kankanaey" ${value === 'kankanaey' ? 'selected' : ''}>Kankanaey</option>
                            <option value="ibaloi" ${value === 'ibaloi' ? 'selected' : ''}>Ibaloi</option>
                            <option value="bontoc" ${value === 'bontoc' ? 'selected' : ''}>Bontoc</option>
                            <option value="isneg" ${value === 'isneg' ? 'selected' : ''}>Isneg</option>
                            <option value="tinggian" ${value === 'tinggian' ? 'selected' : ''}>Tinggian</option>
                            <option value="karao" ${value === 'karao' ? 'selected' : ''}>Karao</option>
                            <option value="hanunoo" ${value === 'hanunoo' ? 'selected' : ''}>Hanunoo</option>
                            <option value="tagbanua" ${value === 'tagbanua' ? 'selected' : ''}>Tagbanua</option>
                            <option value="palawano" ${value === 'palawano' ? 'selected' : ''}>Palawano</option>
                            <option value="batak" ${value === 'batak' ? 'selected' : ''}>Batak</option>
                            <option value="molbog" ${value === 'molbog' ? 'selected' : ''}>Molbog</option>
                            <option value="aeta" ${value === 'aeta' ? 'selected' : ''}>Aeta</option>
                            <option value="agta" ${value === 'agta' ? 'selected' : ''}>Agta</option>
                        </optgroup>
                        <!-- International Languages -->
                        <optgroup label="International Languages">
                            <option value="english" ${value === 'english' ? 'selected' : ''}>English</option>
                            <option value="spanish" ${value === 'spanish' ? 'selected' : ''}>Spanish</option>
                            <option value="chinese" ${value === 'chinese' ? 'selected' : ''}>Chinese</option>
                            <option value="japanese" ${value === 'japanese' ? 'selected' : ''}>Japanese</option>
                            <option value="korean" ${value === 'korean' ? 'selected' : ''}>Korean</option>
                            <option value="arabic" ${value === 'arabic' ? 'selected' : ''}>Arabic</option>
                        </optgroup>
                        <!-- Other -->
                        <option value="other" ${value === 'other' ? 'selected' : ''}>Other (Please specify)</option>
                    </select>
                </div>
                <div class="profile-field-row ${value !== 'other' ? 'hidden' : ''}" id="motherTongueOtherField" style="margin-left: 180px; margin-top: -10px;">
                    <input type="text" class="profile-field-input" id="motherTongueOtherInput" value="${escapeHtml(formatValue(otherValue))}" placeholder="Please specify" style="margin-left: 0; max-width: 200px;">
                </div>
            `;
            
            // Parse name from fullName
            const nameParts = (student.fullName || '').trim().split(/\s+/);
            const lastName = student.lastName || enrollmentData.lastName || (nameParts.length > 0 ? nameParts[nameParts.length - 1] : '');
            const firstName = student.firstName || enrollmentData.firstName || (nameParts.length > 0 ? nameParts[0] : '');
            
            // Only use middleName if the fullName actually has 3+ parts OR student actively entered it
            let middleName = (enrollmentData.middleName || student.middleName || '').toString().trim();
            if (middleName === '-' || middleName === '--' || middleName === '–') {
                middleName = '';
            }
            if (!middleName && nameParts.length > 2) {
                middleName = nameParts.slice(1, -1).join(' ');
            }
            
            // Calculate age from birthdate
            const getAge = (birthdate) => {
                if (!birthdate) return '--';
                const birth = new Date(birthdate);
                const today = new Date();
                let age = today.getFullYear() - birth.getFullYear();
                const monthDiff = today.getMonth() - birth.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                    age--;
                }
                return age >= 0 ? age : '--';
            };
            
            const toDateInputValue = (raw) => {
                if (!raw) return '';
                const parsed = new Date(raw);
                if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
                const str = String(raw).trim();
                return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : '';
            };
            const birthDate = toDateInputValue(student.birthdate || enrollmentData.birthdate || enrollmentRecord?.birthdate);
            const age = getAge(birthDate);

            const normalizedSex = (student.gender || enrollmentData.sex || enrollmentData.gender || enrollmentRecord?.sex || '')
                .toString()
                .toLowerCase()
                .trim();
            const normalizedMotherTongue = (enrollmentData.motherTongue || enrollmentData.mother_tongue || enrollmentRecord?.motherTongue || enrollmentRecord?.mother_tongue || '')
                .toString()
                .toLowerCase()
                .trim();
            
            // Sex options
            const sexOptions = [
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' }
            ];
            
            // Build personal information section
            const personalHTML = `
                <div class="enrollment-detail-section active" data-section="personal">
                    <div class="profile-section">
                        <div class="profile-field-group">
                            <h4 class="profile-group-title">Name Information</h4>
                            ${createEditableFieldRow('LAST NAME', lastName, 'lastName')}
                            ${createEditableFieldRow('FIRST NAME', firstName, 'firstName')}
                            ${createEditableFieldRow('MIDDLE NAME', middleName, 'middleName')}
                            ${createEditableFieldRow('EXTENSION NAME', enrollmentData.extensionName || enrollmentRecord?.extensionName || '', 'extensionName')}
                            ${createEditableFieldRow('LRN', enrollmentData.lrn || enrollmentRecord?.lrn_no || student.lrn || student.id, 'lrn')}
                        </div>

                        <div class="profile-field-group" style="margin-top: 20px;">
                            <h4 class="profile-group-title">Birth & Personal</h4>
                            ${createDateField('BIRTHDATE', birthDate, 'birthdate')}
                            <div class="profile-field-row" data-field="age">
                                <span class="profile-field-label">AGE</span>
                                <span class="profile-field-value" id="ageDisplay">${age}</span>
                            </div>
                            ${createSelectField('SEX', normalizedSex, 'sex', sexOptions)}
                            ${createEditableFieldRow('PLACE OF BIRTH', enrollmentData.placeOfBirth || enrollmentRecord?.place_of_birth || '', 'placeOfBirth')}
                            ${createMotherTongueField(
                                normalizedMotherTongue,
                                enrollmentData.motherTongueOther || enrollmentData.mother_tongue_other || enrollmentRecord?.mother_tongue_other || ''
                            )}
                        </div>

                        <div class="profile-field-group" style="margin-top: 20px;">
                            <h4 class="profile-group-title">Enrollment Specifics</h4>
                            <div class="profile-field-row" data-field="returningLearner">
                                <span class="profile-field-label">RETURNING LEARNER</span>
                                <label class="radio-label"><input type="radio" name="returningLearner" value="yes" ${enrollmentData.returningLearner === 'yes' ? 'checked' : ''}> Yes</label>
                                <label class="radio-label"><input type="radio" name="returningLearner" value="no" ${enrollmentData.returningLearner === 'no' ? 'checked' : ''}> No</label>
                            </div>
                            <div id="returningLearnerFields" style="display:${enrollmentData.returningLearner === 'yes' ? 'block' : 'none'}; margin-top: 10px;">
                                <div class="profile-field-row" data-field="lastGradeLevel">
                                    <span class="profile-field-label">LAST GRADE LEVEL COMPLETED</span>
                                    <select class="profile-select-input" id="lastGradeLevel" data-field="lastGradeLevel" style="max-width: 200px;">
                                        <option value="">Select Grade Level</option>
                                        <option value="6" ${enrollmentData.lastGradeLevel === '6' ? 'selected' : ''}>Grade 6</option>
                                        <option value="7" ${enrollmentData.lastGradeLevel === '7' ? 'selected' : ''}>Grade 7</option>
                                        <option value="8" ${enrollmentData.lastGradeLevel === '8' ? 'selected' : ''}>Grade 8</option>
                                        <option value="9" ${enrollmentData.lastGradeLevel === '9' ? 'selected' : ''}>Grade 9</option>
                                        <option value="10" ${enrollmentData.lastGradeLevel === '10' ? 'selected' : ''}>Grade 10</option>
                                        <option value="11" ${enrollmentData.lastGradeLevel === '11' ? 'selected' : ''}>Grade 11</option>
                                        <option value="12" ${enrollmentData.lastGradeLevel === '12' ? 'selected' : ''}>Grade 12</option>
                                    </select>
                                </div>
                                <div class="profile-field-row" data-field="lastSchoolYear">
                                    <span class="profile-field-label">LAST SCHOOL YEAR COMPLETED</span>
                                    <input type="text" class="profile-field-input" id="lastSchoolYear" data-field="lastSchoolYear" value="${escapeHtml(enrollmentData.lastSchoolYear||'')}" placeholder="e.g., 2024-2025" style="max-width: 200px;">
                                </div>
                                <div class="profile-field-row" data-field="lastSchoolAttended">
                                    <span class="profile-field-label">LAST SCHOOL ATTENDED</span>
                                    <input type="text" class="profile-field-input" id="lastSchoolAttended" data-field="lastSchoolAttended" value="${escapeHtml(enrollmentData.lastSchoolAttended||'')}" style="max-width: 300px;">
                                </div>
                                <div class="profile-field-row" data-field="schoolId">
                                    <span class="profile-field-label">SCHOOL ID</span>
                                    <input type="text" class="profile-field-input" id="schoolId" data-field="schoolId" value="${escapeHtml(enrollmentData.schoolId||'')}" style="max-width: 200px;">
                                </div>
                            </div>
                        </div>

                        <div class="profile-field-group" style="margin-top: 20px;">
                            <h4 class="profile-group-title">IP / 4Ps / PWD</h4>
                            <div class="profile-field-row" data-field="isIP">
                                <span class="profile-field-label">INDIGENOUS PERSON?</span>
                                <label class="radio-label"><input type="radio" name="isIP" value="yes" ${(String(enrollmentData.isIP||'').toLowerCase() === 'yes')?'checked':''}> Yes</label>
                                <label class="radio-label"><input type="radio" name="isIP" value="no" ${(String(enrollmentData.isIP||'').toLowerCase() !== 'yes')?'checked':''}> No</label>
                            </div>
                            <div id="ipFields" class="${String(enrollmentData.isIP||'').toLowerCase() === 'yes' ? '' : 'hidden'}" style="margin-top: 10px;">
                                <div class="profile-field-row" data-field="ipGroup">
                                    <span class="profile-field-label">IP GROUP</span>
                                    <select id="ipGroup" name="ipGroup" data-field="ipGroup">
                                        <option value="">Select IP Group</option>
                                        <!-- Cordillera Administrative Region (CAR) -->
                                        <optgroup label="Cordillera Region">
                                            <option value="ifugao" ${enrollmentData.ipGroup === 'ifugao' ? 'selected' : ''}>Ifugao</option>
                                            <option value="kalinga" ${enrollmentData.ipGroup === 'kalinga' ? 'selected' : ''}>Kalinga</option>
                                            <option value="kankanaey" ${enrollmentData.ipGroup === 'kankanaey' ? 'selected' : ''}>Kankanaey</option>
                                            <option value="ibaloi" ${enrollmentData.ipGroup === 'ibaloi' ? 'selected' : ''}>Ibaloi</option>
                                            <option value="bontoc" ${enrollmentData.ipGroup === 'bontoc' ? 'selected' : ''}>Bontoc</option>
                                            <option value="isneg" ${enrollmentData.ipGroup === 'isneg' ? 'selected' : ''}>Isneg (Apayao)</option>
                                            <option value="tinggian" ${enrollmentData.ipGroup === 'tinggian' ? 'selected' : ''}>Tinggian</option>
                                            <option value="karao" ${enrollmentData.ipGroup === 'karao' ? 'selected' : ''}>Karao</option>
                                        </optgroup>
                                        <!-- Luzon Region -->
                                        <optgroup label="Luzon Region">
                                            <option value="aeta" ${enrollmentData.ipGroup === 'aeta' ? 'selected' : ''}>Aeta</option>
                                            <option value="agta" ${enrollmentData.ipGroup === 'agta' ? 'selected' : ''}>Agta</option>
                                            <option value="ati" ${enrollmentData.ipGroup === 'ati' ? 'selected' : ''}>Ati</option>
                                            <option value="bugkalot" ${enrollmentData.ipGroup === 'bugkalot' ? 'selected' : ''}>Bugkalot (Ilongot)</option>
                                            <option value="dumagat" ${enrollmentData.ipGroup === 'dumagat' ? 'selected' : ''}>Dumagat</option>
                                            <option value="remontado" ${enrollmentData.ipGroup === 'remontado' ? 'selected' : ''}>Remontado</option>
                                        </optgroup>
                                        <!-- Visayas Region -->
                                        <optgroup label="Visayas Region">
                                            <option value="hanunoo" ${enrollmentData.ipGroup === 'hanunoo' ? 'selected' : ''}>Hanunoo</option>
                                            <option value="iraya-manobo" ${enrollmentData.ipGroup === 'iraya-manobo' ? 'selected' : ''}>Iraya Manobo</option>
                                            <option value="panay-bukidnon" ${enrollmentData.ipGroup === 'panay-bukidnon' ? 'selected' : ''}>Panay Bukidnon</option>
                                            <option value="suludnon" ${enrollmentData.ipGroup === 'suludnon' ? 'selected' : ''}>Suludnon</option>
                                            <option value="tagbanua" ${enrollmentData.ipGroup === 'tagbanua' ? 'selected' : ''}>Tagbanua</option>
                                        </optgroup>
                                        <!-- Mindanao - Muslim IP Groups -->
                                        <optgroup label="Mindanao - Muslim IP Groups">
                                            <option value="maranao" ${enrollmentData.ipGroup === 'maranao' ? 'selected' : ''}>Maranao</option>
                                            <option value="maguindanao" ${enrollmentData.ipGroup === 'maguindanao' ? 'selected' : ''}>Maguindanao</option>
                                            <option value="tausug" ${enrollmentData.ipGroup === 'tausug' ? 'selected' : ''}>Tausug</option>
                                            <option value="sama-bajau" ${enrollmentData.ipGroup === 'sama-bajau' ? 'selected' : ''}>Sama-Bajau</option>
                                            <option value="yakan" ${enrollmentData.ipGroup === 'yakan' ? 'selected' : ''}>Yakan</option>
                                        </optgroup>
                                        <!-- Mindanao - Lumad IP Groups -->
                                        <optgroup label="Mindanao - Lumad IP Groups">
                                            <option value="manobo" ${enrollmentData.ipGroup === 'manobo' ? 'selected' : ''}>Manobo (various)</option>
                                            <option value="bagobo" ${enrollmentData.ipGroup === 'bagobo' ? 'selected' : ''}>Bagobo</option>
                                            <option value="bukidnon" ${enrollmentData.ipGroup === 'bukidnon' ? 'selected' : ''}>Bukidnon</option>
                                            <option value="magsaysay" ${enrollmentData.ipGroup === 'magsaysay' ? 'selected' : ''}>Magsaysay</option>
                                            <option value="mandaya" ${enrollmentData.ipGroup === 'mandaya' ? 'selected' : ''}>Mandaya</option>
                                            <option value="mansaka" ${enrollmentData.ipGroup === 'mansaka' ? 'selected' : ''}>Mansaka</option>
                                            <option value="maragusan" ${enrollmentData.ipGroup === 'maragusan' ? 'selected' : ''}>Maragusan</option>
                                            <option value="tboli" ${enrollmentData.ipGroup === 'tboli' ? 'selected' : ''}>T'boli</option>
                                            <option value="blaan" ${enrollmentData.ipGroup === 'blaan' ? 'selected' : ''}>Blaan</option>
                                            <option value="tiruray" ${enrollmentData.ipGroup === 'tiruray' ? 'selected' : ''}>Tiruray</option>
                                            <option value="subanon" ${enrollmentData.ipGroup === 'subanon' ? 'selected' : ''}>Subanon</option>
                                            <option value="subanen" ${enrollmentData.ipGroup === 'subanen' ? 'selected' : ''}>Subanen</option>
                                        </optgroup>
                                        <!-- Palawan Region -->
                                        <optgroup label="Palawan Region">
                                            <option value="palawano" ${enrollmentData.ipGroup === 'palawano' ? 'selected' : ''}>Palawano</option>
                                            <option value="batak" ${enrollmentData.ipGroup === 'batak' ? 'selected' : ''}>Batak</option>
                                            <option value="molbog" ${enrollmentData.ipGroup === 'molbog' ? 'selected' : ''}>Molbog</option>
                                            <option value="tagbanua-palawan" ${enrollmentData.ipGroup === 'tagbanua-palawan' ? 'selected' : ''}>Tagbanua (Palawan)</option>
                                        </optgroup>
                                        <option value="other" ${enrollmentData.ipGroup === 'other' ? 'selected' : ''}>Other (Please specify)</option>
                                    </select>
                                </div>
                                <div id="ipOtherField" class="profile-field-row ${enrollmentData.ipGroup === 'other' ? '' : 'hidden'}" style="margin-left: 180px; margin-top: -10px;">
                                    <input type="text" class="profile-field-input" id="ipOtherText" data-field="ipOtherText" value="${escapeHtml(enrollmentData.ipOtherText||'')}" placeholder="Please specify">
                                </div>
                            </div>

                            <div class="profile-field-row" data-field="is4Ps" style="margin-top: 10px;">
                                <span class="profile-field-label">4Ps BENEFICIARY?</span>
                                <label class="radio-label"><input type="radio" name="is4Ps" value="yes" ${(String(enrollmentData.is4Ps||'').toLowerCase() === 'yes')?'checked':''}> Yes</label>
                                <label class="radio-label"><input type="radio" name="is4Ps" value="no" ${(String(enrollmentData.is4Ps||'').toLowerCase() !== 'yes')?'checked':''}> No</label>
                            </div>
                            <div id="fpsFields" class="profile-field-row ${String(enrollmentData.is4Ps||'').toLowerCase()==='yes'?'':'hidden'}" style="margin-left: 180px; margin-top: -10px;">
                                <input type="text" class="profile-field-input" id="householdID" data-field="householdID" value="${escapeHtml(enrollmentData.householdID||'')}" placeholder="4Ps Household ID">
                            </div>

                            <div class="profile-field-row" data-field="hasPWD" style="margin-top: 10px;">
                                <span class="profile-field-label">HAS DISABILITY?</span>
                                <label class="radio-label"><input type="radio" name="hasPWD" value="yes" ${(String(enrollmentData.hasPWD||'').toLowerCase() === 'yes')?'checked':''}> Yes</label>
                                <label class="radio-label"><input type="radio" name="hasPWD" value="no" ${(String(enrollmentData.hasPWD||'').toLowerCase() !== 'yes')?'checked':''}> No</label>
                            </div>
                            <div id="disabilityFields" class="${String(enrollmentData.hasPWD||'').toLowerCase()==='yes'?'':'hidden'}" style="margin-top: 10px;">
                                <!-- replicate disability options from enrollment form -->
                                <fieldset class="disability-category">
                                    <legend>☐ Visual Impairment</legend>
                                    <div class="disability-subcategory">
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="blind" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('blind') ? 'checked' : ''}>
                                            a. blind
                                        </label>
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="low-vision" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('low-vision') ? 'checked' : ''}>
                                            b. low vision
                                        </label>
                                    </div>
                                </fieldset>
                                <fieldset class="disability-category">
                                    <legend>☐ Hearing Impairment</legend>
                                    <div class="disability-subcategory">
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="autism-spectrum" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('autism-spectrum') ? 'checked' : ''}>
                                            Autism Spectrum Disorder
                                        </label>
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="speech-language" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('speech-language') ? 'checked' : ''}>
                                            Speech/Language Disorder
                                        </label>
                                    </div>
                                </fieldset>
                                <fieldset class="disability-category">
                                    <legend>☐ Learning Disability</legend>
                                    <div class="disability-subcategory">
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="emotional-behavioral" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('emotional-behavioral') ? 'checked' : ''}>
                                            Emotional-Behavioral Disorder
                                        </label>
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="cerebral-palsy" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('cerebral-palsy') ? 'checked' : ''}>
                                            Cerebral Palsy
                                        </label>
                                    </div>
                                </fieldset>
                                <fieldset class="disability-category">
                                    <legend>☐ Intellectual Disability</legend>
                                    <div class="disability-subcategory">
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="orthopedic-handicap" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('orthopedic-handicap') ? 'checked' : ''}>
                                            Orthopedic/Physical Handicap
                                        </label>
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="special-health" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('special-health') ? 'checked' : ''}>
                                            Special Health Problem/Chronic Disease
                                        </label>
                                    </div>
                                </fieldset>
                                <fieldset class="disability-category">
                                    <legend>☐ Multiple Disorder</legend>
                                    <div class="disability-subcategory">
                                        <label class="checkbox-label indent">
                                            <input type="checkbox" name="disability" value="cancer" ${Array.isArray(enrollmentData.disabilities) && enrollmentData.disabilities.includes('cancer') ? 'checked' : ''}>
                                            a. Cancer
                                        </label>
                                    </div>
                                </fieldset>
                                <div class="profile-field-row" data-field="disabilityDetails">
                                    <span class="profile-field-label">ADDITIONAL DETAILS (Optional)</span>
                                    <textarea id="disabilityDetails" name="disabilityDetails" class="profile-field-input" rows="3">${escapeHtml(enrollmentData.disabilityDetails||'')}</textarea>
                                </div>
                            </div>
                        </div>

                        <div class="profile-field-group" style="margin-top: 20px;">
                            <h4 class="profile-group-title">Parent / Guardian Information</h4>
                            <div class="profile-field-row" data-field="fatherName">
                                <span class="profile-field-label">FATHER'S NAME</span>
                                <input type="text" class="profile-field-input" id="fatherName" data-field="fatherName" value="${escapeHtml(enrollmentData.fatherName||'')}">
                            </div>
                            <div class="profile-field-row" data-field="fatherContact">
                                <span class="profile-field-label">FATHER'S CONTACT</span>
                                <input type="tel" class="profile-field-input" id="fatherContact" data-field="fatherContact" value="${escapeHtml(enrollmentData.fatherContact||'')}" placeholder="+63-9XX-XXX-XXXX">
                            </div>
                            <div class="profile-field-row" data-field="motherMaidenName">
                                <span class="profile-field-label">MOTHER'S MAIDEN NAME</span>
                                <input type="text" class="profile-field-input" id="motherMaidenName" data-field="motherMaidenName" value="${escapeHtml(enrollmentData.motherMaidenName||'')}">
                            </div>
                            <div class="profile-field-row" data-field="motherContact">
                                <span class="profile-field-label">MOTHER'S CONTACT</span>
                                <input type="tel" class="profile-field-input" id="motherContact" data-field="motherContact" value="${escapeHtml(enrollmentData.motherContact||'')}" placeholder="+63-9XX-XXX-XXXX">
                            </div>
                            <div class="profile-field-row" data-field="guardianName">
                                <span class="profile-field-label">LEGAL GUARDIAN'S NAME</span>
                                <input type="text" class="profile-field-input" id="guardianName" data-field="guardianName" value="${escapeHtml(enrollmentData.guardianName||'')}">
                            </div>
                            <div class="profile-field-row" data-field="guardianContact">
                                <span class="profile-field-label">LEGAL GUARDIAN'S CONTACT</span>
                                <input type="tel" class="profile-field-input" id="guardianContact" data-field="guardianContact" value="${escapeHtml(enrollmentData.guardianContact||'')}" placeholder="+63-9XX-XXX-XXXX">
                            </div>
                        </div>

                        <div class="profile-field-group" style="margin-top: 20px;">
                            <h4 class="profile-group-title">Learning Modality</h4>
                            <div class="profile-field-row" data-field="learningModality">
                                <span class="profile-field-label">MODALITY</span>
                                ${['modular-print','modular-digital','online','educational-tv','radio-based','homeschooling','blended'].map(m => {
                                    const checked = Array.isArray(enrollmentData.learningModality) ? enrollmentData.learningModality.includes(m) : String(enrollmentData.learningModality||'').split(',').map(x=>x.trim()).includes(m);
                                    return `<label class="checkbox-label"><input type="checkbox" name="learningModality" value="${m}" ${checked?'checked':''}> ${m.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</label>`;
                                }).join('')}
                            </div>
                        </div>

                        ${createFieldRow('STATUS', student.status)}
                    </div>
                </div>
            `;
            
            // Build academic information section with editable dropdowns
            // Use standardized categorized electives for Student Directory edit modal
            let academicElectives = JSON.parse(JSON.stringify(typeof STUDENT_DIRECTORY_ACADEMIC_ELECTIVES !== 'undefined' ? STUDENT_DIRECTORY_ACADEMIC_ELECTIVES : {}));
            let techproElectives = JSON.parse(JSON.stringify(typeof STUDENT_DIRECTORY_TECHPRO_ELECTIVES !== 'undefined' ? STUDENT_DIRECTORY_TECHPRO_ELECTIVES : {}));

            // if globals are blank, fall back to built-in lists
            if (!academicElectives || Object.keys(academicElectives).length === 0) {
                academicElectives = JSON.parse(JSON.stringify(getModalElectives().academic));
            }
            if (!techproElectives || Object.keys(techproElectives).length === 0) {
                techproElectives = JSON.parse(JSON.stringify(getModalElectives().techpro));
            }

            // helper to build static markup for a data object
            const buildElectivesMarkup = (data, name) => {
                const trackLabel = name === 'academicElectives' ? 'academic' : name === 'techproElectives' ? 'techpro' : '';
                return Object.keys(data).map(category => {
                    const list = Array.isArray(data[category]) ? data[category] : [];
                    const items = list.map(sub =>
                        `<label class="checkbox-label"><input type="checkbox" name="${name}" value="${sub}"> <span>${sub}</span></label>`
                    ).join('');
                    return `
                        <div class="elective-category" data-track="${trackLabel}">
                            <strong>${category}</strong>
                            <div class="elective-items">${items}</div>
                        </div>
                    `;
                }).join('');
            };


            const currentGradeLevel = String(student.grade || enrollmentData.gradeLevel || enrollmentRecord?.grade_to_enroll_id || '').trim();
            const currentTrack = String(student.track || enrollmentData.track || enrollmentRecord?.track || '').toLowerCase().trim();
            const currentSemester = String(enrollmentData.semester || enrollmentRecord?.semester || '').toLowerCase().trim();
            
            const ALL_KNOWN_ELECTIVES = [
                ...Object.values(typeof STUDENT_DIRECTORY_ACADEMIC_ELECTIVES !== 'undefined' ? STUDENT_DIRECTORY_ACADEMIC_ELECTIVES : {}).flat(),
                ...Object.values(typeof STUDENT_DIRECTORY_TECHPRO_ELECTIVES !== 'undefined' ? STUDENT_DIRECTORY_TECHPRO_ELECTIVES : {}).flat()
            ].map(v => String(v || '').trim());

            const toElectiveList = (value) => {
                const raw = Array.isArray(value)
                    ? value
                    : (typeof value === 'string'
                        ? (ALL_KNOWN_ELECTIVES.includes(String(value).trim()) ? [value] : value.split(','))
                        : []);
                const invalid = new Set(['', '-', '--', 'none', 'null', 'undefined', 'n/a', 'na']);
                return Array.from(new Set(
                    raw
                        .map(v => (v === undefined || v === null ? '' : String(v).trim()))
                        .filter(v => !invalid.has(v.toLowerCase()))
                ));
            };

            const adminOverride = getAdminEditedElectivesOverride(student.id, student.lrn, studentId);
            const canonicalProfileElectives = toElectiveList(student.electives || []);
            const existingEnrollmentElectives = toElectiveList(enrollmentData.electives);
            // IMPORTANT: prefer admin override first, then enrollment_data.electives,
            // and only then cached profile electives.
            const existingElectives = adminOverride.hasOverride
                ? adminOverride.electives
                : (existingEnrollmentElectives.length > 0
                    ? existingEnrollmentElectives
                    : canonicalProfileElectives);

            // Final canonical electives for Enrollment Details modal.
            // Mirror Student Profile behavior by preferring student.electives.
            const canonicalModalElectives = adminOverride.hasOverride
                ? adminOverride.electives
                : (canonicalProfileElectives.length > 0
                    ? canonicalProfileElectives
                    : existingElectives);
            enrollmentData.electives = canonicalModalElectives;
            
            const academicHTML = `
                <div class="enrollment-detail-section" data-section="academic">
                    <div class="profile-section">
                        <div class="profile-field-group">
                            <h4 class="profile-group-title">Academic Information</h4>
                            <!-- Grade Level Dropdown Only -->
                            <div class="profile-field-row" data-field="gradeLevel">
                                <span class="profile-field-label">GRADE LEVEL TO ENROLL</span>
                                <select class="profile-select-input" id="academicGradeLevel" data-field="gradeLevel" style="max-width: 200px;">
                                    <option value="">Select Grade Level</option>
                                    <option value="7" ${currentGradeLevel === '7' || currentGradeLevel === 'Grade 7' ? 'selected' : ''}>Grade 7</option>
                                    <option value="8" ${currentGradeLevel === '8' || currentGradeLevel === 'Grade 8' ? 'selected' : ''}>Grade 8</option>
                                    <option value="9" ${currentGradeLevel === '9' || currentGradeLevel === 'Grade 9' ? 'selected' : ''}>Grade 9</option>
                                    <option value="10" ${currentGradeLevel === '10' || currentGradeLevel === 'Grade 10' ? 'selected' : ''}>Grade 10</option>
                                    <option value="11" ${currentGradeLevel === '11' || currentGradeLevel === 'Grade 11' ? 'selected' : ''}>Grade 11</option>
                                    <option value="12" ${currentGradeLevel === '12' || currentGradeLevel === 'Grade 12' ? 'selected' : ''}>Grade 12</option>
                                </select>
                            </div>
                            <!-- senior high extra fields -->
                            <div id="seniorHighFields" class="hidden" style="margin-top:20px;">
                                <div class="profile-field-row" data-field="semester">
                                    <span class="profile-field-label">SEMESTER</span>
                                    <select id="academicSemester" class="profile-select-input" data-field="semester" style="max-width: 200px;">
                                        <option value="">Select Semester</option>
                                        <option value="first" ${currentSemester === 'first' ? 'selected' : ''}>First Semester</option>
                                        <option value="second" ${currentSemester === 'second' ? 'selected' : ''}>Second Semester</option>
                                    </select>
                                </div>
                                <div class="profile-field-row" data-field="track" style="margin-top:10px;">
                                    <span class="profile-field-label">TRACK</span>
                                    <select id="academicTrack" class="profile-select-input" data-field="track" style="max-width: 200px;">
                                        <option value="">Select Track</option>
                                        <option value="academic" ${currentTrack === 'academic' ? 'selected' : ''}>Academic Track</option>
                                        <option value="techpro" ${currentTrack === 'techpro' ? 'selected' : ''}>Tech-Pro Track</option>
                                        <option value="doorway" ${currentTrack === 'doorway' ? 'selected' : ''}>Doorway Track</option>
                                    </select>
                                </div>
                                <div id="academicElectiveSelection" class="profile-field-row senior-electives hidden" style="flex-direction:column; margin-top:10px;">
                                    <label style="font-weight:700;">Subjects / Electives</label>
                                    <div id="academicElectivesList" class="checkbox-group" style="border:1px solid #ccc; padding:8px;">
                                        <!-- electives will be rendered dynamically -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Store electives data in a data attribute for later use
            const enrollmentDetailModal = document.getElementById('enrollmentDetailModal');
            if (enrollmentDetailModal) {
                enrollmentDetailModal.dataset.academicElectives = JSON.stringify(academicElectives);
                enrollmentDetailModal.dataset.techproElectives = JSON.stringify(techproElectives);
                enrollmentDetailModal.dataset.existingElectives = JSON.stringify(canonicalModalElectives);
                enrollmentDetailModal.dataset.currentTrack = currentTrack;
            }
            
            // Build address information section
            const getCountries = () => Object.keys(window.PHILIPPINES_ADDRESSES || {});
            const getProvinces = (country) => Object.keys(window.PHILIPPINES_ADDRESSES?.[country] || {});
            const getMunicipalities = (country, province) => Object.keys(window.PHILIPPINES_ADDRESSES?.[country]?.[province] || {});
            const getBarangays = (country, province, municipality) => window.PHILIPPINES_ADDRESSES?.[country]?.[province]?.[municipality] || [];

            const withFallbackOption = (options, value) => {
                const list = Array.isArray(options) ? [...options] : [];
                const selected = (value === undefined || value === null) ? '' : String(value).trim();
                if (!selected) return list;
                const hasMatch = list.some(opt => String(opt).trim() === selected);
                if (!hasMatch) list.unshift(selected);
                return list;
            };
            
            const countriesRaw = getCountries();
            const countries = countriesRaw.length > 0 ? countriesRaw : ['Philippines'];
            const currentCountry = enrollmentData.currentCountry || enrollmentRecord?.currentCountry || ((enrollmentData.currentProvince || enrollmentData.currentMunicipality || enrollmentData.currentBarangay) ? 'Philippines' : '') || (countries.length > 0 ? countries[0] : '');
            const currentCountries = withFallbackOption(countries, currentCountry);
            const currentProvincesBase = getProvinces(currentCountry);
            const currentProvince = enrollmentData.currentProvince || (currentProvincesBase.length > 0 ? currentProvincesBase[0] : '');
            const currentProvinces = withFallbackOption(currentProvincesBase, currentProvince);
            const currentMunicipalitiesBase = getMunicipalities(currentCountry, currentProvince);
            const currentMunicipality = enrollmentData.currentMunicipality || (currentMunicipalitiesBase.length > 0 ? currentMunicipalitiesBase[0] : '');
            const currentMunicipalities = withFallbackOption(currentMunicipalitiesBase, currentMunicipality);
            const currentBarangaysBase = getBarangays(currentCountry, currentProvince, currentMunicipality);
            const currentBarangays = withFallbackOption(currentBarangaysBase, enrollmentData.currentBarangay || enrollmentRecord?.cu_address_barangay_id || enrollmentRecord?.currentBarangay || '');
            // fallback raw values for sitio/zip in case enrollmentData missing
            const currentSitioVal = enrollmentData.currentSitio || enrollmentRecord?.cu_address_sitio_street || enrollmentRecord?.currentSitio || '';
            const currentBarangayVal = enrollmentData.currentBarangay || enrollmentRecord?.cu_address_barangay_id || enrollmentRecord?.currentBarangay || '';
            const currentMunicipalityVal = currentMunicipality;
            const currentProvinceVal = currentProvince;
            const currentCountryVal = currentCountry;
            const currentZipVal = enrollmentData.currentZipCode || enrollmentRecord?.cu_address_zip || enrollmentRecord?.currentZipCode || '';
            
            // Same for permanent address
            const permCountry = enrollmentData.permanentCountry || enrollmentRecord?.permanentCountry || ((enrollmentData.permanentProvince || enrollmentData.permanentMunicipality || enrollmentData.permanentBarangay || enrollmentRecord?.pe_address_sitio_street || enrollmentRecord?.pe_address_zip) ? 'Philippines' : currentCountry);
            const permCountries = withFallbackOption(countries, permCountry);
            const permProvincesBase = getProvinces(permCountry);
            const permProvince = enrollmentData.permanentProvince || (permProvincesBase.length > 0 ? permProvincesBase[0] : '');
            const permProvinces = withFallbackOption(permProvincesBase, permProvince);
            const permMunicipalitiesBase = getMunicipalities(permCountry, permProvince);
            const permMunicipality = enrollmentData.permanentMunicipality || (permMunicipalitiesBase.length > 0 ? permMunicipalitiesBase[0] : '');
            const permMunicipalities = withFallbackOption(permMunicipalitiesBase, permMunicipality);
            const permBarangaysBase = getBarangays(permCountry, permProvince, permMunicipality);
            // fallback raw values for permanent address
            const permSitioVal = enrollmentData.permanentSitio || enrollmentRecord?.pe_address_sitio_street || enrollmentRecord?.permanentSitio || '';
            const permBarangayVal = enrollmentData.permanentBarangay || enrollmentRecord?.pe_address_barangay_id || enrollmentRecord?.permanentBarangay || '';
            const permBarangays = withFallbackOption(permBarangaysBase, permBarangayVal);
            const permZipVal = enrollmentData.permanentZipCode || enrollmentRecord?.pe_address_zip || enrollmentRecord?.permanentZipCode || '';
            
            const sameAsCurrentAddressChecked = (
                String(enrollmentData.sameAsCurrentAddress || '').toLowerCase() === 'yes' ||
                String(enrollmentData.sameAsCurrentAddress || '').toLowerCase() === 'true' ||
                (
                    currentSitioVal === permSitioVal &&
                    currentBarangayVal === permBarangayVal &&
                    currentMunicipality === permMunicipality &&
                    currentProvince === permProvince &&
                    currentCountry === permCountry &&
                    currentZipVal === permZipVal
                )
            );

            const addressHTML = `
                <div class="enrollment-detail-section" data-section="address">
                    <div class="profile-section">
                        <h4 class="address-subheader">Current Address</h4>
                        
                        <!-- Street/Sitio Input -->
                        <div class="profile-field-row" data-field="currentSitio">
                            <span class="profile-field-label">STREET/SITIO</span>
                            <input type="text" class="profile-field-input" id="currentSitio" data-field="currentSitio" value="${escapeHtml(currentSitioVal)}" style="max-width: 300px;" placeholder="House number, street name, or sito">
                        </div>
                        
                        <!-- Country Dropdown -->
                        <div class="profile-field-row" data-field="currentCountry">
                            <span class="profile-field-label">COUNTRY</span>
                            <select class="profile-select-input" id="currentCountry" data-field="currentCountry" style="max-width: 200px;">
                                ${currentCountries.map(country => `<option value="${country}" ${String(currentCountry) === String(country) ? 'selected' : ''}>${country}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Province Dropdown -->
                        <div class="profile-field-row" data-field="currentProvince">
                            <span class="profile-field-label">PROVINCE</span>
                            <select class="profile-select-input" id="currentProvince" data-field="currentProvince" style="max-width: 200px;">
                                ${currentProvinces.map(province => `<option value="${province}" ${String(currentProvince) === String(province) ? 'selected' : ''}>${province}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Municipality/City Dropdown -->
                        <div class="profile-field-row" data-field="currentMunicipality">
                            <span class="profile-field-label">MUNICIPALITY/CITY</span>
                            <select class="profile-select-input" id="currentMunicipality" data-field="currentMunicipality" style="max-width: 200px;">
                                ${currentMunicipalities.map(mun => `<option value="${mun}" ${String(currentMunicipality) === String(mun) ? 'selected' : ''}>${mun}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Barangay Dropdown -->
                        <div class="profile-field-row" data-field="currentBarangay">
                            <span class="profile-field-label">BARANGAY</span>
                            <select class="profile-select-input" id="currentBarangay" data-field="currentBarangay" style="max-width: 200px;">
                                ${currentBarangays.map(barangay => `<option value="${barangay}" ${(currentBarangayVal === barangay) ? 'selected' : ''}>${barangay}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Zip Code Input -->
                        <div class="profile-field-row" data-field="currentZipCode">
                            <span class="profile-field-label">ZIP CODE</span>
                            <input type="text" class="profile-field-input" id="currentZipCode" data-field="currentZipCode" value="${escapeHtml(currentZipVal)}" style="max-width: 150px;" placeholder="Postal code">
                        </div>
                        
                        <h4 class="address-subheader" style="margin-top: 20px;">Permanent Address</h4>
                        
                        <!-- Same as Current Address Checkbox -->
                        <div class="profile-field-row" style="margin-bottom: 15px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="sameAsCurrentAddress" style="cursor: pointer;" ${sameAsCurrentAddressChecked ? 'checked' : ''}>
                                <span style="font-size: 13px;">Same as Current Address</span>
                            </label>
                        </div>
                        
                        <!-- Street/Sitio Input -->
                        <div class="profile-field-row" data-field="permanentSitio">
                            <span class="profile-field-label">STREET/SITIO</span>
                            <input type="text" class="profile-field-input permanent-address-field" id="permanentSitio" data-field="permanentSitio" value="${escapeHtml(permSitioVal)}" style="max-width: 300px;" placeholder="House number, street name, or sito">
                        </div>
                        
                        <!-- Country Dropdown -->
                        <div class="profile-field-row" data-field="permanentCountry">
                            <span class="profile-field-label">COUNTRY</span>
                            <select class="profile-select-input permanent-address-field" id="permanentCountry" data-field="permanentCountry" style="max-width: 200px;">
                                ${permCountries.map(country => `<option value="${country}" ${String(permCountry) === String(country) ? 'selected' : ''}>${country}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Province Dropdown -->
                        <div class="profile-field-row" data-field="permanentProvince">
                            <span class="profile-field-label">PROVINCE</span>
                            <select class="profile-select-input permanent-address-field" id="permanentProvince" data-field="permanentProvince" style="max-width: 200px;">
                                ${permProvinces.map(province => `<option value="${province}" ${String(permProvince) === String(province) ? 'selected' : ''}>${province}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Municipality/City Dropdown -->
                        <div class="profile-field-row" data-field="permanentMunicipality">
                            <span class="profile-field-label">MUNICIPALITY/CITY</span>
                            <select class="profile-select-input permanent-address-field" id="permanentMunicipality" data-field="permanentMunicipality" style="max-width: 200px;">
                                ${permMunicipalities.map(mun => `<option value="${mun}" ${String(permMunicipality) === String(mun) ? 'selected' : ''}>${mun}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Barangay Dropdown -->
                        <div class="profile-field-row" data-field="permanentBarangay">
                            <span class="profile-field-label">BARANGAY</span>
                            <select class="profile-select-input permanent-address-field" id="permanentBarangay" data-field="permanentBarangay" style="max-width: 200px;">
                                ${permBarangays.map(barangay => `<option value="${barangay}" ${(permBarangayVal === barangay) ? 'selected' : ''}>${barangay}</option>`).join('')}
                            </select>
                        </div>
                        
                        <!-- Zip Code Input -->
                        <div class="profile-field-row" data-field="permanentZipCode">
                            <span class="profile-field-label">ZIP CODE</span>
                            <input type="text" class="profile-field-input permanent-address-field" id="permanentZipCode" data-field="permanentZipCode" value="${escapeHtml(permZipVal)}" style="max-width: 150px;" placeholder="Postal code">
                        </div>
                    </div>
                </div>
            `;
            
            // Build documents section placeholder (will be populated with interactive controls)
            const documentsHTML = `
                <div class="enrollment-detail-section" data-section="documents">
                    <div class="profile-section">
                        <div id="enrollmentDocumentsContainer"></div>
                    </div>
                    <input type="file" id="enrollmentDocFileInput" accept="image/*,application/pdf" style="display:none" />
                </div>
            `;
            
            container.innerHTML = personalHTML + academicHTML + addressHTML + documentsHTML;
            
            // run enrollment modal conditionals (IP/4Ps/PWD/others)
            try {
                if (typeof setupEnrollmentModalConditionals === 'function') {
                    setupEnrollmentModalConditionals();
                }
                if (typeof triggerEnrollmentConditionals === 'function') {
                    triggerEnrollmentConditionals();
                }
            } catch (_e) {
                console.warn('could not run enrollment conditionals:', _e && _e.message);
            }

            // Setup academic tab conditional displays and electives
            setupAcademicTab(container);

            // Setup inline editing for editable fields
            setupInlineEditing(container);

            // Populate Enrollment Documents container with interactive controls (Replace / Remove)
            try {
                const docsContainer = document.getElementById('enrollmentDocumentsContainer');
                const fileInputId = 'enrollmentDocFileInput';
                let fileInput = document.getElementById(fileInputId);
                if (!fileInput) {
                    fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/*,application/pdf';
                    fileInput.id = fileInputId;
                    fileInput.style.display = 'none';
                    container.appendChild(fileInput);
                }

                fileInput.onchange = async function(e) {
                    const f = e.target.files && e.target.files[0];
                    if (!f) return;
                    const key = fileInput.dataset.key;
                    const reader = new FileReader();
                    reader.onload = async function(ev) {
                        const dataUrl = ev.target.result;
                        const previewImg = document.querySelector(`#enrollmentDocumentsContainer .document-preview-container[data-key="${key}"] .document-preview-image`);
                        const iconEl = document.querySelector(`#enrollmentDocumentsContainer .document-preview-container[data-key="${key}"] .document-icon`);
                        if (previewImg) previewImg.src = dataUrl;
                        else if (iconEl) {
                            const img = document.createElement('img');
                            img.src = dataUrl;
                            img.className = 'document-preview-image';
                            img.style.cursor = 'pointer';
                            img.addEventListener('click', () => viewDocument(dataUrl));
                            iconEl.parentNode.replaceChild(img, iconEl);
                        }
                        student.enrollmentFiles = student.enrollmentFiles || {};
                        student.enrollmentFiles[key] = dataUrl;
                        try { await sendDocumentUpdate(currentProfileStudentId || student.id || student.lrn, key, dataUrl); showNotification('Document updated', 'success'); }
                        catch (err) { console.warn('Document update failed', err); showNotification('Document updated locally', 'info'); }
                        fileInput.value = ''; delete fileInput.dataset.key;
                    };
                    reader.readAsDataURL(f);
                };

                if (docsContainer) {
                    docsContainer.innerHTML = '';
                    if (student.enrollmentFiles && Object.keys(student.enrollmentFiles).length > 0) {
                        const documentGrid = document.createElement('div');
                        documentGrid.className = 'document-grid';
                        Object.entries(student.enrollmentFiles).forEach(([key, dataUrl]) => {
                            const docLabel = key === 'psaBirthCert' ? 'PSA Birth Certificate' : key === 'reportCard' ? 'Report Card' : key === 'studentImage' ? 'Student Photo' : key;
                            const isImage = dataUrl && dataUrl.startsWith('data:image');

                            const containerEl = document.createElement('div');
                            containerEl.className = 'document-preview-container';
                            containerEl.dataset.key = key;

                            if (isImage) {
                                const img = document.createElement('img');
                                img.src = dataUrl;
                                img.alt = docLabel;
                                img.className = 'document-preview-image';
                                img.style.cursor = 'pointer';
                                img.addEventListener('click', () => viewDocument(dataUrl));
                                containerEl.appendChild(img);
                            } else {
                                const icon = document.createElement('div');
                                icon.className = 'document-icon';
                                icon.textContent = '📄';
                                containerEl.appendChild(icon);
                            }

                            const label = document.createElement('div');
                            label.className = 'document-label';
                            label.textContent = docLabel;
                            containerEl.appendChild(label);

                            const controls = document.createElement('div');
                            controls.className = 'document-controls';

                            const replaceBtn = document.createElement('button');
                            replaceBtn.className = 'btn btn-tertiary';
                            replaceBtn.textContent = 'Replace';
                            replaceBtn.addEventListener('click', () => {
                                fileInput.dataset.key = key;
                                fileInput.click();
                            });

                            const removeBtn = document.createElement('button');
                            removeBtn.className = 'btn btn-reject';
                            removeBtn.textContent = 'Remove';
                            removeBtn.addEventListener('click', async () => {
                                if (!confirm('Remove this document?')) return;
                                // Remove only the preview (image or icon), keep the container with label and controls
                                const previewImg = containerEl.querySelector('.document-preview-image');
                                const previewIcon = containerEl.querySelector('.document-icon');
                                if (previewImg) previewImg.remove();
                                else if (previewIcon) previewIcon.remove();
                                // Insert a placeholder icon if nothing remains in the visual area
                                if (!containerEl.querySelector('.document-preview-image') && !containerEl.querySelector('.document-icon')) {
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'document-icon';
                                    placeholder.textContent = '📄';
                                    // insert at the top of the container (before label)
                                    const labelEl = containerEl.querySelector('.document-label');
                                    if (labelEl) containerEl.insertBefore(placeholder, labelEl);
                                    else containerEl.insertBefore(placeholder, containerEl.firstChild);
                                }
                                // Remove from in-memory files and try server-side removal
                                delete student.enrollmentFiles[key];
                                try { await sendDocumentRemove(currentProfileStudentId || student.id || student.lrn, key); showNotification('Document removed', 'success'); }
                                catch (err) { console.warn('Document remove failed', err); showNotification('Document removed locally', 'info'); }
                                // If no documents remain, replace the documents area with a no-data message
                                if (!student.enrollmentFiles || Object.keys(student.enrollmentFiles).length === 0) {
                                    docsContainer.innerHTML = '<p style="color: #666; font-style: italic;">No documents submitted.</p>';
                                }
                            });

                            controls.appendChild(replaceBtn);
                            controls.appendChild(removeBtn);
                            containerEl.appendChild(controls);

                            documentGrid.appendChild(containerEl);
                        });
                        docsContainer.appendChild(documentGrid);
                    } else {
                        docsContainer.innerHTML = '<p style="color: #666; font-style: italic;">No documents submitted.</p>';
                    }
                }
            } catch (e) { console.warn('Failed to setup enrollment documents UI', e); }

            // Setup tab switching for the modal
            try {
                setupEnrollmentDetailTabs();
            } catch (e) { /* ignore */ }
        } catch (err) {
            console.error('[Students] build modal error', err);
            // display short message inside modal to help debugging when user doesn't open console
            const errorMsg = err && err.message ? err.message : String(err);
            const safeMsg = errorMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            container.innerHTML = `<div style="padding:20px;color:#c00;">Failed to load edit form: ${safeMsg}</div>`;
        }
    }

    const modal = document.getElementById('enrollmentDetailModal');
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'auto';
        modal.setAttribute('aria-hidden','false');
    }
}

function reviewEnrollmentDetail() {
    console.log('🟡🟡🟡 reviewEnrollmentDetail CALLED 🟡🟡🟡');
    const idKey = currentProfileStudentId;
    console.log('[Students] In reviewEnrollmentDetail - currentProfileStudentId:', idKey);
    if (!idKey) { 
        console.error('[Students] ❌ No student selected for review');
        showNotification('No student selected', 'warning'); 
        return; 
    }

    // Try to find an existing form; if none exists (inline edit UI), collect inputs from the container
    const fullForm = document.getElementById('enrollmentForm') || document.getElementById('enrollmentEditForm');
    let updated = {};
    if (fullForm && fullForm.tagName === 'FORM') {
        const fd = new FormData(fullForm);
        const obj = {};
        for (const [k, v] of fd.entries()) {
            if (obj.hasOwnProperty(k)) {
                if (!Array.isArray(obj[k])) obj[k] = [obj[k]];
                obj[k].push(v);
            } else {
                obj[k] = v;
            }
        }
        updated = { enrollment_data: obj };
        if (obj.firstName || obj.lastName) updated.fullName = `${obj.firstName || ''} ${obj.lastName || ''}`.trim();
        if (obj.lrn) updated.lrn = obj.lrn;
        if (obj.gradeLevel || obj.grade) updated.grade = obj.gradeLevel || obj.grade;
        if (obj.track) updated.track = obj.track;
        if (obj.status) updated.status = obj.status;
    } else {
        // Collect inputs/selects/textareas from the enrollment detail container
        const container = document.getElementById('enrollmentDetail');
        const obj = {};
        if (container) {
            const elements = container.querySelectorAll('input, select, textarea');
            elements.forEach(el => {
                // Prefer element's own data-field/name/id, otherwise look up to the nearest ancestor with data-field
                let key = el.dataset.field || el.name || el.id;
                if (!key && el.closest) {
                    const parent = el.closest('[data-field]');
                    if (parent) key = parent.dataset.field;
                }
                if (!key) return;
                let value = '';
                if (el.type === 'checkbox') value = el.checked ? (el.value || 'yes') : (el.dataset.offValue || 'no');
                else if (el.type === 'radio') { if (!el.checked) return; else value = el.value; }
                else value = el.value;

                if (obj.hasOwnProperty(key)) {
                    if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
                    obj[key].push(value);
                } else {
                    obj[key] = value;
                }
            });

            // EXPLICITLY GET TRACK FROM FORM - Critical for track change detection
            const trackSelect = container.querySelector('#academicTrack');
            if (trackSelect) {
                const formTrack = trackSelect.value;
                if (formTrack) {
                    obj.track = formTrack;
                    console.log('[Students] EXPLICIT TRACK COLLECTION: formTrack from select:', formTrack);
                }
            }

            // Collect elective selections: prefer dataset on track select, otherwise check checkboxes
            try {
                let electives = [];
                const trackSelectEl = container.querySelector('#academicTrack') || document.querySelector('#academicTrack');
                if (trackSelectEl && trackSelectEl.dataset && trackSelectEl.dataset.selectedElectives) {
                    try { const parsed = JSON.parse(trackSelectEl.dataset.selectedElectives); if (Array.isArray(parsed)) electives = parsed; else if (parsed) electives = [parsed]; } catch(e) { /* ignore parse */ }
                }

                // Fallback: look for checkboxes inside electives container and categorize by name
                const electiveCheckboxes = container.querySelectorAll('.elective-checkbox');
                let academicSelections = [];
                let techproSelections = [];
                let doorwayAcadSelections = [];
                let doorwayTechSelections = [];
                electives = [];

                if (electiveCheckboxes && electiveCheckboxes.length > 0) {
                    electiveCheckboxes.forEach(cb => {
                        if (!cb.checked) return;
                        const val = cb.value;
                        electives.push(val);
                        switch (cb.name) {
                            case 'academicElectives': academicSelections.push(val); break;
                            case 'techproElectives': techproSelections.push(val); break;
                            case 'doorwayAcademic': doorwayAcadSelections.push(val); break;
                            case 'doorwayTechPro': doorwayTechSelections.push(val); break;
                            default: break;
                        }
                    });
                }

                // IMPORTANT: When track changes, clear ALL old electives and only keep new ones
                const newTrack = obj.track || '';

                // Always clear all track-specific electives first - EXPLICITLY set to empty arrays
                obj.academicElectives = [];
                obj.techproElectives = [];
                obj.doorwayAcademic = [];
                obj.doorwayTechpro = [];
                obj.electives = [];

                if (newTrack.toLowerCase().includes('academic')) {
                    obj.academicElectives = academicSelections;
                    obj.electives = academicSelections.slice();
                } else if (newTrack.toLowerCase().includes('techpro')) {
                    obj.techproElectives = techproSelections;
                    obj.electives = techproSelections.slice();
                } else if (newTrack.toLowerCase().includes('doorway')) {
                    obj.doorwayAcademic = doorwayAcadSelections;
                    obj.doorwayTechpro = doorwayTechSelections;
                    obj.electives = [...doorwayAcadSelections, ...doorwayTechSelections];
                } else {
                    // no track selected, just clear everything
                }
            } catch (e) { console.warn('Electives collect failed', e); }
        }
        updated = { enrollment_data: obj };
        if (obj.firstName || obj.lastName) updated.fullName = `${obj.firstName || ''} ${obj.lastName || ''}`.trim();
        if (obj.lrn) updated.lrn = obj.lrn || obj.lrn;
        if (obj.gradeLevel || obj.grade) updated.grade = obj.gradeLevel || obj.grade;
        if (obj.track) updated.track = obj.track;
        if (obj.status) updated.status = obj.status;
        
        // DEBUG: Log collected form data
        console.log('[Students] FORM DATA COLLECTED - obj.track:', obj.track, 'updated.track:', updated.track);
        console.log('[Students] Full obj:', JSON.stringify(obj, null, 2));
    }

    // Find existing student record for comparison
    const student = allStudents.find(s => {
        const sId = String(s.id || '').trim();
        const normalizedId = String(idKey).trim();
        const sLrn = String(s.lrn || '').trim();
        return sId === normalizedId || sLrn === normalizedId;
    }) || null;

    // Store the updated data for later confirmation
    window.pendingEnrollmentUpdate = updated;
    window.pendingEnrollmentStudent = student;
    
    // DEBUG: Log the pending update object before review
    console.log('[Students] BEFORE REVIEW - pendingEnrollmentUpdate:', JSON.stringify(updated, null, 2));
    console.log('[Students] BEFORE REVIEW - pendingEnrollmentUpdate.track:', updated.track);

    // Generate review HTML with comparison to existing data
    displayEnrollmentReview(updated, student);
}

function displayEnrollmentReview(updatedData, student) {
    console.log('🔵🔵🔵 displayEnrollmentReview CALLED 🔵🔵🔵');
    console.log('[Students] displayEnrollmentReview - updatedData:', updatedData);
    console.log('[Students] displayEnrollmentReview - student:', student?.fullName);
    
    const reviewContent = document.getElementById('reviewContent');
    if (!reviewContent) return;

    const enrollmentData = updatedData.enrollment_data || {};
    const existingEnrollment = (student && (student.enrollment_data ? (typeof student.enrollment_data === 'string' ? (() => { try { return JSON.parse(student.enrollment_data); } catch(e){ return {}; } })() : student.enrollment_data) : {})) || {};

    const isChanged = (fieldKey, newVal) => {
        const oldVal = (existingEnrollment && existingEnrollment[fieldKey]) || (student && student[fieldKey]) || '';
        const a = (newVal === undefined || newVal === null) ? '' : String(newVal);
        const b = (oldVal === undefined || oldVal === null) ? '' : String(oldVal);
        return a.trim() !== '' && a !== b;
    };

    let html = '';

    // helper to add a labeled row (label left, value right)
    const addInfo = (label, value, changed) => {
        html += `<div class="info-item ${changed ? 'changed' : ''}"><div class="info-row"><div class="info-label">${label}</div><div class="info-value">${value}</div></div></div>`;
    };



    // Personal Section
    html += '<div class="review-block"><h4>LEARNER INFORMATION</h4><div class="info-grid">';

    // Build full name from first, middle, and last names (skip middle if empty or placeholder '--')
    const firstName = (updatedData.firstName || enrollmentData.firstName || (student && student.firstName) || '').toString().trim();
    const middleName = (updatedData.middleName || enrollmentData.middleName || '').toString().trim();
    const lastName = (updatedData.lastName || enrollmentData.lastName || (student && student.lastName) || '').toString().trim();

    // Filter out empty values and placeholder markers like '--'
    const nameParts = [firstName, middleName, lastName].filter(n => {
        const text = String(n || '').trim();
        return !!text && text !== '-' && text !== '--' && text !== '–' && text.toLowerCase() !== 'null' && text.toLowerCase() !== 'undefined';
    });
    const fullNameNew = nameParts.join(' ').trim();
    const fullNameChanged = isChanged('fullName', fullNameNew) || isChanged('firstName', firstName) || isChanged('lastName', lastName) || isChanged('middleName', middleName);
    // Prefer constructed name, fall back to any provided fullName or student.fullName; don't insert '--'
    const fallbackFull = (updatedData.fullName || '') || (student && student.fullName) || '';
    const fullNameDisplay = (fullNameNew && fullNameNew.length) ? fullNameNew : (fallbackFull && String(fallbackFull).trim()) || '';
    if (fullNameDisplay) addInfo('FULL NAME:', fullNameDisplay, fullNameChanged);

    const lrnNew = updatedData.lrn || enrollmentData.lrn || '';
    const lrnChanged = isChanged('lrn', lrnNew);
    addInfo('LRN / ID:', lrnNew || (student && student.lrn) || '--', lrnChanged);

    const extensionNew = updatedData.extensionName || enrollmentData.extensionName || '';
    const extensionChanged = isChanged('extensionName', extensionNew);
    addInfo('EXTENSION NAME:', extensionNew || '--', extensionChanged);

    const returningNew = enrollmentData.returningLearner || existingEnrollment.returningLearner || '';
    const returningChanged = isChanged('returningLearner', returningNew);
    addInfo('RETURNING LEARNER:', returningNew || '--', returningChanged);
    if (String(returningNew).toLowerCase() === 'yes') {
        const lastGrade = enrollmentData.lastGradeLevel || existingEnrollment.lastGradeLevel || '';
        const lastYear = enrollmentData.lastSchoolYear || existingEnrollment.lastSchoolYear || '';
        const lastSchool = enrollmentData.lastSchoolAttended || existingEnrollment.lastSchoolAttended || '';
        const schoolId = enrollmentData.schoolId || existingEnrollment.schoolId || '';
        addInfo('LAST GRADE LEVEL COMPLETED:', lastGrade || '--', isChanged('lastGradeLevel', lastGrade));
        addInfo('LAST SCHOOL YEAR COMPLETED:', lastYear || '--', isChanged('lastSchoolYear', lastYear));
        addInfo('LAST SCHOOL ATTENDED:', lastSchool || '--', isChanged('lastSchoolAttended', lastSchool));
        addInfo('SCHOOL ID:', schoolId || '--', isChanged('schoolId', schoolId));
    }

    const birthNew = updatedData.birthdate || enrollmentData.birthdate || '';
    const birthChanged = isChanged('birthdate', birthNew);
    addInfo('BIRTHDATE:', birthNew || (student && student.birthdate) || '--', birthChanged);

    const ageVal = (() => {
        const b = birthNew || (student && student.birthdate) || '';
        if (!b) return '--';
        try { const d = new Date(b); const today = new Date(); let age = today.getFullYear() - d.getFullYear(); const m = today.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--; return age >= 0 ? age : '--'; } catch(e) { return '--'; }
    })();
    addInfo('AGE:', ageVal, false);

    const genderNew = updatedData.sex || updatedData.gender || enrollmentData.sex || enrollmentData.gender || (student && student.gender) || '';
    const genderChanged = isChanged('gender', genderNew) || isChanged('sex', genderNew);
    addInfo('SEX:', (genderNew || '--').toString().toUpperCase(), genderChanged);

    const pobNew = enrollmentData.placeOfBirth || existingEnrollment.placeOfBirth || (student && student.placeOfBirth) || '';
    const pobChanged = isChanged('placeOfBirth', pobNew);
    addInfo('PLACE OF BIRTH:', pobNew || '--', pobChanged);

    const motherTongueNew = enrollmentData.motherTongue || enrollmentData.mother_tongue || existingEnrollment.motherTongue || existingEnrollment.mother_tongue || (student && student.mother_tongue) || '';
    const mtChanged = isChanged('motherTongue', motherTongueNew);
    addInfo('MOTHER TONGUE:', motherTongueNew || '--', mtChanged);

    // Additional personal fields
    const ipNew = enrollmentData.isIP || existingEnrollment.isIP || '';
    const ipChanged = isChanged('isIP', ipNew);
    addInfo('INDIGENOUS PERSON:', ipNew || '--', ipChanged);
    if (String(ipNew).toLowerCase() === 'yes') {
        const ipGroupNew = enrollmentData.ipGroup || existingEnrollment.ipGroup || '';
        const ipGroupChanged = isChanged('ipGroup', ipGroupNew);
        addInfo('IP GROUP:', ipGroupNew || '--', ipGroupChanged);
        if (ipGroupNew === 'other') {
            const ipOtherNew = enrollmentData.ipOtherText || existingEnrollment.ipOtherText || '';
            const ipOtherChanged = isChanged('ipOtherText', ipOtherNew);
            addInfo('IP (OTHER):', ipOtherNew || '--', ipOtherChanged);
        }
    }

    const fourPsNew = enrollmentData.is4Ps || existingEnrollment.is4Ps || '';
    const fourPsChanged = isChanged('is4Ps', fourPsNew);
    addInfo('4Ps BENEFICIARY:', fourPsNew || '--', fourPsChanged);
    if (String(fourPsNew).toLowerCase() === 'yes') {
        const hhNew = enrollmentData.householdID || existingEnrollment.householdID || '';
        const hhChanged = isChanged('householdID', hhNew);
        addInfo('HOUSEHOLD ID:', hhNew || '--', hhChanged);
    }

    const pwdNew = enrollmentData.hasPWD || existingEnrollment.hasPWD || '';
    const pwdChanged = isChanged('hasPWD', pwdNew);
    addInfo('HAS DISABILITY:', pwdNew || '--', pwdChanged);
    if (String(pwdNew).toLowerCase() === 'yes') {
        const detailsNew = enrollmentData.disabilityDetails || existingEnrollment.disabilityDetails || '';
        const detailsChanged = isChanged('disabilityDetails', detailsNew);
        addInfo('DISABILITY DETAILS:', detailsNew || '--', detailsChanged);
    }

    const fatherNew = enrollmentData.fatherName || existingEnrollment.fatherName || '';
    const fatherChanged = isChanged('fatherName', fatherNew);
    addInfo("FATHER'S NAME:", fatherNew || '--', fatherChanged);
    const fatherContactNew = enrollmentData.fatherContact || existingEnrollment.fatherContact || '';
    const fatherContactChanged = isChanged('fatherContact', fatherContactNew);
    addInfo("FATHER'S CONTACT:", fatherContactNew || '--', fatherContactChanged);
    const motherNew = enrollmentData.motherMaidenName || existingEnrollment.motherMaidenName || '';
    const motherChanged = isChanged('motherMaidenName', motherNew);
    addInfo("MOTHER'S MAIDEN NAME:", motherNew || '--', motherChanged);
    const motherContactNew = enrollmentData.motherContact || existingEnrollment.motherContact || '';
    const motherContactChanged = isChanged('motherContact', motherContactNew);
    addInfo("MOTHER'S CONTACT:", motherContactNew || '--', motherContactChanged);
    const guardNew = enrollmentData.guardianName || existingEnrollment.guardianName || '';
    const guardChanged = isChanged('guardianName', guardNew);
    addInfo("GUARDIAN NAME:", guardNew || '--', guardChanged);
    const guardContactNew = enrollmentData.guardianContact || existingEnrollment.guardianContact || '';
    const guardContactChanged = isChanged('guardianContact', guardContactNew);
    addInfo("GUARDIAN CONTACT:", guardContactNew || '--', guardContactChanged);

    const modalitiesNew = enrollmentData.learningModality || existingEnrollment.learningModality || '';
    const modalitiesText = Array.isArray(modalitiesNew) ? modalitiesNew.join(', ') : String(modalitiesNew);
    const modalitiesChanged = isChanged('learningModality', modalitiesText);
    addInfo('LEARNING MODALITY:', modalitiesText || '--', modalitiesChanged);


    html += '</div></div>';

    // Academic Section
    html += '<div class="review-block"><h4>ACADEMIC INFORMATION</h4><div class="info-grid">';
    const gradeNew = updatedData.grade || enrollmentData.gradeLevel || enrollmentData.grade || (student && student.grade) || '';
    const gradeChanged = isChanged('grade', gradeNew);
    addInfo('GRADE LEVEL TO ENROLL:', gradeNew || (student && student.grade) || '--', gradeChanged);

    const parsedGrade = parseInt(String(gradeNew || (student && student.grade) || '').replace(/[^0-9]/g, ''), 10);
    const isJHS = !isNaN(parsedGrade) && parsedGrade >= 7 && parsedGrade <= 10;


    const statusNew = updatedData.status || enrollmentData.status || existingEnrollment.status || (student && student.status) || '';
    const statusChanged = isChanged('status', statusNew);
    // STATUS will be shown separately after Documents

    // Electives (canonical source only: updated enrollment_data.electives, then student.electives)
    let selectedElectives = [];
    if (Array.isArray(enrollmentData.electives) && enrollmentData.electives.length) {
        selectedElectives = [...enrollmentData.electives];
    } else if (student && Array.isArray(student.electives) && student.electives.length) {
        selectedElectives = [...student.electives];
    }
    const uniqueElectives = Array.from(new Set(selectedElectives.map(e => (e || '').toString().trim()).filter(Boolean)));
    const electivesList = uniqueElectives.length ? uniqueElectives.join(', ') : 'None';
    const electivesChanged = isChanged('electives', electivesList);
    addInfo('ELECTIVES:', electivesList, electivesChanged);


    html += '</div></div>';

    // Address Section
    html += '<div class="review-block"><h4>ADDRESS</h4><div class="info-grid">';
    const currentAddrParts = [];
    ['currentSitio','currentBarangay','currentMunicipality','currentProvince','currentCountry','currentZipCode'].forEach(k => { if (enrollmentData[k]) currentAddrParts.push(enrollmentData[k]); else if (existingEnrollment && existingEnrollment[k]) currentAddrParts.push(existingEnrollment[k]); });
    const currentAddrNew = currentAddrParts.join(', ');
    const currentAddrOld = (student && student.currentAddress) || (existingEnrollment && existingEnrollment.currentAddress) || '';
    const addrChanged = currentAddrNew && currentAddrNew !== '' ? currentAddrNew.trim() !== String(currentAddrOld).trim() : false;
    addInfo('CURRENT ADDRESS:', currentAddrNew || currentAddrOld || '--', addrChanged);

    const permAddrParts = [];
    ['permanentSitio','permanentBarangay','permanentMunicipality','permanentProvince','permanentCountry','permanentZipCode'].forEach(k => { if (enrollmentData[k]) permAddrParts.push(enrollmentData[k]); else if (existingEnrollment && existingEnrollment[k]) permAddrParts.push(existingEnrollment[k]); });
    const permAddrNew = permAddrParts.join(', ');
    const permAddrOld = (existingEnrollment && existingEnrollment.permanentAddress) || '';
    const permChanged = permAddrNew && permAddrNew !== '' ? permAddrNew.trim() !== String(permAddrOld).trim() : false;
    if (permAddrNew || permAddrOld) addInfo('PERMANENT ADDRESS:', permAddrNew || permAddrOld || '--', permChanged);

    html += '</div></div>';

    // Documents Section with preview thumbnails - always render known containers and keep removed state
    html += '<div class="review-block"><h4>DOCUMENTS</h4><div class="document-preview-grid">';
    const existingFiles = (student && student.enrollmentFiles) || {};
    const updatedFiles = enrollmentData.enrollmentFiles || {};
    // Known doc keys to always show in review (keeps container even when image removed)
    const knownKeys = ['psaBirthCert', 'studentImage', 'reportCard'];
    const unionKeys = new Set([...Object.keys(existingFiles || {}), ...Object.keys(updatedFiles || {})]);
    // Build ordered keys: known keys first, then any other keys that appear
    const ordered = [...knownKeys, ...Array.from(unionKeys).filter(k => !knownKeys.includes(k))];
    // If nothing at all, show placeholder
    if (ordered.length === 0) {
        html += '<div style="padding: 20px; text-align: center; color: #999;">No documents submitted</div>';
    } else {
        // detect if updated/enrollmentFiles were provided in the updated data
        const hasUpdatedFilesProvided = Object.prototype.hasOwnProperty.call(enrollmentData, 'enrollmentFiles') && Object.keys(updatedFiles || {}).length > 0;
        ordered.forEach(k => {
            // Determine presence and removal; only treat as "removed" when the update explicitly provided enrollmentFiles
            const hadExisting = Object.prototype.hasOwnProperty.call(existingFiles, k) && !!existingFiles[k];
            const hasUpdated = hasUpdatedFilesProvided && Object.prototype.hasOwnProperty.call(updatedFiles, k) && !!updatedFiles[k];
            const wasRemoved = hasUpdatedFilesProvided && hadExisting && !hasUpdated; // previously existed but removed in updated data
            const dataUrl = hasUpdated ? updatedFiles[k] : (hadExisting ? existingFiles[k] : null);
            const changed = hasUpdated && (!hadExisting || String(updatedFiles[k]) !== String(existingFiles[k] || ''));
            const label = k === 'psaBirthCert' ? 'PSA Birth Certificate' : k === 'reportCard' ? 'Report Card' : k === 'studentImage' ? 'Student Photo' : k;
            const isImage = dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image');

            html += `<div class="document-thumbnail-item ${changed ? 'changed' : ''}${wasRemoved ? ' removed' : ''}">`;
            if (isImage && !wasRemoved) {
                html += `<img src="${dataUrl}" class="document-thumbnail" style="cursor: pointer; max-width: 100%; border-radius: 4px; max-height: 120px;" onclick="viewDocumentZoom('${dataUrl.replace(/'/g, "\\'")}')" title="Click to zoom" />`;
            } else if (wasRemoved) {
                // show removed placeholder but keep the container
                html += `<div class="document-icon" style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: #fafafa; border-radius: 4px; font-size: 28px; opacity: 0.45;">🗑️</div>`;
            } else if (isImage === false && dataUrl) {
                html += `<div class="document-icon" style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: #f0f0f0; border-radius: 4px; font-size: 32px;">📄</div>`;
            } else {
                // no file present
                html += `<div class="document-icon" style="width: 100%; height: 120px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 4px; font-size: 20px; color: #999;">No file</div>`;
            }
            html += `<div class="document-label" style="margin-top: 8px; font-size: 12px; font-weight: 600; color: #333; text-align: center;">${label}</div>`;
            if (changed && !wasRemoved) html += `<div style="font-size: 10px; color: #ff7043; text-align: center; margin-top: 4px;">Updated</div>`;
            if (wasRemoved) html += `<div style="font-size: 10px; color: #999; text-align: center; margin-top: 4px;">Removed</div>`;
            html += `</div>`;
        });
    }
    html += '</div></div>';

    // Render STATUS in its own block after documents
    html += '<div class="review-block"><h4>STATUS</h4><div class="info-grid">';
    addInfo('STATUS:', statusNew || (student && student.status) || '--', statusChanged);
    html += '</div></div>';

    reviewContent.innerHTML = html;

    // Show the review modal
    const reviewModal = document.getElementById('reviewModal');
    console.log('[Students] Showing review modal, element found:', !!reviewModal);
    if (reviewModal) {
        reviewModal.classList.add('active');
        reviewModal.style.display = 'flex';
        reviewModal.style.pointerEvents = 'auto';
        reviewModal.setAttribute('aria-hidden', 'false');
        console.log('[Students] ✓ Review modal displayed');
    }
}

function confirmEnrollmentSave() {
    console.log('🔴🔴🔴 confirmEnrollmentSave CALLED 🔴🔴🔴');
    const idKey = currentProfileStudentId;
    console.log('[Students] In confirmEnrollmentSave - currentProfileStudentId:', idKey);
    if (!idKey) {
        showNotification('No student selected', 'warning');
        return;
    }

    const pendingData = window.pendingEnrollmentUpdate;
    if (!pendingData) {
        showNotification('No pending changes', 'warning');
        return;
    }

    // Call the original save function with the pending data
    saveEnrollmentDetailWithData(pendingData, idKey);

    // Close the review modal
    const reviewModal = document.getElementById('reviewModal');
    if (reviewModal) {
        reviewModal.classList.remove('active');
        reviewModal.style.display = 'none';
        reviewModal.style.pointerEvents = 'none';
        reviewModal.setAttribute('aria-hidden', 'true');
    }

    // Clear pending data
    window.pendingEnrollmentUpdate = null;
}

async function setStudentEnrollmentStatus(idKey, status) {
    const normalizedId = String(idKey || '').trim();
    if (!normalizedId) {
        showNotification('No student selected', 'warning');
        return;
    }

    const student = allStudents.find(s => {
        const sId = String(s.id || '').trim();
        const sLrn = String(s.lrn || '').trim();
        return sId === normalizedId || sLrn === normalizedId;
    });

    if (!student) {
        showNotification('Student not found', 'error');
        return;
    }

    const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
    const updatePayload = {
        status,
        enrollment_data: { status }
    };

    // include schoolYearId as query param to avoid touching other years
    const schoolYearId = resolveSchoolYearForUpdates();
    const statusEndpoint = schoolYearId
        ? `/api/enrollments/by-student/${encodeURIComponent(normalizedId)}?schoolYearId=${encodeURIComponent(schoolYearId)}`
        : `/api/enrollments/by-student/${encodeURIComponent(normalizedId)}`;
    console.log('[Students] setStudentEnrollmentStatus sending to endpoint', statusEndpoint, 'payload', updatePayload);
    const resp = await studentsApiFetch(base + statusEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Server ${resp.status} ${resp.statusText}: ${errText}`);
    }

    await resp.json().catch(() => ({}));

    student.status = status;
    student.enrollment_status = status;

    const detailModal = document.getElementById('enrollmentDetailModal');
    if (detailModal) {
        detailModal.classList.remove('active');
        detailModal.style.display = 'none';
        detailModal.style.pointerEvents = 'none';
        detailModal.setAttribute('aria-hidden', 'true');
    }

    const profileModal = document.getElementById('studentProfileModal');
    if (profileModal) {
        profileModal.classList.remove('active');
        profileModal.style.display = 'none';
        profileModal.style.pointerEvents = 'none';
        profileModal.setAttribute('aria-hidden', 'true');
    }

    try { updateStudentRowStatus(student.id || student.lrn, status); } catch (e) { }

    if (typeof loadStudents === 'function') await loadStudents();
    applyFilters();
    if (typeof loadEnrollments === 'function') loadEnrollments(window.currentFilter || 'all');
    if (typeof loadRecentEnrollments === 'function') loadRecentEnrollments();
    if (typeof loadDashboardStats === 'function') loadDashboardStats();

    try {
        localStorage.setItem('enrollmentUpdate', JSON.stringify({ id: normalizedId, status, ts: Date.now() }));
        localStorage.setItem('students', String(Date.now()));
    } catch (e) { }

    const actionWord = status === 'Approved' ? 'approved successfully' : 'enrollment rejected';
    showNotification(`${student.fullName} ${actionWord}.`, status === 'Approved' ? 'success' : 'info');
}

function approveEnrollment() {
    const idKey = currentProfileStudentId;
    if (!idKey) {
        showNotification('No student selected', 'warning');
        return;
    }

    (async () => {
        try {
            await setStudentEnrollmentStatus(idKey, 'Approved');
        } catch (err) {
            console.error('[Students] Approve failed:', err);
            showNotification(`Failed to approve enrollment: ${err.message}`, 'error');
        }
    })();
}

function rejectEnrollment() {
    const idKey = currentProfileStudentId;
    if (!idKey) {
        showNotification('No student selected', 'warning');
        return;
    }

    (async () => {
        try {
            await setStudentEnrollmentStatus(idKey, 'Rejected');
        } catch (err) {
            console.error('[Students] Reject failed:', err);
            showNotification(`Failed to reject enrollment: ${err.message}`, 'error');
        }
    })();
}

function viewDocumentZoom(dataUrl) {
    const modal = document.getElementById('documentZoomModal');
    const img = document.getElementById('documentZoomImage');
    if (modal && img) {
        img.src = dataUrl;
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
    }
}

function saveEnrollmentDetailWithData(updated, idKey) {
    // FIRST POSSIBLE LOG - IF YOU SEE THIS, FUNCTION IS CALLED
    console.log('[Students] ⭐⭐⭐ FUNCTION CALLED: saveEnrollmentDetailWithData ⭐⭐⭐');
    console.log('[Students] Parameters - updated:', typeof updated, updated);
    console.log('[Students] Parameters - idKey:', idKey);

    // Propagate certain fields from enrollment_data to top-level keys so
    // the backend can map them to column updates. Without this diff,
    // only names were ever placed at root which explains the bug where
    // birthdate/sex/etc would remain unchanged in the table.
    if (updated && updated.enrollment_data && typeof updated.enrollment_data === 'object') {
        const ed = updated.enrollment_data;
        ['firstName','lastName','middleName','birthdate','sex','gender','placeOfBirth','email','phone','currentAddress','motherTongue',
         'extensionName','lrn','returningLearner','lastGradeLevel','lastSchoolYear','lastSchoolAttended','schoolId',
         'isIP','ipGroup','ipOtherText','is4Ps','householdID','hasPWD','disabilities','disabilityDetails',
         'fatherName','fatherContact','motherMaidenName','motherContact','guardianName','guardianContact',
         'learningModality','currentSitio','currentBarangay','currentMunicipality','currentProvince','currentCountry','currentZipCode',
         'permanentSitio','permanentBarangay','permanentMunicipality','permanentProvince','permanentCountry','permanentZipCode'
        ].forEach(k => {
            if (ed[k] !== undefined && !(k in updated)) {
                updated[k] = ed[k];
                console.log('[Students] Propagated field to root:', k, '=', ed[k]);
            }
        });
        // --- PATCH: propagate canonical electives as 'subjects' for DB update ---
        let electives = [];
        if (Array.isArray(ed.electives)) electives.push(...ed.electives);
        electives = Array.from(new Set(electives.map(e => (e || '').toString().trim()).filter(Boolean)));
        updated.subjects = electives.length ? electives.join(', ') : null;
        console.log('[Students] Propagated electives to root as subjects:', updated.subjects);
    }

    // Find current student for track change detection and validation
    const student = allStudents.find(s => {
        const sId = String(s.id || '').trim();
        const normalizedId = String(idKey).trim();
        const sLrn = String(s.lrn || '').trim();
        return sId === normalizedId || sLrn === normalizedId;
    });

    // DEBUG: Log what we're about to check
    console.log('[Students] === ENTERING saveEnrollmentDetailWithData ===');
    console.log('[Students] idKey:', idKey);
    console.log('[Students] student found:', !!student, student?.fullName);
    console.log('[Students] updated.track:', updated.track, 'type:', typeof updated.track);
    console.log('[Students] student.track:', student?.track, 'type:', typeof student?.track);
    
    if (!student) { 
        showNotification('Student not found', 'warning'); 
        return; 
    }

    const normalizeGradeValue = (value) => {
        if (value === undefined || value === null || value === '') return null;
        const parsed = parseInt(String(value).trim(), 10);
        return Number.isNaN(parsed) ? null : parsed;
    };

    const oldGradeNormalized = normalizeGradeValue(student.grade);
    const newGradeNormalized = normalizeGradeValue(
        updated.grade ?? updated.enrollment_data?.gradeLevel ?? updated.enrollment_data?.grade
    );
    const gradeIsChanging =
        newGradeNormalized !== null && String(oldGradeNormalized) !== String(newGradeNormalized);

    const clearSectionAssignmentOnUpdate = () => {
        updated.section_id = null;
        updated.class_id = null;
        if (!updated.enrollment_data || typeof updated.enrollment_data !== 'object') {
            updated.enrollment_data = {};
        }
        updated.enrollment_data.section_id = null;
        updated.enrollment_data.sectionId = null;
        updated.enrollment_data.section_code = null;
        updated.enrollment_data.sectionCode = null;
        updated.enrollment_data.section_name = null;
        updated.enrollment_data.sectionName = null;
    };

    if (gradeIsChanging) {
        console.log('[Students] ✅✅✅ GRADE CHANGE DETECTED ✅✅✅');
        console.log('[Students] Changing grade from', oldGradeNormalized, 'to', newGradeNormalized);
        clearSectionAssignmentOnUpdate();
        console.log('[Students] ✅ Section assignment cleared due to grade change');
    }
    
    // ===== ROBUST TRACK CHANGE DETECTION =====
    // Normalize both tracks for proper comparison
    const oldTrackNormalized = (student.track || '').toString().toLowerCase().trim();
    const newTrackNormalized = (updated.track || '').toString().toLowerCase().trim();
    
    console.log('[Students] TRACK COMPARISON:');
    console.log('[Students]   Old (normalized):', oldTrackNormalized);
    console.log('[Students]   New (normalized):', newTrackNormalized);
    console.log('[Students]   Are different?', oldTrackNormalized !== newTrackNormalized);
    
    // EXPLICIT TRACK CHANGE CHECK - FOOLPROOF VERSION
    let trackIsChanging = false;
    if (oldTrackNormalized && newTrackNormalized && oldTrackNormalized !== newTrackNormalized) {
        trackIsChanging = true;
    }
    
    console.log('[Students] trackIsChanging flag:', trackIsChanging);
    
    if (trackIsChanging) {
        // Track is changing - clear old electives AND remove section assignment
        if (!updated.enrollment_data) updated.enrollment_data = {};
        
        console.log('[Students] ✅✅✅ TRACK CHANGE DETECTED AND ACKNOWLEDGED ✅✅✅');
        console.log('[Students] Changing from "' + oldTrackNormalized + '" to "' + newTrackNormalized + '"');
        
        // 1. Clear electives from the OLD track
        if (oldTrackNormalized.includes('academic')) {
            updated.enrollment_data.academicElectives = null;
            console.log('[Students]   → Cleared academicElectives');
        }
        if (oldTrackNormalized.includes('techpro')) {
            updated.enrollment_data.techproElectives = null;
            console.log('[Students]   → Cleared techproElectives');
        }
        if (oldTrackNormalized.includes('doorway')) {
            updated.enrollment_data.doorwayAcademic = null;
            updated.enrollment_data.doorwayTechpro = null;
            console.log('[Students]   → Cleared doorway electives');
        }

        // 2. ===== CRITICAL: REMOVE SECTION ASSIGNMENT =====
        // This is the most important part - MUST happen when track changes
        clearSectionAssignmentOnUpdate();
        
        console.log('[Students] ✅✅✅ SECTION REMOVAL TRIGGERED ✅✅✅');
        console.log('[Students]   section_id = null (set)');
        console.log('[Students]   class_id = null (set)');
        console.log('[Students]   typeof updated.section_id:', typeof updated.section_id);
        console.log('[Students]   typeof updated.class_id:', typeof updated.class_id);
        console.log('[Students]   updated object now has section_id?', 'section_id' in updated);
        console.log('[Students]   updated object now has class_id?', 'class_id' in updated);
    } else {
        console.log('[Students] ℹ No track change (or tracks are empty/same)');
        if (!oldTrackNormalized) console.log('[Students] → Old track is empty');
        if (!newTrackNormalized) console.log('[Students] → New track is empty');
        
        // ALWAYS CLEAR OLD ELECTIVES EVEN WHEN TRACK DOESN'T CHANGE
        // Because admin might update electives without changing track
        if (!updated.enrollment_data) updated.enrollment_data = {};
        
        // Always set these explicitly to ensure old ones are cleared
        if (!('academicElectives' in updated.enrollment_data)) {
            updated.enrollment_data.academicElectives = [];
        }
        if (!('techproElectives' in updated.enrollment_data)) {
            updated.enrollment_data.techproElectives = [];
        }
        if (!('doorwayAcademic' in updated.enrollment_data)) {
            updated.enrollment_data.doorwayAcademic = [];
        }
        if (!('doorwayTechpro' in updated.enrollment_data)) {
            updated.enrollment_data.doorwayTechpro = [];
        }
        console.log('[Students] ℹ Ensured all elective fields are explicitly set to clear old values');
    }
    
    // ===== ELECTIVE CHANGE DETECTION (even when track stays the same) =====
    // This handles the case where admin changes electives while keeping the same track
    if (!trackIsChanging) {  // Only check if track is NOT changing
        // Collect OLD electives from student's existing enrollment data
        let oldElectives = [];
        if (student.enrollment_data) {
            const enrollData = typeof student.enrollment_data === 'string' ? (() => { try { return JSON.parse(student.enrollment_data); } catch(e){ return {}; } })() : student.enrollment_data;
            if (Array.isArray(enrollData.academicElectives)) oldElectives.push(...enrollData.academicElectives);
            if (Array.isArray(enrollData.techproElectives)) oldElectives.push(...enrollData.techproElectives);
            if (Array.isArray(enrollData.doorwayAcademic)) oldElectives.push(...enrollData.doorwayAcademic);
            if (Array.isArray(enrollData.doorwayTechpro)) oldElectives.push(...enrollData.doorwayTechpro);
            if (Array.isArray(enrollData.electives)) oldElectives.push(...enrollData.electives);
        }
        
        // Fallback to student.electives if no enrollment_data
        if (oldElectives.length === 0 && Array.isArray(student.electives)) {
            oldElectives = [...student.electives];
        }
        
        // Collect NEW electives from updated object
        let newElectives = [];
        if (updated.enrollment_data) {
            if (Array.isArray(updated.enrollment_data.academicElectives)) newElectives.push(...updated.enrollment_data.academicElectives);
            if (Array.isArray(updated.enrollment_data.techproElectives)) newElectives.push(...updated.enrollment_data.techproElectives);
            if (Array.isArray(updated.enrollment_data.doorwayAcademic)) newElectives.push(...updated.enrollment_data.doorwayAcademic);
            if (Array.isArray(updated.enrollment_data.doorwayTechpro)) newElectives.push(...updated.enrollment_data.doorwayTechpro);
            if (Array.isArray(updated.enrollment_data.electives)) newElectives.push(...updated.enrollment_data.electives);
        }
        
        // Normalize and deduplicate for comparison
        const normalizeElectives = (arr) => Array.from(new Set(arr.map(e => (e || '').toString().toLowerCase().trim()).filter(Boolean))).sort();
        const oldElectivesNorm = normalizeElectives(oldElectives);
        const newElectivesNorm = normalizeElectives(newElectives);
        
        console.log('[Students] ELECTIVE COMPARISON:');
        console.log('[Students]   Old electives:', oldElectivesNorm.join(', ') || '(none)');
        console.log('[Students]   New electives:', newElectivesNorm.join(', ') || '(none)');
        
        // Check if electives are different
        let electivesChanged = false;
        if (oldElectivesNorm.length !== newElectivesNorm.length) {
            electivesChanged = true;
            console.log('[Students]   → Different number of electives');
        } else {
            for (let i = 0; i < oldElectivesNorm.length; i++) {
                if (oldElectivesNorm[i] !== newElectivesNorm[i]) {
                    electivesChanged = true;
                    console.log('[Students]   → Different elective at position', i, ':', oldElectivesNorm[i], '→', newElectivesNorm[i]);
                    break;
                }
            }
        }
        
        if (electivesChanged && oldElectivesNorm.length > 0) {  // Only if there were previous electives
            console.log('[Students] ✅✅✅ ELECTIVE CHANGE DETECTED (same track) ✅✅✅');
            console.log('[Students] Removing section assignment for elective change...');
            
            // ===== CRITICAL: REMOVE SECTION ASSIGNMENT =====
            // When admin changes electives while keeping the same track,
            // student must be reassigned through the proper section assignment module
            clearSectionAssignmentOnUpdate();
            
            console.log('[Students] ✅✅✅ SECTION REMOVAL TRIGGERED (ELECTIVE CHANGE) ✅✅✅');
            console.log('[Students]   section_id = null (set)');
            console.log('[Students]   class_id = null (set)');
        } else {
            console.log('[Students] ℹ No elective change detected');
        }
    }
    
    // Capture returning learner fields from the modal (radio inputs)
    const returningYesRadio = document.querySelector('input[name="returningLearner"][value="yes"]:checked');
    const returningNoRadio = document.querySelector('input[name="returningLearner"][value="no"]:checked');
    if (returningYesRadio || returningNoRadio) {
        const returnVal = returningYesRadio ? 'yes' : 'no';
        if (!updated.enrollment_data) updated.enrollment_data = {};
        updated.enrollment_data.returningLearner = returnVal;
        
        // Only capture the additional fields if "Yes" is selected
        if (returnVal === 'yes') {
            const lastGradeLevel = document.querySelector('#lastGradeLevelCompleted')?.value;
            const lastSchoolYear = document.querySelector('#lastSchoolYearCompleted')?.value;
            const lastSchoolAttended = document.querySelector('#lastSchoolAttendedInput')?.value;
            const schoolId = document.querySelector('#schoolIdInput')?.value;
            
            if (lastGradeLevel) updated.enrollment_data.lastGradeLevel = lastGradeLevel;
            if (lastSchoolYear) updated.enrollment_data.lastSchoolYear = lastSchoolYear;
            if (lastSchoolAttended) updated.enrollment_data.lastSchoolAttended = lastSchoolAttended;
            if (schoolId) updated.enrollment_data.schoolId = schoolId;
        }
    }
    
    // Capture address fields from the modal
    const currentSitio = document.querySelector('#currentSitio')?.value;
    const currentCountry = document.querySelector('#currentCountry')?.value;
    const currentProvince = document.querySelector('#currentProvince')?.value;
    const currentMunicipality = document.querySelector('#currentMunicipality')?.value;
    const currentBarangay = document.querySelector('#currentBarangay')?.value;
    const currentZipCode = document.querySelector('#currentZipCode')?.value;
    
    const permanentSitio = document.querySelector('#permanentSitio')?.value;
    const permanentCountry = document.querySelector('#permanentCountry')?.value;
    const permanentProvince = document.querySelector('#permanentProvince')?.value;
    const permanentMunicipality = document.querySelector('#permanentMunicipality')?.value;
    const permanentBarangay = document.querySelector('#permanentBarangay')?.value;
    const permanentZipCode = document.querySelector('#permanentZipCode')?.value;
    
    if (!updated.enrollment_data) updated.enrollment_data = {};
    
    if (currentSitio) updated.enrollment_data.currentSitio = currentSitio;
    if (currentCountry) updated.enrollment_data.currentCountry = currentCountry;
    if (currentProvince) updated.enrollment_data.currentProvince = currentProvince;
    if (currentMunicipality) updated.enrollment_data.currentMunicipality = currentMunicipality;
    if (currentBarangay) updated.enrollment_data.currentBarangay = currentBarangay;
    if (currentZipCode) updated.enrollment_data.currentZipCode = currentZipCode;
    
    if (permanentSitio) updated.enrollment_data.permanentSitio = permanentSitio;
    if (permanentCountry) updated.enrollment_data.permanentCountry = permanentCountry;
    if (permanentProvince) updated.enrollment_data.permanentProvince = permanentProvince;
    if (permanentMunicipality) updated.enrollment_data.permanentMunicipality = permanentMunicipality;
    if (permanentBarangay) updated.enrollment_data.permanentBarangay = permanentBarangay;
    if (permanentZipCode) updated.enrollment_data.permanentZipCode = permanentZipCode;

    // Finalize electives -> subjects mapping right before change detection/save.
    // This ensures enrollments.subjects is always synced with the latest modal selection.
    let finalizedElectives = [];
    if (updated.enrollment_data && Array.isArray(updated.enrollment_data.electives)) {
        finalizedElectives.push(...updated.enrollment_data.electives);
    }
    finalizedElectives = Array.from(new Set(finalizedElectives.map(e => (e || '').toString().trim()).filter(Boolean)));
    updated.subjects = finalizedElectives.length ? finalizedElectives.join(', ') : null;
    console.log('[Students] Finalized subjects from electives:', updated.subjects);

    // Once admin edits electives, persist override and stop using enrollments-derived electives for this student.
    setAdminEditedElectivesOverride(
        [idKey, student?.id, student?.lrn, updated?.lrn, updated?.enrollment_data?.lrn],
        finalizedElectives
    );

    // Validate student exists and check if any changes were made
    if (!student) { showNotification('Student not found', 'warning'); return; }

    // Check if any field actually changed
    const hasChanges = 
        (updated.enrollment_data && Object.keys(updated.enrollment_data).length > 0) ||
        (updated.fullName && updated.fullName !== student.fullName) ||
        (updated.lrn && updated.lrn !== student.lrn) ||
        (updated.grade && updated.grade !== student.grade) ||
        (updated.track && updated.track !== student.track) ||
        (updated.status && updated.status !== student.status) ||
        (updated.section_id !== undefined) ||  // Any change to section (including null) is a change
        (updated.class_id !== undefined) ||    // Any change to class (including null) is a change
        (updated.currentAddress && updated.currentAddress !== student.currentAddress) ||
        (updated.birthdate && updated.birthdate !== student.birthdate) ||
        (updated.gender && updated.gender !== student.gender);

    console.log('[Students] ========== HASPCHANGES CHECK ==========');
    console.log('[Students] hasChanges?:', hasChanges);
    if (!hasChanges) {
        console.log('[Students] Reason: No changes detected');
        console.log('[Students]   - enrollment_data keys:', updated.enrollment_data ? Object.keys(updated.enrollment_data).length : 0);
        console.log('[Students]   - section_id defined?', 'section_id' in updated);
        console.log('[Students]   - class_id defined?', 'class_id' in updated);
        console.log('[Students]   - track different?', updated.track !== student.track);
    } else {
        console.log('[Students] Reason: Changes detected - proceeding to save');
        console.log('[Students]   section_id in updated?', 'section_id' in updated, '=', updated.section_id);
        console.log('[Students]   class_id in updated?', 'class_id' in updated, '=', updated.class_id);
    }
        (updated.gender && updated.gender !== student.gender);

    if (!hasChanges) { showNotification('No changes to save', 'info'); return; }

    // Attempt to persist to server
    (async () => {
        try {
            const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
            
            // DEBUG: Log the full payload being sent - BE VERY EXPLICIT
            console.log('[Students] ========== PAYLOAD CONSTRUCTION CHECK ==========');
            console.log('[Students] updated object keys:', Object.keys(updated));
            console.log('[Students] ✓ Has section_id?', 'section_id' in updated);
            console.log('[Students] ✓ section_id value?', updated.section_id);
            console.log('[Students] ✓ Has class_id?', 'class_id' in updated);
            console.log('[Students] ✓ class_id value?', updated.class_id);
            console.log('[Students] ✓ Has track?', 'track' in updated);
            console.log('[Students] ✓ track value?', updated.track);
            
            const jsonPayload = JSON.stringify(updated, null, 2);
            console.log('[Students] ========== FULL PAYLOAD JSON ==========');
            console.log('[Students] CRITICAL - About to send:');
            console.log('[Students]   → section_id:', updated.section_id, '(should be null if track changed)');
            console.log('[Students]   → class_id:', updated.class_id, '(should be null if track changed)');
            console.log('[Students] Full JSON:');
            console.log(jsonPayload);
            console.log('[Students] ========== END PAYLOAD ==========');
            console.log('[Students] 🚀🚀🚀 ACTUAL STRING BEING SENT TO FETCH:');
            console.log(jsonPayload);
            
            const resp = await studentsApiFetch(base + `/api/enrollments/by-student/${encodeURIComponent(idKey)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: jsonPayload
            });
            
            console.log('[Students] ========== SERVER RESPONSE ==========');
            console.log('[Students] Status:', resp.status, resp.statusText);

            if (!resp.ok) {
                const errText = await resp.text();
                const msg = `Server ${resp.status} ${resp.statusText}: ${errText}`;
                console.error('[Students] ERROR:', msg);
                throw new Error(msg);
            }

            const result = await resp.json();
            console.log('[Students] ✓ Response successful');
            
            // Add updated enrollments to the in-memory store used by reports
            try {
                if (result.enrollments && Array.isArray(result.enrollments)) {
                    result.enrollments.forEach(en => { try { addEnrollmentToStore(en); } catch(e){} });
                }
            } catch (e) { /* ignore */ }

            // ALSO sync any updated enrollments into the current enrollments list
            // so that the enrollment management UI reflects changes immediately
            try {
                if (result.enrollments && Array.isArray(result.enrollments) && Array.isArray(window.allEnrollments)) {
                    result.enrollments.forEach(updatedEnroll => {
                        const idx = window.allEnrollments.findIndex(e => e.id === updatedEnroll.id);
                        if (idx !== -1) {
                            console.log('[Students] Syncing updated enrollment into window.allEnrollments for id', updatedEnroll.id);
                            window.allEnrollments[idx] = updatedEnroll;
                        }
                    });
                }
            } catch(syncErr) {
                console.warn('[Students] Failed to sync updated enrollments into list:', syncErr);
            }

            // Also update the local student record with any changed fields so the
            // directory/profile UI updates without requiring a page refresh
            try {
                if (student) {
                    const keysToMerge = ['firstName','lastName','middleName','birthdate','gender','email','phone','currentAddress'];
                    keysToMerge.forEach(k => {
                        if (updated[k] !== undefined) {
                            student[k] = updated[k];
                        }
                    });
                    if (updated.enrollment_data) {
                        try {
                            let existing = student.enrollment_data;
                            if (typeof existing === 'string') {
                                existing = JSON.parse(existing);
                            }
                            existing = existing || {};
                            Object.assign(existing, updated.enrollment_data);
                            student.enrollment_data = existing;
                        } catch(e) {
                            console.warn('[Students] Could not merge enrollment_data into student record', e);
                        }
                    }
                }
            } catch(updateErr) {
                console.warn('[Students] Failed to sync updated student record:', updateErr);
            }

            // Create notification for the student about profile edit
            try {
                console.log('[Students] Creating notification - student object:', JSON.stringify(student, null, 2));
                console.log('[Students] student.id:', student.id, 'type:', typeof student.id);
                const notificationPayload = {
                    student_id: student.id,
                    type: 'profile_edited',
                    title: '✏️ Profile Updated',
                    message: 'Your student profile has been updated by the school administrator. Please review your information on the dashboard.',
                    related_data: {
                        updated_fields: Object.keys(updated.enrollment_data || {}),
                        timestamp: new Date().toISOString()
                    }
                };
                console.log('[Students] Notification payload:', JSON.stringify(notificationPayload, null, 2));
                const notifUrl = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
                console.log('[Students] Notification API URL:', notifUrl + '/api/notifications');
                const notifResp = await studentsApiFetch(notifUrl + '/api/notifications', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(notificationPayload)
                });
                console.log('[Students] Notification response status:', notifResp.status);
                if (!notifResp.ok) {
                    const errText = await notifResp.text();
                    console.warn('[Students] Notification creation failed:', errText);
                } else {
                    const notifData = await notifResp.json();
                    console.log('[Students] Notification created successfully:', notifData);
                }
            } catch (notifErr) {
                console.warn('[Students] Failed to create profile edit notification:', notifErr);
                // Don't fail the save if notification fails
            }

            // Reload students and UI to ensure consistency across tabs/sections
            if (typeof loadStudents === 'function') await loadStudents();
            
            // After reloading, find the updated student and refresh the student object in memory
            const refreshedStudent = allStudents.find(s => {
                const sId = String(s.id || '').trim();
                const normalizedId = String(idKey).trim();
                const sLrn = String(s.lrn || '').trim();
                return sId === normalizedId || sLrn === normalizedId;
            });
            
            if (refreshedStudent) {
                console.log('[Students] Updated student in memory with electives:', refreshedStudent.electives);
                // Update the in-memory reference so the Student Details view shows new electives
                Object.assign(student, refreshedStudent);

                // Also sync student fields into any cached enrollments so that
                // lists display the latest name/grade/track/etc without waiting
                // for a full reload.
                try {
                    if (Array.isArray(window.allEnrollments)) {
                        window.allEnrollments.forEach(en => {
                            const matchId = String(en.student_id || '').trim();
                            const matchLrn = String(en.lrn_no || '').trim();
                            const compare = String(student.id || student.lrn || '').trim();
                            if (matchId === compare || matchLrn === compare) {
                                console.log('[Students] Syncing student info into enrollment', en.id);
                                // ensure enrollment_data exists
                                let data = {};
                                try {
                                    data = typeof en.enrollment_data === 'string' ? JSON.parse(en.enrollment_data || '{}') : (en.enrollment_data || {});
                                } catch(e){ data = {}; }
                                // map fields we care about
                                if (student.firstName) data.firstName = student.firstName;
                                if (student.lastName) data.lastName = student.lastName;
                                if (student.middleName) data.middleName = student.middleName;
                                if (student.fullName) {
                                    data.fullName = student.fullName;
                                }
                                if (student.grade) data.gradeLevel = student.grade;
                                if (student.track) data.track = student.track;
                                en.enrollment_data = data;
                            }
                        });
                    }
                } catch(syncErr) {
                    console.warn('[Students] Error syncing student info into enrollments:', syncErr);
                }
            }
            
            applyFilters();
            if (typeof loadEnrollments === 'function') loadEnrollments(window.currentFilter || 'all');
            if (typeof loadRecentEnrollments === 'function') loadRecentEnrollments();  // ← CRITICAL: Reload recent enrollments to show cleared section
            if (typeof loadDashboardStats === 'function') loadDashboardStats();

            // Notify other tabs/windows via storage event listeners
            try {
                localStorage.setItem('enrollmentUpdate', JSON.stringify({ id: idKey, ts: Date.now() }));
                localStorage.setItem('students', String(Date.now()));
            } catch (e) { /* ignore */ }

            // ===== EMIT REAL-TIME EVENTS =====
            // Broadcast changes to all modules for instant UI updates
            try {
                console.log('[Students] === REAL-TIME EVENT EMISSION ===');
                
                // Detect what actually changed to include accurate event data
                const sectionWasCleared = updated.section_id === null && 'section_id' in updated;
                const trackChanged = updated.track && updated.track !== student.track;
                
                console.log('[Students] Event triggers:');
                console.log('[Students]   - Section cleared?', sectionWasCleared, '(section_id=', updated.section_id, ')');
                console.log('[Students]   - Track changed?', trackChanged, '(old=', student.track, ', new=', updated.track, ')');
                
                // Detect elective change - check if enrollment_data changed
                let electiveChanged = false;
                if (!trackChanged && updated.enrollment_data) {
                    // Compare electives between old and new enrollment data
                    const oldEnrollData = typeof student.enrollment_data === 'string' 
                        ? (() => { try { return JSON.parse(student.enrollment_data); } catch(e){ return {}; } })() 
                        : (student.enrollment_data || {});
                    const newEnrollData = updated.enrollment_data;
                    
                    // Quick comparison of elective fields
                    const electiveFields = ['academicElectives', 'techproElectives', 'doorwayAcademic', 'doorwayTechpro', 'electives'];
                    for (let field of electiveFields) {
                        const oldVal = oldEnrollData[field];
                        const newVal = newEnrollData[field];
                        // Check if either value exists and they're different
                        if ((oldVal || newVal) && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                            electiveChanged = true;
                            console.log('[Students]   - Elective field changed:', field);
                            break;
                        }
                    }
                }
                console.log('[Students]   - Elective changed?', electiveChanged);
                
                const eventData = {
                    student_id: student.id || student.lrn || idKey,
                    student_name: student.fullName || student.name,
                    section_cleared: sectionWasCleared,
                    elective_changed: electiveChanged,
                    track_changed: trackChanged,
                    timestamp: Date.now(),
                    changes: Object.keys(updated).filter(k => k !== 'enrollment_data')
                };
                
                console.log('[Students] Prepared event data:');
                console.log('[Students]   - student_id:', eventData.student_id, '(type:', typeof eventData.student_id, ')');
                console.log('[Students]   - student_name:', eventData.student_name);
                console.log('[Students]   - section_cleared:', eventData.section_cleared);
                
                // If section was cleared, trigger a specific event for Section Assignment module
                if (eventData.section_cleared) {
                    console.log('[Students] 🎯 BROADCASTING: student_section_cleared');
                    console.log('[Students]   Reason:', trackChanged ? 'track_change' : 'elective_change');
                    console.log('[Students]   Student:', eventData.student_name, '(ID:', eventData.student_id + ')');
                    
                    window.DashboardEvents?.broadcast('student_section_cleared', {
                        student_id: eventData.student_id,
                        student_name: eventData.student_name,
                        reason: trackChanged ? 'track_change' : 'elective_change',
                        timestamp: eventData.timestamp
                    });
                    
                    console.log('[Students] ✅ Broadcast sent successfully');
                } else {
                    console.log('[Students] ℹ Section not cleared, student_section_cleared event NOT broadcast');
                }
                
                // Broadcast general student update event
                console.log('[Students] 📊 BROADCASTING: student_updated');
                window.DashboardEvents?.broadcast('student_updated', eventData);
                console.log('[Students] ✅ Broadcast sent successfully');
                
                console.log('[Students] === END EVENT EMISSION ===');
            } catch (e) {
                console.warn('[Students] ❌ Failed to emit real-time events:', e.message);
                console.warn('[Students] Error stack:', e.stack);
                // Non-critical failure - don't break the save
            }

            showNotification('Saved changes to server', 'success');
            
            // ===== CLOSE MODAL IMMEDIATELY =====
            // Close immediately to avoid stale data being displayed
            const modal = document.getElementById('enrollmentDetailModal');
            if (modal) {
                modal.classList.remove('active');
                modal.style.display = 'none';
                modal.style.pointerEvents = 'none';
                modal.setAttribute('aria-hidden', 'true');
                console.log('[Students] Modal closed immediately after successful save');
            }
            
            return;
        } catch (err) {
            console.warn('Server save failed, falling back to local update -', err.message);
            // Fallback to local-only update
            let updatedCount = 0;
            
            // Extract electives from enrollment_data
            const enrollmentData = updated.enrollment_data || {};
            let updatedElectives = [];
            if (Array.isArray(enrollmentData.academicElectives)) updatedElectives.push(...enrollmentData.academicElectives);
            if (Array.isArray(enrollmentData.techproElectives)) updatedElectives.push(...enrollmentData.techproElectives);
            if (Array.isArray(enrollmentData.doorwayAcademic)) updatedElectives.push(...enrollmentData.doorwayAcademic);
            if (Array.isArray(enrollmentData.doorwayTechpro)) updatedElectives.push(...enrollmentData.doorwayTechpro);
            if (Array.isArray(enrollmentData.electives)) updatedElectives.push(...enrollmentData.electives);
            
            allStudents = allStudents.map(s => {
                if ((s.id || s.lrn) === idKey || s.lrn === idKey || s.id === idKey) {
                    updatedCount++;
                    return Object.assign({}, s, {
                        fullName: updated.fullName,
                        lrn: updated.lrn,
                        grade: updated.grade,
                        track: updated.track,
                        status: updated.status,
                        currentAddress: updated.currentAddress,
                        birthdate: updated.birthdate,
                        gender: updated.gender,
                        electives: updatedElectives
                    });
                }
                return s;
            });

            // Also update filteredStudents
            filteredStudents = filteredStudents.map(s => {
                if ((s.id || s.lrn) === idKey || s.lrn === idKey || s.id === idKey) {
                    return Object.assign({}, s, {
                        fullName: updated.fullName,
                        lrn: updated.lrn,
                        grade: updated.grade,
                        track: updated.track,
                        status: updated.status,
                        currentAddress: updated.currentAddress,
                        birthdate: updated.birthdate,
                        gender: updated.gender,
                        electives: updatedElectives
                    });
                }
                return s;
            });

            renderStudentTable();
            showNotification(`Saved changes locally (${updatedCount} record updated)`, 'warning');
            const m = document.getElementById('enrollmentDetailModal'); if (m) { m.classList.remove('active'); m.style.display = 'none'; m.style.pointerEvents = 'none'; m.setAttribute('aria-hidden','true'); }
            return;
        }
    })();
}

async function archiveStudent(studentId) {
    const normalizedId = String(studentId || '').trim();
    const student = allStudents.find(s => {
        const sId = String(s.id || '').trim();
        const sLrn = String(s.lrn || '').trim();
        return sId === normalizedId || sLrn === normalizedId;
    });

    if (!student) {
        showNotification('Student not found', 'warning');
        return;
    }

    const confirmed = await showStudentsConfirmDialog(
        `Archive ${student.fullName} (${student.lrn || student.id})? You can restore this student later in Quick Admin Settings > Archived.`,
        'Archive Student'
    );
    if (!confirmed) return;

    const archivedRecord = buildArchivedStudentRecord(student);
    const existing = readArchivedStudentsStore();
    const existingIndex = existing.findIndex((record) => {
        const recordIds = Array.isArray(record?.identifiers) ? record.identifiers : [];
        return record.archiveId === archivedRecord.archiveId || recordIds.some((id) => archivedRecord.identifiers.includes(String(id || '').trim()));
    });

    if (existingIndex >= 0) {
        existing[existingIndex] = { ...existing[existingIndex], ...archivedRecord, archivedAt: new Date().toISOString() };
    } else {
        existing.push(archivedRecord);
    }

    writeArchivedStudentsStore(existing);
    closeStudentProfile();
    await loadStudents();
    applyFilters();
    showNotification(`${student.fullName} archived successfully`, 'success');
}

async function deleteStudentPermanently(studentId) {
    const normalizedId = String(studentId || '').trim();
    const student = allStudents.find(s => {
        const sId = String(s.id || '').trim();
        const sLrn = String(s.lrn || '').trim();
        return sId === normalizedId || sLrn === normalizedId;
    });

    if (!student) {
        showNotification('Student not found', 'warning');
        return;
    }

    const confirmed = await showStudentsConfirmDialog(
        `Delete ${student.fullName} (${student.lrn || student.id}) permanently? This action cannot be undone.`,
        'Delete Student'
    );
    if (!confirmed) return;

    const base = (typeof API_BASE !== 'undefined' && API_BASE) ? API_BASE : window.location.origin;
    const studentKey = String(student.id || student.lrn || '').trim();
    let deletedStudentRecord = false;
    let deletedEnrollmentCount = 0;

    try {
        if (studentKey) {
            const studentDeleteResp = await studentsApiFetch(base + `/api/students/${encodeURIComponent(studentKey)}`, {
                method: 'DELETE'
            });
            deletedStudentRecord = !!studentDeleteResp.ok;
        }

        if (studentKey) {
            const enrollmentResp = await studentsApiFetch(base + `/api/enrollments/student/${encodeURIComponent(studentKey)}`);
            if (enrollmentResp.ok) {
                const enrollmentRows = await enrollmentResp.json().catch(() => []);
                if (Array.isArray(enrollmentRows) && enrollmentRows.length > 0) {
                    for (const row of enrollmentRows) {
                        const enrollmentId = row && row.id;
                        if (!enrollmentId) continue;
                        try {
                            const delResp = await studentsApiFetch(base + `/api/enrollments/${encodeURIComponent(enrollmentId)}`, {
                                method: 'DELETE'
                            });
                            if (delResp.ok) deletedEnrollmentCount += 1;
                        } catch (_innerErr) {
                            // Continue deleting remaining records
                        }
                    }
                }
            }
        }

        if (!deletedStudentRecord && deletedEnrollmentCount === 0) {
            showNotification('Delete failed: no matching backend record found', 'error');
            return;
        }

        closeStudentProfile();
        await loadStudents();
        applyFilters();

        if (typeof loadEnrollments === 'function') {
            try { await loadEnrollments(window.currentFilter || 'all'); } catch (_) { }
        }
        if (typeof loadRecentEnrollments === 'function') {
            try { await loadRecentEnrollments(); } catch (_) { }
        }
        if (typeof loadDashboardStats === 'function') {
            try { await loadDashboardStats(); } catch (_) { }
        }

        if (deletedStudentRecord && deletedEnrollmentCount > 0) {
            showNotification(`${student.fullName} deleted successfully`, 'success');
        } else if (deletedStudentRecord) {
            showNotification(`${student.fullName} student record deleted`, 'success');
        } else {
            showNotification(`${student.fullName} enrollment deleted`, 'success');
        }
    } catch (err) {
        console.error('Delete student failed:', err);
        showNotification(`Delete failed: ${err.message || 'unknown error'}`, 'error');
    }
}

function closeStudentProfile() {
    const modal = document.getElementById('studentProfileModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}

async function approveStudentEnrollment(studentId) {
    try {
        await setStudentEnrollmentStatus(studentId, 'Approved');
    } catch (err) {
        console.error('Error approving enrollment:', err);
        showNotification('Error approving enrollment: ' + err.message, 'error');
    }
}

async function rejectStudentEnrollment(studentId) {
    try {
        await setStudentEnrollmentStatus(studentId, 'Rejected');
    } catch (err) {
        console.error('Error rejecting enrollment:', err);
        showNotification('Error rejecting enrollment: ' + err.message, 'error');
    }
}

function initStudentDirectory() {
    // Load students on init
    loadStudents();

    // Helper: reload data then apply filters
    const reloadThenFilter = async () => { await loadStudents(); applyFilters(); };

    // Filter event listeners - each will ensure latest data is loaded first
    document.getElementById('dirSearchInput')?.addEventListener('input', async () => { await reloadThenFilter(); });
    document.getElementById('dirFilterGrade')?.addEventListener('change', async () => { await reloadThenFilter(); });
    document.getElementById('dirFilterGender')?.addEventListener('change', async () => { await reloadThenFilter(); });
    document.getElementById('dirFilterTrack')?.addEventListener('change', async () => { await reloadThenFilter(); });
    document.getElementById('dirFilterStatus')?.addEventListener('change', async () => { await reloadThenFilter(); });
    document.getElementById('dirFilterDisability')?.addEventListener('change', async () => { await reloadThenFilter(); });
    document.getElementById('dirFilterIP')?.addEventListener('change', async () => { await reloadThenFilter(); });
    document.getElementById('dirFilter4Ps')?.addEventListener('change', async () => { await reloadThenFilter(); });

    document.getElementById('dirResetBtn')?.addEventListener('click', async () => {
        document.getElementById('dirSearchInput').value = '';
        document.getElementById('dirFilterGrade').value = '';
        document.getElementById('dirFilterGender').value = '';
        document.getElementById('dirFilterTrack').value = '';
        document.getElementById('dirFilterStatus').value = '';
        document.getElementById('dirFilterDisability').value = '';
        document.getElementById('dirFilterIP').value = '';
        document.getElementById('dirFilter4Ps').value = '';
        await reloadThenFilter();
    });

    document.getElementById('dirReloadBtn')?.addEventListener('click', async () => {
        console.log('Dir: User clicked Reload from Server');
        await loadStudents();
        applyFilters();
        showNotification('Student data reloaded from server', 'success');
    });

    // Pagination
    document.getElementById('dirPrevBtn')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderStudentTable(); }
    });
    document.getElementById('dirNextBtn')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredStudents.length / pageSize);
        if (currentPage < totalPages) { currentPage++; renderStudentTable(); }
    });

    // Table actions - Using event delegation on dirTableBody for proper targeting
    const dirTableBody = document.getElementById('dirTableBody');
    if (dirTableBody) {
        dirTableBody.addEventListener('click', (e) => {
            const btn = e.target.closest('button.action-btn');
            if (!btn) return;
            
            const id = btn.dataset.id || btn.dataset.lrn;
            console.log('[Students] table button clicked:', btn.className, 'id=', id);
            if (!id) {
                console.warn('No student ID found on button', btn);
                return;
            }

            if (btn.classList.contains('view-btn')) {
                openStudentProfile(id);
                return;
            }
            if (btn.classList.contains('edit-btn')) {
                openEnrollmentDetail(id);
                return;
            }
            if (btn.classList.contains('archive-btn')) {
                archiveStudent(id);
                return;
            }
            if (btn.classList.contains('delete-btn')) {
                deleteStudentPermanently(id);
                return;
            }
        });
    }

    document.getElementById('closeDetailBtn')?.addEventListener('click', () => {
        const m = document.getElementById('enrollmentDetailModal'); if (m) { m.classList.remove('active'); m.style.display = 'none'; m.style.pointerEvents = 'none'; m.setAttribute('aria-hidden','true'); }
    });
    document.getElementById('closeDetailModal')?.addEventListener('click', () => {
        const m = document.getElementById('enrollmentDetailModal'); if (m) { m.classList.remove('active'); m.style.display = 'none'; m.style.pointerEvents = 'none'; m.setAttribute('aria-hidden','true'); }
    });
    document.getElementById('approveBtn')?.addEventListener('click', (e) => { e.preventDefault(); approveEnrollment(); });
    document.getElementById('rejectBtn')?.addEventListener('click', (e) => { e.preventDefault(); rejectEnrollment(); });
    document.getElementById('reviewDetailBtn')?.addEventListener('click', (e) => { 
        console.log('🟠🟠🟠 REVIEW BUTTON CLICKED 🟠🟠🟠');
        e.preventDefault(); 
        reviewEnrollmentDetail(); 
    });

    // Review Modal handlers
    document.getElementById('closeReviewModal')?.addEventListener('click', () => {
        const m = document.getElementById('reviewModal'); if (m) { m.classList.remove('active'); m.style.display = 'none'; m.style.pointerEvents = 'none'; m.setAttribute('aria-hidden','true'); }
    });
    document.getElementById('cancelReviewBtn')?.addEventListener('click', () => {
        const m = document.getElementById('reviewModal'); if (m) { m.classList.remove('active'); m.style.display = 'none'; m.style.pointerEvents = 'none'; m.setAttribute('aria-hidden','true'); }
    });
    document.getElementById('confirmReviewBtn')?.addEventListener('click', (e) => {
        console.log('🟣🟣🟣 CONFIRM REVIEW BUTTON CLICKED 🟣🟣🟣');
        e.preventDefault();
        confirmEnrollmentSave();
    });

    // Zoom modal close handler
    document.querySelector('#documentZoomModal .zoom-close')?.addEventListener('click', () => {
        const m = document.getElementById('documentZoomModal'); if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden','true'); }
    });

    // Profile modal tabs
    document.querySelectorAll('.profile-tabs .tab-btn')?.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.profile-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            const tabName = e.target.dataset.tab;
            document.getElementById(`tab-${tabName}`)?.classList.add('active');
        });
    });

    // Close modal
    document.getElementById('closeProfileModal')?.addEventListener('click', closeStudentProfile);
    document.getElementById('profileCloseBtn')?.addEventListener('click', closeStudentProfile);

    document.getElementById('profileEditBtn')?.addEventListener('click', () => {
        if (!currentProfileStudentId) {
            showNotification('No student selected for editing', 'warning');
            return;
        }
        openEnrollmentDetail(currentProfileStudentId);
    });

    document.getElementById('profileArchiveBtn')?.addEventListener('click', () => {
        if (!currentProfileStudentId) {
            showNotification('No student selected to archive', 'warning');
            return;
        }
        archiveStudent(currentProfileStudentId);
    });

    document.getElementById('profileRejectBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentProfileStudentId) {
            showNotification('No student selected to reject', 'warning');
            return;
        }
        rejectStudentEnrollment(currentProfileStudentId);
    });

    document.getElementById('profileApproveBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!currentProfileStudentId) {
            showNotification('No student selected to approve', 'warning');
            return;
        }
        approveStudentEnrollment(currentProfileStudentId);
    });
}

// Initialize on DOM load (with retry logic in case data isn't loaded yet)
document.addEventListener('DOMContentLoaded', () => {
    try { 
        // Wait a moment for main dashboard to populate window.allEnrollments
        setTimeout(() => {
            initStudentDirectory();
        }, 100);
    } catch (err) { 
        console.warn('Student Directory init failed', err); 
    }
});

window.addEventListener('schoolYearActivated', () => {
    loadStudents().catch(err => console.warn('[Students] reload on schoolYearActivated failed:', err));
});

window.addEventListener('dashboard:school-year-changed', () => {
    loadStudents().catch(err => console.warn('[Students] reload on dashboard:school-year-changed failed:', err));
});

window.addEventListener('storage', (event) => {
    if (!event || !event.key) return;
    if (event.key === 'activeSchoolYear' || event.key === 'activeSchoolYearChangedAt') {
        loadStudents().catch(err => console.warn('[Students] reload on storage school-year change failed:', err)); 
    }
});


