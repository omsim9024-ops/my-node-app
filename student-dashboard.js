// --- Address Data Structure - Cascading Dropdowns (copied from enrollment-form.js) ---
const ADDRESS_DATA = {
    "Philippines": {
        "Davao de Oro": {
            "Compostela": ["Aurora", "Bagongon", "Gabi", "Lagab", "Mangayon", "Mapaca", "Maparat", "New Alegria", "Ngan", "Osmeña", "Panansalan", "Poblacion", "San Jose", "San Miguel", "Siocon", "Tamia"],
            "Laak": ["Basil", "Kidawa", "Kiagum", "Kipalili", "Langmas", "Macaag", "Mampising", "Manan", "Pangi", "San Isidro", "San Miguel", "Santa Emilia", "Sawata"],
            "Mabini": ["Cabuyuan", "Cadunan", "Cuambog", "Lapinigan", "Pindasan", "Tagnanan", "Tambo"],
            "Maco": ["Anitapan", "Bucana", "Binuangan", "Calabcag", "Goma", "Hubang", "Kidawa", "Mabuhay", "New Barili", "Panansalan", "Poblacion", "San Roque", "San Vicente", "Tagbaros", "Tuboran"],
            "Maragusan": ["Alimodao", "Bagong Silang", "Bayabas", "Burias", "Carmen", "Lahi", "Lantud", "Mabuhay", "Mahayahay", "Mapawa", "Masara", "New Albay", "Poblacion", "Salvacion", "San Antonio", "San Miguel", "Santo Niño", "Tadman", "Tagbaros", "Tigbao"],
            "Mawab": ["Beraba", "Bongabong", "Carpol", "Gutierrez", "Lapi", "Malinawon", "New Astorga", "New Bataan", "New Corella", "Poblacion", "Salvacion", "Sawata", "Tuboran"],
            "Monkayo": ["Awao", "Babag", "Casoon", "Inocencio", "Liberty", "Maco", "Mansaka", "Montevista", "Nabunturan", "New Albay", "New Corella", "New Leyte", "Poblacion", "San Isidro", "San Jose", "San Martin", "San Vicente", "Santa Cruz", "Santo Niño", "Tuboran"],
            "Montevista": ["Bankerohan", "Bayabas", "Bitaugan", "Cabantian", "Dalisay", "Gasaan", "Kapatagan", "Lino", "Mabuhay", "New Corella", "Poblacion", "San Antonio", "San Jose", "San Miguel", "San Vicente", "Santo Niño"],
            "Nabunturan": ["Bangkerohan", "Bayabas", "Bingcungan", "Bucana", "Cabidian", "Katipunan", "Luna", "Magsaysay", "Manat", "New Corella", "Poblacion", "San Antonio", "San Isidro", "San Jose", "San Miguel", "San Roque", "San Vicente", "Santo Niño"],
            "New Bataan": ["Andap", "Bantawan", "Camanlangan", "Cawayan", "Concepcion", "Fatima", "Gazutan", "Kati-2", "Magangit", "Maya", "Pagsabangan", "Panamao", "Pangatuan", "Paraiso", "Poblacion", "San Roque", "Santo Niño", "Tina"],
            "Pantukan": ["Bongabong", "Boringot", "Buan", "Gasan", "Kingking", "Lapu-lapu", "Magnaga", "Malamodao", "Matiao", "Napnapan", "Poblacion", "Tagbaros", "Tambong", "Tagugpo", "Tauber"]
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

// Helper function to copy current address to permanent address
function copyCurrentToPermanentAddress() {
    const checkbox = document.getElementById('sameAsCurrentAddress');
    const isChecked = checkbox.checked;
    
    console.log('[Address Copy] Same as Current Address checked:', isChecked);
    
    if (isChecked) {
        // Copy simple text fields
        document.getElementById('editPermanentSitio').value = document.getElementById('editCurrentSitio').value;
        document.getElementById('editPermanentZipCode').value = document.getElementById('editCurrentZipCode').value;
        
        // Copy cascading dropdown values
        const currentCountry = document.getElementById('editCurrentCountry').value;
        const currentProvince = document.getElementById('editCurrentProvince').value;
        const currentMunicipality = document.getElementById('editCurrentMunicipality').value;
        const currentBarangay = document.getElementById('editCurrentBarangay').value;
        
        setCascadingAddressValues('editPermanent', currentCountry, currentProvince, currentMunicipality, currentBarangay);
        
        // Disable permanent address fields to prevent manual editing
        setPermanentAddressFieldsDisabled(true);
        
        // Add event listeners to current address fields for real-time sync
        addCurrentAddressListeners();
    } else {
        // Enable permanent address fields for manual editing
        setPermanentAddressFieldsDisabled(false);
        
        // Remove event listeners to stop syncing
        removeCurrentAddressListeners();
    }
}

// Event listeners for real-time sync when checkbox is checked
let currentAddressListeners = [];

function addCurrentAddressListeners() {
    // Remove any existing listeners first
    removeCurrentAddressListeners();
    
    const currentFields = [
        { id: 'editCurrentSitio', targetId: 'editPermanentSitio' },
        { id: 'editCurrentZipCode', targetId: 'editPermanentZipCode' }
    ];
    
    currentFields.forEach(field => {
        const sourceElement = document.getElementById(field.id);
        const targetElement = document.getElementById(field.targetId);
        
        if (sourceElement && targetElement) {
            const listener = () => {
                if (document.getElementById('sameAsCurrentAddress').checked) {
                    targetElement.value = sourceElement.value;
                }
            };
            
            sourceElement.addEventListener('input', listener);
            sourceElement.addEventListener('change', listener);
            
            currentAddressListeners.push({ element: sourceElement, listener: listener });
        }
    });
    
    // Add listeners for cascading dropdowns
    const cascadingFields = [
        { id: 'editCurrentCountry', targetPrefix: 'editPermanent' },
        { id: 'editCurrentProvince', targetPrefix: 'editPermanent' },
        { id: 'editCurrentMunicipality', targetPrefix: 'editPermanent' },
        { id: 'editCurrentBarangay', targetPrefix: 'editPermanent' }
    ];
    
    cascadingFields.forEach(field => {
        const sourceElement = document.getElementById(field.id);
        
        if (sourceElement) {
            const listener = () => {
                if (document.getElementById('sameAsCurrentAddress').checked) {
                    // Copy all cascading values when any dropdown changes
                    const currentCountry = document.getElementById('editCurrentCountry').value;
                    const currentProvince = document.getElementById('editCurrentProvince').value;
                    const currentMunicipality = document.getElementById('editCurrentMunicipality').value;
                    const currentBarangay = document.getElementById('editCurrentBarangay').value;
                    
                    setCascadingAddressValues('editPermanent', currentCountry, currentProvince, currentMunicipality, currentBarangay);
                }
            };
            
            sourceElement.addEventListener('change', listener);
            
            currentAddressListeners.push({ element: sourceElement, listener: listener });
        }
    });
}

function removeCurrentAddressListeners() {
    currentAddressListeners.forEach(({ element, listener }) => {
        element.removeEventListener('input', listener);
        element.removeEventListener('change', listener);
    });
    currentAddressListeners = [];
}

// Helper function to setup conditional field display for Special Programs & Status
function setupConditionalFields() {
    // IP Member conditional field
    const ipYesRadio = document.getElementById('editIPYes');
    const ipNoRadio = document.getElementById('editIPNo');
    const ipDetailsGroup = document.getElementById('ipDetailsGroup');
    const ipOtherDetailsGroup = document.getElementById('ipOtherDetailsGroup');
    const ipGroupSelect = document.getElementById('editIPGroup');
    
    function toggleIPField() {
        if (ipYesRadio && ipNoRadio && ipDetailsGroup) {
            if (ipYesRadio.checked) {
                ipDetailsGroup.classList.remove('hidden');
                ipDetailsGroup.classList.add('show');
                console.log('[Conditional Fields] IP details field shown');
                
                // Check if "Other" is selected to show/hide the text field
                toggleIPOtherField();
            } else {
                ipDetailsGroup.classList.add('hidden');
                ipDetailsGroup.classList.remove('show');
                ipOtherDetailsGroup.classList.add('hidden');
                ipOtherDetailsGroup.classList.remove('show');
                // Clear the fields when hidden
                const ipGroupSelect = document.getElementById('editIPGroup');
                const ipOtherText = document.getElementById('editIPOtherText');
                if (ipGroupSelect) ipGroupSelect.value = '';
                if (ipOtherText) ipOtherText.value = '';
                console.log('[Conditional Fields] IP details field hidden');
            }
        }
    }
    
    function toggleIPOtherField() {
        if (ipGroupSelect && ipOtherDetailsGroup) {
            if (ipGroupSelect.value === 'other') {
                ipOtherDetailsGroup.classList.remove('hidden');
                ipOtherDetailsGroup.classList.add('show');
                console.log('[Conditional Fields] IP "Other" text field shown');
            } else {
                ipOtherDetailsGroup.classList.add('hidden');
                ipOtherDetailsGroup.classList.remove('show');
                // Clear the text field when hidden
                const ipOtherText = document.getElementById('editIPOtherText');
                if (ipOtherText) ipOtherText.value = '';
                console.log('[Conditional Fields] IP "Other" text field hidden');
            }
        }
    }
    
    if (ipYesRadio) ipYesRadio.addEventListener('change', toggleIPField);
    if (ipNoRadio) ipNoRadio.addEventListener('change', toggleIPField);
    if (ipGroupSelect) ipGroupSelect.addEventListener('change', toggleIPOtherField);
    
    // 4Ps Beneficiary conditional field
    const ps4psYesRadio = document.getElementById('edit4PsYes');
    const ps4psNoRadio = document.getElementById('edit4PsNo');
    const ps4psDetailsGroup = document.getElementById('ps4psDetailsGroup');
    
    function toggle4PsField() {
        if (ps4psYesRadio && ps4psNoRadio && ps4psDetailsGroup) {
            if (ps4psYesRadio.checked) {
                ps4psDetailsGroup.classList.remove('hidden');
                ps4psDetailsGroup.classList.add('show');
                console.log('[Conditional Fields] 4Ps details field shown');
            } else {
                ps4psDetailsGroup.classList.add('hidden');
                ps4psDetailsGroup.classList.remove('show');
                // Clear the field when hidden
                const householdIDInput = document.getElementById('edit4PsHouseholdID');
                if (householdIDInput) householdIDInput.value = '';
                console.log('[Conditional Fields] 4Ps details field hidden');
            }
        }
    }
    
    if (ps4psYesRadio) ps4psYesRadio.addEventListener('change', toggle4PsField);
    if (ps4psNoRadio) ps4psNoRadio.addEventListener('change', toggle4PsField);
    
    // PWD conditional field
    const pwdYesRadio = document.getElementById('editPWDYes');
    const pwdNoRadio = document.getElementById('editPWDNo');
    const pwdDetailsGroup = document.getElementById('pwdDetailsGroup');
    
    function togglePWDField() {
        if (pwdYesRadio && pwdNoRadio && pwdDetailsGroup) {
            if (pwdYesRadio.checked) {
                pwdDetailsGroup.classList.remove('hidden');
                pwdDetailsGroup.classList.add('show');
                console.log('[Conditional Fields] PWD details field shown');
            } else {
                pwdDetailsGroup.classList.add('hidden');
                pwdDetailsGroup.classList.remove('show');
                // Clear all disability checkboxes and text field when hidden
                const disabilityCheckboxes = document.querySelectorAll('input[name="disability"]');
                const pwdDetailsInput = document.getElementById('editPWDDetails');
                disabilityCheckboxes.forEach(checkbox => checkbox.checked = false);
                if (pwdDetailsInput) pwdDetailsInput.value = '';
                console.log('[Conditional Fields] PWD details field hidden');
            }
        }
    }
    
    if (pwdYesRadio) pwdYesRadio.addEventListener('change', togglePWDField);
    if (pwdNoRadio) pwdNoRadio.addEventListener('change', togglePWDField);
    
    // Returning Learner conditional field
    const returningLearnerYesRadio = document.getElementById('editReturningLearnerYes');
    const returningLearnerNoRadio = document.getElementById('editReturningLearnerNo');
    const returningLearnerFields = document.getElementById('returningLearnerFields');
    
    function toggleReturningLearnerField() {
        if (returningLearnerYesRadio && returningLearnerNoRadio && returningLearnerFields) {
            if (returningLearnerYesRadio.checked) {
                returningLearnerFields.classList.remove('hidden');
                returningLearnerFields.classList.add('show');
                console.log('[Conditional Fields] Returning Learner fields shown');
            } else {
                returningLearnerFields.classList.add('hidden');
                returningLearnerFields.classList.remove('show');
                // Clear the fields when hidden
                const lastGradeLevel = document.getElementById('editLastGradeLevel');
                const lastSchoolYear = document.getElementById('editLastSchoolYear');
                const lastSchoolAttended = document.getElementById('editLastSchoolAttended');
                const schoolID = document.getElementById('editSchoolID');
                if (lastGradeLevel) lastGradeLevel.value = '';
                if (lastSchoolYear) lastSchoolYear.value = '';
                if (lastSchoolAttended) lastSchoolAttended.value = '';
                if (schoolID) schoolID.value = '';
                console.log('[Conditional Fields] Returning Learner fields hidden');
            }
        }
    }
    
    if (returningLearnerYesRadio) returningLearnerYesRadio.addEventListener('change', toggleReturningLearnerField);
    if (returningLearnerNoRadio) returningLearnerNoRadio.addEventListener('change', toggleReturningLearnerField);
    
    console.log('[Conditional Fields] Event listeners setup complete');
}

// Helper function to enable/disable permanent address fields
function setPermanentAddressFieldsDisabled(disabled) {
    const fields = [
        'editPermanentSitio',
        'editPermanentCountry',
        'editPermanentProvince',
        'editPermanentMunicipality',
        'editPermanentBarangay',
        'editPermanentZipCode'
    ];
    
    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.disabled = disabled;
            if (disabled) {
                field.style.backgroundColor = '#f8f9fa';
                field.style.cursor = 'not-allowed';
            } else {
                field.style.backgroundColor = '';
                field.style.cursor = '';
            }
        }
    });
}

// Helper function to set cascading dropdown values
function setCascadingAddressValues(prefix, country, province, municipality, barangay) {
    console.log(`[Address Cascade] Setting values for ${prefix}:`, { country, province, municipality, barangay });
    
    const countrySelect = document.getElementById(prefix + 'Country');
    const provinceSelect = document.getElementById(prefix + 'Province');
    const municipalitySelect = document.getElementById(prefix + 'Municipality');
    const barangaySelect = document.getElementById(prefix + 'Barangay');
    
    if (!countrySelect || !provinceSelect || !municipalitySelect || !barangaySelect) {
        console.error(`[Address Cascade] Missing elements for ${prefix}`);
        return;
    }
    
    // Set country and trigger change
    if (country) {
        countrySelect.value = country;
        console.log(`[Address Cascade] Set ${prefix}Country to: ${country}`);
        countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Set province after a delay to allow dropdown to populate
        setTimeout(() => {
            if (province) {
                provinceSelect.value = province;
                console.log(`[Address Cascade] Set ${prefix}Province to: ${province}`);
                provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Set municipality after another delay
                setTimeout(() => {
                    if (municipality) {
                        municipalitySelect.value = municipality;
                        console.log(`[Address Cascade] Set ${prefix}Municipality to: ${municipality}`);
                        municipalitySelect.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        // Set barangay after final delay
                        setTimeout(() => {
                            if (barangay) {
                                barangaySelect.value = barangay;
                                console.log(`[Address Cascade] Set ${prefix}Barangay to: ${barangay}`);
                            }
                        }, 100);
                    }
                }, 100);
            }
        }, 100);
    }
}
// --- Address Cascading Dropdowns for Edit Enrollment Modal ---
function populateAddressDropdowns(prefix) {
    // prefix: 'editCurrent' or 'editPermanent'
    const countrySelect = document.getElementById(prefix + 'Country');
    const provinceSelect = document.getElementById(prefix + 'Province');
    const municipalitySelect = document.getElementById(prefix + 'Municipality');
    const barangaySelect = document.getElementById(prefix + 'Barangay');
    if (!countrySelect || !provinceSelect || !municipalitySelect || !barangaySelect || typeof ADDRESS_DATA !== 'object') return;

    // Populate country
    countrySelect.innerHTML = '<option value="">Select Country</option>';
    Object.keys(ADDRESS_DATA).forEach(country => {
        countrySelect.innerHTML += `<option value="${country}">${country}</option>`;
    });

    // Province
    function updateProvinces() {
        const country = countrySelect.value;
        provinceSelect.innerHTML = '<option value="">Select Province</option>';
        municipalitySelect.innerHTML = '<option value="">Select Municipality/City</option>';
        barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
        if (!country || !ADDRESS_DATA[country]) return;
        Object.keys(ADDRESS_DATA[country]).forEach(province => {
            provinceSelect.innerHTML += `<option value="${province}">${province}</option>`;
        });
    }

    // Municipality
    function updateMunicipalities() {
        const country = countrySelect.value;
        const province = provinceSelect.value;
        municipalitySelect.innerHTML = '<option value="">Select Municipality/City</option>';
        barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
        if (!country || !province || !ADDRESS_DATA[country] || !ADDRESS_DATA[country][province]) return;
        Object.keys(ADDRESS_DATA[country][province]).forEach(municipality => {
            municipalitySelect.innerHTML += `<option value="${municipality}">${municipality}</option>`;
        });
    }

    // Barangay
    function updateBarangays() {
        const country = countrySelect.value;
        const province = provinceSelect.value;
        const municipality = municipalitySelect.value;
        barangaySelect.innerHTML = '<option value="">Select Barangay</option>';
        if (!country || !province || !municipality || !ADDRESS_DATA[country] || !ADDRESS_DATA[country][province] || !ADDRESS_DATA[country][province][municipality]) return;
        ADDRESS_DATA[country][province][municipality].forEach(barangay => {
            barangaySelect.innerHTML += `<option value="${barangay}">${barangay}</option>`;
        });
    }

    countrySelect.addEventListener('change', function() {
        updateProvinces();
        // If a value is already selected, trigger next cascade
        if (provinceSelect.value) updateMunicipalities();
        if (municipalitySelect.value) updateBarangays();
    });
    provinceSelect.addEventListener('change', function() {
        updateMunicipalities();
        if (municipalitySelect.value) updateBarangays();
    });
    municipalitySelect.addEventListener('change', updateBarangays);

    // Initial population and cascade for pre-filled values
    updateProvinces();
    // If a value is already set (from pre-fill), trigger cascades
    if (provinceSelect.value) {
        updateMunicipalities();
        // Force selection if value exists
        provinceSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (municipalitySelect.value) {
        updateBarangays();
        municipalitySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // If country is pre-filled, force change event to trigger cascade
    if (countrySelect.value) {
        countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// On DOMContentLoaded or modal open, call:
document.addEventListener('DOMContentLoaded', function() {
    if (typeof ADDRESS_DATA !== 'undefined') {
        populateAddressDropdowns('editCurrent');
        populateAddressDropdowns('editPermanent');
    }
    
    // Add event listener for "Same as Current Address" checkbox
    const sameAsCurrentCheckbox = document.getElementById('sameAsCurrentAddress');
    if (sameAsCurrentCheckbox) {
        sameAsCurrentCheckbox.addEventListener('change', copyCurrentToPermanentAddress);
    }
});
// Modal for editing enrollment details - Enhanced Admin Style
function openEnrollmentEditModal(enrollment) {
    console.log('[Edit Modal] Opening enhanced enrollment edit modal for:', enrollment);
    console.log('[Edit Modal] Raw enrollment object keys:', Object.keys(enrollment || {}));
    
    const modal = document.getElementById('enrollmentEditModal');
    const form = document.getElementById('enrollmentEditForm');
    if (!modal || !form || !enrollment) {
        console.error('[Edit Modal] Missing elements:', { modal: !!modal, form: !!form, enrollment: !!enrollment });
        return;
    }

    // Get enrollment data with comprehensive field extraction
    let data = enrollment.enrollment_data || {};
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { data = {}; }
    }

    // ensure any embedded file maps are objects
    if (data.enrollmentFiles && typeof data.enrollmentFiles === 'string') {
        try { data.enrollmentFiles = JSON.parse(data.enrollmentFiles); } catch { /*ignore*/ }
    }
    if (data.documents && typeof data.documents === 'string') {
        try { data.documents = JSON.parse(data.documents); } catch { /*ignore*/ }
    }

    console.log('[Edit Modal] Loading existing data:', data);
    console.log('[Edit Modal] Data keys:', Object.keys(data || {}));
    console.log('[Edit Modal] PWD-related data:', {
        'data.hasPWD': data.hasPWD,
        'enrollment.hasPWD': enrollment.hasPWD,
        'data.disability': data.disability,
        'enrollment.disability': enrollment.disability,
        'data.pwdDetails': data.pwdDetails,
        'enrollment.pwdDetails': enrollment.pwdDetails
    });

    // Populate Personal Information Section
    document.getElementById('editLastName').value = data.lastName || enrollment.last_name || '';
    document.getElementById('editFirstName').value = data.firstName || enrollment.first_name || '';
    document.getElementById('editMiddleName').value = data.middleName || '';
    
    // Set and calculate birthdate/age
    let birthdate = data.birthdate || enrollment.birthdate || '';
    // Normalize birthdate to yyyy-mm-dd for input[type=date]
    if (birthdate) {
        // Accepts ISO, slashes, or other formats
        const d = new Date(birthdate);
        if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            birthdate = `${yyyy}-${mm}-${dd}`;
        }
    }
    document.getElementById('editBirthdate').value = birthdate;
    if (birthdate) {
        const age = calculateAge(birthdate);
        document.getElementById('editAge').value = age;
    }
    
    // Set gender radio buttons
    const maleRadio = document.getElementById('editMale');
    const femaleRadio = document.getElementById('editFemale');
    const gender = data.gender || enrollment.gender || '';
    if (gender.toLowerCase() === 'male') {
        maleRadio.checked = true;
        femaleRadio.checked = false;
    } else if (gender.toLowerCase() === 'female') {
        maleRadio.checked = false;
        femaleRadio.checked = true;
    }

    document.getElementById('editPlaceOfBirth').value = data.placeOfBirth || enrollment.placeOfBirth || '';

    // Set Mother Tongue with proper handling
    const motherTongue = data.motherTongue || '';
    document.getElementById('editMotherTongue').value = motherTongue;
    
    // Handle Mother Tongue "Other" field
    const motherTongueOther = document.getElementById('editMotherTongueOther');
    const motherTongueOtherText = document.getElementById('editMotherTongueOtherText');
    if (motherTongue === 'other') {
        motherTongueOther.classList.remove('hidden');
        motherTongueOtherText.value = data.motherTongueOtherText || '';
        motherTongueOtherText.required = true;
    } else {
        motherTongueOther.classList.add('hidden');
        motherTongueOtherText.value = '';
        motherTongueOtherText.required = false;
    }

    // Populate Academic Information Section
    const gradeLevel = data.gradeLevel || enrollment.grade_level || '';
    document.getElementById('editGradeLevel').value = gradeLevel;
    
    // Handle Track visibility based on Grade Level
    const trackContainer = document.getElementById('editTrackContainer');
    const electivesContainer = document.getElementById('editElectivesContainer');
    const semesterContainer = document.getElementById('editSemesterContainer');
    
    if (['11', '12'].includes(gradeLevel)) {
        trackContainer.style.display = 'block';
        electivesContainer.style.display = 'block';
        semesterContainer.style.display = 'block';

        // Set Track/Program (normalize to match select options)
        let track = data.track || enrollment.track || '';
        // Normalize common aliases/case (add more as needed)
        if (track) {
            track = track.trim();
            // Example: handle case-insensitivity and known aliases
            const trackOptions = Array.from(document.getElementById('editTrack').options).map(opt => opt.value);
            const found = trackOptions.find(opt => opt.toLowerCase() === track.toLowerCase());
            if (found) track = found;
        }
        document.getElementById('editTrack').value = track;
        document.getElementById('editTrack').required = true;

        // Set Semester
        const semester = data.semester || enrollment.semester || '';
        document.getElementById('editSemester').value = semester;
        document.getElementById('editSemester').required = true;

        // Populate electives based on track and set selected electives
        populateElectivesForTrack(track);

        // Set selected electives from saved data
        setTimeout(() => {
            const savedElectives = data.electives || enrollment.electives || [];
            if (Array.isArray(savedElectives)) {
                savedElectives.forEach(elective => {
                    const checkbox = document.querySelector(`input[name="electives"][value="${elective}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        }, 100);
    } else {
        trackContainer.style.display = 'none';
        electivesContainer.style.display = 'none';
        semesterContainer.style.display = 'none';
        document.getElementById('editTrack').value = '';
        document.getElementById('editTrack').required = false;
        document.getElementById('editSemester').value = '';
        document.getElementById('editSemester').required = false;
    }

    // Set LRN (now text input)
    document.getElementById('editLRN').value = data.lrn || enrollment.lrn || '';
    
    // Set Returning Learner radio buttons and populate conditional fields
    const returningLearnerYes = document.getElementById('editReturningLearnerYes');
    const returningLearnerNo = document.getElementById('editReturningLearnerNo');
    const isReturningLearner = data.returningLearner || enrollment.returningLearner || 'no';
    console.log('[Edit Modal] Returning Learner Status Check:', { isReturningLearner, 'data.returningLearner': data.returningLearner, 'enrollment.returningLearner': enrollment.returningLearner });
    
    if (isReturningLearner === 'yes') {
        returningLearnerYes.checked = true;
        returningLearnerNo.checked = false;
        
        // Immediately populate Returning Learner fields
        const returningLearnerFields = document.getElementById('returningLearnerFields');
        const lastGradeLevel = document.getElementById('editLastGradeLevel');
        const lastSchoolYear = document.getElementById('editLastSchoolYear');
        const lastSchoolAttended = document.getElementById('editLastSchoolAttended');
        const schoolID = document.getElementById('editSchoolID');
        
        if (returningLearnerFields) {
            returningLearnerFields.classList.remove('hidden');
            returningLearnerFields.classList.add('show');
        }
        
        if (lastGradeLevel) {
            lastGradeLevel.value = data.lastGradeLevel || enrollment.lastGradeLevel || '';
            console.log('[Edit Modal] Last Grade Level populated:', lastGradeLevel.value);
        }
        
        if (lastSchoolYear) {
            lastSchoolYear.value = data.lastSchoolYear || enrollment.lastSchoolYear || '';
            console.log('[Edit Modal] Last School Year populated:', lastSchoolYear.value);
        }
        
        if (lastSchoolAttended) {
            lastSchoolAttended.value = data.lastSchoolAttended || enrollment.lastSchoolAttended || '';
            console.log('[Edit Modal] Last School Attended populated:', lastSchoolAttended.value);
        }
        
        if (schoolID) {
            schoolID.value = data.schoolID || enrollment.schoolID || '';
            console.log('[Edit Modal] School ID populated:', schoolID.value);
        }
    } else {
        returningLearnerYes.checked = false;
        returningLearnerNo.checked = true;
    }

    // Set IP, 4Ps, and PWD status with proper data extraction
    const ipYes = document.getElementById('editIPYes');
    const ipNo = document.getElementById('editIPNo');
    const isIP = data.isIP || enrollment.isIP || 'no';
    if (isIP === 'yes') {
        ipYes.checked = true;
        ipNo.checked = false;
    } else {
        ipYes.checked = false;
        ipNo.checked = true;
    }

    const ps4psYes = document.getElementById('edit4PsYes');
    const ps4psNo = document.getElementById('edit4PsNo');
    const is4Ps = data.is4Ps || enrollment.is4Ps || 'no';
    console.log('[Edit Modal] 4Ps Status Check:', { is4Ps, 'data.is4Ps': data.is4Ps, 'enrollment.is4Ps': enrollment.is4Ps });
    
    if (is4Ps === 'yes') {
        ps4psYes.checked = true;
        ps4psNo.checked = false;
        
        // Immediately populate 4Ps Household ID field
        const householdIDInput = document.getElementById('edit4PsHouseholdID');
        const ps4psDetailsGroup = document.getElementById('ps4psDetailsGroup');
        
        if (householdIDInput) {
            householdIDInput.value = data.ps4psHouseholdID || enrollment.ps4psHouseholdID || data.householdID || enrollment.householdID || '';
            console.log('[Edit Modal] 4Ps Household ID populated:', householdIDInput.value);
        }
        
        if (ps4psDetailsGroup) {
            ps4psDetailsGroup.classList.remove('hidden');
            ps4psDetailsGroup.classList.add('show');
            console.log('[Edit Modal] 4Ps details field shown');
        }
    } else {
        ps4psYes.checked = false;
        ps4psNo.checked = true;
    }

    const pwdYes = document.getElementById('editPWDYes');
    const pwdNo = document.getElementById('editPWDNo');
    const hasPWD = data.hasPWD || enrollment.hasPWD || 'no';
    console.log('[Edit Modal] PWD Status Check:', { hasPWD, 'data.hasPWD': data.hasPWD, 'enrollment.hasPWD': enrollment.hasPWD });
    
    if (hasPWD === 'yes') {
        pwdYes.checked = true;
        pwdNo.checked = false;
        
        // Immediately populate PWD disability checkboxes
        const pwdDetailsInput = document.getElementById('editPWDDetails');
        const pwdDetailsGroup = document.getElementById('pwdDetailsGroup');
        
        if (pwdDetailsInput) {
            pwdDetailsInput.value = data.pwdDetails || enrollment.pwdDetails || data.disabilityDetails || enrollment.disabilityDetails || '';
        }
        
        if (pwdDetailsGroup) {
            pwdDetailsGroup.classList.remove('hidden');
            pwdDetailsGroup.classList.add('show');
        }
        
        // Populate disability checkboxes immediately
        console.log('[Edit Modal] PWD Data for population:', {
            'data.disability': data.disability,
            'enrollment.disability': enrollment.disability,
            'data.disabilities': data.disabilities,
            'enrollment.disabilities': enrollment.disabilities
        });
        
        // Try multiple possible field names for disability data
        const disabilityData = data.disability || enrollment.disability || 
                              data.disabilities || enrollment.disabilities || 
                              data.pwdDisabilities || enrollment.pwdDisabilities || [];
        
        console.log('[Edit Modal] Final disability data to process:', disabilityData);
        
        if (Array.isArray(disabilityData) && disabilityData.length > 0) {
            console.log('[Edit Modal] Populating disability checkboxes from array:', disabilityData);
            disabilityData.forEach(disabilityValue => {
                const checkbox = document.querySelector(`input[name="disability"][value="${disabilityValue}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    console.log('[Edit Modal] ✓ Checked disability:', disabilityValue);
                } else {
                    console.log('[Edit Modal] ✗ Disability checkbox not found:', disabilityValue);
                }
            });
        } else if (typeof disabilityData === 'string' && disabilityData.trim() !== '') {
            console.log('[Edit Modal] Populating disability checkboxes from string:', disabilityData);
            const disabilities = disabilityData.split(',').map(d => d.trim()).filter(d => d !== '');
            disabilities.forEach(disabilityValue => {
                const checkbox = document.querySelector(`input[name="disability"][value="${disabilityValue}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                    console.log('[Edit Modal] ✓ Checked disability from string:', disabilityValue);
                } else {
                    console.log('[Edit Modal] ✗ Disability checkbox not found from string:', disabilityValue);
                }
            });
        } else {
            console.log('[Edit Modal] No disability data found or empty data');
        }
    } else {
        pwdYes.checked = false;
        pwdNo.checked = true;
    }

    // Populate conditional fields based on radio button states
    setTimeout(() => {
        // IP Group field
        const ipGroupSelect = document.getElementById('editIPGroup');
        const ipOtherDetailsGroup = document.getElementById('ipOtherDetailsGroup');
        const ipOtherText = document.getElementById('editIPOtherText');
        
        if (ipGroupSelect && isIP === 'yes') {
            ipGroupSelect.value = data.ipGroup || enrollment.ipGroup || '';
            // Show the field if IP is yes
            const ipDetailsGroup = document.getElementById('ipDetailsGroup');
            if (ipDetailsGroup) {
                ipDetailsGroup.classList.remove('hidden');
                ipDetailsGroup.classList.add('show');
            }
            
            // Handle "Other" selection and text field
            if (ipGroupSelect.value === 'other' && ipOtherText && ipOtherDetailsGroup) {
                ipOtherText.value = data.ipOtherText || enrollment.ipOtherText || '';
                ipOtherDetailsGroup.classList.remove('hidden');
                ipOtherDetailsGroup.classList.add('show');
            }
        }
    }, 100);

    // Populate Address Information Section (normalize for '--', null, undefined)
    // Pre-fill Current Address fields
    document.getElementById('editCurrentSitio').value = data.currentSitio || enrollment.currentSitio || data.cu_address_sitio_street || enrollment.cu_address_sitio_street || '';
    document.getElementById('editCurrentCountry').value = data.currentCountry || enrollment.currentCountry || data.country || enrollment.country || '';
    document.getElementById('editCurrentProvince').value = data.currentProvince || enrollment.currentProvince || data.current_province_name || enrollment.current_province_name || data.cu_address_province_name || enrollment.cu_address_province_name || '';
    document.getElementById('editCurrentMunicipality').value = data.currentMunicipality || enrollment.currentMunicipality || data.current_municipality_name || enrollment.current_municipality_name || data.cu_address_municipality_name || enrollment.cu_address_municipality_name || '';
    document.getElementById('editCurrentBarangay').value = data.currentBarangay || enrollment.currentBarangay || data.current_barangay_name || enrollment.current_barangay_name || data.cu_address_barangay_name || enrollment.cu_address_barangay_name || '';
    document.getElementById('editCurrentZipCode').value = data.currentZipCode || enrollment.currentZipCode || data.cu_address_zip || enrollment.cu_address_zip || '';

    // Pre-fill Permanent Address fields
    document.getElementById('editPermanentSitio').value = data.permanentSitio || enrollment.permanentSitio || data.pe_address_sitio_street || enrollment.pe_address_sitio_street || '';
    document.getElementById('editPermanentCountry').value = data.permanentCountry || enrollment.permanentCountry || data.country || enrollment.country || '';
    document.getElementById('editPermanentProvince').value = data.permanentProvince || enrollment.permanentProvince || data.permanent_province_name || enrollment.permanent_province_name || data.pe_address_province_name || enrollment.pe_address_province_name || '';
    document.getElementById('editPermanentMunicipality').value = data.permanentMunicipality || enrollment.permanentMunicipality || data.permanent_municipality_name || enrollment.permanent_municipality_name || data.pe_address_municipality_name || enrollment.pe_address_municipality_name || '';
    document.getElementById('editPermanentBarangay').value = data.permanentBarangay || enrollment.permanentBarangay || data.permanent_barangay_name || enrollment.permanent_barangay_name || data.pe_address_barangay_name || enrollment.pe_address_barangay_name || '';
    document.getElementById('editPermanentZipCode').value = data.permanentZipCode || enrollment.permanentZipCode || data.pe_address_zip || enrollment.pe_address_zip || '';

    // Trigger cascading dropdowns for address fields after setting values
    setTimeout(() => {
        // Set current address cascading values
        setCascadingAddressValues(
            'editCurrent',
            data.currentCountry || enrollment.currentCountry || data.country || enrollment.country || '',
            data.currentProvince || enrollment.currentProvince || data.current_province_name || enrollment.current_province_name || data.cu_address_province_name || enrollment.cu_address_province_name || '',
            data.currentMunicipality || enrollment.currentMunicipality || data.current_municipality_name || enrollment.current_municipality_name || data.cu_address_municipality_name || enrollment.cu_address_municipality_name || '',
            data.currentBarangay || enrollment.currentBarangay || data.current_barangay_name || enrollment.current_barangay_name || data.cu_address_barangay_name || enrollment.cu_address_barangay_name || ''
        );
        
        // Set permanent address cascading values
        setCascadingAddressValues(
            'editPermanent',
            data.permanentCountry || enrollment.permanentCountry || data.country || enrollment.country || '',
            data.permanentProvince || enrollment.permanentProvince || data.permanent_province_name || enrollment.permanent_province_name || data.pe_address_province_name || enrollment.pe_address_province_name || '',
            data.permanentMunicipality || enrollment.permanentMunicipality || data.permanent_municipality_name || enrollment.permanent_municipality_name || data.pe_address_municipality_name || enrollment.pe_address_municipality_name || '',
            data.permanentBarangay || enrollment.permanentBarangay || data.permanent_barangay_name || enrollment.permanent_barangay_name || data.pe_address_barangay_name || enrollment.pe_address_barangay_name || ''
        );
    }, 200);

    // Populate Contact Information Section
    document.getElementById('editEmail').value = data.email || enrollment.email || '';
    document.getElementById('editPhone').value = data.phone || enrollment.phone || '';

    // Pre-populate Documents section if document data exists
    // prefer the new "enrollmentFiles" property (or column) but fall back
    // to the legacy "documents" field so older records still work
    // helper that normalizes any of the candidate values to an object
    const parseMaybe = (val) => {
        if (!val) return {};
        if (typeof val === 'string') {
            try { return JSON.parse(val) || {}; } catch { return {}; }
        }
        if (typeof val === 'object') return val;
        return {};
    };
    // merge all sources so nothing is dropped; later sources override earlier ones
    const existingDocs = Object.assign(
        {},
        parseMaybe(enrollment.enrollment_files),
        parseMaybe(data.enrollmentFiles),
        parseMaybe(data.documents),
        parseMaybe(enrollment.documents)
    );
    populateDocumentsSection(existingDocs);

    // Reset "Same as Current Address" checkbox and enable permanent address fields
    const sameAsCheckbox = document.getElementById('sameAsCurrentAddress');
    if (sameAsCheckbox) {
        sameAsCheckbox.checked = false;
        setPermanentAddressFieldsDisabled(false);
    }

    // Setup conditional fields for Special Programs & Status
    setupConditionalFields();

    // Show modal with proper display and z-index
    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '9999';
    modal.classList.remove('hidden');
    modal.classList.add('active');
    
    // Force visibility with a timeout
    setTimeout(() => {
        modal.style.display = 'flex';
        modal.style.visibility = 'visible';
        modal.style.opacity = '1';
        modal.classList.add('active');
        console.log('[Edit Modal] Enhanced modal displayed successfully');
    }, 10);
    
    // Store current enrollment for saving (prefer stable id fields)
    const historyKey = enrollment.__historyKey || enrollment.id || enrollment.enrollment_id || '';
    modal.dataset.editingEnrollmentId = historyKey;
    // also keep direct reference to the object so save can operate on it
    modal._currentEnrollment = enrollment;
    
    // ensure the record exists in localStorage and has the same history key
    try {
        const stored = JSON.parse(localStorage.getItem('enrollments') || '[]');
        let idx = stored.findIndex((e, i) => {
            const key = String((e && (e.id || e.enrollment_id)) || '').trim() || `idx-${i}`;
            return key === historyKey || String(e.__historyKey||'').trim() === historyKey;
        });
        if (idx === -1) {
            // append copy of enrollment
            const copy = Object.assign({}, enrollment);
            copy.__historyKey = historyKey;
            stored.push(copy);
            idx = stored.length - 1;
        } else {
            // update existing entry's key
            stored[idx].__historyKey = historyKey;
        }
        localStorage.setItem('enrollments', JSON.stringify(stored));
    } catch (_err) {
        // ignore storage errors
    }
    
    console.log('[Edit Modal] Enhanced modal displayed with pre-filled data:', {
        display: modal.style.display,
        visibility: modal.style.visibility,
        zIndex: modal.style.zIndex,
        active: modal.classList.contains('active'),
        editingKey: historyKey,
        preFilledData: {
            birthdate,
            track: data.track || enrollment.track || '',
            electives: data.electives || enrollment.electives || [],
            isIP,
            is4Ps,
            hasPWD,
            currentAddress: data.currentAddress || enrollment.currentAddress || '',
            permanentAddress: data.permanentAddress || enrollment.permanentAddress || '',
            email: data.email || enrollment.email || '',
            documents: existingDocs
        }
    });
}

// Populate documents section with existing uploaded files
function populateDocumentsSection(documents) {
    // ensure we have an object (parse if necessary)
    if (typeof documents === 'string') {
        try { documents = JSON.parse(documents); } catch { documents = {}; }
    }
    console.log('[Edit Modal] Populating documents section:', documents);

    // remove any previous previews/info elements so we don't duplicate
    document.querySelectorAll('.existing-file-info').forEach(el => el.remove());
    
    // PSA Birth Certificate
    if (documents.psaBirthCert) {
        const psaInput = document.getElementById('editPSABirthCert');
        // For file inputs, we can't set the file directly, but we can show the existing file info
        showExistingFile('psaBirthCert', documents.psaBirthCert);
    }
    
    // Report Card
    if (documents.reportCard) {
        showExistingFile('reportCard', documents.reportCard);
    }
    
    // Good Moral Certificate
    if (documents.goodMoralCert) {
        showExistingFile('goodMoralCert', documents.goodMoralCert);
    }
    
    // Other Requirements
    if (documents.otherRequirements && Array.isArray(documents.otherRequirements)) {
        showExistingFile('otherRequirements', documents.otherRequirements);
    }
}

// Show existing file information for document fields; also render previews
function showExistingFile(fieldName, fileData) {
    const input = document.getElementById(`edit${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`);
    if (!input) return;

    // normalize string to object/array
    if (typeof fileData === 'string') {
        try { fileData = JSON.parse(fileData); } catch { /* leave as-is */ }
    }

    const existingFileDiv = document.createElement('div');
    existingFileDiv.className = 'existing-file-info';
    existingFileDiv.style.cssText = `
        margin-top: 5px;
        padding: 8px;
        background: #f0f9ff;
        border: 1px solid #b3d9ff;
        border-radius: 4px;
        font-size: 12px;
        color: #0066cc;
    `;

    const makePreview = (src) => {
        if (!src) return null;
        const img = document.createElement('img');
        img.src = src;
        img.style.maxWidth = '100px';
        img.style.maxHeight = '80px';
        img.style.display = 'block';
        img.style.marginBottom = '4px';
        return img;
    };

    if (Array.isArray(fileData)) {
        existingFileDiv.innerHTML = `📎 ${fileData.length} file(s) already uploaded. Upload new files to replace.`;
        // try to preview first item
        const first = fileData[0];
        const previewSrc = typeof first === 'string' ? first : (first && (first.dataUrl || first.url || first.filename || first.name));
        const img = makePreview(previewSrc);
        if (img) existingFileDiv.insertBefore(img, existingFileDiv.firstChild);
    } else if (fileData && typeof fileData === 'object') {
        const src = fileData.dataUrl || fileData.url || fileData.filename || fileData.name;
        const img = makePreview(src);
        const fileName = fileData.name || fileData.filename || 'Existing file';
        if (img) existingFileDiv.appendChild(img);
        existingFileDiv.innerHTML += `📎 ${fileName} (Click to upload new file)`;
    } else if (fileData) {
        const img = makePreview(fileData);
        if (img) existingFileDiv.appendChild(img);
        existingFileDiv.appendChild(document.createTextNode(`📎 Uploaded`));
    } else {
        existingFileDiv.textContent = '📎 File already uploaded';
    }

    input.parentNode.insertBefore(existingFileDiv, input.nextSibling);
}

// Calculate age from birthdate
function calculateAge(birthdate) {
    if (!birthdate) return '';
    
    const birthDate = new Date(birthdate);
    const today = new Date();
    
    if (isNaN(birthDate.getTime())) return '';
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age > 0 ? age : '';
}

// Populate electives based on selected track
function populateElectivesForTrack(track) {
    const electivesList = document.getElementById('editElectivesList');
    electivesList.innerHTML = '';
    
    if (!track) {
        electivesList.innerHTML = '<p style="color: #666; font-style: italic;">Please select a track to see available electives.</p>';
        return;
    }
    
    const electivesData = {
        academic: [
            {
                category: 'Arts, Social Sciences, & Humanities',
                electives: [
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
                ]
            },
            {
                category: 'Business & Entrepreneurship',
                electives: [
                    'Basic Accounting',
                    'Business Finance and Income Taxation',
                    'Contemporary Marketing and Business Economics',
                    'Entrepreneurship',
                    'Introduction to Organization and Management'
                ]
            },
            {
                category: 'Sports, Health, & Wellness',
                electives: [
                    'Exercise and Sports Programming',
                    'Introduction to Human Movement',
                    'Physical Education (Fitness and Recreation)',
                    'Physical Education (Sports and Dance)',
                    'Safety and First Aid',
                    'Sports Coaching',
                    'Sports Officiating',
                    'Sports Activity Management'
                ]
            },
            {
                category: 'Science, Technology, Engineering, & Mathematics',
                electives: [
                    'Advanced Mathematics 1–2',
                    'Biology 1–2',
                    'Biology 3–4',
                    'Chemistry 1–2',
                    'Chemistry 3–4',
                    'Database Management',
                    'Earth and Space Science 1–2',
                    'Earth and Space Science 3–4',
                    'Empowerment Technologies',
                    'Finite Mathematics',
                    'Fundamentals of Data Analytics and Management',
                    'General Science (Physical Science)',
                    'General Science (Earth and Life Science)',
                    'Pre-Calculus 1–2',
                    'Physics 1–2',
                    'Physics 3–4',
                    'Trigonometry 1–2'
                ]
            },
            {
                category: 'Field Experience',
                electives: [
                    'Arts Apprenticeship – Theater Arts',
                    'Arts Apprenticeship – Dance',
                    'Arts Apprenticeship – Music',
                    'Arts Apprenticeship – Literary Arts',
                    'Arts Apprenticeship – Visual, Media, Applied, and Traditional Art',
                    'Creative Production and Presentation',
                    'Design and Innovation Research Methods',
                    'Field Exposure (In-Campus)',
                    'Field Exposure (Off-Campus)',
                    'Work Immersion'
                ]
            }
        ],
        techpro: [
            {
                category: 'Information & Computer Technology',
                electives: [
                    'Animation (NC II)',
                    'Broadband Installation (Fixed Wireless Systems) (NC II)',
                    'Computer Programming (Java) (NC III)',
                    'Computer Programming (Oracle Database) (NC III)',
                    'Computer Systems Servicing (NC II)',
                    'Contact Center Services (NC II)',
                    'Illustration (NC II)',
                    'Programming (.NET Technology) (NC III)',
                    'Visual Graphic Design (NC III)'
                ]
            },
            {
                category: 'Industrial Arts',
                electives: [
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
                ]
            },
            {
                category: 'Agriculture & Fishery Arts',
                electives: [
                    'Agricultural Crops Production (NC II)',
                    'Agro-Entrepreneurship (NC II)',
                    'Aquaculture (NC II)',
                    'Fish Capture Operation (NC II)',
                    'Food Processing (NC II)',
                    'Organic Agriculture Production (NC II)',
                    'Poultry Production – Chicken (NC II)',
                    'Ruminants Production (NC II)',
                    'Swine Production (NC II)'
                ]
            },
            {
                category: 'Family & Consumer Science',
                electives: [
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
                ]
            },
            {
                category: 'Maritime',
                electives: [
                    'Marine Engineering at the Support Level (Non-NC)',
                    'Marine Transportation at the Support Level (Non-NC)',
                    'Ships Catering Services (NC I)'
                ]
            }
        ]
    };

    // Generate HTML with the new structure
    let html = '';
    const trackElectives = electivesData[track] || [];
    
    if (trackElectives.length === 0) {
        html = '<p style="color: #666; font-style: italic;">No electives available for this track.</p>';
    } else {
        trackElectives.forEach((categoryData, index) => {
            html += `
                <div class="electives-category-group">
                    <div class="electives-category-header">
                        <span class="category-number">${index + 1}</span>
                        <span class="category-title">${categoryData.category}</span>
                    </div>
                    <div class="electives-grid">
            `;
            
            categoryData.electives.forEach(elective => {
                html += `
                    <div class="elective-item">
                        <label class="elective-checkbox-label">
                            <input type="checkbox" name="electives" value="${elective}" class="elective-checkbox">
                            <span class="elective-text">${elective}</span>
                        </label>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
    }
    
    electivesList.innerHTML = html;
}

// Setup enhanced enrollment edit modal functionality
function setupEnrollmentEditModal() {
    // Age calculation on birthdate change
    const editBirthdate = document.getElementById('editBirthdate');
    const editAge = document.getElementById('editAge');
    if (editBirthdate && editAge) {
        editBirthdate.addEventListener('change', function() {
            const age = calculateAge(this.value);
            editAge.value = age;
        });
    }

    // Grade level change handler for semester, track, and electives visibility
    const editGradeLevel = document.getElementById('editGradeLevel');
    if (editGradeLevel) {
        editGradeLevel.addEventListener('change', function() {
            const semesterContainer = document.getElementById('editSemesterContainer');
            const trackContainer = document.getElementById('editTrackContainer');
            const electivesContainer = document.getElementById('editElectivesContainer');
            const track = document.getElementById('editTrack');
            if (['11', '12'].includes(this.value)) {
                semesterContainer.style.display = 'block';
                trackContainer.style.display = 'block';
                electivesContainer.style.display = 'block';
                track.required = true;
            } else {
                semesterContainer.style.display = 'none';
                trackContainer.style.display = 'none';
                electivesContainer.style.display = 'none';
                track.required = false;
                track.value = '';
                document.getElementById('editElectivesList').innerHTML = '';
            }
        });
    }

    // Track change handler for electives
    const editTrack = document.getElementById('editTrack');
    if (editTrack) {
        editTrack.addEventListener('change', function() {
            populateElectivesForTrack(this.value);
        });
    }

    // Mother Tongue change handler for "Other" field
    const editMotherTongue = document.getElementById('editMotherTongue');
    const editMotherTongueOther = document.getElementById('editMotherTongueOther');
    const editMotherTongueOtherText = document.getElementById('editMotherTongueOtherText');
    
    if (editMotherTongue && editMotherTongueOther && editMotherTongueOtherText) {
        editMotherTongue.addEventListener('change', function() {
            if (this.value === 'other') {
                editMotherTongueOther.classList.remove('hidden');
                editMotherTongueOtherText.required = true;
            } else {
                editMotherTongueOther.classList.add('hidden');
                editMotherTongueOtherText.value = '';
                editMotherTongueOtherText.required = false;
            }
        });
    }

    // Modal close handlers
    const closeBtn = document.getElementById('closeEnrollmentEditModalBtn');
    const cancelBtn = document.getElementById('editCancelBtn');
    const modal = document.getElementById('enrollmentEditModal');
    
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            // Clean up event listeners
            removeCurrentAddressListeners();
        });
    }
    if (cancelBtn && modal) {
        cancelBtn.addEventListener('click', function() {
            modal.style.display = 'none';
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            // Clean up event listeners
            removeCurrentAddressListeners();
        });
    }

    // Save button handler
    const saveBtn = document.getElementById('editSaveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            saveEnrollmentChanges();
        });
    }

    // Click outside to close
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
                modal.setAttribute('aria-hidden', 'true');
                // Clean up event listeners
                removeCurrentAddressListeners();
            }
        });
    }
}

// Save enrollment changes
async function saveEnrollmentChanges() {
    console.log('[Save Function] Starting saveEnrollmentChanges...');
    
    const modal = document.getElementById('enrollmentEditModal');
    const form = document.getElementById('enrollmentEditForm');
    
    console.log('[Save Function] Elements found:', { 
        modal: !!modal, 
        form: !!form,
        enrollmentId: modal?.dataset?.editingEnrollmentId 
    });
    
    if (!form.checkValidity()) {
        console.log('[Save Function] Form validation failed');
        alert('Please fill in all required fields correctly.');
        return;
    }
    
    // Collect form data
    const formData = new FormData(form);
    const enrollmentData = {};
    
    // Convert FormData to object
    for (let [key, value] of formData.entries()) {
        enrollmentData[key] = value;
    }
    
    // Handle electives array
    const electives = [];
    document.querySelectorAll('input[name="electives"]:checked').forEach(checkbox => {
        electives.push(checkbox.value);
    });
    enrollmentData.electives = electives;
    
    // Handle disability checkboxes array
    const disabilities = [];
    document.querySelectorAll('input[name="disability"]:checked').forEach(checkbox => {
        disabilities.push(checkbox.value);
    });
    enrollmentData.disability = disabilities;

    // Bundle document uploads
    async function gatherFiles(){
        const filesObj = {};
        const toDataUrl = (file) => new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });
        const wl = [
            {id:'editPSABirthCert', key:'psaBirthCert', multi:false},
            {id:'editReportCard', key:'reportCard', multi:false},
            {id:'editGoodMoralCert', key:'goodMoralCert', multi:false},
            {id:'editOtherRequirements', key:'otherRequirements', multi:true}
        ];
        for(const def of wl){
            const inp = document.getElementById(def.id);
            if(!inp || !inp.files || inp.files.length===0) continue;
            if(def.multi){
                const arr=[];
                for(const f of inp.files){
                    arr.push(await toDataUrl(f));
                }
                filesObj[def.key]=arr;
            } else {
                filesObj[def.key]=await toDataUrl(inp.files[0]);
            }
        }
        return filesObj;
    }

    const enrollmentFiles = await gatherFiles();
    if (Object.keys(enrollmentFiles).length) {
        // use camelCase to match server expectations
        enrollmentData.enrollmentFiles = enrollmentFiles;
        // also populate legacy "documents" so the edit modal can read it
        enrollmentData.documents = enrollmentFiles;
    }
    
    // Get enrollment ID from modal
    const enrollmentId = modal.dataset.editingEnrollmentId;
    
    console.log('[Save Function] Saving enrollment changes:', {
        enrollmentId,
        data: enrollmentData
    });
    
    if (!enrollmentId) {
        console.error('[Save Function] No enrollment ID found!');
        alert('Error: No enrollment ID found. Please try again.');
        return;
    }
    
    // Update the specific enrollment in localStorage
    try {
        let enrollments = JSON.parse(localStorage.getItem('enrollments') || '[]');
        console.log('[Save Function] Loaded enrollments:', enrollments.length, 'records');
        
        let enrollmentIndex = -1;
        // if we have the in-memory reference use it directly
        if (modal._currentEnrollment) {
            // attempt to locate that exact object in the stored array
            enrollmentIndex = enrollments.findIndex(e => e === modal._currentEnrollment);
            // if not ===, fall back to key matching below
        }
        
        if (enrollmentIndex === -1) {
            // compute normalization similar to rendering logic
            enrollmentIndex = enrollments.findIndex((entry, idx) => {
                const entryKey = String((entry && (entry.id || entry.enrollment_id)) || '').trim() || `idx-${idx}`;
                return entryKey === enrollmentId || String(entry.__historyKey || '').trim() === enrollmentId;
            });
        }
        
        console.log('[Save Function] Enrollment index found:', enrollmentIndex);
        
        if (enrollmentIndex !== -1) {
            // reference the object we will update
            const target = enrollments[enrollmentIndex];
            target.enrollment_data = enrollmentData;
            // if we gathered any files also mirror them at top level so
            // the modal helper (which reads record.enrollment_files) sees them
            if (Object.keys(enrollmentFiles || {}).length) {
                target.enrollment_files = enrollmentFiles;
                // also keep legacy documents field populated for edit modal
                if (!target.enrollment_data) target.enrollment_data = {};
                target.enrollment_data.documents = enrollmentFiles;
            }
            target.updated_at = new Date().toISOString();
            // also ensure __historyKey is stored for future lookups
            const stableKey = String((target.id || target.enrollment_id) || '').trim() || `idx-${enrollmentIndex}`;
            target.__historyKey = stableKey;
            
            // Save back to localStorage
            localStorage.setItem('enrollments', JSON.stringify(enrollments));
            
            console.log('[Save Function] Successfully updated enrollment:', enrollmentId);
            console.log('[Save Function] Updated enrollment data:', target);
            
            // Refresh the enrollments display with updated array
            loadMyEnrollmentsSection(enrollments);
            
            // also send update to server via student-specific patch endpoint
            if (typeof API_BASE === 'string' && API_BASE) {
                try {
                    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
                    const studentId = studentData.id || studentData.student_id || studentData.studentID;
                    if (studentId) {
                        const updResp = await fetch(`${API_BASE}/api/enrollments/by-student/${encodeURIComponent(studentId)}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enrollment_data: enrollmentData })
                        });
                        if (!updResp.ok) {
                            alert('Failed to update enrollment on server (status ' + updResp.status + ')');
                            console.warn('[Save Function] Server update failed', updResp.status);
                        } else {
                            // also refresh entire list from server
                            try {
                                const listResp = await fetch(`${API_BASE}/api/enrollments/student/${encodeURIComponent(studentId)}`);
                                if (listResp.ok) {
                                    const listJson = await listResp.json();
                                    if (Array.isArray(listJson)) {
                                        enrollments = listJson;
                                        window.studentEnrollmentsCache = enrollments;
                                        window.studentEnrollmentsCacheByKey = {};
                                        enrollments.forEach((e, idx) => {
                                            const key = String((e && (e.id || e.enrollment_id)) || '').trim() || `idx-${idx}`;
                                            e.__historyKey = key;
                                            window.studentEnrollmentsCacheByKey[key] = e;
                                        });
                                        localStorage.setItem('enrollments', JSON.stringify(enrollments));
                                        loadMyEnrollmentsSection(enrollments);
                                    }
                                }
                            } catch (_e) {}
                        }
                    }
                } catch (_err) {
                    console.warn('[Save Function] Error updating server enrollment', _err);
                }
            }
            alert('Enrollment changes saved successfully!');
        } else {
            console.error('[Save Function] Enrollment not found:', enrollmentId);
            console.log('[Save Function] Available enrollment IDs:', 
                enrollments.map((e, idx) => ({ 
                    id: e.id, 
                    enrollment_id: e.enrollment_id, 
                    __historyKey: e.__historyKey || `idx-${idx}` 
                }))
            );
            alert('Error: Enrollment record not found.');
        }
    } catch (error) {
        console.error('[Save Function] Error saving enrollment:', error);
        alert('Error saving enrollment changes. Please try again.');
    }
    
    // Clean up event listeners before closing
    removeCurrentAddressListeners();
    
    modal.style.display = 'none';
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    
    console.log('[Save Function] Save process completed');
}

// Close modal logic
document.addEventListener('DOMContentLoaded', function() {
    // Setup admin-style enrollment edit modal functionality
    setupEnrollmentEditModal();
    
    // Make Edit Profile button open enrollment edit modal for the most recent enrollment

    // Make Edit Profile button open the enrollment edit modal for the most recent enrollment
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', async function() {
            console.log('[Edit Button] Clicked - opening enrollment edit modal (fetching latest data)');
            // Get student data from localStorage
            const studentDataStr = localStorage.getItem('studentData');
            if (!studentDataStr) {
                alert('Student data not found. Please log in again.');
                return;
            }
            const studentData = JSON.parse(studentDataStr);
            let enrollments = [];
            try {
                enrollments = await fetchStudentEnrollmentsForDashboard(studentData);
            } catch (err) {
                console.error('[Edit Button] Failed to fetch enrollments from API:', err);
                enrollments = [];
            }
            if (!Array.isArray(enrollments) || enrollments.length === 0) {
                enrollments = JSON.parse(localStorage.getItem('enrollments') || '[]');
                console.log('[Edit Button] Loaded enrollments from localStorage:', enrollments);
            }
            if (Array.isArray(enrollments) && enrollments.length > 0) {
                enrollments = enrollments.slice().sort((a, b) => {
                    const dateA = new Date(a.enrollment_date || a.created_at || 0);
                    const dateB = new Date(b.enrollment_date || b.created_at || 0);
                    return dateB - dateA;
                });
                const mostRecent = enrollments[0];
                console.log('[Edit Button] Most recent enrollment:', mostRecent);
                if (mostRecent) {
                    openEnrollmentEditModal(mostRecent);
                    setTimeout(() => {
                        const modal = document.getElementById('enrollmentEditModal');
                        if (modal) {
                            modal.style.display = 'flex !important';
                            modal.style.visibility = 'visible !important';
                            modal.style.opacity = '1 !important';
                            modal.style.zIndex = '99999 !important';
                            modal.classList.add('active');
                            console.log('[Edit Button] Modal forced AGAIN after delay');
                        }
                    }, 100);
                } else {
                    console.log('[Edit Button] No most recent enrollment found');
                }
            } else {
                console.log('[Edit Button] No enrollments found');
                alert('No enrollment record found to edit.');
            }
        });
    }

    // Conditional logic for modal fields
    function setupEnrollmentModalConditionals() {
        // LRN toggle
        const yesLRN = document.querySelector('input[name="hasLRN"][value="yes"]');
        const noLRN = document.querySelector('input[name="hasLRN"][value="no"]');
        const lrnField = document.getElementById('lrnField');
        const lrnInput = document.getElementById('lrnNumber');
        if (yesLRN && noLRN && lrnField) {
            function updateLRN() {
                if (yesLRN.checked) {
                    lrnField.classList.remove('hidden');
                    lrnInput.required = true;
                } else {
                    lrnField.classList.add('hidden');
                    lrnInput.required = false;
                    lrnInput.value = '';
                }
            }
            yesLRN.addEventListener('change', updateLRN);
            noLRN.addEventListener('change', updateLRN);
            updateLRN();
        }

        // Birthdate to age
        const birthdateInput = document.getElementById('birthdate');
        const ageInput = document.getElementById('age');
        if (birthdateInput && ageInput) {
            function calculateAge() {
                const birthDate = new Date(birthdateInput.value);
                if (!birthdateInput.value || isNaN(birthDate)) return;
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                ageInput.value = age > 0 ? age : '';
            }
            birthdateInput.addEventListener('change', calculateAge);
        }

        // Mother Tongue "Other"
        const motherTongueSelect = document.querySelector('select[name="motherTongue"]');
        const motherTongueOther = document.getElementById('motherTongueOther');
        const motherTongueOtherText = document.getElementById('motherTongueOtherText');
        if (motherTongueSelect && motherTongueOther && motherTongueOtherText) {
            function updateMotherTongueOther() {
                if (motherTongueSelect.value === 'other') {
                    motherTongueOther.classList.remove('hidden');
                    motherTongueOtherText.required = true;
                } else {
                    motherTongueOther.classList.add('hidden');
                    motherTongueOtherText.required = false;
                    motherTongueOtherText.value = '';
                }
            }
            motherTongueSelect.addEventListener('change', updateMotherTongueOther);
            updateMotherTongueOther();
        }

        // IP conditionals
        const yesIP = document.querySelector('input[name="isIP"][value="yes"]');
        const noIP = document.querySelector('input[name="isIP"][value="no"]');
        const ipFields = document.getElementById('ipFields');
        const ipGroupSelect = document.querySelector('select[name="ipGroup"]');
        const ipOtherField = document.getElementById('ipOtherField');
        const ipOtherText = document.getElementById('ipOtherText');
        if (yesIP && noIP && ipFields) {
            function updateIPVisibility() {
                if (yesIP.checked) {
                    ipFields.classList.remove('hidden');
                    ipGroupSelect.required = true;
                    updateIPOtherVisibility();
                } else {
                    ipFields.classList.add('hidden');
                    ipGroupSelect.required = false;
                    ipGroupSelect.value = '';
                    if (ipOtherField) ipOtherField.classList.add('hidden');
                    if (ipOtherText) ipOtherText.value = '';
                }
            }
            function updateIPOtherVisibility() {
                if (ipGroupSelect && ipOtherField && ipOtherText) {
                    if (ipGroupSelect.value === 'other') {
                        ipOtherField.classList.remove('hidden');
                        ipOtherText.required = true;
                    } else {
                        ipOtherField.classList.add('hidden');
                        ipOtherText.required = false;
                        ipOtherText.value = '';
                    }
                }
            }
            yesIP.addEventListener('change', updateIPVisibility);
            noIP.addEventListener('change', updateIPVisibility);
            if (ipGroupSelect) ipGroupSelect.addEventListener('change', updateIPOtherVisibility);
            updateIPVisibility();
        }

        // 4Ps conditionals
        const yes4Ps = document.querySelector('input[name="is4Ps"][value="yes"]');
        const no4Ps = document.querySelector('input[name="is4Ps"][value="no"]');
        const fpsFields = document.getElementById('fpsFields');
        const householdID = document.getElementById('householdID');
        if (yes4Ps && no4Ps && fpsFields) {
            function update4PsVisibility() {
                if (yes4Ps.checked) {
                    fpsFields.classList.remove('hidden');
                    if (householdID) householdID.required = true;
                } else {
                    fpsFields.classList.add('hidden');
                    if (householdID) {
                        householdID.required = false;
                        householdID.value = '';
                    }
                }
            }
            yes4Ps.addEventListener('change', update4PsVisibility);
            no4Ps.addEventListener('change', update4PsVisibility);
            update4PsVisibility();
        }

        // Disability conditionals
        const yesPWD = document.querySelector('input[name="hasPWD"][value="yes"]');
        const noPWD = document.querySelector('input[name="hasPWD"][value="no"]');
        const disabilityFields = document.getElementById('disabilityFields');
        if (yesPWD && noPWD && disabilityFields) {
            function updateDisabilityVisibility() {
                if (yesPWD.checked) {
                    disabilityFields.classList.remove('hidden');
                } else {
                    disabilityFields.classList.add('hidden');
                }
            }
            yesPWD.addEventListener('change', updateDisabilityVisibility);
            noPWD.addEventListener('change', updateDisabilityVisibility);
            updateDisabilityVisibility();
        }

        // Returning Learner conditionals
        const yesReturning = document.querySelector('input[name="returningLearner"][value="yes"]');
        const noReturning = document.querySelector('input[name="returningLearner"][value="no"]');
        const returningFields = document.getElementById('returningLearnerFields');
        if (yesReturning && noReturning && returningFields) {
            function updateReturningVisibility() {
                if (yesReturning.checked) {
                    returningFields.classList.remove('hidden');
                } else {
                    returningFields.classList.add('hidden');
                }
            }
            yesReturning.addEventListener('change', updateReturningVisibility);
            noReturning.addEventListener('change', updateReturningVisibility);
            updateReturningVisibility();
        }

        // Grade level and track-based electives
        const gradeLevelSelect = document.getElementById('editGradeLevel');
        const semesterContainer = document.getElementById('semesterContainer');
        const trackContainer = document.getElementById('trackContainer');
        const trackSelect = document.getElementById('editTrack');
        const electivesContainer = document.getElementById('electivesContainer');
        if (gradeLevelSelect) {
            function updateGradeLevelFields() {
                const grade = gradeLevelSelect.value;
                if (grade === '11' || grade === '12') {
                    if (semesterContainer) semesterContainer.style.display = 'block';
                    if (trackContainer) trackContainer.style.display = 'block';
                    if (trackSelect) trackSelect.required = true;
                } else {
                    if (semesterContainer) semesterContainer.style.display = 'none';
                    if (trackContainer) trackContainer.style.display = 'none';
                    if (trackSelect) { trackSelect.required = false; trackSelect.value = ''; }
                    if (electivesContainer) electivesContainer.style.display = 'none';
                }
            }
            gradeLevelSelect.addEventListener('change', updateGradeLevelFields);
            updateGradeLevelFields();
        }
        if (trackSelect) {
            function updateElectivesByTrack() {
                const track = trackSelect.value;
                if (!electivesContainer) return;
                const academicElectives = document.querySelectorAll('input[name="electives"][data-type="academic"]');
                const techProElectives = document.querySelectorAll('input[name="electives"][data-type="techpro"]');
                academicElectives.forEach(el => {
                    const container = el.closest('.elective-item');
                    if (container) container.style.display = 'none';
                });
                techProElectives.forEach(el => {
                    const container = el.closest('.elective-item');
                    if (container) container.style.display = 'none';
                });
                if (track === 'Academic') {
                    academicElectives.forEach(el => {
                        const container = el.closest('.elective-item');
                        if (container) container.style.display = 'block';
                    });
                    setupElectiveMaxSelection('academic', 2);
                    electivesContainer.style.display = 'block';
                } else if (track === 'TechPro' || track === 'Tech-Pro') {
                    techProElectives.forEach(el => {
                        const container = el.closest('.elective-item');
                        if (container) container.style.display = 'block';
                    });
                    setupElectiveMaxSelection('techpro', 1);
                    electivesContainer.style.display = 'block';
                } else if (track === 'Doorway') {
                    academicElectives.forEach(el => {
                        const container = el.closest('.elective-item');
                        if (container) container.style.display = 'block';
                    });
                    techProElectives.forEach(el => {
                        const container = el.closest('.elective-item');
                        if (container) container.style.display = 'block';
                    });
                    setupElectiveMaxSelection('doorway', null);
                    electivesContainer.style.display = 'block';
                } else {
                    electivesContainer.style.display = 'none';
                }
            }
            trackSelect.addEventListener('change', updateElectivesByTrack);
            updateElectivesByTrack();
        }
        function setupElectiveMaxSelection(track, maxCount) {
            if (track === 'doorway') {
                const academicElectives = document.querySelectorAll('input[name="electives"][data-type="academic"]');
                const techProElectives = document.querySelectorAll('input[name="electives"][data-type="techpro"]');
                academicElectives.forEach(el => {
                    el.addEventListener('change', function() {
                        const checkedCount = Array.from(academicElectives).filter(e => e.checked).length;
                        if (checkedCount > 1) {
                            this.checked = false;
                            alert('Maximum 1 Academic elective allowed for Doorway');
                        }
                    });
                });
                techProElectives.forEach(el => {
                    el.addEventListener('change', function() {
                        const checkedCount = Array.from(techProElectives).filter(e => e.checked).length;
                        if (checkedCount > 1) {
                            this.checked = false;
                            alert('Maximum 1 Tech-Pro elective allowed for Doorway');
                        }
                    });
                });
            } else {
                const selectorsMap = {
                    'academic': 'input[name="electives"][data-type="academic"]',
                    'techpro': 'input[name="electives"][data-type="techpro"]'
                };
                const electives = document.querySelectorAll(selectorsMap[track] || 'input[name="electives"]');
                electives.forEach(el => {
                    el.addEventListener('change', function() {
                        const checkedCount = Array.from(electives).filter(e => e.checked).length;
                        if (checkedCount > maxCount) {
                            this.checked = false;
                            alert(`Maximum ${maxCount} electives allowed`);
                        }
                    });
                });
            }
        }

        // Address cascading and sync
        function setupAddressCascade(type) {
            // Placeholder: implement address data population if ADDRESS_DATA is available
        }
        const sameAsCurrentCheckbox = document.getElementById('sameAsCurrentAddress');
        if (sameAsCurrentCheckbox) {
            function syncPermanentToCurrent() {
                if (sameAsCurrentCheckbox.checked) {
                    // Copy current to permanent
                    const currentCountry = document.querySelector('select[name="currentCountry"]');
                    const currentProvince = document.querySelector('select[name="currentProvince"]');
                    const currentMunicipality = document.querySelector('select[name="currentMunicipality"]');
                    const currentBarangay = document.querySelector('select[name="currentBarangay"]');
                    const currentSitio = document.getElementById('currentSitio');
                    const permanentCountry = document.querySelector('select[name="permanentCountry"]');
                    const permanentProvince = document.querySelector('select[name="permanentProvince"]');
                    const permanentMunicipality = document.querySelector('select[name="permanentMunicipality"]');
                    const permanentBarangay = document.querySelector('select[name="permanentBarangay"]');
                    const permanentSitio = document.getElementById('permanentSitio');
                    if (permanentCountry && currentCountry) permanentCountry.value = currentCountry.value;
                    if (permanentProvince && currentProvince) permanentProvince.value = currentProvince.value;
                    if (permanentMunicipality && currentMunicipality) permanentMunicipality.value = currentMunicipality.value;
                    if (permanentBarangay && currentBarangay) permanentBarangay.value = currentBarangay.value;
                    if (permanentSitio && currentSitio) permanentSitio.value = currentSitio.value;
                    if (permanentCountry) permanentCountry.disabled = true;
                    if (permanentProvince) permanentProvince.disabled = true;
                    if (permanentMunicipality) permanentMunicipality.disabled = true;
                    if (permanentBarangay) permanentBarangay.disabled = true;
                    if (permanentSitio) permanentSitio.disabled = true;
                } else {
                    // Enable permanent address fields
                    const permanentCountry = document.querySelector('select[name="permanentCountry"]');
                    const permanentProvince = document.querySelector('select[name="permanentProvince"]');
                    const permanentMunicipality = document.querySelector('select[name="permanentMunicipality"]');
                    const permanentBarangay = document.querySelector('select[name="permanentBarangay"]');
                    const permanentSitio = document.getElementById('permanentSitio');
                    if (permanentCountry) permanentCountry.disabled = false;
                    if (permanentProvince) permanentProvince.disabled = false;
                    if (permanentMunicipality) permanentMunicipality.disabled = false;
                    if (permanentBarangay) permanentBarangay.disabled = false;
                    if (permanentSitio) permanentSitio.disabled = false;
                }
            }
            sameAsCurrentCheckbox.addEventListener('change', syncPermanentToCurrent);
            syncPermanentToCurrent();
        }
    }
    // Run conditional logic when modal is opened
    setupEnrollmentModalConditionals();
    const modal = document.getElementById('enrollmentEditModal');
    const closeBtn = document.getElementById('closeEnrollmentEditModalBtn');
    if (closeBtn && modal) {
        closeBtn.onclick = function() {
            modal.style.display = 'none';
            modal.classList.remove('active');
        };
    }
}); // Close DOMContentLoaded event listener

// Backend origin and API base URL
const BACKEND_ORIGIN = window.location.origin;
const API_BASE = BACKEND_ORIGIN;
let activeSchoolCode = '';

function detectSchoolCode() {
    try {
        const existing = new URLSearchParams(window.location.search || '');
        let existingSchool = String(existing.get('school') || '').trim().toLowerCase();
        if (/^\d+$/.test(existingSchool)) { existingSchool = ''; existing.delete('school'); }
        if (!existingSchool) {
            let derived = existingSchool;
            if (!derived) {
                derived = String(localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || '').trim().toLowerCase();
            }
            if (!derived) {
                const h = String(window.location.hostname || '').trim().toLowerCase();
                const localHosts = new Set(['localhost','127.0.0.1','::1']);
                if (!localHosts.has(h)) {
                    const parts = h.split('.').filter(Boolean);
                    if (parts.length >= 3) derived = String(parts[0] || '').toLowerCase();
                }
            }
            if (!derived) derived = 'default-school';
            existing.set('school', derived);
            const newUrl = `${window.location.pathname}?${existing.toString()}${window.location.hash || ''}`;
            window.history.replaceState(null, '', newUrl);
        }
    } catch (_e) {}

    const params = new URLSearchParams(window.location.search || '');
    const fromQuery = (params.get('school') || params.get('tenant') || params.get('code') || '').trim().toLowerCase();
    if (fromQuery) return fromQuery;

    const fromStorage = String(
        localStorage.getItem('sms.selectedSchoolCode') || localStorage.getItem('sms.selectedTenantCode') || ''
    ).trim().toLowerCase();
    if (fromStorage) return fromStorage;

    const host = String(window.location.hostname || '').trim().toLowerCase();
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    if (localHosts.has(host)) return '';

    const parts = host.split('.').filter(Boolean);
    if (parts.length >= 3) return String(parts[0] || '').toLowerCase();
    return '';
}

function withSchoolParam(path) {
    let code = activeSchoolCode || detectSchoolCode();
    if (!code) return path;
    try {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('school', code);
        return `${url.pathname}${url.search}${url.hash || ''}`;
    } catch (_err) {
        return path;
    }
}

function appendSchoolParamToLinks(code) {
    if (!code) return;
    document.querySelectorAll('a[href$=".html"], a[href*=".html?"]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (!href || href.startsWith('#')) return;
        anchor.setAttribute('href', withSchoolParam(href));
    });
}

function applySchoolTheme(branding) {
    const theme = branding && typeof branding === 'object' ? branding : {};
    const root = document.documentElement;
    const primary = String(theme.primary || theme.brand700 || '').trim();
    const secondary = String(theme.secondary || theme.brand600 || '').trim();
    if (primary) root.style.setProperty('--primary-green', primary);
    if (secondary) root.style.setProperty('--primary-dark-green', secondary);
}

function setSchoolFavicon(logoValue, schoolCode) {
    const baseFallback = 'logo.png';
    const raw = String(logoValue || '').trim();
    const isDataUrl = /^data:/i.test(raw);
    const cacheSuffix = `school=${encodeURIComponent(String(schoolCode || 'default').toLowerCase())}&t=${Date.now()}`;
    const finalHref = raw
        ? (isDataUrl ? raw : `${raw}${raw.includes('?') ? '&' : '?'}${cacheSuffix}`)
        : `${baseFallback}?${cacheSuffix}`;

    const ensureLink = (relValue) => {
        let link = document.querySelector(`link[rel="${relValue}"]`);
        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', relValue);
            document.head.appendChild(link);
        }
        link.setAttribute('href', finalHref);
        link.setAttribute('type', 'image/png');
    };

    ensureLink('icon');
    ensureLink('shortcut icon');
}

async function bootstrapSchoolBranding() {
    const detected = detectSchoolCode();
    if (detected) {
        localStorage.setItem('sms.selectedSchoolCode', detected);
        localStorage.setItem('sms.selectedTenantCode', detected);
    }
    activeSchoolCode = detected;
    const endpoint = detected
        ? `/api/system-health/schools/resolve?code=${encodeURIComponent(detected)}`
        : '/api/system-health/schools/resolve';

    try {
        const response = await fetch(endpoint);
        if (!response.ok) return;
        const payload = await response.json();
        if (!payload || !payload.success || !payload.school) return;

        const school = payload.school;
        if (detected !== 'default-school') {
            activeSchoolCode = String(school.code || detected || '').trim().toLowerCase();
        } else {
            activeSchoolCode = detected;
        }
        if (activeSchoolCode && detected !== 'default-school') {
            localStorage.setItem('sms.selectedSchoolCode', activeSchoolCode);
            localStorage.setItem('sms.selectedTenantCode', activeSchoolCode);
        }
        if (school.id) {
            localStorage.setItem('sms.selectedSchoolId', String(school.id));
            localStorage.setItem('sms.selectedTenantId', String(school.id));
        }

        const schoolName = String(school.name || 'School Management System');
        const logo = String(school.logoData || '').trim();

        document.title = `${schoolName} - Student Dashboard`;

        const nameNode = document.getElementById('schoolName');
        if (nameNode) nameNode.textContent = schoolName;

        const subtitleNode = document.getElementById('schoolSubtitle');
        if (subtitleNode) subtitleNode.textContent = 'Student Portal';

        const logoNode = document.getElementById('schoolLogo');
        if (logoNode && logo) logoNode.setAttribute('src', logo);

        setSchoolFavicon(logo || '', activeSchoolCode);
        applySchoolTheme(school.branding || {});
        appendSchoolParamToLinks(activeSchoolCode);
    } catch (_err) {
    }
}

const nativeFetch = window.fetch.bind(window);
window.fetch = (resource, options = {}) => {
    let urlString = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    if (!urlString) return nativeFetch(resource, options);

    try {
        const parsed = new URL(urlString, window.location.origin);
        const isApiPath = parsed.pathname.startsWith('/api/');
        const isSameOrigin = parsed.origin === window.location.origin;
        if (isApiPath && isSameOrigin && activeSchoolCode) {
            parsed.searchParams.set('school', activeSchoolCode);
            const headers = {
                ...(options.headers || {}),
                'x-tenant-code': activeSchoolCode
            };
            return nativeFetch(parsed.toString(), { ...options, headers });
        }
    } catch (_err) {
    }

    return nativeFetch(resource, options);
};

function withSchoolParam(path) {
    let code = activeSchoolCode || detectSchoolCode();
    if (!code) return path;
    try {
        const url = new URL(path, window.location.origin);
        url.searchParams.set('school', code);
        return `${url.pathname}${url.search}${url.hash || ''}`;
    } catch (_err) {
        return path;
    }
}

function trackUserAction(action, details) {
    if (!action) return;

    const throttle = (() => {
        let last = 0;
        return (fn, ms) => {
            const now = Date.now();
            if (now - last < ms) return;
            last = now;
            fn();
        };
    })();

    const actor = (() => {
        try {
            const stored = localStorage.getItem('studentData') || localStorage.getItem('adminData') || localStorage.getItem('teacherData') || localStorage.getItem('adviserData');
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    id: parsed?.id || parsed?.student_id || null,
                    role: parsed?.role || null,
                    name: parsed?.name || `${parsed?.firstName || ''} ${parsed?.lastName || ''}`.trim() || null
                };
            }
        } catch (_e) {
        }
        return null;
    })();

    const payload = {
        action,
        details: {
            ...details,
            actor
        }
    };

    const sendAuditEvent = async () => {
        try {
            const url = withSchoolParam('/api/audit/track');
            const body = JSON.stringify(payload);
            const headers = { 'Content-Type': 'application/json' };

            // Try common local dev ports in case the backend is running on a different one.
            const host = window.location.hostname;
            const candidatePorts = [window.location.port || '', '3000','3001','3002','3003','3004','3005','3006','3007','3008','3009','3010'];
            const tried = new Set();

            for (const port of candidatePorts) {
                const p = String(port || '').trim();
                const key = p || 'default';
                if (tried.has(key)) continue;
                tried.add(key);

                const base = p ? `${window.location.protocol}//${host}:${p}` : `${window.location.protocol}//${host}`;
                const endpoint = `${base}${url}`;

                try {
                    const resp = await fetch(endpoint, {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        body
                    });
                    if (resp.ok) return;
                    // If it returned an explicit client/server error, we assume backend reached.
                    if (resp.status >= 400 && resp.status < 600) return;
                } catch (_err) {
                    // try next port
                }
            }
        } catch (_err) {
            // ignore
        }
    };

    throttle(() => { sendAuditEvent(); }, 800);
}


function setupStudentDashboardAuditLogging() {
    document.addEventListener('click', (event) => {
        try {
            const target = event.target.closest('button, a, input[type="button"], input[type="submit"], [role="button"]');
            if (!target) return;
            if (target.closest('.audit-log') || target.closest('.activity-log')) return;

            const label = String(target.getAttribute('data-audit-action') || target.textContent || target.getAttribute('aria-label') || target.id || target.name || '').trim();
            if (!label) return;

            const action = `click:${target.tagName.toLowerCase()}`;
            const details = {
                label: label.slice(0, 80),
                id: target.id || null,
                classes: target.className || null,
                href: target.getAttribute('href') || null
            };

            trackUserAction(action, details);
        } catch (_e) {
        }
    }, true);

    document.addEventListener('submit', (event) => {
        try {
            const form = event.target;
            if (!form || form.tagName !== 'FORM') return;
            const name = String(form.getAttribute('data-audit-action') || form.getAttribute('name') || form.id || '').trim();
            const details = {
                form: name || null,
                id: form.id || null,
                classes: form.className || null
            };
            trackUserAction('submit:form', details);
        } catch (_e) {
        }
    }, true);
}

// initialize audit logging once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupStudentDashboardAuditLogging();
});

// Global variable to store active school year
window.activeSchoolYear = null;

// Global variable to track profile polling interval
let profilePollingInterval = null;
let activeNotificationFilter = 'all';
let isNotificationDrawerOpen = false;
let isThemeStudioOpen = false;
const DEFAULT_THEME_SETTINGS = {
    mode: 'light',
    preset: 'default',
    accent: '#6366f1',
    fontSize: 'default',
    density: 'comfortable'
};
let currentThemeSettings = { ...DEFAULT_THEME_SETTINGS };
let currentThemeDraft = { ...DEFAULT_THEME_SETTINGS };
const themeSystemQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let isSettingsDrawerOpen = false;
window.studentEnrollmentsCache = [];
window.studentEnrollmentsCacheByKey = {};
window.schoolYearLookupById = {};
const DEFAULT_STUDENT_SETTINGS = {
    notifications: {
        inApp: true,
        email: false,
        sms: false,
        academic: true,
        enrollment: true,
        guidance: true,
        system: true
    },
    accessibility: {
        highContrast: false,
        reducedMotion: false,
        largeText: false
    }
};
let currentStudentSettings = JSON.parse(JSON.stringify(DEFAULT_STUDENT_SETTINGS));
const seenRealtimeNotificationIds = new Set();

function getEnrollmentSectionId(enrollment) {
    if (!enrollment || typeof enrollment !== 'object') return null;

    const directSection = enrollment.section_id || enrollment.sectionId || enrollment.class_id || enrollment.classId;
    if (directSection !== undefined && directSection !== null && String(directSection).trim() !== '') {
        return directSection;
    }

    let data = enrollment.enrollment_data || enrollment.enrollmentData || {};
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data || '{}') || {};
        } catch (_err) {
            data = {};
        }
    }

    const nestedSection = data.section_id || data.sectionId || data.class_id || data.classId;
    if (nestedSection !== undefined && nestedSection !== null && String(nestedSection).trim() !== '') {
        return nestedSection;
    }

    return null;
}

function hasSectionAssignedNotification(notifications = []) {
    return (notifications || []).some((notification) => {
        const text = `${notification?.type || ''} ${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
        return /section[_\s-]*assigned|section assignment|assigned to/.test(text);
    });
}

async function refreshStudentAssignmentData() {
    try {
        const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
        if (!studentData || !studentData.id) return;

        await Promise.allSettled([
            loadAndDisplayAssignedSection(studentData.id),
            setupEnrollmentStatusButton(),
            loadAndDisplayEnrollmentData(studentData.id)
        ]);
    } catch (_err) {
    }
}

function getThemeStorageKey() {
    try {
        const student = JSON.parse(localStorage.getItem('studentData') || '{}');
        const studentId = student && student.id ? String(student.id) : 'guest';
        return `student_theme_settings_${studentId}`;
    } catch (_err) {
        return 'student_theme_settings_guest';
    }
}

function getSettingsStorageKey() {
    try {
        const student = JSON.parse(localStorage.getItem('studentData') || '{}');
        const studentId = student && student.id ? String(student.id) : 'guest';
        return `student_settings_${studentId}`;
    } catch (_err) {
        return 'student_settings_guest';
    }
}

function deepMergeSettings(defaults, incoming) {
    const base = JSON.parse(JSON.stringify(defaults));
    if (!incoming || typeof incoming !== 'object') return base;
    Object.keys(base).forEach((key) => {
        if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
            base[key] = { ...base[key], ...(incoming[key] || {}) };
        } else if (incoming[key] !== undefined) {
            base[key] = incoming[key];
        }
    });
    return base;
}

function loadStudentSettings() {
    try {
        const raw = localStorage.getItem(getSettingsStorageKey());
        if (!raw) return JSON.parse(JSON.stringify(DEFAULT_STUDENT_SETTINGS));
        const parsed = JSON.parse(raw);
        return deepMergeSettings(DEFAULT_STUDENT_SETTINGS, parsed);
    } catch (_err) {
        return JSON.parse(JSON.stringify(DEFAULT_STUDENT_SETTINGS));
    }
}

function saveStudentSettings(settings) {
    currentStudentSettings = deepMergeSettings(DEFAULT_STUDENT_SETTINGS, settings);
    localStorage.setItem(getSettingsStorageKey(), JSON.stringify(currentStudentSettings));
}

function applyAccessibilitySettings(accessibility) {
    const prefs = deepMergeSettings(DEFAULT_STUDENT_SETTINGS, { accessibility }).accessibility;
    document.body.classList.toggle('settings-high-contrast', Boolean(prefs.highContrast));
    document.body.classList.toggle('settings-reduced-motion', Boolean(prefs.reducedMotion));
    document.body.classList.toggle('settings-large-text', Boolean(prefs.largeText));
}

function shouldDisplayNotificationByPreferences(notification) {
    const prefs = currentStudentSettings && currentStudentSettings.notifications
        ? currentStudentSettings.notifications
        : DEFAULT_STUDENT_SETTINGS.notifications;

    if (!prefs.inApp) return false;
    const category = getNotificationCategory(notification);
    if (category === 'academic' && !prefs.academic) return false;
    if (category === 'enrollment' && !prefs.enrollment) return false;
    if (category === 'guidance' && !prefs.guidance) return false;
    if (category === 'system' && !prefs.system) return false;
    return true;
}

function normalizeHexColor(value) {
    const raw = String(value || '').trim();
    if (!/^#([0-9a-f]{6})$/i.test(raw)) return null;
    return raw.toLowerCase();
}

function hexToRgbString(hex) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return '99,102,241';
    const value = normalized.replace('#', '');
    const red = parseInt(value.slice(0, 2), 16);
    const green = parseInt(value.slice(2, 4), 16);
    const blue = parseInt(value.slice(4, 6), 16);
    return `${red},${green},${blue}`;
}

function shiftHexColor(hex, amount) {
    const normalized = normalizeHexColor(hex) || DEFAULT_THEME_SETTINGS.accent;
    const value = normalized.replace('#', '');
    const factor = Math.max(-1, Math.min(1, Number(amount) || 0));

    const convert = (component) => {
        const base = parseInt(component, 16);
        const shifted = factor >= 0
            ? Math.round(base + (255 - base) * factor)
            : Math.round(base * (1 + factor));
        return Math.max(0, Math.min(255, shifted));
    };

    const r = convert(value.slice(0, 2));
    const g = convert(value.slice(2, 4));
    const b = convert(value.slice(4, 6));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function getEffectiveThemeMode(mode) {
    const preferred = themeSystemQuery && themeSystemQuery.matches ? 'dark' : 'light';
    return mode === 'auto' ? preferred : (mode === 'dark' ? 'dark' : 'light');
}

function loadSavedThemeSettings() {
    const base = { ...DEFAULT_THEME_SETTINGS };
    try {
        const savedRaw = localStorage.getItem(getThemeStorageKey());
        if (savedRaw) {
            const parsed = JSON.parse(savedRaw);
            return {
                ...base,
                ...parsed,
                accent: normalizeHexColor(parsed.accent) || base.accent
            };
        }
    } catch (_err) {
    }

    const legacy = localStorage.getItem('student_theme');
    if (legacy === 'dark' || legacy === 'light') {
        return { ...base, mode: legacy };
    }
    return base;
}

function setThemeStudioStatus(message) {
    const node = document.getElementById('themeStudioStatus');
    if (node) node.textContent = message;
}

function applyThemeSettings(settings, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const merged = {
        ...DEFAULT_THEME_SETTINGS,
        ...settings,
        accent: normalizeHexColor(settings && settings.accent) || DEFAULT_THEME_SETTINGS.accent
    };

    const effectiveMode = getEffectiveThemeMode(merged.mode);
    const root = document.documentElement;
    const body = document.body;
    const accent = merged.accent;
    const accentRgb = hexToRgbString(accent);
    const accentLight = shiftHexColor(accent, effectiveMode === 'dark' ? -0.55 : 0.86);
    const accentDark = shiftHexColor(accent, -0.32);

    root.style.setProperty('--accent', accent);
    root.style.setProperty('--primary-color', accent);
    root.style.setProperty('--primary-dark', accentDark);
    root.style.setProperty('--primary-light', accentLight);
    root.style.setProperty('--accent-light', accentLight);
    root.style.setProperty('--accent-rgb', accentRgb);

    body.classList.toggle('dark-mode', effectiveMode === 'dark');
    root.classList.toggle('dark-theme', effectiveMode === 'dark');

    body.classList.remove('theme-font-small', 'theme-font-default', 'theme-font-large');
    body.classList.add(`theme-font-${merged.fontSize}`);

    body.classList.toggle('theme-density-compact', merged.density === 'compact');

    const toggle = document.getElementById('modeToggleBtn');
    if (toggle) {
        toggle.textContent = effectiveMode === 'dark' ? '☀️' : '🌙';
        toggle.setAttribute('aria-pressed', effectiveMode === 'dark' ? 'true' : 'false');
        toggle.setAttribute('title', merged.mode === 'auto' ? `Auto (${effectiveMode})` : `Switch mode (${effectiveMode})`);
    }

    if (opts.persist) {
        currentThemeSettings = { ...merged };
        localStorage.setItem(getThemeStorageKey(), JSON.stringify(currentThemeSettings));
        localStorage.setItem('student_theme', effectiveMode);
    }
}

function updateThemeStudioControls(settings) {
    const merged = { ...DEFAULT_THEME_SETTINGS, ...settings };

    document.querySelectorAll('#themeModeControls .theme-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.mode === merged.mode);
    });
    document.querySelectorAll('#themePresetControls .theme-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.preset === merged.preset);
    });
    document.querySelectorAll('#themeFontControls .theme-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.font === merged.fontSize);
    });
    document.querySelectorAll('#themeDensityControls .theme-chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.density === merged.density);
    });

    const colorInput = document.getElementById('themeAccentColor');
    const hexInput = document.getElementById('themeAccentHex');
    if (colorInput) colorInput.value = merged.accent;
    if (hexInput) hexInput.value = merged.accent;
}

function openThemeStudioDrawer() {
    const drawer = document.getElementById('themeStudioDrawer');
    const overlay = document.getElementById('themeStudioOverlay');
    const button = document.getElementById('themeBtn');
    if (!drawer || !overlay) return;

    currentThemeDraft = { ...currentThemeSettings };
    updateThemeStudioControls(currentThemeDraft);
    setThemeStudioStatus('Preview your style, then save.');

    drawer.classList.add('active');
    overlay.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    if (button) button.setAttribute('aria-expanded', 'true');
    isThemeStudioOpen = true;
}

function closeThemeStudioDrawer(revertDraft = true) {
    const drawer = document.getElementById('themeStudioDrawer');
    const overlay = document.getElementById('themeStudioOverlay');
    const button = document.getElementById('themeBtn');
    if (!drawer || !overlay) return;

    if (revertDraft) {
        applyThemeSettings(currentThemeSettings, { persist: false });
    }

    drawer.classList.remove('active');
    overlay.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    if (button) button.setAttribute('aria-expanded', 'false');
    isThemeStudioOpen = false;
}

function setSettingsDrawerStatus(message) {
    const node = document.getElementById('settingsDrawerStatus');
    if (node) node.textContent = message;
}

function syncSettingsDrawerControls(settings) {
    const merged = deepMergeSettings(DEFAULT_STUDENT_SETTINGS, settings);
    const notifications = merged.notifications;
    const accessibility = merged.accessibility;

    const map = {
        prefInApp: notifications.inApp,
        prefEmail: notifications.email,
        prefSms: notifications.sms,
        prefAcademic: notifications.academic,
        prefEnrollment: notifications.enrollment,
        prefGuidance: notifications.guidance,
        prefSystem: notifications.system,
        prefHighContrast: accessibility.highContrast,
        prefReducedMotion: accessibility.reducedMotion,
        prefLargeText: accessibility.largeText
    };

    Object.entries(map).forEach(([id, value]) => {
        const input = document.getElementById(id);
        if (input) input.checked = Boolean(value);
    });
}

function collectSettingsDrawerValues() {
    const get = (id) => {
        const input = document.getElementById(id);
        return Boolean(input && input.checked);
    };

    return {
        notifications: {
            inApp: get('prefInApp'),
            email: get('prefEmail'),
            sms: get('prefSms'),
            academic: get('prefAcademic'),
            enrollment: get('prefEnrollment'),
            guidance: get('prefGuidance'),
            system: get('prefSystem')
        },
        accessibility: {
            highContrast: get('prefHighContrast'),
            reducedMotion: get('prefReducedMotion'),
            largeText: get('prefLargeText')
        }
    };
}

function openSettingsDrawer() {
    const drawer = document.getElementById('settingsDrawer');
    const overlay = document.getElementById('settingsDrawerOverlay');
    const button = document.getElementById('settingsBtn');
    if (!drawer || !overlay) return;

    syncSettingsDrawerControls(currentStudentSettings);
    setSettingsDrawerStatus('Manage your dashboard preferences.');

    drawer.classList.add('active');
    overlay.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    if (button) button.setAttribute('aria-expanded', 'true');
    isSettingsDrawerOpen = true;
}

function closeSettingsDrawer() {
    const drawer = document.getElementById('settingsDrawer');
    const overlay = document.getElementById('settingsDrawerOverlay');
    const button = document.getElementById('settingsBtn');
    if (!drawer || !overlay) return;

    drawer.classList.remove('active');
    overlay.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    if (button) button.setAttribute('aria-expanded', 'false');
    isSettingsDrawerOpen = false;
}

function setupSettingsDrawer() {
    const settingsBtn = document.getElementById('settingsBtn');
    const closeBtn = document.getElementById('closeSettingsDrawerBtn');
    const overlay = document.getElementById('settingsDrawerOverlay');
    const saveBtn = document.getElementById('saveSettingsDrawerBtn');
    const resetBtn = document.getElementById('resetSettingsDrawerBtn');
    const changePasswordBtn = document.getElementById('settingsChangePasswordBtn');
    const logoutAllBtn = document.getElementById('settingsLogoutAllBtn');

    if (settingsBtn && !settingsBtn.dataset.boundSettingsDrawer) {
        settingsBtn.dataset.boundSettingsDrawer = 'true';
        settingsBtn.addEventListener('click', () => {
            if (isSettingsDrawerOpen) {
                closeSettingsDrawer();
                return;
            }
            if (isNotificationDrawerOpen) closeNotificationDrawer();
            if (isThemeStudioOpen) closeThemeStudioDrawer(false);
            openSettingsDrawer();
        });
    }

    if (closeBtn && !closeBtn.dataset.boundSettingsDrawer) {
        closeBtn.dataset.boundSettingsDrawer = 'true';
        closeBtn.addEventListener('click', closeSettingsDrawer);
    }

    if (overlay && !overlay.dataset.boundSettingsDrawer) {
        overlay.dataset.boundSettingsDrawer = 'true';
        overlay.addEventListener('click', closeSettingsDrawer);
    }

    if (saveBtn && !saveBtn.dataset.boundSettingsDrawer) {
        saveBtn.dataset.boundSettingsDrawer = 'true';
        saveBtn.addEventListener('click', () => {
            const values = collectSettingsDrawerValues();
            saveStudentSettings(values);
            applyAccessibilitySettings(currentStudentSettings.accessibility);
            renderNotifications(window.studentNotifications || []);
            setSettingsDrawerStatus('Settings saved.');
            closeSettingsDrawer();
            showToast('Settings saved successfully.', 'success', 2600);
        });
    }

    if (resetBtn && !resetBtn.dataset.boundSettingsDrawer) {
        resetBtn.dataset.boundSettingsDrawer = 'true';
        resetBtn.addEventListener('click', () => {
            saveStudentSettings(DEFAULT_STUDENT_SETTINGS);
            applyAccessibilitySettings(currentStudentSettings.accessibility);
            syncSettingsDrawerControls(currentStudentSettings);
            renderNotifications(window.studentNotifications || []);
            setSettingsDrawerStatus('Settings reset to default.');
            showToast('Settings reset to default.', 'success', 2500);
        });
    }

    if (changePasswordBtn && !changePasswordBtn.dataset.boundSettingsDrawer) {
        changePasswordBtn.dataset.boundSettingsDrawer = 'true';
        changePasswordBtn.addEventListener('click', () => {
            const modal = document.getElementById('passwordModal');
            if (modal) modal.classList.add('active');
            closeSettingsDrawer();
        });
    }

    if (logoutAllBtn && !logoutAllBtn.dataset.boundSettingsDrawer) {
        logoutAllBtn.dataset.boundSettingsDrawer = 'true';
        logoutAllBtn.addEventListener('click', () => {
            localStorage.setItem('student_logout_all_requested_at', new Date().toISOString());
            showToast('Logout-all request recorded. Server-wide session invalidation can be enabled in backend.', 'success', 3400);
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isSettingsDrawerOpen) {
            closeSettingsDrawer();
        }
    });
}

function showToast(message, type = 'success', timeout = 4200) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : 'success'}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 240);
    }, timeout);
}

function updateEnrollmentTracker(enrollment) {
    const statusText = document.getElementById('enrollmentTrackerStatusText');
    const steps = document.querySelectorAll('#enrollmentTrackerSteps .tracker-step');
    const openBtn = document.getElementById('openEnrollmentModalBtn');

    steps.forEach((step) => {
        step.classList.remove('active', 'rejected');
    });

    if (!enrollment) {
        if (statusText) statusText.textContent = 'No enrollment record yet.';
        if (openBtn) openBtn.style.display = 'none';
        return;
    }

    const statusRaw = String(enrollment.status || 'pending').trim().toLowerCase();
    const hasSection = Boolean(getEnrollmentSectionId(enrollment));

    const submitted = document.querySelector('#enrollmentTrackerSteps [data-step="submitted"]');
    const review = document.querySelector('#enrollmentTrackerSteps [data-step="review"]');
    const approved = document.querySelector('#enrollmentTrackerSteps [data-step="approved"]');
    const assigned = document.querySelector('#enrollmentTrackerSteps [data-step="assigned"]');

    if (submitted) submitted.classList.add('active');

    if (['review', 'under_review', 'in_review', 'processing', 'approved', 'rejected'].includes(statusRaw) && review) {
        review.classList.add('active');
    }

    if (statusRaw === 'approved' && approved) {
        approved.classList.add('active');
    }

    if (statusRaw === 'approved' && hasSection && assigned) {
        assigned.classList.add('active');
    }

    if (statusRaw === 'rejected' && review) {
        review.classList.add('rejected');
    }

    let label = `Status: ${statusRaw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
    if (statusRaw === 'approved' && hasSection) {
        label += ' • Section Assigned';
    }
    if (statusText) statusText.textContent = label;
    if (openBtn) openBtn.style.display = 'inline-flex';
}

// Check if student is logged in
document.addEventListener('DOMContentLoaded', async () => {
    // Force-close only specific modals on page load (not including enrollment edit modal)
    setTimeout(() => {
        const modalsToClose = document.querySelectorAll('.modal.active');
        modalsToClose.forEach(modal => {
            // Don't close enrollment edit modal on page load
            if (modal.id !== 'enrollmentEditModal') {
                modal.classList.remove('active');
            }
        });
        
        // Ensure enrollment edit modal is hidden on page load
        const enrollmentEditModal = document.getElementById('enrollmentEditModal');
        if (enrollmentEditModal) {
            enrollmentEditModal.classList.remove('active');
            enrollmentEditModal.style.display = 'none';
            enrollmentEditModal.setAttribute('aria-hidden', 'true');
        }
    }, 10);
    // Setup nav toggle functionality
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const isOpen = navMenu.classList.toggle('open');
            navMenu.classList.toggle('hidden', !isOpen);
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            if (isOpen) {
                navMenu.setAttribute('aria-hidden', 'false');
            } else {
                navMenu.setAttribute('aria-hidden', 'true');
            }
        });

        // Close mobile nav after clicking an item
        navMenu.addEventListener('click', (e) => {
            if (e.target.classList.contains('nav-link')) {
                navMenu.classList.remove('open');
                navMenu.classList.add('hidden');
                navMenu.setAttribute('aria-hidden', 'true');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Force clear any cached data on page load with refresh parameter
    const urlParams = new URLSearchParams(window.location.search);
    const isRefresh = urlParams.has('refresh');
    
    await bootstrapSchoolBranding();
    checkStudentLogin();
    
    // If fresh login, clear cached data
    if (isRefresh) {
        // Clear cached dashboard data to load fresh for new account
        sessionStorage.clear();
        // Remove refresh parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Load active school year from localStorage or fetch
    loadActiveSchoolYear();
    currentStudentSettings = loadStudentSettings();
    applyAccessibilitySettings(currentStudentSettings.accessibility);
    
    loadStudentData();
    setupNavigation();
    setupLogout();
    loadDynamicData();
    setupModals();
    setupTaskManagement();
    setupProfileManagement();
    loadTasks();
    loadNotifications();
    setupNotifications();
    loadAnnouncements();
    setupEnrollmentStatusButton();
    setupThemeToggle();
    setupSettingsDrawer();
});

// Check if student is logged in
function checkStudentLogin() {
    const studentData = localStorage.getItem('studentData');
    if (!studentData) {
        window.location.href = withSchoolParam('auth.html?role=student');
        return;
    }
}

// Load active school year from API with localStorage as fallback
async function loadActiveSchoolYear() {
    try {
        // Always try to fetch fresh from API first for most up-to-date data
        const response = await fetch(`${API_BASE}/api/school-years/active`);
        if (response.ok) {
            const schoolYear = await response.json();
            window.activeSchoolYear = schoolYear;
            // Store in localStorage for offline access
            if (schoolYear) {
                localStorage.setItem('activeSchoolYear', JSON.stringify(schoolYear));
            }
            console.log('[Student Dashboard] Active school year loaded from API:', window.activeSchoolYear);
            return schoolYear;
        }
    } catch (err) {
        console.warn('[Student Dashboard] Failed to load school year from API:', err);
    }
    
    // Fallback: try to get from localStorage
    const storedSchoolYear = localStorage.getItem('activeSchoolYear');
    if (storedSchoolYear) {
        try {
            window.activeSchoolYear = JSON.parse(storedSchoolYear);
            console.log('[Student Dashboard] Active school year loaded from localStorage:', window.activeSchoolYear);
            return window.activeSchoolYear;
        } catch (err) {
            console.warn('Failed to parse stored school year:', err);
        }
    }
    
    console.warn('[Student Dashboard] No active school year found');
    return null;
}

// Load student data from localStorage
function loadStudentData() {
    const studentDataStr = localStorage.getItem('studentData');
    if (!studentDataStr) return;
    
    // Always parse fresh from localStorage to get latest data
    const studentData = JSON.parse(studentDataStr);
    
    // Validate that studentData has required fields
    if (!studentData.firstName || !studentData.email) {
        console.warn('Incomplete student data, redirecting to login');
        localStorage.removeItem('studentData');
        window.location.href = withSchoolParam('auth.html?role=student');
        return;
    }
    
    const studentName = (studentData.firstName || '') + ' ' + (studentData.lastName || '');
    
    // Update all dashboard elements with current student data
    const nameElement = document.getElementById('studentName');
    if (nameElement) nameElement.textContent = studentName;
    
    const profileNameHeader = document.getElementById('studentProfileName');
    if (profileNameHeader) profileNameHeader.textContent = studentName;
    
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = studentName;

    // Update enhanced profile fields
    const profileFullName = document.getElementById('profileFullName');
    if (profileFullName) profileFullName.textContent = studentName || '--';
    
    const profileEmail = document.getElementById('profileEmail');
    if (profileEmail) profileEmail.textContent = studentData.email || '--';
    
    const profilePhone = document.getElementById('profilePhone');
    if (profilePhone) profilePhone.textContent = studentData.phone || '--';

    const profileAddress = document.getElementById('profileAddress');
    if (profileAddress) profileAddress.textContent = studentData.address || '--';

    const profileStudentID = document.getElementById('profileStudentID');
    if (profileStudentID) profileStudentID.textContent = 'Student ID: ' + (studentData.studentID || 'Not Set');
    
    const profileGrade = document.getElementById('profileGrade');
    if (profileGrade) profileGrade.textContent = 'Grade Level: ' + (studentData.gradeLevel || 'Not Set');

    const profileBirthdate = document.getElementById('profileBirthdate');
    if (profileBirthdate) profileBirthdate.textContent = studentData.birthdate || '--';

    const profileGender = document.getElementById('profileGender');
    if (profileGender) profileGender.textContent = studentData.gender || '--';

    const profilePlaceOfBirth = document.getElementById('profilePlaceOfBirth');
    if (profilePlaceOfBirth) profilePlaceOfBirth.textContent = studentData.placeOfBirth || '--';
    
    // Load profile photo
    const profilePhotoImg = document.getElementById('profilePhotoImg');
    if (profilePhotoImg) {
        const fallbackLocalPhoto = localStorage.getItem(getStudentPhotoStorageKey(studentData.id));
        const resolvedPhoto = studentData.photoURL || fallbackLocalPhoto;
        if (resolvedPhoto) {
            profilePhotoImg.src = resolvedPhoto;
            if (!studentData.photoURL && fallbackLocalPhoto) {
                const updatedData = { ...studentData, photoURL: fallbackLocalPhoto };
                localStorage.setItem('studentData', JSON.stringify(updatedData));
            }
        } else {
            // Set default avatar with student initials
            profilePhotoImg.src = generateDefaultAvatar(studentData.firstName, studentData.lastName);
        }
    }
    
    // Load active school year
    loadAndDisplayActiveSchoolYear();
    
    // Load assigned section from enrollment
    loadAndDisplayAssignedSection(studentData.id);
    
    // Load enrollment data to fill personal info
    loadAndDisplayEnrollmentData(studentData.id);
    
    loadDashboardStats();
    
    // Initialize profile edit functionality
    initializeProfileEdit();
}

// Generate a default avatar with student initials
function generateDefaultAvatar(firstName, lastName) {
    const initials = ((firstName || '').charAt(0) + (lastName || '').charAt(0)).toUpperCase() || 'S';
    const colors = ['#4a6cf7', '#667eea', '#5e72e4', '#764ba2', '#f093fb', '#4facfe', '#00f2fe'];
    const colorIndex = (firstName + lastName).charCodeAt(0) % colors.length;
    const bgColor = colors[colorIndex];
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
        <rect width="150" height="150" fill="${bgColor}"/>
        <text x="75" y="85" font-size="60" font-weight="bold" fill="white" text-anchor="middle" font-family="Arial, sans-serif">${initials}</text>
    </svg>`;
    
    return 'data:image/svg+xml;base64,' + btoa(svg);
}

// Load and display the active school year in the profile
async function loadAndDisplayActiveSchoolYear() {
    const schoolYearElement = document.getElementById('profileSchoolYear');
    if (!schoolYearElement) return;
    
    try {
        // Always fetch fresh from API for real-time updates
        const response = await fetch(`${API_BASE}/api/school-years/active`);
        if (response.ok) {
            const schoolYear = await response.json();
            if (schoolYear && schoolYear.school_year) {
                schoolYearElement.textContent = schoolYear.school_year;
                window.activeSchoolYear = schoolYear;
                localStorage.setItem('activeSchoolYear', JSON.stringify(schoolYear));
                console.log('[Student Dashboard] School year displayed:', schoolYear.school_year);
                return;
            }
        }
    } catch (err) {
        console.warn('[Student Dashboard] Could not load school year from API:', err);
    }
    
    // Fallback: use cached value if API fails
    if (window.activeSchoolYear && window.activeSchoolYear.school_year) {
        schoolYearElement.textContent = window.activeSchoolYear.school_year;
        console.log('[Student Dashboard] Using cached school year:', window.activeSchoolYear.school_year);
    } else {
        schoolYearElement.textContent = '--';
        console.warn('[Student Dashboard] No school year available');
    }
}

// Load and display the assigned section for the student
async function loadAndDisplayAssignedSection(studentId) {
    const sectionElement = document.getElementById('profileSection');
    if (!sectionElement) return;
    
    if (!studentId) {
        sectionElement.textContent = '--';
        return;
    }
    
    try {
        const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
        const lookupData = { ...studentData, id: studentId || studentData.id };
        const apiEnrollments = await fetchStudentEnrollmentsForDashboard(lookupData);
        const localEnrollments = JSON.parse(localStorage.getItem('enrollments') || '[]');
        const enrollments = (apiEnrollments && apiEnrollments.length > 0) ? apiEnrollments : localEnrollments;
        
        if (!enrollments || enrollments.length === 0) {
            console.log('[Student Dashboard] No enrollments found for student');
            sectionElement.textContent = 'Not Assigned';
            return;
        }
        
        // Get the most recent approved enrollment with a section assignment
        // Prioritize approved enrollments with section assignments
        const enrollmentWithSection = enrollments.find(e =>
            (e.status || '').toLowerCase() === 'approved' && getEnrollmentSectionId(e)
        ) || enrollments.find(e => getEnrollmentSectionId(e));
        
        const sectionId = getEnrollmentSectionId(enrollmentWithSection);

        if (!enrollmentWithSection || !sectionId) {
            console.log('[Student Dashboard] Student not assigned to any section yet');
            sectionElement.textContent = 'Not Assigned';
            return;
        }
        
        // Fetch section details
        const sectionRes = await fetch(`${API_BASE}/api/sections/${sectionId}`);
        if (!sectionRes.ok) {
            let fallbackData = enrollmentWithSection.enrollment_data || enrollmentWithSection.enrollmentData || {};
            if (typeof fallbackData === 'string') {
                try { fallbackData = JSON.parse(fallbackData || '{}') || {}; } catch (_err) { fallbackData = {}; }
            }

            const fallbackSectionName = enrollmentWithSection.section_name || fallbackData.section_name || fallbackData.sectionName || null;
            const fallbackSectionCode = enrollmentWithSection.section_code || fallbackData.section_code || fallbackData.sectionCode || null;
            if (fallbackSectionName || fallbackSectionCode) {
                const fallbackDisplay = `${fallbackSectionName || 'Assigned Section'} ${fallbackSectionCode ? '(' + fallbackSectionCode + ')' : ''}`.trim();
                sectionElement.textContent = fallbackDisplay;
                return;
            }
            throw new Error('Section not found');
        }
        
        const section = await sectionRes.json();
        if (section && section.section_name) {
            const displayText = `${section.section_name} ${section.section_code ? '(' + section.section_code + ')' : ''}`.trim();
            sectionElement.textContent = displayText;
            console.log('[Student Dashboard] Section assigned:', displayText);
        } else {
            sectionElement.textContent = 'Not Assigned';
        }
        
    } catch (err) {
        console.warn('[Student Dashboard] Error loading section:', err);
        sectionElement.textContent = 'Error Loading Section';
    }
}

// Load and display enrollment data to fill personal information
async function loadAndDisplayEnrollmentData(studentId) {
    if (!studentId) {
        console.log('[Student Dashboard] No student ID provided for enrollment data');
        return;
    }
    
    try {
        // Fetch student's enrollment records
        const enrollmentRes = await fetch(`${API_BASE}/api/enrollments/student/${studentId}`);
        if (!enrollmentRes.ok) {
            throw new Error('Failed to fetch enrollments');
        }
        
        const enrollments = await enrollmentRes.json();
        
        if (!enrollments || enrollments.length === 0) {
            console.log('[Student Dashboard] No enrollments found to populate personal data');
            return;
        }
        
        // Get the most recent enrollment with enrollment_data
        const mostRecentEnrollment = enrollments[0];
        if (!mostRecentEnrollment.enrollment_data) {
            console.log('[Student Dashboard] No enrollment_data found in enrollments');
            return;
        }
        
        // Parse enrollment_data (it might be a string or object)
        let enrollmentData = mostRecentEnrollment.enrollment_data;
        if (typeof enrollmentData === 'string') {
            try {
                enrollmentData = JSON.parse(enrollmentData);
            } catch (e) {
                console.warn('[Student Dashboard] Could not parse enrollment_data as JSON:', e);
                return;
            }
        }
        
        console.log('[Student Dashboard] Enrollment data retrieved:', enrollmentData);
        
        // Extract personal information from enrollment data and update profile display
        const updates = {};
        
        // Map enrollment fields to student profile fields
        if (enrollmentData.birthdate) {
            updates.birthdate = enrollmentData.birthdate;
            const birthdateEl = document.getElementById('profileBirthdate');
            if (birthdateEl) birthdateEl.textContent = enrollmentData.birthdate;
        }
        
        if (enrollmentData.sex) {
            updates.gender = enrollmentData.sex;
            const genderEl = document.getElementById('profileGender');
            if (genderEl) genderEl.textContent = enrollmentData.sex;
        }
        
        if (enrollmentData.placeOfBirth) {
            updates.placeOfBirth = enrollmentData.placeOfBirth;
            const placeEl = document.getElementById('profilePlaceOfBirth');
            if (placeEl) placeEl.textContent = enrollmentData.placeOfBirth;
        }
        
        if (enrollmentData.phone) {
            updates.phone = enrollmentData.phone;
            const phoneEl = document.getElementById('profilePhone');
            if (phoneEl) phoneEl.textContent = enrollmentData.phone;
        }
        
        // Build address from components
        const addressParts = [];
        if (enrollmentData.currentSitio) addressParts.push(enrollmentData.currentSitio);
        if (enrollmentData.currentBarangay) addressParts.push(enrollmentData.currentBarangay);
        if (enrollmentData.currentMunicipality) addressParts.push(enrollmentData.currentMunicipality);
        if (enrollmentData.currentProvince) addressParts.push(enrollmentData.currentProvince);
        
        if (addressParts.length > 0) {
            const fullAddress = addressParts.join(', ');
            updates.address = fullAddress;
            const addressEl = document.getElementById('profileAddress');
            if (addressEl) addressEl.textContent = fullAddress;
        }
        
        // Update localStorage with the enrollment data
        const studentDataStr = localStorage.getItem('studentData');
        if (studentDataStr) {
            const studentData = JSON.parse(studentDataStr);
            const updatedData = { ...studentData, ...updates };
            localStorage.setItem('studentData', JSON.stringify(updatedData));
            console.log('[Student Dashboard] Student data updated with enrollment info:', updates);
        }
        
    } catch (err) {
        console.warn('[Student Dashboard] Error loading enrollment data:', err);
    }
}

// Load dashboard statistics
function loadDashboardStats() {
    const gpaDisplay = document.getElementById('gpaDisplay');
    const subjectsCount = document.getElementById('subjectsCount');
    const classesCount = document.getElementById('classesCount');
    const attendancePercent = document.getElementById('attendancePercent');

    if (gpaDisplay) gpaDisplay.textContent = '--';
    if (subjectsCount) subjectsCount.textContent = '--';
    if (classesCount) classesCount.textContent = '--';
    if (attendancePercent) attendancePercent.textContent = '--';
}

// Load dynamic data (grades, schedule, announcements, tasks)
function loadDynamicData() {
    loadGrades();
    loadSchedule();
}

// Load grades from storage
function loadGrades() {
    const gradesTableContainer = document.getElementById('gradesTableContainer');
    const gradesInfoContainer = document.getElementById('gradesInfoContainer');
    const grades = localStorage.getItem('studentGrades');
    
    if (grades) {
        const gradesData = JSON.parse(grades);
        renderGradesTable(gradesData);
        gradesInfoContainer.style.display = 'block';
    } else {
        gradesTableContainer.innerHTML = '<div class="no-data"><p>📚 Grades data is not yet available.</p></div>';
    }
}

// Render grades table
function renderGradesTable(gradesData) {
    const gradesTableContainer = document.getElementById('gradesTableContainer');
    
    if (!gradesData || gradesData.length === 0) {
        gradesTableContainer.innerHTML = '<div class="no-data"><p>📚 Grades data is not yet available.</p></div>';
        return;
    }
    
    let tableHTML = '<table class="grades-table"><thead><tr><th>Subject</th><th>Teacher</th><th>Q1</th><th>Q2</th><th>Midterm</th><th>Average</th></tr></thead><tbody>';
    
    gradesData.forEach(grade => {
        const q1 = grade.q1 || '--';
        const q2 = grade.q2 || '--';
        const midterm = grade.midterm || '--';
        const average = grade.average
        
        tableHTML += `<tr><td class="subject-name">${grade.subject}</td><td>${grade.teacher}</td><td><span class="grade-cell">${q1}</span></td><td><span class="grade-cell">${q2}</span></td><td><span class="grade-cell ${midterm === '--' ? 'pending' : ''}">${midterm}</span></td><td><span class="grade-cell average">${average}</span></td></tr>`;
    });
    
    tableHTML += '</tbody></table>';
    gradesTableContainer.innerHTML = tableHTML;
}

// Load schedule from storage
function loadSchedule() {
    const scheduleGridContainer = document.getElementById('scheduleGridContainer');
    const schedule = localStorage.getItem('studentSchedule');
    
    if (schedule) {
        const scheduleData = JSON.parse(schedule);
        renderSchedule(scheduleData);
    } else {
        scheduleGridContainer.innerHTML = '<div class="no-data"><p>📅 Schedule data is not yet available.</p></div>';
    }
}

// Render schedule
function renderSchedule(scheduleData) {
    const scheduleGridContainer = document.getElementById('scheduleGridContainer');
    
    if (!scheduleData || Object.keys(scheduleData).length === 0) {
        scheduleGridContainer.innerHTML = '<div class="no-data"><p>📅 Schedule data is not yet available.</p></div>';
        return;
    }
    
    let scheduleHTML = '<div class="schedule-grid">';
    
    Object.keys(scheduleData).forEach(day => {
        const classes = scheduleData[day];
        scheduleHTML += `<div class="schedule-day"><h3>${day}</h3><div class="schedule-classes">`;
        
        if (Array.isArray(classes) && classes.length > 0) {
            classes.forEach(cls => {
                scheduleHTML += `<div class="class-item"><span class="class-time">${cls.time}</span><span class="class-name">${cls.subject} (${cls.room})</span><span class="class-teacher">${cls.teacher}</span></div>`;
            });
        } else {
            scheduleHTML += '<p style="color: #999; font-size: 12px;">No classes scheduled</p>';
        }
        
        scheduleHTML += '</div></div>';
    });
    
    scheduleHTML += '</div>';
    scheduleGridContainer.innerHTML = scheduleHTML;
}

// Load announcements from storage
function loadAnnouncements() {
    const announcementsList = document.getElementById('announcementsList');
    const announcements = localStorage.getItem('studentAnnouncements');
    
    if (announcements) {
        const announcementsData = JSON.parse(announcements);
        renderAnnouncements(announcementsData);
    } else {
        announcementsList.innerHTML = '<div class="no-data"><p>No announcements at this time.</p></div>';
    }
}

/**
 * Load notifications from API
 */
async function loadNotifications() {
    try {
        const studentData = localStorage.getItem('studentData');
        if (!studentData) {
            console.warn('[Student Dashboard] No student data in localStorage');
            return;
        }
        
        const student = JSON.parse(studentData);
        console.log('[Student Dashboard] Student object from localStorage:', JSON.stringify(student, null, 2));
        const studentId = student.id;
        console.log('[Student Dashboard] Student ID:', studentId, 'type:', typeof studentId);
        
        console.log('[Student Dashboard] API_BASE:', API_BASE);
        console.log('[Student Dashboard] Full notifications URL:', `${API_BASE}/api/notifications/student/${studentId}?limit=20`);
        
        const response = await fetch(`${API_BASE}/api/notifications/student/${studentId}?limit=20`);
        console.log('[Student Dashboard] Notification fetch response status:', response.status);
        if (!response.ok) {
            const errText = await response.text();
            console.warn('[Student Dashboard] Failed to fetch notifications:', response.status, errText);
            return;
        }
        
        const notifications = await response.json();
        console.log('[Student Dashboard] Loaded notifications:', notifications.length);
        console.log('[Student Dashboard] Notification data:', JSON.stringify(notifications, null, 2));

        notifications.forEach((notification) => {
            if (notification && notification.id !== undefined && notification.id !== null) {
                seenRealtimeNotificationIds.add(String(notification.id));
            }
        });
        
        // Store notifications in memory for quick access
        window.studentNotifications = notifications;
        
        // Render notifications
        renderNotifications(notifications);
        
        // Start polling for new notifications every 30 seconds
        if (!window.notificationPollingInterval) {
            window.notificationPollingInterval = setInterval(() => {
                pollNotifications(studentId);
            }, 30000);
        }
    } catch (err) {
        console.error('[Student Dashboard] Error loading notifications:', err);
    }
}

/**
 * Poll for new notifications
 */
async function pollNotifications(studentId) {
    try {
        const response = await fetch(`${API_BASE}/api/notifications/student/${studentId}?unread_only=true`);
        if (!response.ok) return;
        
        const newNotifications = await response.json();
        
        // If there are new unread notifications, add them to the display
        if (newNotifications.length > 0) {
            console.log('[Student Dashboard] New notifications received:', newNotifications.length);
            const trulyNew = newNotifications.filter((notification) => {
                const key = String(notification && notification.id);
                if (!key || key === 'undefined' || key === 'null') return true;
                if (seenRealtimeNotificationIds.has(key)) return false;
                seenRealtimeNotificationIds.add(key);
                return true;
            });

            const existing = Array.isArray(window.studentNotifications) ? window.studentNotifications : [];
            const merged = [...newNotifications, ...existing];
            const deduped = [];
            const seenMergeIds = new Set();
            merged.forEach((notification) => {
                const key = String(notification && notification.id);
                if (key && key !== 'undefined' && key !== 'null') {
                    if (seenMergeIds.has(key)) return;
                    seenMergeIds.add(key);
                }
                deduped.push(notification);
            });

            window.studentNotifications = deduped;
            renderNotifications(window.studentNotifications);

            if (trulyNew.length > 0 && hasSectionAssignedNotification(trulyNew)) {
                showToast('Your section assignment has been updated.', 'success', 3400);
                refreshStudentAssignmentData();
            }
        }
    } catch (err) {
        console.warn('[Student Dashboard] Error polling notifications:', err);
    }
}

/**
 * Setup notification event listeners
 */
function setupNotifications() {
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }

    const toggleBtn = document.getElementById('notificationToggleBtn');
    const closeBtn = document.getElementById('closeNotificationDrawerBtn');
    const overlay = document.getElementById('notificationDrawerOverlay');
    const drawerMarkAllBtn = document.getElementById('drawerMarkAllReadBtn');
    const drawerOpenAllBtn = document.getElementById('drawerOpenAllBtn');
    const filtersWrap = document.getElementById('notificationDrawerFilters');
    const drawerList = document.getElementById('notificationDrawerList');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (isNotificationDrawerOpen) {
                closeNotificationDrawer();
            } else {
                openNotificationDrawer();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeNotificationDrawer);
    }

    if (overlay) {
        overlay.addEventListener('click', closeNotificationDrawer);
    }

    if (drawerMarkAllBtn) {
        drawerMarkAllBtn.addEventListener('click', markAllNotificationsAsRead);
    }

    if (drawerOpenAllBtn) {
        drawerOpenAllBtn.addEventListener('click', () => {
            const dashboardLink = document.querySelector('.menu-item[data-section="dashboard"]');
            if (dashboardLink) dashboardLink.click();
            const notificationsList = document.getElementById('notificationsList');
            if (notificationsList) notificationsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
            closeNotificationDrawer();
        });
    }

    if (filtersWrap) {
        filtersWrap.addEventListener('click', (event) => {
            const button = event.target.closest('.notif-filter-btn');
            if (!button) return;
            activeNotificationFilter = button.dataset.filter || 'all';
            filtersWrap.querySelectorAll('.notif-filter-btn').forEach((btn) => {
                btn.classList.toggle('active', btn === button);
            });
            renderNotificationDrawer(window.studentNotifications || []);
        });
    }

    if (drawerList) {
        drawerList.addEventListener('click', (event) => {
            const markBtn = event.target.closest('[data-action="mark-read"]');
            if (markBtn) {
                const notificationId = Number(markBtn.dataset.id);
                if (notificationId) markNotificationAsRead(notificationId);
                return;
            }

            const openBtn = event.target.closest('[data-action="open-related"]');
            if (openBtn) {
                const notificationId = Number(openBtn.dataset.id);
                if (notificationId) openNotificationRelated(notificationId);
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isNotificationDrawerOpen) {
            closeNotificationDrawer();
        }
    });
}

/**
 * Render notifications
 */
function renderNotifications(notifications) {
    const notificationsList = document.getElementById('notificationsList');
    const visibleNotifications = (notifications || []).filter(shouldDisplayNotificationByPreferences);
    
    if (!visibleNotifications || visibleNotifications.length === 0) {
        notificationsList.innerHTML = '<div class="no-data"><p>No notifications yet.</p></div>';
        updateUnreadBadge(0);
        renderNotificationDrawer([]);
        return;
    }
    
    // Count unread
    const unreadCount = visibleNotifications.filter(n => !n.is_read).length;
    updateUnreadBadge(unreadCount);
    
    // Show/hide mark all read button
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.style.display = unreadCount > 0 ? 'block' : 'none';
    }
    
    let html = '';
    visibleNotifications.forEach(notification => {
        const createdDate = new Date(notification.created_at);
        const timeString = formatNotificationTime(createdDate);
        const unreadClass = notification.is_read ? 'read' : 'unread';
        const unreadBadge = notification.is_read ? '' : '<span class="notification-badge-unread"></span>';
        
        html += `
            <div class="notification-item ${unreadClass}" data-notification-id="${notification.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <span class="notification-time">${timeString}</span>
                        <h4>${unreadBadge} ${notification.title}</h4>
                        <p>${notification.message}</p>
                        <div class="notification-actions">
                            ${!notification.is_read ? `<button class="notification-btn" onclick="markNotificationAsRead(${notification.id})">Mark as read</button>` : ''}
                            <button class="notification-btn" onclick="deleteNotification(${notification.id})" style="color: #d32f2f;">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    notificationsList.innerHTML = html;
    renderNotificationDrawer(visibleNotifications);
}

function openNotificationDrawer() {
    const drawer = document.getElementById('notificationDrawer');
    const overlay = document.getElementById('notificationDrawerOverlay');
    const toggleBtn = document.getElementById('notificationToggleBtn');
    if (!drawer || !overlay) return;

    drawer.classList.add('active');
    overlay.classList.add('active');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    isNotificationDrawerOpen = true;
    renderNotificationDrawer(window.studentNotifications || []);
}

function closeNotificationDrawer() {
    const drawer = document.getElementById('notificationDrawer');
    const overlay = document.getElementById('notificationDrawerOverlay');
    const toggleBtn = document.getElementById('notificationToggleBtn');
    if (!drawer || !overlay) return;

    drawer.classList.remove('active');
    overlay.classList.remove('active');
    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    isNotificationDrawerOpen = false;
}

function getNotificationCategory(notification) {
    const content = [
        notification && notification.category,
        notification && notification.type,
        notification && notification.module,
        notification && notification.title,
        notification && notification.message
    ].filter(Boolean).join(' ').toLowerCase();

    if (/guidance|counsel/.test(content)) return 'guidance';
    if (/enroll|admission|section assign/.test(content)) return 'enrollment';
    if (/grade|subject|exam|attendance|class|schedule|lesson|academic|gpa/.test(content)) return 'academic';
    return 'system';
}

function getFilteredNotifications(notifications) {
    const list = Array.isArray(notifications) ? notifications : [];
    if (activeNotificationFilter === 'all') return list;
    if (activeNotificationFilter === 'unread') return list.filter((n) => !n.is_read);
    return list.filter((n) => getNotificationCategory(n) === activeNotificationFilter);
}

function renderNotificationDrawer(notifications) {
    const drawerList = document.getElementById('notificationDrawerList');
    const summaryNode = document.getElementById('notificationDrawerSummary');
    const drawerMarkAllBtn = document.getElementById('drawerMarkAllReadBtn');
    if (!drawerList) return;

    const list = Array.isArray(notifications) ? notifications : [];
    const unreadCount = list.filter((n) => !n.is_read).length;
    const filtered = getFilteredNotifications(list);

    if (summaryNode) {
        const urgentCount = list.filter((n) => {
            const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
            return /urgent|deadline|immediate|today/.test(text);
        }).length;
        summaryNode.textContent = unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''} • ${urgentCount} urgent`
            : 'All caught up.';
    }

    if (drawerMarkAllBtn) {
        drawerMarkAllBtn.disabled = unreadCount === 0;
    }

    if (filtered.length === 0) {
        drawerList.innerHTML = '<div class="no-data"><p>No notifications found for this filter.</p></div>';
        return;
    }

    let html = '';
    filtered.forEach((notification) => {
        const category = getNotificationCategory(notification);
        const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
        const createdDate = new Date(notification.created_at);
        const timeString = formatNotificationTime(createdDate);
        const rowClass = notification.is_read ? 'read' : 'unread';

        html += `
            <div class="drawer-notification-item ${rowClass}" data-id="${notification.id}">
                <div class="drawer-notification-meta">
                    <span class="drawer-notification-time">${timeString}</span>
                    <span class="drawer-notification-category">${categoryLabel}</span>
                </div>
                <h4 class="drawer-notification-title">${notification.title || 'Notification'}</h4>
                <p class="drawer-notification-message">${notification.message || ''}</p>
                <div class="drawer-notification-actions">
                    ${!notification.is_read ? `<button class="btn btn-small" data-action="mark-read" data-id="${notification.id}">Mark as Read</button>` : ''}
                    <button class="btn btn-small btn-enrollment-status" data-action="open-related" data-id="${notification.id}">Open Related</button>
                </div>
            </div>
        `;
    });

    drawerList.innerHTML = html;
}

function resolveNotificationTarget(notification) {
    const category = getNotificationCategory(notification);
    const rawLink = String(notification && (notification.link || notification.target_url || notification.redirect_to || '') || '').trim();
    const text = `${notification && notification.title ? notification.title : ''} ${notification && notification.message ? notification.message : ''}`.toLowerCase();

    if (rawLink.startsWith('#')) {
        return { section: rawLink.replace('#', '') };
    }

    if (category === 'guidance') return { section: 'guidance' };
    if (/grade|subject|gpa|exam|score/.test(text)) return { section: 'grades' };
    if (/schedule|class|timetable/.test(text)) return { section: 'schedule' };
    if (category === 'enrollment' || /enroll|admission|section/.test(text)) return { section: 'dashboard', openEnrollmentStatus: true };
    return { section: 'dashboard' };
}

function openNotificationRelated(notificationId) {
    const notifications = window.studentNotifications || [];
    const notification = notifications.find((n) => Number(n.id) === Number(notificationId));
    if (!notification) {
        showToast('Notification not found.', 'error');
        return;
    }

    const target = resolveNotificationTarget(notification);
    const section = target.section || 'dashboard';
    const sectionLink = document.querySelector(`.menu-item[data-section="${section}"]`);
    if (sectionLink) {
        sectionLink.click();
    }

    if (target.openEnrollmentStatus) {
        const viewBtn = document.getElementById('viewEnrollmentBtn');
        const trackerBtn = document.getElementById('openEnrollmentModalBtn');
        if (viewBtn && viewBtn.style.display !== 'none') viewBtn.click();
        else if (trackerBtn && trackerBtn.style.display !== 'none') trackerBtn.click();
    }

    if (!notification.is_read) {
        markNotificationAsRead(notificationId);
    }

    closeNotificationDrawer();
}

/**
 * Format notification time
 */
function formatNotificationTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

/**
 * Update unread notification badge
 */
function updateUnreadBadge(count) {
    const badge = document.getElementById('unreadBadge');
    const headerBadge = document.getElementById('notificationBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (headerBadge) {
        headerBadge.textContent = String(count);
        headerBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

/**
 * Mark a notification as read
 */
async function markNotificationAsRead(notificationId) {
    try {
        const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            console.log('[Student Dashboard] Notification marked as read:', notificationId);
            // Update local notifications
            if (window.studentNotifications) {
                const notif = window.studentNotifications.find(n => n.id === notificationId);
                if (notif) {
                    notif.is_read = true;
                    notif.read_at = new Date().toISOString();
                }
                renderNotifications(window.studentNotifications);
            }
        }
    } catch (err) {
        console.error('[Student Dashboard] Error marking notification as read:', err);
    }
}

/**
 * Mark all notifications as read
 */
async function markAllNotificationsAsRead() {
    try {
        const studentData = localStorage.getItem('studentData');
        if (!studentData) return;
        
        const student = JSON.parse(studentData);
        const response = await fetch(`${API_BASE}/api/notifications/student/${student.id}/read-all`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            console.log('[Student Dashboard] All notifications marked as read');
            // Update local notifications
            if (window.studentNotifications) {
                window.studentNotifications.forEach(n => {
                    n.is_read = true;
                });
                renderNotifications(window.studentNotifications);
            }
            showToast('All notifications marked as read.', 'success', 2800);
        }
    } catch (err) {
        console.error('[Student Dashboard] Error marking all as read:', err);
        showToast('Unable to update notifications right now.', 'error');
    }
}

/**
 * Delete a notification
 */
async function deleteNotification(notificationId) {
    if (!confirm('Delete this notification?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('[Student Dashboard] Notification deleted:', notificationId);
            // Remove from local notifications
            if (window.studentNotifications) {
                window.studentNotifications = window.studentNotifications.filter(n => n.id !== notificationId);
                renderNotifications(window.studentNotifications);
            }
            showToast('Notification deleted.', 'success', 2600);
        }
    } catch (err) {
        console.error('[Student Dashboard] Error deleting notification:', err);
        showToast('Unable to delete notification right now.', 'error');
    }
}

// Render announcements
function renderAnnouncements(announcementsData) {
    const announcementsList = document.getElementById('announcementsList');
    
    if (!announcementsData || announcementsData.length === 0) {
        announcementsList.innerHTML = '<div class="no-data"><p>No announcements at this time.</p></div>';
        return;
    }
    
    let html = '';
    announcementsData.forEach(announcement => {
        html += `<div class="announcement-item"><span class="announcement-date">${announcement.date}</span><h4>${announcement.title}</h4><p>${announcement.description}</p></div>`;
    });
    
    announcementsList.innerHTML = html;
}

// Theme toggle: light / dark with persistence
function setupThemeToggle() {
    try {
        const toggle = document.getElementById('modeToggleBtn');
        const themeBtn = document.getElementById('themeBtn');
        const overlay = document.getElementById('themeStudioOverlay');
        const closeBtn = document.getElementById('closeThemeStudioBtn');
        const saveBtn = document.getElementById('saveThemeStudioBtn');
        const resetBtn = document.getElementById('resetThemeStudioBtn');
        const colorInput = document.getElementById('themeAccentColor');
        const hexInput = document.getElementById('themeAccentHex');
        const modeControls = document.getElementById('themeModeControls');
        const presetControls = document.getElementById('themePresetControls');
        const fontControls = document.getElementById('themeFontControls');
        const densityControls = document.getElementById('themeDensityControls');

        currentThemeSettings = loadSavedThemeSettings();
        currentThemeDraft = { ...currentThemeSettings };
        applyThemeSettings(currentThemeSettings, { persist: false });
        updateThemeStudioControls(currentThemeSettings);

        if (toggle && !toggle.dataset.boundThemeToggle) {
            toggle.dataset.boundThemeToggle = 'true';
            toggle.addEventListener('click', () => {
                const nextMode = getEffectiveThemeMode(currentThemeSettings.mode) === 'dark' ? 'light' : 'dark';
                currentThemeSettings = { ...currentThemeSettings, mode: nextMode };
                currentThemeDraft = { ...currentThemeSettings };
                applyThemeSettings(currentThemeSettings, { persist: true });
                updateThemeStudioControls(currentThemeSettings);
            });
        }

        if (themeBtn && !themeBtn.dataset.boundThemeStudio) {
            themeBtn.dataset.boundThemeStudio = 'true';
            themeBtn.addEventListener('click', () => {
                if (isThemeStudioOpen) {
                    closeThemeStudioDrawer(true);
                } else {
                    if (isNotificationDrawerOpen) closeNotificationDrawer();
                    openThemeStudioDrawer();
                }
            });
        }

        if (closeBtn && !closeBtn.dataset.boundThemeStudio) {
            closeBtn.dataset.boundThemeStudio = 'true';
            closeBtn.addEventListener('click', () => closeThemeStudioDrawer(true));
        }

        if (overlay && !overlay.dataset.boundThemeStudio) {
            overlay.dataset.boundThemeStudio = 'true';
            overlay.addEventListener('click', () => closeThemeStudioDrawer(true));
        }

        if (modeControls && !modeControls.dataset.boundThemeStudio) {
            modeControls.dataset.boundThemeStudio = 'true';
            modeControls.addEventListener('click', (event) => {
                const chip = event.target.closest('.theme-chip[data-mode]');
                if (!chip) return;
                currentThemeDraft = { ...currentThemeDraft, mode: chip.dataset.mode || 'light' };
                updateThemeStudioControls(currentThemeDraft);
                applyThemeSettings(currentThemeDraft, { persist: false });
                setThemeStudioStatus('Preview mode updated (not saved yet).');
            });
        }

        if (presetControls && !presetControls.dataset.boundThemeStudio) {
            presetControls.dataset.boundThemeStudio = 'true';
            presetControls.addEventListener('click', (event) => {
                const chip = event.target.closest('.theme-chip[data-preset]');
                if (!chip) return;
                const color = normalizeHexColor(chip.dataset.color) || currentThemeDraft.accent;
                currentThemeDraft = {
                    ...currentThemeDraft,
                    preset: chip.dataset.preset || 'default',
                    accent: color
                };
                updateThemeStudioControls(currentThemeDraft);
                applyThemeSettings(currentThemeDraft, { persist: false });
                setThemeStudioStatus('Preset preview applied (not saved yet).');
            });
        }

        if (fontControls && !fontControls.dataset.boundThemeStudio) {
            fontControls.dataset.boundThemeStudio = 'true';
            fontControls.addEventListener('click', (event) => {
                const chip = event.target.closest('.theme-chip[data-font]');
                if (!chip) return;
                currentThemeDraft = { ...currentThemeDraft, fontSize: chip.dataset.font || 'default' };
                updateThemeStudioControls(currentThemeDraft);
                applyThemeSettings(currentThemeDraft, { persist: false });
                setThemeStudioStatus('Font size preview updated (not saved yet).');
            });
        }

        if (densityControls && !densityControls.dataset.boundThemeStudio) {
            densityControls.dataset.boundThemeStudio = 'true';
            densityControls.addEventListener('click', (event) => {
                const chip = event.target.closest('.theme-chip[data-density]');
                if (!chip) return;
                currentThemeDraft = { ...currentThemeDraft, density: chip.dataset.density || 'comfortable' };
                updateThemeStudioControls(currentThemeDraft);
                applyThemeSettings(currentThemeDraft, { persist: false });
                setThemeStudioStatus('Density preview updated (not saved yet).');
            });
        }

        if (colorInput && !colorInput.dataset.boundThemeStudio) {
            colorInput.dataset.boundThemeStudio = 'true';
            colorInput.addEventListener('input', () => {
                const color = normalizeHexColor(colorInput.value);
                if (!color) return;
                currentThemeDraft = { ...currentThemeDraft, preset: 'custom', accent: color };
                if (hexInput) hexInput.value = color;
                updateThemeStudioControls(currentThemeDraft);
                applyThemeSettings(currentThemeDraft, { persist: false });
                setThemeStudioStatus('Custom accent preview applied (not saved yet).');
            });
        }

        if (hexInput && !hexInput.dataset.boundThemeStudio) {
            hexInput.dataset.boundThemeStudio = 'true';
            const applyHex = () => {
                const color = normalizeHexColor(hexInput.value);
                if (!color) {
                    showToast('Use a valid color like #6366f1.', 'error', 2600);
                    hexInput.value = currentThemeDraft.accent;
                    return;
                }
                currentThemeDraft = { ...currentThemeDraft, preset: 'custom', accent: color };
                if (colorInput) colorInput.value = color;
                updateThemeStudioControls(currentThemeDraft);
                applyThemeSettings(currentThemeDraft, { persist: false });
                setThemeStudioStatus('Custom accent preview applied (not saved yet).');
            };

            hexInput.addEventListener('blur', applyHex);
            hexInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    applyHex();
                }
            });
        }

        if (saveBtn && !saveBtn.dataset.boundThemeStudio) {
            saveBtn.dataset.boundThemeStudio = 'true';
            saveBtn.addEventListener('click', () => {
                currentThemeSettings = { ...currentThemeDraft };
                applyThemeSettings(currentThemeSettings, { persist: true });
                updateThemeStudioControls(currentThemeSettings);
                setThemeStudioStatus('Theme saved successfully.');
                closeThemeStudioDrawer(false);
                showToast('Theme preferences saved.', 'success', 2600);
            });
        }

        if (resetBtn && !resetBtn.dataset.boundThemeStudio) {
            resetBtn.dataset.boundThemeStudio = 'true';
            resetBtn.addEventListener('click', () => {
                currentThemeSettings = { ...DEFAULT_THEME_SETTINGS };
                currentThemeDraft = { ...DEFAULT_THEME_SETTINGS };
                applyThemeSettings(currentThemeSettings, { persist: true });
                updateThemeStudioControls(currentThemeSettings);
                setThemeStudioStatus('Theme reset to default.');
                showToast('Theme reset to default.', 'success', 2600);
            });
        }

        if (themeSystemQuery && !themeSystemQuery._studentThemeStudioBound) {
            themeSystemQuery._studentThemeStudioBound = true;
            themeSystemQuery.addEventListener('change', () => {
                if (currentThemeSettings.mode === 'auto') {
                    applyThemeSettings(currentThemeSettings, { persist: false });
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isThemeStudioOpen) {
                closeThemeStudioDrawer(true);
            }
        });
    } catch (err) {
        console.warn('[Student Dashboard] setupThemeToggle error', err);
    }
}

// Load tasks from storage
function loadTasks() {
    const tasksList = document.getElementById('tasksList');
    const tasks = localStorage.getItem('studentTasks');
    
    if (tasks) {
        const tasksData = JSON.parse(tasks);
        renderTasks(tasksData);
    } else {
        tasksList.innerHTML = '<div class="no-data"><p>No tasks yet. Create one to get started!</p></div>';
    }
}

// Render tasks
function renderTasks(tasksData) {
    const tasksList = document.getElementById('tasksList');
    
    if (!tasksData || tasksData.length === 0) {
        tasksList.innerHTML = '<div class="no-data"><p>No tasks yet. Create one to get started!</p></div>';
        return;
    }
    
    let html = '';
    tasksData.forEach((task, index) => {
        const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date';
        const priorityClass = task.priority || 'medium';
        const completedClass = task.completed ? 'completed' : '';
        
        html += `
            <div class="task-item ${completedClass}">
                <input type="checkbox" class="task-checkbox" data-index="${index}" ${task.completed ? 'checked' : ''}>
                <div class="task-content">
                    <h4>${task.title}</h4>
                    <p>${task.description || 'No description'}</p>
                    <small>Due: ${dueDate} | Priority: <span class="priority-${priorityClass}">${priorityClass.toUpperCase()}</span></small>
                </div>
                <button class="task-delete" data-index="${index}">Delete</button>
            </div>
        `;
    });
    
    tasksList.innerHTML = html;
}

// Setup modal functionality
function setupModals() {
    const modals = document.querySelectorAll('.modal');
    const modalCloseButtons = document.querySelectorAll('.modal-close');
    const modalCancelButtons = document.querySelectorAll('.modal-cancel');
    
    document.getElementById('addTaskBtn').addEventListener('click', () => {
        document.getElementById('taskModal').classList.add('active');
    });
    
    document.getElementById('changePasswordBtn').addEventListener('click', () => {
        document.getElementById('passwordModal').classList.add('active');
    });
    
    modalCloseButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });
    
    modalCancelButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });
    
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// Setup task management
function setupTaskManagement() {
    document.getElementById('createTaskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const title = document.getElementById('taskTitle').value;
        const description = document.getElementById('taskDescription').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const priority = document.getElementById('taskPriority').value;
        
        let tasks = JSON.parse(localStorage.getItem('studentTasks')) || [];
        tasks.push({ title, description, dueDate, priority, completed: false, createdAt: new Date().toISOString() });
        localStorage.setItem('studentTasks', JSON.stringify(tasks));
        
        document.getElementById('taskModal').classList.remove('active');
        document.getElementById('createTaskForm').reset();
        loadTasks();
    });
    
    // Task checkbox and delete handling
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('task-checkbox')) {
            const index = e.target.dataset.index;
            let tasks = JSON.parse(localStorage.getItem('studentTasks')) || [];
            if (tasks[index]) {
                tasks[index].completed = e.target.checked;
                localStorage.setItem('studentTasks', JSON.stringify(tasks));
                loadTasks();
            }
        }
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('task-delete')) {
            if (confirm('Are you sure you want to delete this task?')) {
                const index = e.target.dataset.index;
                let tasks = JSON.parse(localStorage.getItem('studentTasks')) || [];
                tasks.splice(index, 1);
                localStorage.setItem('studentTasks', JSON.stringify(tasks));
                loadTasks();
            }
        }
    });
}

// Setup profile management
function setupProfileManagement() {
    document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword.length < 8) {
            showToast('Password must be at least 8 characters long.', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showToast('Passwords do not match.', 'error');
            return;
        }
        
        let studentData = JSON.parse(localStorage.getItem('studentData'));
        studentData.password = newPassword;
        localStorage.setItem('studentData', JSON.stringify(studentData));
        
        showToast('Password changed successfully.', 'success');
        document.getElementById('passwordModal').classList.remove('active');
        document.getElementById('changePasswordForm').reset();
    });
    
    document.getElementById('editProfileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const firstName = document.getElementById('editFirstName').value;
        const lastName = document.getElementById('editLastName').value;
        const email = document.getElementById('editEmail').value;
        const phone = document.getElementById('editPhone').value;
        const address = document.getElementById('editAddress').value;
        
        let studentData = JSON.parse(localStorage.getItem('studentData'));
        studentData.firstName = firstName;
        studentData.lastName = lastName;
        studentData.email = email;
        studentData.phone = phone;
        studentData.address = address;
        localStorage.setItem('studentData', JSON.stringify(studentData));
        
        showToast('Profile updated successfully.', 'success');
        document.getElementById('profileModal').classList.remove('active');
        loadStudentData();
    });
    
    // Setup refresh profile data button
    const refreshBtn = document.getElementById('refreshProfileBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('[Student Dashboard] Refresh button clicked - updating profile data');
            
            // Disable button during refresh
            refreshBtn.disabled = true;
            refreshBtn.textContent = '⏳ Refreshing...';
            
            try {
                const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
                
                // Refresh both school year and section data in parallel
                await Promise.all([
                    loadAndDisplayActiveSchoolYear(),
                    loadAndDisplayAssignedSection(studentData.id),
                    loadAndDisplayEnrollmentData(studentData.id)
                ]);
                
                // Re-enable button
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh Data';
                console.log('[Student Dashboard] Profile data refreshed');
                showToast('Profile data refreshed.', 'success', 2600);
            } catch (err) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh Data';
                console.error('[Student Dashboard] Error refreshing data:', err);
                showToast('Error refreshing data. Please try again.', 'error');
            }
        });
    }
}

// Load profile form data
function loadProfileFormData() {
    const studentData = JSON.parse(localStorage.getItem('studentData'));
    document.getElementById('editFirstName').value = studentData.firstName;
    document.getElementById('editLastName').value = studentData.lastName || '';
    document.getElementById('editEmail').value = studentData.email;
    document.getElementById('editPhone').value = studentData.phone || '';
    document.getElementById('editAddress').value = studentData.address || '';
}

// Start periodic polling for profile data updates
function startProfilePolling(studentId) {
    // Clear any existing polling interval
    stopProfilePolling();
    
    console.log('[Student Dashboard] Starting profile data polling (every 30 seconds)');
    
    // Poll for updates every 30 seconds while profile is open
    profilePollingInterval = setInterval(async () => {
        // Check if profile section is still active
        const profileSection = document.getElementById('profile');
        if (!profileSection || !profileSection.classList.contains('active')) {
            console.log('[Student Dashboard] Profile section no longer active, stopping polling');
            stopProfilePolling();
            return;
        }
        
        try {
            // Silently refresh profile data in background
            console.log('[Student Dashboard] Polling for profile updates...');
            await loadAndDisplayActiveSchoolYear();
            await loadAndDisplayAssignedSection(studentId);
            await loadAndDisplayEnrollmentData(studentId);
            console.log('[Student Dashboard] Profile data polling completed');
        } catch (err) {
            console.warn('[Student Dashboard] Error during profile polling:', err);
        }
    }, 30000); // Poll every 30 seconds
}

// Stop periodic polling for profile data
function stopProfilePolling() {
    if (profilePollingInterval !== null) {
        console.log('[Student Dashboard] Stopping profile data polling');
        clearInterval(profilePollingInterval);
        profilePollingInterval = null;
    }
}

// Navigation functionality
function setupNavigation() {
    document.querySelectorAll('.nav-link:not(.logout-btn)').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionName = link.dataset.section;
            
            document.querySelectorAll('.nav-link:not(.logout-btn)').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
            
            link.classList.add('active');
            const targetSection = document.getElementById(sectionName);
            if (targetSection) {
                targetSection.classList.add('active');
            } else {
                console.warn('[Student Dashboard] Missing section element for', sectionName);
            }
            
            // Refresh profile data when profile section is clicked
            if (sectionName === 'profile') {
                const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
                console.log('[Student Dashboard] Profile section opened - refreshing data');
                loadAndDisplayActiveSchoolYear();
                loadAndDisplayAssignedSection(studentData.id);
                loadAndDisplayEnrollmentData(studentData.id);
                
                // Start periodic polling for profile data when profile is active
                startProfilePolling(studentData.id);
            } else {
                // Stop polling when leaving profile section
                stopProfilePolling();
            }
            
            window.scrollTo(0, 0);
        });
    });
    
    document.querySelector('[data-section="dashboard"]').classList.add('active');
}

// Logout functionality
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutModal = document.getElementById('logoutModal');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    const logoutModalClose = document.getElementById('logoutModalClose');

    // If the modal and its controls exist, use the modal flow, otherwise fall back
    // to a direct logout action that clears stored student data and redirects.
    if (logoutModal && confirmLogoutBtn && cancelLogoutBtn && logoutModalClose) {
        logoutBtn.addEventListener('click', () => {
            logoutModal.classList.add('active');
            logoutModal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            confirmLogoutBtn.focus();
        });

        function closeLogoutModal() {
            logoutModal.classList.remove('active');
            logoutModal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
        }

        cancelLogoutBtn.addEventListener('click', closeLogoutModal);
        logoutModalClose.addEventListener('click', closeLogoutModal);

        confirmLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('studentData');
            sessionStorage.clear();
            document.body.classList.remove('modal-open');
            // redirect to the student login page
            window.location.href = withSchoolParam('auth.html?role=student');
        });
    } else if (logoutBtn) {
        // Simple fallback when modal is not present: immediate logout + redirect
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('studentData');
            sessionStorage.clear();
            window.location.href = withSchoolParam('auth.html?role=student');
        });
    }
}

// Add animation on page load
window.addEventListener('load', () => {
    document.querySelectorAll('.stat-card').forEach((card, index) => {
        card.style.animation = `slideUp 0.5s ease ${index * 0.1}s both`;
    });
});

// Enrollment status handling: replace Enroll link with View Enrollment Status if enrolled
function setEnrollmentCtaState(hasEnrollment) {
    const enrollBtn = document.getElementById('enrollBtn');
    const viewBtn = document.getElementById('viewEnrollmentBtn');
    if (enrollBtn) enrollBtn.style.display = hasEnrollment ? 'none' : 'inline-block';
    if (viewBtn) viewBtn.style.display = hasEnrollment ? 'inline-block' : 'none';
}

function getActiveSchoolYearMeta() {
    let active = window.activeSchoolYear;
    if (!active) {
        try {
            active = JSON.parse(localStorage.getItem('activeSchoolYear') || 'null');
        } catch (_err) {
            active = null;
        }
    }

    return {
        id: String((active && (active.id || active.school_year_id || active.schoolYearId || active.activeSchoolYearId)) || '').trim(),
        name: String((active && (active.school_year || active.schoolYear || active.name)) || '').trim().toLowerCase()
    };
}

async function ensureSchoolYearLookup() {
    if (window.schoolYearLookupById && Object.keys(window.schoolYearLookupById).length > 0) {
        return window.schoolYearLookupById;
    }

    const byId = {};
    try {
        const response = await fetch(`${API_BASE}/api/school-years`);
        if (response.ok) {
            const rows = await response.json();
            (Array.isArray(rows) ? rows : []).forEach((row) => {
                const id = String((row && row.id) || '').trim();
                const label = String((row && (row.school_year || row.schoolYear || row.name)) || '').trim();
                if (id && label) byId[id] = label;
            });
        }
    } catch (_err) {
    }

    if ((!Object.keys(byId).length) && window.activeSchoolYear) {
        const activeId = String(window.activeSchoolYear.id || window.activeSchoolYear.school_year_id || '').trim();
        const activeLabel = String(window.activeSchoolYear.school_year || window.activeSchoolYear.schoolYear || '').trim();
        if (activeId && activeLabel) byId[activeId] = activeLabel;
    }

    window.schoolYearLookupById = byId;
    return byId;
}

function getEnrollmentSchoolYearMeta(entry = {}) {
    let parsedData = {};
    if (entry && entry.enrollment_data) {
        if (typeof entry.enrollment_data === 'string') {
            try {
                parsedData = JSON.parse(entry.enrollment_data || '{}') || {};
            } catch (_err) {
                parsedData = {};
            }
        } else {
            parsedData = entry.enrollment_data || {};
        }
    }

    const idCandidates = [
        entry && entry.school_year_id,
        entry && entry.schoolYearId,
        entry && entry.activeSchoolYearId,
        entry && entry.school_year && entry.school_year.id,
        parsedData && parsedData.school_year_id,
        parsedData && parsedData.schoolYearId,
        parsedData && parsedData.activeSchoolYearId,
        parsedData && parsedData.school_year && parsedData.school_year.id
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    const nameCandidates = [
        entry && entry.school_year_name,
        entry && entry.schoolYear,
        entry && entry.school_year && entry.school_year.school_year,
        entry && entry.school_year,
        parsedData && parsedData.school_year_name,
        parsedData && parsedData.school_year,
        parsedData && parsedData.schoolYear,
        parsedData && parsedData.lastSchoolYear,
        entry && entry.lastSchoolYear
    ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean);

    return {
        ids: new Set(idCandidates),
        names: new Set(nameCandidates)
    };
}

function isEnrollmentForActiveSchoolYear(entry, activeMeta = null) {
    const meta = activeMeta || getActiveSchoolYearMeta();
    if (!meta.id && !meta.name) return false;

    const enrollmentMeta = getEnrollmentSchoolYearMeta(entry);
    const byId = !!(meta.id && enrollmentMeta.ids.has(meta.id));
    const byName = !!(meta.name && enrollmentMeta.names.has(meta.name));
    return byId || byName;
}

function sortEnrollmentsByRecent(enrollments = []) {
    return [...(enrollments || [])].sort((left, right) => {
        const leftTime = new Date(left && (left.enrollment_date || left.created_at || left.updated_at || 0)).getTime() || 0;
        const rightTime = new Date(right && (right.enrollment_date || right.created_at || right.updated_at || 0)).getTime() || 0;
        return rightTime - leftTime;
    });
}

function resolveEnrollmentSchoolYearLabel(entry = {}, schoolYearLookup = null) {
    let parsedData = {};
    if (entry && entry.enrollment_data) {
        if (typeof entry.enrollment_data === 'string') {
            try {
                parsedData = JSON.parse(entry.enrollment_data || '{}') || {};
            } catch (_err) {
                parsedData = {};
            }
        } else {
            parsedData = entry.enrollment_data || {};
        }
    }

    const label = String(
        entry.school_year_name ||
        entry.schoolYearName ||
        entry.schoolYear ||
        (entry.school_year && entry.school_year.school_year) ||
        entry.school_year ||
        parsedData.schoolYearName ||
        parsedData.school_year_name ||
        parsedData.school_year ||
        parsedData.schoolYear ||
        parsedData.lastSchoolYear ||
        entry.lastSchoolYear ||
        ''
    ).trim();

    if (label) return label;

    const ids = [
        entry.school_year_id,
        entry.schoolYearId,
        entry.activeSchoolYearId,
        entry.school_year && entry.school_year.id,
        parsedData.school_year_id,
        parsedData.schoolYearId,
        parsedData.activeSchoolYearId,
        parsedData.school_year && parsedData.school_year.id
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    const byId = schoolYearLookup || window.schoolYearLookupById || {};
    for (const id of ids) {
        if (byId[id]) return String(byId[id]).trim();
    }

    return 'Unknown School Year';
}

function filterEnrollmentsForStudent(studentData = {}, enrollments = []) {
    const identitySet = getStudentIdentitySet(studentData);

    return (enrollments || []).filter((entry) => {
        let parsedData = {};
        if (entry && entry.enrollment_data) {
            if (typeof entry.enrollment_data === 'string') {
                try {
                    parsedData = JSON.parse(entry.enrollment_data || '{}') || {};
                } catch (_err) {
                    parsedData = {};
                }
            } else {
                parsedData = entry.enrollment_data || {};
            }
        }

        const studentCandidateIds = [
            entry && entry.student_id,
            entry && entry.studentID,
            entry && entry.studentId,
            parsedData && parsedData.student_id,
            parsedData && parsedData.studentID,
            parsedData && parsedData.studentId,
            parsedData && parsedData.lrn,
            parsedData && parsedData.email
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        return studentCandidateIds.some((candidate) => identitySet.has(candidate));
    });
}

function getCurrentSchoolYearEnrollment(enrollments = []) {
    const activeMeta = getActiveSchoolYearMeta();
    const currentRecords = sortEnrollmentsByRecent(
        (enrollments || []).filter((entry) => isEnrollmentForActiveSchoolYear(entry, activeMeta))
    );
    return currentRecords[0] || null;
}

function openEnrollmentStatusModalWithRecord(record) {
    const modal = document.getElementById('enrollmentStatusModal');
    if (!modal || !record) return;

    let enrollmentDataParsed = record.enrollment_data;
    // build enrollmentFilesParsed by merging both the column value and any
    // files that might be stored inside the enrollment_data object
    let enrollmentFilesParsed = {};
    if (record.enrollment_data && record.enrollment_data.enrollmentFiles && typeof record.enrollment_data.enrollmentFiles === 'object') {
        Object.assign(enrollmentFilesParsed, record.enrollment_data.enrollmentFiles);
    }
    if (record.enrollment_files && typeof record.enrollment_files === 'object') {
        Object.assign(enrollmentFilesParsed, record.enrollment_files);
    }

    if (typeof enrollmentDataParsed === 'string') {
        try { enrollmentDataParsed = JSON.parse(enrollmentDataParsed); } catch (_err) { enrollmentDataParsed = {}; }
    }
    if (typeof enrollmentFilesParsed === 'string') {
        try { enrollmentFilesParsed = JSON.parse(enrollmentFilesParsed); } catch (_err) { enrollmentFilesParsed = {}; }
    }

    // populate contents; errors should not stop modal from showing
    try {
        populateEnrollmentStatusModal({
            ...record,
            enrollmentData: enrollmentDataParsed || {},
            enrollmentFiles: enrollmentFilesParsed || {}
        });
    } catch (err) {
        console.error('[Status Modal] failed to populate content', err);
    }

    // ensure highest stacking order and make visible
    modal.style.zIndex = '100000';
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('active');
}

async function loadMyEnrollmentsSection(enrollmentsInput = null) {
    const container = document.getElementById('myEnrollmentsByYear');
    if (!container) return;

    const studentData = JSON.parse(localStorage.getItem('studentData') || '{}');
    let source = Array.isArray(enrollmentsInput) ? enrollmentsInput : [];

    if (!Array.isArray(enrollmentsInput)) {
        try {
            const fetched = await fetchStudentEnrollmentsForDashboard(studentData);
            source = Array.isArray(fetched) ? fetched : [];
            if (!source.length) {
                source = JSON.parse(localStorage.getItem('enrollments') || '[]') || [];
            }
        } catch (_err) {
            source = JSON.parse(localStorage.getItem('enrollments') || '[]') || [];
        }
    }

    const studentEnrollments = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, source));
    // ensure any enrollment_files values are objects rather than JSON strings
    studentEnrollments.forEach(e => {
        if (e && typeof e.enrollment_files === 'string') {
            try { e.enrollment_files = JSON.parse(e.enrollment_files || '{}'); } catch { e.enrollment_files = {}; }
        }
        if (e && e.enrollment_data && typeof e.enrollment_data === 'object' && typeof e.enrollment_data.enrollmentFiles === 'string') {
            try { e.enrollment_data.enrollmentFiles = JSON.parse(e.enrollment_data.enrollmentFiles || '{}'); } catch { e.enrollment_data.enrollmentFiles = {}; }
        }
    });
    const schoolYearLookup = await ensureSchoolYearLookup();
    window.studentEnrollmentsCache = studentEnrollments;
    window.studentEnrollmentsCacheByKey = {};

    if (!studentEnrollments.length) {
        container.innerHTML = '<div class="no-data"><p>No enrollment records found yet.</p></div>';
        return;
    }

    const groups = new Map();
    studentEnrollments.forEach((entry, index) => {
        const schoolYear = resolveEnrollmentSchoolYearLabel(entry, schoolYearLookup);
        const key = String(entry && (entry.id || entry.enrollment_id) || '').trim() || `idx-${index}`;
        entry.__historyKey = key;
        window.studentEnrollmentsCacheByKey[key] = entry;
        if (!groups.has(schoolYear)) groups.set(schoolYear, []);
        groups.get(schoolYear).push(entry);
    });

    const statusPill = (statusRaw) => {
        const text = String(statusRaw || 'Pending').trim();
        const key = text.toLowerCase();
        const cls = key === 'approved' ? 'approved' : (key === 'rejected' ? 'rejected' : 'pending');
        return `<span class="enrollment-status-pill ${cls}">${text}</span>`;
    };

    container.innerHTML = Array.from(groups.entries()).map(([schoolYear, records]) => {
        const rows = records.map((entry) => {
            let enrollmentData = entry.enrollment_data || {};
            if (typeof enrollmentData === 'string') {
                try { enrollmentData = JSON.parse(enrollmentData || '{}') || {}; } catch (_err) { enrollmentData = {}; }
            }

            const enrollmentId = String(entry.__historyKey || entry.id || entry.enrollment_id || '').trim();
            const submitted = entry.enrollment_date || entry.created_at;
            const submittedText = submitted ? new Date(submitted).toLocaleDateString() : '--';
            const gradeText = enrollmentData.gradeLevel || entry.grade_level || '--';
            const trackText = enrollmentData.track || entry.track || '--';

            return `
                <tr>
                    <td>${submittedText}</td>
                    <td>${gradeText}</td>
                    <td>${trackText}</td>
                    <td>${statusPill(entry.status)}</td>
                    <td>
                        <button type="button" class="btn btn-small btn-enrollment-status open-enrollment-history-btn" data-enrollment-id="${enrollmentId}">View Details</button>
                        <button type="button" class="btn btn-small btn-edit-enrollment" data-enrollment-id="${enrollmentId}">Edit</button>
                    </td>
                </tr>
            `;
        }).join('');

        return `
            <div class="enrollment-history-group">
                <div class="school-year-header">
                    <h3>📅 ${schoolYear}</h3>
                    <div class="school-year-info">
                        <span class="enrollment-count">${records.length} enrollment${records.length > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="enrollment-history-table-wrap">
                    <table class="enrollment-history-table">
                        <thead>
                            <tr>
                                <th>Date Submitted</th>
                                <th>Grade</th>
                                <th>Track</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');

    // Always (re)bind event delegation for edit/view buttons after rendering
    if (container._enrollmentHistoryClickHandler) {
        container.removeEventListener('click', container._enrollmentHistoryClickHandler);
    }
    container._enrollmentHistoryClickHandler = function(event) {
        // View Details button
        const viewBtn = event.target && event.target.closest
            ? event.target.closest('.open-enrollment-history-btn[data-enrollment-id]')
            : null;
        if (viewBtn) {
            const enrollmentId = String(viewBtn.getAttribute('data-enrollment-id') || '').trim();
            if (!enrollmentId) return;
            const selected = (window.studentEnrollmentsCacheByKey && window.studentEnrollmentsCacheByKey[enrollmentId])
                || (window.studentEnrollmentsCache || []).find((entry) => String(entry.__historyKey || entry.id || entry.enrollment_id || '').trim() === enrollmentId);
            if (selected) {
                openEnrollmentStatusModalWithRecord(selected);
            } else {
                // try fetching directly from API as a last resort
                if (typeof API_BASE === 'string' && API_BASE) {
                    fetch(`${API_BASE}/api/enrollments/${encodeURIComponent(enrollmentId)}`)
                        .then(res => res.ok ? res.json() : null)
                        .then(rec => { if (rec) openEnrollmentStatusModalWithRecord(rec); })
                        .catch(() => {});
                }
            }
            return;
        }

        // Edit button
        const editBtn = event.target && event.target.closest
            ? event.target.closest('.btn-edit-enrollment[data-enrollment-id]')
            : null;
        if (editBtn) {
            const enrollmentId = String(editBtn.getAttribute('data-enrollment-id') || '').trim();
            if (!enrollmentId) return;
            const selected = (window.studentEnrollmentsCacheByKey && window.studentEnrollmentsCacheByKey[enrollmentId])
                || (window.studentEnrollmentsCache || []).find((entry) => String(entry.__historyKey || entry.id || entry.enrollment_id || '').trim() === enrollmentId);
            if (selected) openEnrollmentEditModal(selected);
            return;
        }
    };
    container.addEventListener('click', container._enrollmentHistoryClickHandler);
}

function normalizeEnrollmentList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.enrollments)) return payload.enrollments;
    if (payload && payload.enrollment) return [payload.enrollment];
    if (payload && payload.item) return [payload.item];
    return [];
}

function getStudentIdentitySet(studentData = {}) {
    const identitySet = new Set();
    [
        studentData.id,
        studentData.student_id,
        studentData.studentID,
        studentData.lrn,
        studentData.email
    ].forEach((value) => {
        const normalized = String(value || '').trim();
        if (normalized) identitySet.add(normalized);
    });
    return identitySet;
}

function findExistingEnrollmentRecord(studentData = {}, enrollments = []) {
    const identitySet = getStudentIdentitySet(studentData);
    const enrollmentId = String(studentData.enrollmentID || studentData.enrollment_id || '').trim();

    return (enrollments || []).find((entry) => {
        let parsedData = {};
        if (entry && entry.enrollment_data) {
            if (typeof entry.enrollment_data === 'string') {
                try {
                    parsedData = JSON.parse(entry.enrollment_data || '{}') || {};
                } catch (_err) {
                    parsedData = {};
                }
            } else {
                parsedData = entry.enrollment_data;
            }
        }
        const studentCandidateIds = [
            entry && entry.student_id,
            entry && entry.studentID,
            entry && entry.studentId,
            parsedData && parsedData.student_id,
            parsedData && parsedData.studentID,
            parsedData && parsedData.studentId,
            parsedData && parsedData.lrn,
            parsedData && parsedData.email
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        const enrollmentCandidateIds = [
            entry && entry.enrollment_id,
            entry && entry.id
        ]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        const hasStudentMatch = studentCandidateIds.some((candidate) => identitySet.has(candidate));
        const hasEnrollmentIdMatch = enrollmentId && enrollmentCandidateIds.includes(enrollmentId);
        return hasStudentMatch || hasEnrollmentIdMatch;
    });
}

function saveEnrollmentMarker(studentData = {}, enrollment = null) {
    if (!enrollment || !studentData || typeof studentData !== 'object') return;
    const nextStudentData = {
        ...studentData,
        hasEnrollment: true,
        enrollmentID: enrollment.enrollment_id || enrollment.id || studentData.enrollmentID,
        enrollment_id: enrollment.enrollment_id || enrollment.id || studentData.enrollment_id
    };
    localStorage.setItem('studentData', JSON.stringify(nextStudentData));
}

function getEnrollmentLookupIds(studentData = {}) {
    const ids = [];
    const pushUnique = (value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        if (!ids.includes(normalized)) ids.push(normalized);
    };

    pushUnique(studentData.id);
    pushUnique(studentData.student_id);
    pushUnique(studentData.studentID);
    pushUnique(studentData.lrn);
    pushUnique(studentData.email);
    return ids;
}

async function fetchStudentEnrollmentsForDashboard(studentData = {}) {
    const lookupIds = getEnrollmentLookupIds(studentData);
    const collected = [];
    const seenIds = new Set();

    const pushUniqueEnrollments = (rows = []) => {
        (rows || []).forEach((row) => {
            const key = String((row && (row.enrollment_id || row.id)) || '').trim();
            if (key) {
                if (seenIds.has(key)) return;
                seenIds.add(key);
            }
            collected.push(row);
        });
    };

    const endpointSuffixes = [
        '?allYears=true&limit=500&sort=recent',
        '?activeYear=false&limit=500&sort=recent',
        '?allYears=true&limit=500',
        '?activeYear=false&limit=500',
        '?limit=500&sort=recent',
        '?limit=500',
        ''
    ];

    for (const lookupId of lookupIds) {
        for (const suffix of endpointSuffixes) {
            try {
                const response = await fetch(`${API_BASE}/api/enrollments/student/${encodeURIComponent(lookupId)}${suffix}`);
                if (!response.ok) continue;
                const payload = await response.json();
                const enrollments = normalizeEnrollmentList(payload);
                if (enrollments.length > 0) {
                    pushUniqueEnrollments(enrollments);
                }
            } catch (_err) {
            }
        }
    }

    if (collected.length > 0) {
        return sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, collected));
    }

    const globalEndpoints = [
        '/api/enrollments?activeYear=false&limit=500&sort=recent',
        '/api/enrollments?activeYear=false&limit=500',
        '/api/enrollments?limit=500&sort=recent',
        '/api/enrollments?limit=500'
    ];

    for (const endpoint of globalEndpoints) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            if (!response.ok) continue;
            const payload = await response.json();
            const enrollments = normalizeEnrollmentList(payload);
            if (enrollments.length === 0) continue;

            const filtered = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, enrollments));
            if (filtered.length > 0) {
                return filtered;
            }
        } catch (_err) {
        }
    }

    return [];
}

async function setupEnrollmentStatusButton() {
    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
    
    const viewBtn = document.getElementById('viewEnrollmentBtn');
    const trackerOpenBtn = document.getElementById('openEnrollmentModalBtn');
    const studentID = studentData.id;

    // Immediate UI state from local marker to prevent incorrect CTA after redirect from submission
    if (studentData.hasEnrollment || studentData.enrollmentID || studentData.enrollment_id) {
        setEnrollmentCtaState(true);
    } else {
        setEnrollmentCtaState(false);
    }

    await loadActiveSchoolYear();

    // Check if student has an enrollment ID stored
    if (studentData.enrollmentID || studentData.enrollment_id || studentID || studentData.student_id || studentData.studentID || studentData.lrn || studentData.email) {
        // Fetch enrollment from API/database
        
        // Setup click handler with proper event delegation - only once
        if (viewBtn && !viewBtn.hasListener) {
            viewBtn.addEventListener('click', handleViewEnrollmentClick);
            viewBtn.hasListener = true;  // Mark that listener is attached
        }
        if (trackerOpenBtn && !trackerOpenBtn.hasListener) {
            trackerOpenBtn.addEventListener('click', handleViewEnrollmentClick);
            trackerOpenBtn.hasListener = true;
        }
        
        try {
            const apiEnrollments = await fetchStudentEnrollmentsForDashboard(studentData);
            const localEnrollments = JSON.parse(localStorage.getItem('enrollments')) || [];
            const sourceEnrollments = (apiEnrollments && apiEnrollments.length > 0) ? apiEnrollments : localEnrollments;
            const studentEnrollments = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, sourceEnrollments));
            await loadMyEnrollmentsSection(studentEnrollments);

            const currentYearEnrollment = getCurrentSchoolYearEnrollment(studentEnrollments);

            if (currentYearEnrollment) {
                saveEnrollmentMarker(studentData, currentYearEnrollment);
                updateEnrollmentTracker(currentYearEnrollment);
                setEnrollmentCtaState(true);
            } else {
                updateEnrollmentTracker(null);
                setEnrollmentCtaState(false);
            }
        } catch (err) {
            console.error('Error checking enrollment:', err);
            const enrollments = JSON.parse(localStorage.getItem('enrollments')) || [];
            const studentEnrollments = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, enrollments));
            await loadMyEnrollmentsSection(studentEnrollments);
            const currentYearEnrollment = getCurrentSchoolYearEnrollment(studentEnrollments);

            if (currentYearEnrollment) {
                saveEnrollmentMarker(studentData, currentYearEnrollment);
                updateEnrollmentTracker(currentYearEnrollment);
                setEnrollmentCtaState(true);
            } else {
                updateEnrollmentTracker(null);
                setEnrollmentCtaState(false);
            }
        }
    } else {
        await loadMyEnrollmentsSection([]);
        updateEnrollmentTracker(null);
        setEnrollmentCtaState(false);
    }
}

// Handle the View Enrollment Status button click
function handleViewEnrollmentClick(e) {
    e.preventDefault();
    console.log('[StudentDash] handleViewEnrollmentClick triggered');
    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};

    // Attempt to use cached enrollments first (populated by loadMyEnrollmentsSection)
    let cached = (window.studentEnrollmentsCache || []).slice();
    if (cached.length) {
        const studentEnrollments = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, cached));
        const currentYearEnrollment = getCurrentSchoolYearEnrollment(studentEnrollments);
        const targetEnrollment = currentYearEnrollment || studentEnrollments[0] || null;
        if (targetEnrollment) {
            saveEnrollmentMarker(studentData, targetEnrollment);
            openEnrollmentStatusModalWithRecord(targetEnrollment);
            return;
        }
    }

    // fall back to network fetch
    fetchStudentEnrollmentsForDashboard(studentData)
        .then((enrollments) => {
            const studentEnrollments = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, enrollments));
            const currentYearEnrollment = getCurrentSchoolYearEnrollment(studentEnrollments);
            const targetEnrollment = currentYearEnrollment || studentEnrollments[0] || null;
            if (targetEnrollment) {
                saveEnrollmentMarker(studentData, targetEnrollment);
                openEnrollmentStatusModalWithRecord(targetEnrollment);
                return;
            }

            const localEnrollments = JSON.parse(localStorage.getItem('enrollments')) || [];
            const localStudentEnrollments = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, localEnrollments));
            const localCurrentYearEnrollment = getCurrentSchoolYearEnrollment(localStudentEnrollments);
            const localTargetEnrollment = localCurrentYearEnrollment || localStudentEnrollments[0] || null;
            if (localTargetEnrollment) {
                saveEnrollmentMarker(studentData, localTargetEnrollment);
                openEnrollmentStatusModalWithRecord(localTargetEnrollment);
                return;
            }

            console.warn('No enrollment found');
            showToast('No enrollment record found yet.', 'error');
        })
        .catch(err => {
            console.error('Error fetching enrollment:', err);
            const enrollments = JSON.parse(localStorage.getItem('enrollments')) || [];
            const studentEnrollments = sortEnrollmentsByRecent(filterEnrollmentsForStudent(studentData, enrollments));
            const currentYearEnrollment = getCurrentSchoolYearEnrollment(studentEnrollments);
            const targetEnrollment = currentYearEnrollment || studentEnrollments[0] || null;
            if (targetEnrollment) {
                saveEnrollmentMarker(studentData, targetEnrollment);
                openEnrollmentStatusModalWithRecord(targetEnrollment);
            } else {
                console.warn('No enrollment found in localStorage');
                showToast('No enrollment record found yet.', 'error');
            }
        });
}

function populateEnrollmentStatusModal(enrollment) {
    if (!enrollment) return;

    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
    const enrollData = enrollment.enrollmentData || {};

    // Helper functions
    const formatValue = (val) => (val ? String(val).toUpperCase().replace(/([a-z])([A-Z])/g, '$1 $2') : '--');
    const formatAddress = (sitio, barangay, municipality, province, zipcode) => {
        let addr = [];
        if (sitio) addr.push(sitio);
        if (barangay) addr.push(barangay);
        if (municipality) addr.push(municipality);
        if (province) addr.push(province);
        if (zipcode) addr.push(zipcode);
        return addr.length > 0 ? addr.join(', ').toUpperCase() : '--';
    };

    // Set status badge
    const status = (enrollment.status || 'Pending').toUpperCase();
    const statusBadge = document.getElementById('statusBadgeLarge');
    if (statusBadge) {
        statusBadge.textContent = status;
        statusBadge.className = 'status-badge-large';
        if (status === 'PENDING') statusBadge.classList.add('pending');
        else if (status === 'APPROVED') statusBadge.classList.add('approved');
        else if (status === 'REJECTED') statusBadge.classList.add('rejected');
    }

    // Set enrollment date
    const enrollDate = document.getElementById('enrollmentDateDisplay');
    if (enrollDate) {
        // Check multiple possible field names
        const dateField = enrollment.enrollment_date || enrollment.enrollmentDate || enrollment.created_at;
        if (dateField) {
            const date = new Date(dateField);
            enrollDate.textContent = 'Submitted on ' + date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        } else {
            enrollDate.textContent = 'Submitted on --';
        }
    }

    // Set School Year based on selected enrollment record first, then active school year.
    (function setActiveSchoolYear() {
        const el = document.getElementById('enrollmentSchoolYear');
        if (!el) return;

        const directLabel = resolveEnrollmentSchoolYearLabel(enrollment);
        if (directLabel && directLabel !== 'Unknown School Year') {
            el.textContent = directLabel.toString().toUpperCase();
            return;
        }

        // Try API first
        fetch(`${API_BASE}/api/school-years/active`)
            .then(res => res.json())
            .then(data => {
                if (data && (data.school_year || data.schoolYear)) {
                    el.textContent = (data.school_year || data.schoolYear).toString().toUpperCase();
                } else if (enrollment.schoolYear || enrollment.school_year) {
                    el.textContent = (enrollment.schoolYear || enrollment.school_year).toString().toUpperCase();
                } else {
                    el.textContent = '--';
                }
            })
            .catch(err => {
                // On error, use enrollment-provided value or fallback
                if (enrollment.schoolYear || enrollment.school_year) {
                    el.textContent = (enrollment.schoolYear || enrollment.school_year).toString().toUpperCase();
                } else {
                    el.textContent = '--';
                }
            });
    })();

    // === PERSONAL INFORMATION ===
    const cleanNamePart = (value) => {
        const text = String(value || '').trim();
        if (!text) return '';
        if (text === '-' || text === '--' || text === '–') return '';
        if (text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return '';
        return text;
    };
    const fullName = [
        cleanNamePart(enrollData.firstName),
        cleanNamePart(enrollData.middleName),
        cleanNamePart(enrollData.lastName),
        cleanNamePart(enrollData.extensionName)
    ].filter(Boolean).join(' ').trim().toUpperCase();
    document.getElementById('enrollmentFullName').textContent = fullName || '--';
    document.getElementById('enrollmentBirthdate').textContent = formatValue(enrollData.birthdate);
    document.getElementById('enrollmentSex').textContent = formatValue(enrollData.sex);
    document.getElementById('enrollmentPlaceOfBirth').textContent = formatValue(enrollData.placeOfBirth);
    document.getElementById('enrollmentMotherTongue').textContent = formatValue(enrollData.motherTongue === 'other' ? enrollData.motherTongueOtherText : enrollData.motherTongue);
    document.getElementById('enrollmentLRN').textContent = enrollData.lrn ? enrollData.lrn.toUpperCase() : 'NOT PROVIDED';

    // === ACADEMIC INFORMATION ===
    document.getElementById('enrollmentGradeLevel').textContent = enrollData.gradeLevel ? ('GRADE ' + enrollData.gradeLevel) : '--';
    document.getElementById('enrollmentTrack').textContent = formatValue(enrollData.track) || '--';
    document.getElementById('enrollmentSemester').textContent = formatValue(enrollData.semester) || '--';

    // Display Electives
    const electivesDisplay = document.getElementById('electivesDisplay');
    electivesDisplay.innerHTML = '';
    if (enrollData.gradeLevel === '11' || enrollData.gradeLevel === '12') {
        let electivesHTML = '';
        if (enrollData.track === 'academic' && enrollData.academicElectives && enrollData.academicElectives.length > 0) {
            electivesHTML += `<div class="info-item" style="grid-column: 1/-1;"><span class="info-label">ELECTIVES:</span><span class="info-value">${enrollData.academicElectives.map(e => e.toUpperCase()).join(', ')}</span></div>`;
        } else if (enrollData.track === 'techpro' && enrollData.techproElectives && enrollData.techproElectives.length > 0) {
            electivesHTML += `<div class="info-item" style="grid-column: 1/-1;"><span class="info-label">ELECTIVE:</span><span class="info-value">${enrollData.techproElectives.map(e => e.toUpperCase()).join(', ')}</span></div>`;
        } else if (enrollData.track === 'doorway') {
            if (enrollData.doorwayAcademic && enrollData.doorwayAcademic.length > 0) {
                electivesHTML += `<div class="info-item" style="grid-column: 1/-1;"><span class="info-label">ACADEMIC ELECTIVE:</span><span class="info-value">${enrollData.doorwayAcademic.map(e => e.toUpperCase()).join(', ')}</span></div>`;
            }
            if (enrollData.doorwayTechPro && enrollData.doorwayTechPro.length > 0) {
                electivesHTML += `<div class="info-item" style="grid-column: 1/-1;"><span class="info-label">TECH-PRO ELECTIVE:</span><span class="info-value">${enrollData.doorwayTechPro.map(e => e.toUpperCase()).join(', ')}</span></div>`;
            }
        }
        if (electivesHTML) {
            electivesDisplay.innerHTML = `<div class="info-grid">${electivesHTML}</div>`;
        }
    }

    // === ADDRESS INFORMATION ===
    const currentAddr = formatAddress(enrollData.currentSitio, enrollData.currentBarangay, enrollData.currentMunicipality, enrollData.currentProvince, enrollData.currentZipCode);
    document.getElementById('enrollmentCurrentAddress').textContent = currentAddr;

    const permanentAddr = formatAddress(enrollData.permanentSitio, enrollData.permanentBarangay, enrollData.permanentMunicipality, enrollData.permanentProvince, enrollData.permanentZipCode);
    document.getElementById('enrollmentPermanentAddress').textContent = permanentAddr;

    // === ADDITIONAL INFORMATION ===
    document.getElementById('enrollmentLearningModality').textContent = formatValue(enrollData.learningModality) || '--';
    document.getElementById('enrollmentIPStatus').textContent = formatValue(enrollData.isIP) === 'YES' ? `YES - ${formatValue(enrollData.ipGroup)}` : 'NO';
    document.getElementById('enrollment4PSStatus').textContent = enrollData.is4Ps === 'yes' ? `YES - ID: ${(enrollData.householdID || 'NOT PROVIDED').toUpperCase()}` : 'NO';
    document.getElementById('enrollmentPWDStatus').textContent = formatValue(enrollData.hasPWD) === 'YES' ? `YES - ${enrollData.disabilities && enrollData.disabilities.length > 0 ? enrollData.disabilities.map(d => formatValue(d)).join(', ') : 'NOT SPECIFIED'}` : 'NO';
    document.getElementById('enrollmentReturningStatus').textContent = formatValue(enrollData.returningLearner) === 'YES' ? `YES - Last Grade: ${enrollData.lastGradeLevel || 'N/A'}` : 'NO';

    // Additional details for returning learner
    const additionalDetails = document.getElementById('additionalDetailsDisplay');
    additionalDetails.innerHTML = '';
    if (enrollData.returningLearner === 'yes') {
        let detailsHTML = `<div class="info-grid" style="margin-top: 10px;">`;
        if (enrollData.lastSchoolYear) detailsHTML += `<div class="info-item"><span class="info-label">Last School Year:</span><span class="info-value">${enrollData.lastSchoolYear.toUpperCase()}</span></div>`;
        if (enrollData.lastSchoolAttended) detailsHTML += `<div class="info-item"><span class="info-label">Last School Attended:</span><span class="info-value">${enrollData.lastSchoolAttended.toUpperCase()}</span></div>`;
        detailsHTML += `</div>`;
        additionalDetails.innerHTML = detailsHTML;
    }

    // === DOCUMENTS ===
    const docsContainer = document.getElementById('enrollmentStatusDocuments');
    if (!docsContainer) return;
    docsContainer.innerHTML = '';
    const files = enrollment.enrollmentFiles || {};
    let hasDocuments = false;

    const resolveDocumentSource = (value) => {
        if (!value) return '';
        if (typeof value === 'string') {
            const raw = value.trim();
            if (!raw) return '';
            if (/^data:/i.test(raw)) return raw;
            if (/^https?:\/\//i.test(raw)) return raw;
            return '';
        }
        if (typeof value === 'object') {
            const candidates = [
                value.dataUrl,
                value.dataURL,
                value.url,
                value.src,
                value.preview,
                value.fileData,
                value.base64,
                value.content
            ];
            for (const candidate of candidates) {
                const resolved = resolveDocumentSource(candidate);
                if (resolved) return resolved;
            }
        }
        return '';
    };

    const appendDocumentTile = (labelText, sourceValue) => {
        const src = resolveDocumentSource(sourceValue);
        if (!src) return;

        hasDocuments = true;
        const tile = document.createElement('div');
        tile.className = 'document-tile';
        tile.title = 'Click to view document';
        tile.setAttribute('role', 'button');
        tile.setAttribute('tabindex', '0');
        tile.setAttribute('aria-label', `Open ${labelText}`);

        const img = document.createElement('img');
        img.src = src;
        img.alt = labelText;
        img.loading = 'lazy';

        const label = document.createElement('div');
        label.className = 'document-label';
        label.textContent = labelText;

        tile.appendChild(img);
        tile.appendChild(label);

        tile.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            openDashboardDocumentZoom(src);
        });

        tile.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openDashboardDocumentZoom(src);
            }
        });

        docsContainer.appendChild(tile);
    };

    const docLabels = {
        psaBirthCert: '📋 PSA Birth Certificate',
        reportCard: '📊 Report Card',
        studentImage: '📸 Student Photo'
    };

    Object.keys(docLabels).forEach((key) => {
        appendDocumentTile(docLabels[key], files[key]);
    });

    Object.keys(files).forEach((key) => {
        if (docLabels[key]) return;
        appendDocumentTile(`📎 ${key}`, files[key]);
    });

    if (!hasDocuments) {
        docsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999; padding: 30px 0;">No documents submitted</p>';
    }

    // === ADMIN REMARKS ===
    const remarksBox = document.getElementById('enrollmentAdminRemarks');
    if (remarksBox) {
        remarksBox.textContent = enrollment.remarks || 'No remarks at this time.';
    }

    // Populate enrollment summary
    populateEnrollmentSummary(enrollment);
}

// Populate the enrollment summary section
function populateEnrollmentSummary(enrollment) {
    if (!enrollment) return;

    const enrollData = enrollment.enrollmentData || {};
    const summaryContent = document.getElementById('enrollmentSummaryContent');
    if (!summaryContent) return;

    const summaryItems = [];

    // Full Name
    const fullName = `${enrollData.firstName || ''} ${enrollData.middleName || ''} ${enrollData.lastName || ''} ${enrollData.extensionName || ''}`.trim().toUpperCase();
    if (fullName) {
        summaryItems.push({
            label: '👤 Full Name',
            value: fullName
        });
    }

    // Grade Level and Track
    if (enrollData.gradeLevel) {
        let gradeInfo = `GRADE ${enrollData.gradeLevel}`;
        if (enrollData.track) {
            gradeInfo += ` - ${enrollData.track.toUpperCase()}`;
        }
        summaryItems.push({
            label: '🎓 Grade Level & Track',
            value: gradeInfo
        });
    }

    // Semester (for SHS)
    if ((enrollData.gradeLevel === '11' || enrollData.gradeLevel === '12') && enrollData.semester) {
        summaryItems.push({
            label: '📅 Semester',
            value: enrollData.semester.toUpperCase()
        });
    }

    // Electives (for SHS)
    if (enrollData.gradeLevel === '11' || enrollData.gradeLevel === '12') {
        let electives = [];
        if (enrollData.track === 'academic' && enrollData.academicElectives && enrollData.academicElectives.length > 0) {
            electives = enrollData.academicElectives;
        } else if (enrollData.track === 'techpro' && enrollData.techproElectives && enrollData.techproElectives.length > 0) {
            electives = enrollData.techproElectives;
        } else if (enrollData.track === 'doorway') {
            if (enrollData.doorwayAcademic && enrollData.doorwayAcademic.length > 0) {
                electives.push(...enrollData.doorwayAcademic);
            }
            if (enrollData.doorwayTechPro && enrollData.doorwayTechPro.length > 0) {
                electives.push(...enrollData.doorwayTechPro);
            }
        }
        if (electives.length > 0) {
            summaryItems.push({
                label: '✏️ Electives',
                value: electives.map(e => e.toUpperCase()).join(', ')
            });
        }
    }

    // Learning Modality
    if (enrollData.learningModality) {
        summaryItems.push({
            label: '🌐 Learning Modality',
            value: enrollData.learningModality.toUpperCase()
        });
    }

    // Current Address
    const currentAddrParts = [enrollData.currentBarangay, enrollData.currentMunicipality, enrollData.currentProvince].filter(x => x);
    if (currentAddrParts.length > 0) {
        summaryItems.push({
            label: '📍 Current Address',
            value: currentAddrParts.map(x => x.toUpperCase()).join(', ')
        });
    }

    // Enrollment Status
    const status = (enrollment.status || 'Pending').toUpperCase();
    summaryItems.push({
        label: '✅ Status',
        value: status,
        isStatus: true
    });

    // Render summary items
    summaryContent.innerHTML = summaryItems.map(item => {
        if (item.isStatus) {
            let statusClass = 'pending';
            if (status === 'APPROVED') statusClass = 'approved';
            else if (status === 'REJECTED') statusClass = 'rejected';
            return `<div>
                <div style="font-size: 11px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">${item.label}</div>
                <div style="font-weight: 700;">
                    <span class="status-badge-inline ${statusClass}">
                        ${item.value}
                    </span>
                </div>
            </div>`;
        }
        return `<div>
            <div style="font-size: 11px; color: #888; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">${item.label}</div>
            <div style="font-weight: 700; color: #1a1a1a; font-size: 15px;">${item.value}</div>
        </div>`;
    }).join('');
}

// Dashboard document zoom functionality
let dashboardZoomScale = 1;
let dashboardPanX = 0;
let dashboardPanY = 0;
let dashboardPanActive = false;
let dashboardPanStartX = 0;
let dashboardPanStartY = 0;
let dashboardPanOriginX = 0;
let dashboardPanOriginY = 0;

function applyDashboardZoomTransform() {
    const image = document.getElementById('dashboardZoomImage');
    if (!image) return;
    image.style.transform = `translate(${dashboardPanX}px, ${dashboardPanY}px) scale(${dashboardZoomScale})`;
    image.style.cursor = dashboardZoomScale > 1 ? 'grab' : 'default';
}

function setDashboardZoomPercentage() {
    const node = document.getElementById('dashboardZoomPercentage');
    if (!node) return;
    node.textContent = Math.round(dashboardZoomScale * 100) + '%';
}

function beginDashboardPan(clientX, clientY) {
    if (dashboardZoomScale <= 1) return;
    const image = document.getElementById('dashboardZoomImage');
    if (!image) return;

    dashboardPanActive = true;
    dashboardPanStartX = Number(clientX) || 0;
    dashboardPanStartY = Number(clientY) || 0;
    dashboardPanOriginX = dashboardPanX;
    dashboardPanOriginY = dashboardPanY;
    image.classList.add('dragging');
}

function moveDashboardPan(clientX, clientY) {
    if (!dashboardPanActive) return;

    const deltaX = (Number(clientX) || 0) - dashboardPanStartX;
    const deltaY = (Number(clientY) || 0) - dashboardPanStartY;
    dashboardPanX = dashboardPanOriginX + deltaX;
    dashboardPanY = dashboardPanOriginY + deltaY;
    applyDashboardZoomTransform();
}

function endDashboardPan() {
    if (!dashboardPanActive) return;
    dashboardPanActive = false;
    const image = document.getElementById('dashboardZoomImage');
    if (image) image.classList.remove('dragging');
}

function openDashboardDocumentZoom(src) {
    const modal = document.getElementById('dashboardDocumentZoomModal');
    const img = document.getElementById('dashboardZoomImage');
    if (!modal || !img) return;
    if (!src || typeof src !== 'string') {
        showToast('Document preview is unavailable for this file.', 'error', 2600);
        return;
    }
    img.src = src;
    dashboardZoomScale = 1;
    dashboardPanX = 0;
    dashboardPanY = 0;
    applyDashboardZoomTransform();
    setDashboardZoomPercentage();
    modal.classList.add('active');
    modal.style.display = 'flex';
}

function closeDashboardDocumentZoom() {
    const modal = document.getElementById('dashboardDocumentZoomModal');
    if (!modal) return;
    endDashboardPan();
    modal.classList.remove('active');
    modal.style.display = 'none';
}

function closeEnrollmentStatusModal() {
    const modal = document.getElementById('enrollmentStatusModal');
    if (!modal) return;
    closeDashboardDocumentZoom();
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function dashboardZoomIn() {
    dashboardZoomScale = Math.min(dashboardZoomScale + 0.25, 5);
    applyDashboardZoomTransform();
    setDashboardZoomPercentage();
}

function dashboardZoomOut() {
    dashboardZoomScale = Math.max(dashboardZoomScale - 0.25, 0.25);
    if (dashboardZoomScale <= 1) {
        dashboardPanX = 0;
        dashboardPanY = 0;
    }
    applyDashboardZoomTransform();
    setDashboardZoomPercentage();
}

function dashboardZoomReset() {
    dashboardZoomScale = 1;
    dashboardPanX = 0;
    dashboardPanY = 0;
    applyDashboardZoomTransform();
    setDashboardZoomPercentage();
}

// wire modal controls on load
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal').forEach((modalEl) => {
        modalEl.classList.remove('active');
        modalEl.setAttribute('aria-hidden', 'true');
    });

    const zoomModalOnLoad = document.getElementById('dashboardDocumentZoomModal');
    if (zoomModalOnLoad) {
        zoomModalOnLoad.classList.remove('active');
        zoomModalOnLoad.style.display = 'none';
    }

    const closeBtn = document.getElementById('closeEnrollmentStatus');
    if (closeBtn) closeBtn.addEventListener('click', closeEnrollmentStatusModal);

    const closeFooterBtn = document.getElementById('closeEnrollmentBtn');
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeEnrollmentStatusModal);

    const dashClose = document.getElementById('dashboardZoomClose');
    if (dashClose) dashClose.addEventListener('click', closeDashboardDocumentZoom);
    const inBtn = document.getElementById('dashboardZoomIn');
    const outBtn = document.getElementById('dashboardZoomOut');
    const resetBtn = document.getElementById('dashboardZoomReset');
    if (inBtn) inBtn.addEventListener('click', dashboardZoomIn);
    if (outBtn) outBtn.addEventListener('click', dashboardZoomOut);
    if (resetBtn) resetBtn.addEventListener('click', dashboardZoomReset);

    if (zoomModalOnLoad && !zoomModalOnLoad.dataset.overlayBound) {
        zoomModalOnLoad.dataset.overlayBound = 'true';
        zoomModalOnLoad.addEventListener('click', (event) => {
            if (event.target === zoomModalOnLoad) {
                closeDashboardDocumentZoom();
            }
        });
    }

    const zoomImage = document.getElementById('dashboardZoomImage');
    if (zoomImage && !zoomImage.dataset.panBound) {
        zoomImage.dataset.panBound = 'true';

        zoomImage.addEventListener('mousedown', (event) => {
            event.preventDefault();
            beginDashboardPan(event.clientX, event.clientY);
        });

        zoomImage.addEventListener('touchstart', (event) => {
            if (!event.touches || event.touches.length !== 1) return;
            const touch = event.touches[0];
            beginDashboardPan(touch.clientX, touch.clientY);
            if (dashboardZoomScale > 1) event.preventDefault();
        }, { passive: false });

        document.addEventListener('mousemove', (event) => {
            if (!dashboardPanActive) return;
            moveDashboardPan(event.clientX, event.clientY);
        });

        document.addEventListener('mouseup', () => {
            endDashboardPan();
        });

        document.addEventListener('touchmove', (event) => {
            if (!dashboardPanActive || !event.touches || event.touches.length !== 1) return;
            const touch = event.touches[0];
            moveDashboardPan(touch.clientX, touch.clientY);
            event.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', () => {
            endDashboardPan();
        });

        document.addEventListener('touchcancel', () => {
            endDashboardPan();
        });
    }
    
    // close modals on escape
    document.addEventListener('keydown', (e) => { 
        if (e.key === 'Escape') {
            closeDashboardDocumentZoom();
            closeEnrollmentStatusModal();
        }
    });

    // close modal when clicking outside
    const statusModal = document.getElementById('enrollmentStatusModal');
    if (statusModal) {
        statusModal.addEventListener('click', (e) => {
            if (e.target === statusModal) {
                closeEnrollmentStatusModal();
            }
        });
    }
    
    // Update character count for guidance message
    function updateCharacterCount() {
        const textarea = document.getElementById('guidanceMessage');
        const countEl = document.getElementById('charCount');
        if (textarea && countEl) {
            const count = textarea.value.length;
            countEl.textContent = Math.min(count, 500);
            
            // Prevent exceeding 500 characters
            if (count > 500) {
                textarea.value = textarea.value.substring(0, 500);
            }
        }
    }
    
    // Request Guidance helper function for form submission
    async function submitGuidanceRequest(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('submitGuidanceBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.origText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        }

        const studentData = JSON.parse(localStorage.getItem('studentData') || 'null');
        if (!studentData) {
            showToast('You must be logged in to submit a guidance request.', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.origText || '<i class="fas fa-paper-plane"></i> Send Request';
            }
            return;
        }

        const reasonEl = document.getElementById('guidanceReason');
        const messageEl = document.getElementById('guidanceMessage');
        const reason = reasonEl ? reasonEl.value.trim() : '';
        const message = messageEl ? messageEl.value.trim() : '';

        // Basic validation
        if (!reason) {
            showToast('Please select a reason for your request.', 'error');
            if (submitBtn) { 
                submitBtn.disabled = false; 
                submitBtn.innerHTML = submitBtn.dataset.origText || '<i class="fas fa-paper-plane"></i> Send Request'; 
            }
            return;
        }
        if (!message || message.length < 10) {
            showToast('Please provide more details (at least 10 characters).', 'error');
            if (submitBtn) { 
                submitBtn.disabled = false; 
                submitBtn.innerHTML = submitBtn.dataset.origText || '<i class="fas fa-paper-plane"></i> Send Request'; 
            }
            return;
        }

        const payload = {
            student_id: studentData.id,
            reason,
            message,
            preferred_date: document.getElementById('guidancePreferredDate').value || null,
            preferred_time: document.getElementById('guidancePreferredTime').value || null
        };

        try {
            const res = await fetch(API_BASE + '/api/guidance/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast('✅ Your guidance request was submitted! A counselor will contact you soon.', 'success');
                const form = document.getElementById('requestGuidanceForm');
                if (form) form.reset();
                // Update character count
                updateCharacterCount();
                // optional: navigate back to dashboard
                const dashboardLink = document.querySelector('[data-section="dashboard"]');
                if (dashboardLink) setTimeout(() => dashboardLink.click(), 1200);
            } else {
                const errorText = await res.text();
                // fallback: queue locally
                queueGuidanceRequest(payload);
                showToast(errorText || '⚠️ Unable to submit now — request queued locally.', 'error');
            }
        } catch (err) {
            console.error('Guidance submit error', err);
            queueGuidanceRequest(payload);
            showToast('⚠️ Network error — request saved locally and will be retried.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = submitBtn.dataset.origText || 'Submit Request';
            }
        }
    }

    // queue guidance request in localStorage when API fails
    function queueGuidanceRequest(payload) {
        try {
            const queue = JSON.parse(localStorage.getItem('pendingGuidanceRequests') || '[]');
            queue.push({ payload, created_at: new Date().toISOString() });
            localStorage.setItem('pendingGuidanceRequests', JSON.stringify(queue));
        } catch (e) { console.warn('Could not queue guidance request', e); }
    }

    // Setup Request Guidance Form
    const requestGuidanceForm = document.getElementById('requestGuidanceForm');
    if (requestGuidanceForm) {
        requestGuidanceForm.addEventListener('submit', submitGuidanceRequest);
        
        // Setup character counter for guidance message
        const guidanceMessage = document.getElementById('guidanceMessage');
        if (guidanceMessage) {
            guidanceMessage.addEventListener('input', updateCharacterCount);
        }
    }
    
    // Add cancel button listener for guidance form
    const cancelGuidanceBtn = document.getElementById('cancelGuidanceBtn');
    if (cancelGuidanceBtn) {
        cancelGuidanceBtn.addEventListener('click', () => {
            const form = document.getElementById('requestGuidanceForm');
            if (form) form.reset();
            updateCharacterCount();
            // Navigate back to dashboard
            const dashboardLink = document.querySelector('[data-section="dashboard"]');
            if (dashboardLink) dashboardLink.click();
        });
    }

    // Profile Edit Event Listeners
    const closeEditBtn = document.getElementById('closeEditBtn');
    if (closeEditBtn) {
        closeEditBtn.addEventListener('click', closeProfileEditMode);
    }

    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeProfileEditMode);
    }

    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', saveProfileChanges);
    }

    // Photo Upload Event Listeners
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    if (changePhotoBtn) {
        changePhotoBtn.addEventListener('click', openPhotoUploadModal);
    }

    const photoUploadArea = document.getElementById('photoUploadArea');
    if (photoUploadArea) {
        photoUploadArea.addEventListener('click', triggerPhotoInput);
        photoUploadArea.addEventListener('dragover', handlePhotoDragOver);
        photoUploadArea.addEventListener('dragleave', handlePhotoDragLeave);
        photoUploadArea.addEventListener('drop', handlePhotoDrop);
    }

    const photoFileInput = document.getElementById('photoFileInput');
    if (photoFileInput) {
        photoFileInput.addEventListener('change', handlePhotoSelect);
    }

    const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
    if (uploadPhotoBtn) {
        uploadPhotoBtn.addEventListener('click', uploadProfilePhoto);
    }

    const removePhotoBtn = document.getElementById('removePhotoBtn');
    if (removePhotoBtn) {
        removePhotoBtn.addEventListener('click', removeProfilePhoto);
    }

    const closePhotoModalBtn = document.getElementById('closePhotoModalBtn');
    if (closePhotoModalBtn) {
        closePhotoModalBtn.addEventListener('click', closePhotoUploadModal);
    }

    const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');
    if (cancelPhotoBtn) {
        cancelPhotoBtn.addEventListener('click', closePhotoUploadModal);
    }

    const photoUploadModal = document.getElementById('photoUploadModal');
    if (photoUploadModal) {
        photoUploadModal.addEventListener('click', (e) => {
            if (e.target === photoUploadModal) {
                closePhotoUploadModal();
            }
        });
    }

    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const requestGuidanceModal = document.getElementById('requestGuidanceModal');
            if (requestGuidanceModal && requestGuidanceModal.classList.contains('show') && typeof closeRequestGuidanceModal === 'function') {
                closeRequestGuidanceModal();
            }
            closePhotoUploadModal();
            closeProfileEditMode();
        }
    });
});

// ========== Profile Edit Functions ==========
function initializeProfileEdit() {
    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
    
    // Safely populate edit form with current data (check if elements exist)
    const editFullNameEl = document.getElementById('editFullName');
    if (editFullNameEl) {
        editFullNameEl.value = (studentData.firstName || '') + ' ' + (studentData.lastName || '');
    }
    
    const editEmailEl = document.getElementById('editEmail');
    if (editEmailEl) {
        editEmailEl.value = studentData.email || '';
    }
    
    const editPhoneEl = document.getElementById('editPhone');
    if (editPhoneEl) {
        editPhoneEl.value = studentData.phone || '';
    }
    
    const editAddressEl = document.getElementById('editAddress');
    if (editAddressEl) {
        editAddressEl.value = studentData.address || '';
    }
    
    const editBirthdateEl = document.getElementById('editBirthdate');
    if (editBirthdateEl) {
        editBirthdateEl.value = studentData.birthdate || '';
    }
    
    const editGenderEl = document.getElementById('editGender');
    if (editGenderEl) {
        editGenderEl.value = studentData.gender || '';
    }
    
    const editPlaceOfBirthEl = document.getElementById('editPlaceOfBirth');
    if (editPlaceOfBirthEl) {
        editPlaceOfBirthEl.value = studentData.placeOfBirth || '';
    }
}

function openProfileEditMode() {
    initializeProfileEdit();
    document.getElementById('profileViewMode').style.display = 'none';
    document.getElementById('profileEditMode').style.display = 'block';
}

function closeProfileEditMode() {
    document.getElementById('profileEditMode').style.display = 'none';
    document.getElementById('profileViewMode').style.display = 'block';
}

async function saveProfileChanges(e) {
    e.preventDefault();
    
    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
    
    // Get form values safely
    const fullNameEl = document.getElementById('editFullName');
    const emailEl = document.getElementById('editEmail');
    const phoneEl = document.getElementById('editPhone');
    const addressEl = document.getElementById('editAddress');
    const birthdateEl = document.getElementById('editBirthdate');
    const genderEl = document.getElementById('editGender');
    const placeOfBirthEl = document.getElementById('editPlaceOfBirth');
    
    if (!fullNameEl || !emailEl) {
        showToast('Form elements not found. Please refresh the page.', 'error');
        console.error('Form elements missing in DOM');
        return;
    }
    
    const fullName = fullNameEl.value.trim();
    const email = emailEl.value.trim();
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const address = addressEl ? addressEl.value.trim() : '';
    const birthdate = birthdateEl ? birthdateEl.value : '';
    const gender = genderEl ? genderEl.value : '';
    const placeOfBirth = placeOfBirthEl ? placeOfBirthEl.value.trim() : '';
    
    // Validation
    if (!fullName || !email) {
        showToast('Full Name and Email are required.', 'error');
        return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    // Phone validation (optional but if provided, should be valid)
    if (phone && !/^[\d\s\-\+\(\)]+$/.test(phone)) {
        showToast('Please enter a valid phone number.', 'error');
        return;
    }

    // Split full name into first and last name
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Prepare update payload
    const updateData = {
        firstName,
        lastName,
        email,
        phone: phone || null,
        address: address || null,
        birthdate: birthdate || null,
        gender: gender || null,
        placeOfBirth: placeOfBirth || null
    };

    try {
        const response = await fetch(`${API_BASE}/api/students/${studentData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (response.ok) {
            // Update localStorage with new data
            const updatedData = { ...studentData, ...updateData };
            localStorage.setItem('studentData', JSON.stringify(updatedData));
            
            // Close edit mode first
            closeProfileEditMode();
            
            // Refresh display with updated data
            loadStudentData();
            
            showToast('Profile updated successfully!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            showToast('Failed to update profile: ' + (errorData.message || 'Please try again.'), 'error');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('An error occurred while saving your profile. Please check your connection and try again.', 'error');
    }
}

// ========== Photo Upload Functions ==========
let selectedPhotoFile = null;

function openPhotoUploadModal() {
    const modal = document.getElementById('photoUploadModal');
    modal.style.display = 'flex';
    modal.classList.add('active');
    resetPhotoUploadModal();
}

function closePhotoUploadModal() {
    const modal = document.getElementById('photoUploadModal');
    modal.classList.remove('active');
    modal.style.display = 'none';
    resetPhotoUploadModal();
}

function resetPhotoUploadModal() {
    selectedPhotoFile = null;
    document.getElementById('photoFileInput').value = '';
    document.getElementById('photoUploadArea').style.display = 'flex';
    document.getElementById('photoPreviewArea').style.display = 'none';
    document.getElementById('uploadPhotoBtn').style.display = 'none';
    document.getElementById('removePhotoBtn').style.display = 'none';
}

function triggerPhotoInput() {
    document.getElementById('photoFileInput').click();
}

function handlePhotoDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('photoUploadArea').style.borderColor = 'var(--primary-dark)';
    document.getElementById('photoUploadArea').style.backgroundColor = 'rgba(74, 108, 247, 0.15)';
}

function handlePhotoDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('photoUploadArea').style.borderColor = 'var(--primary-color)';
    document.getElementById('photoUploadArea').style.backgroundColor = 'linear-gradient(135deg, var(--primary-light) 0%, rgba(74, 108, 247, 0.05) 100%)';
}

function handlePhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handlePhotoFile(files[0]);
    }
}

function handlePhotoSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handlePhotoFile(files[0]);
    }
}

function handlePhotoFile(file) {
    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];

    if (!validTypes.includes(file.type)) {
        showToast('Please upload a JPG, PNG, or GIF image.', 'error');
        return;
    }

    if (file.size > maxSize) {
        showToast('Image size must be less than 5MB.', 'error');
        return;
    }

    selectedPhotoFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('photoPreview').src = e.target.result;
        document.getElementById('photoFileName').textContent = file.name;
        document.getElementById('photoUploadArea').style.display = 'none';
        document.getElementById('photoPreviewArea').style.display = 'block';
        document.getElementById('uploadPhotoBtn').style.display = 'inline-block';
        document.getElementById('removePhotoBtn').style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
}

function getStudentPhotoStorageKey(studentId) {
    return `student_profile_photo_${String(studentId || 'guest')}`;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event && event.target ? String(event.target.result || '') : '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function applyPhotoToUi(photoUrl, studentData) {
    const photoImg = document.getElementById('profilePhotoImg');
    if (!photoImg) return;
    if (photoUrl) {
        photoImg.src = photoUrl;
    } else {
        photoImg.src = generateDefaultAvatar(studentData.firstName, studentData.lastName);
    }
}

function savePhotoToLocalStorage(studentData, photoUrl) {
    const studentId = studentData && studentData.id ? studentData.id : 'guest';
    const storageKey = getStudentPhotoStorageKey(studentId);
    if (photoUrl) {
        localStorage.setItem(storageKey, photoUrl);
    } else {
        localStorage.removeItem(storageKey);
    }

    const updatedData = { ...studentData, photoURL: photoUrl || null };
    localStorage.setItem('studentData', JSON.stringify(updatedData));
    return updatedData;
}

async function uploadProfilePhoto() {
    if (!selectedPhotoFile) return;

    // Show loading state
    const uploadBtn = document.getElementById('uploadPhotoBtn');
    if (uploadBtn) uploadBtn.disabled = true;

    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};
    const formData = new FormData();
    formData.append('file', selectedPhotoFile);
    formData.append('student_id', studentData.id);

    try {
        const response = await fetch(`${API_BASE}/api/students/${studentData.id}/photo`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            const resolvedPhotoUrl = String(result.photoURL || result.photoUrl || '').trim();
            if (!resolvedPhotoUrl) {
                throw new Error('Photo URL missing from upload response');
            }
            // Update profile photo
            applyPhotoToUi(resolvedPhotoUrl, studentData);
            
            // Update localStorage
            savePhotoToLocalStorage(studentData, resolvedPhotoUrl);
            
            closePhotoUploadModal();
            showToast('Profile photo updated successfully!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            const shouldFallbackLocal = [404, 405, 501].includes(response.status) || !response.status;
            if (!shouldFallbackLocal) {
                showToast('Failed to upload photo: ' + (errorData.message || 'Please try again.'), 'error');
                return;
            }

            const localPhotoUrl = await fileToDataUrl(selectedPhotoFile);
            if (!localPhotoUrl) throw new Error('Could not process image file');
            savePhotoToLocalStorage(studentData, localPhotoUrl);
            applyPhotoToUi(localPhotoUrl, studentData);
            closePhotoUploadModal();
            showToast('Profile photo saved locally (server upload unavailable).', 'success', 3600);
        }
    } catch (error) {
        try {
            const localPhotoUrl = await fileToDataUrl(selectedPhotoFile);
            if (!localPhotoUrl) throw error;
            savePhotoToLocalStorage(studentData, localPhotoUrl);
            applyPhotoToUi(localPhotoUrl, studentData);
            closePhotoUploadModal();
            showToast('Profile photo saved locally.', 'success', 3200);
        } catch (fallbackError) {
            console.error('Error uploading photo:', error, fallbackError);
            showToast('Failed to upload photo. Please try a smaller image or check your connection.', 'error');
        }
    } finally {
        if (uploadBtn) uploadBtn.disabled = false;
    }
}

async function removeProfilePhoto() {
    if (!confirm('Are you sure you want to remove your profile photo?')) {
        return;
    }

    const studentData = JSON.parse(localStorage.getItem('studentData')) || {};

    try {
        const response = await fetch(`${API_BASE}/api/students/${studentData.id}/photo`, {
            method: 'DELETE'
        });

        if (!response.ok && ![404, 405, 501].includes(response.status)) {
            const errorData = await response.json().catch(() => ({}));
            showToast('Failed to remove photo: ' + (errorData.message || 'Please try again.'), 'error');
            return;
        }

        savePhotoToLocalStorage(studentData, null);
        applyPhotoToUi(null, studentData);
        closePhotoUploadModal();
        showToast('Profile photo removed successfully!', 'success');
    } catch (error) {
        console.warn('Photo remove API unavailable, applying local removal only:', error);
        savePhotoToLocalStorage(studentData, null);
        applyPhotoToUi(null, studentData);
        closePhotoUploadModal();
        showToast('Profile photo removed locally.', 'success');
    }
}

async function refreshStudentDashboardForActiveSchoolYearChange() {
    try {
        if (typeof loadActiveSchoolYear === 'function') {
            await loadActiveSchoolYear();
        }
        if (typeof loadAndDisplayActiveSchoolYear === 'function') {
            await loadAndDisplayActiveSchoolYear();
        }
        if (typeof setupEnrollmentStatusButton === 'function') {
            await setupEnrollmentStatusButton();
        }
        if (typeof loadMyEnrollmentsSection === 'function') {
            await loadMyEnrollmentsSection();
        }
        if (typeof fetchAndDisplayStudentData === 'function') {
            await fetchAndDisplayStudentData();
        }
    } catch (err) {
        console.warn('[Student Dashboard] Active school year refresh failed:', err);
    }
}

window.addEventListener('dashboard:school-year-changed', () => {
    refreshStudentDashboardForActiveSchoolYearChange();
});

window.addEventListener('storage', (event) => {
    if (!event || !event.key) return;
    if (event.key === 'activeSchoolYear' || event.key === 'activeSchoolYearChangedAt') {
        refreshStudentDashboardForActiveSchoolYearChange();
    }
});

