/**
 * Conditional Form Behaviors for Enrollment Modal
 * Handles all conditional field visibility and interactions
 */

function setupEnrollmentModalConditionals() {
    // LRN visibility toggle
    setupLRNToggle();
    
    // Age auto-calculation from birthdate
    setupBirthdateAgeCalculation();
    
    // Mother Tongue "Other" field
    setupMotherTongueToggle();
    
    // IP (Indigenous People) conditionals
    setupIPConditionals();
    
    // 4Ps conditionals
    setup4PsConditionals();
    
    // Disability conditionals
    setupDisabilityConditionals();
    
    // Returning Learner/Transferee conditionals
    setupReturningLearnerConditionals();
    
    // Grade level and track-based electives
    setupGradeLevelTrackElectives();
    
    // Address cascading and "Same as Current" sync
    setupAddressConditionals();
}

// ============================================
// LRN Visibility Toggle
// ============================================
function setupLRNToggle() {
    const yesRadio = document.querySelector('input[name="hasLRN"][value="yes"]');
    const noRadio = document.querySelector('input[name="hasLRN"][value="no"]');
    const lrnContainer = document.getElementById('lrnField');
    const lrnInput = document.getElementById('lrnNumber');

    if (yesRadio && noRadio && lrnContainer) {
        function updateLRNVisibility() {
            if (yesRadio.checked) {
                lrnContainer.classList.remove('hidden');
                lrnInput.required = true;
            } else {
                lrnContainer.classList.add('hidden');
                lrnInput.required = false;
                lrnInput.value = '';
            }
        }
        
        yesRadio.addEventListener('change', updateLRNVisibility);
        noRadio.addEventListener('change', updateLRNVisibility);
        updateLRNVisibility(); // initial state
    }
}

// ============================================
// Birthdate to Age Auto-Calculation
// ============================================
function setupBirthdateAgeCalculation() {
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
}

// ============================================
// Mother Tongue "Other" Field Toggle
// ============================================
function setupMotherTongueToggle() {
    const motherTongueSelect = document.querySelector('select[name="motherTongue"]');
    const motherTongueOtherContainer = document.getElementById('motherTongueOther');
    const motherTongueOtherInput = document.getElementById('motherTongueOtherText');

    if (motherTongueSelect && motherTongueOtherContainer && motherTongueOtherInput) {
        function updateMotherTongueOther() {
            if (motherTongueSelect.value === 'other') {
                motherTongueOtherContainer.classList.remove('hidden');
                motherTongueOtherInput.required = true;
            } else {
                motherTongueOtherContainer.classList.add('hidden');
                motherTongueOtherInput.required = false;
                motherTongueOtherInput.value = '';
            }
        }
        
        motherTongueSelect.addEventListener('change', updateMotherTongueOther);
        updateMotherTongueOther(); // initial state
    }
}

// ============================================
// IP (Indigenous People) Conditionals
// ============================================
function setupIPConditionals() {
    const yesRadio = document.querySelector('input[name="isIP"][value="yes"]');
    const noRadio = document.querySelector('input[name="isIP"][value="no"]');
    const ipFieldsContainer = document.getElementById('ipFields');
    const ipGroupSelect = document.querySelector('select[name="ipGroup"]');
    const ipOtherFieldContainer = document.getElementById('ipOtherField');
    const ipOtherInput = document.getElementById('ipOtherText');

    if (yesRadio && noRadio && ipFieldsContainer) {
        function updateIPVisibility() {
            if (yesRadio.checked) {
                ipFieldsContainer.classList.remove('hidden');
                ipGroupSelect.required = true;
                updateIPOtherVisibility();
            } else {
                ipFieldsContainer.classList.add('hidden');
                ipGroupSelect.required = false;
                ipGroupSelect.value = '';
                if (ipOtherFieldContainer) ipOtherFieldContainer.classList.add('hidden');
                if (ipOtherInput) ipOtherInput.value = '';
            }
        }
        
        function updateIPOtherVisibility() {
            if (ipGroupSelect && ipOtherFieldContainer && ipOtherInput) {
                if (ipGroupSelect.value === 'other') {
                    ipOtherFieldContainer.classList.remove('hidden');
                    ipOtherInput.required = true;
                } else {
                    ipOtherFieldContainer.classList.add('hidden');
                    ipOtherInput.required = false;
                    ipOtherInput.value = '';
                }
            }
        }
        
        yesRadio.addEventListener('change', updateIPVisibility);
        noRadio.addEventListener('change', updateIPVisibility);
        if (ipGroupSelect) ipGroupSelect.addEventListener('change', updateIPOtherVisibility);
        updateIPVisibility(); // initial state
    }
}

// ============================================
// 4Ps Conditionals
// ============================================
function setup4PsConditionals() {
    const yesRadio = document.querySelector('input[name="is4Ps"][value="yes"]');
    const noRadio = document.querySelector('input[name="is4Ps"][value="no"]');
    const fpsFieldsContainer = document.getElementById('fpsFields');
    const householdIdInput = document.getElementById('householdID');

    if (yesRadio && noRadio && fpsFieldsContainer) {
        function update4PsVisibility() {
            if (yesRadio.checked) {
                fpsFieldsContainer.classList.remove('hidden');
                if (householdIdInput) householdIdInput.required = true;
            } else {
                fpsFieldsContainer.classList.add('hidden');
                if (householdIdInput) {
                    householdIdInput.required = false;
                    householdIdInput.value = '';
                }
            }
        }
        
        yesRadio.addEventListener('change', update4PsVisibility);
        noRadio.addEventListener('change', update4PsVisibility);
        update4PsVisibility(); // initial state
    }
}

// ============================================
// Disability Conditionals
// ============================================
function setupDisabilityConditionals() {
    const yesRadio = document.querySelector('input[name="hasPWD"][value="yes"]');
    const noRadio = document.querySelector('input[name="hasPWD"][value="no"]');
    const disabilityFieldsContainer = document.getElementById('disabilityFields');

    if (yesRadio && noRadio && disabilityFieldsContainer) {
        function updateDisabilityVisibility() {
            if (yesRadio.checked) {
                disabilityFieldsContainer.classList.remove('hidden');
            } else {
                disabilityFieldsContainer.classList.add('hidden');
            }
        }
        
        yesRadio.addEventListener('change', updateDisabilityVisibility);
        noRadio.addEventListener('change', updateDisabilityVisibility);
        updateDisabilityVisibility(); // initial state
    }
}

// ============================================
// Returning Learner/Transferee Conditionals
// ============================================
function setupReturningLearnerConditionals() {
    const yesRadio = document.querySelector('input[name="returningLearner"][value="yes"]');
    const noRadio = document.querySelector('input[name="returningLearner"][value="no"]');
    const returningLearnerFieldsContainer = document.getElementById('returningLearnerFields');

    if (yesRadio && noRadio && returningLearnerFieldsContainer) {
        function updateReturningLearnerVisibility() {
            if (yesRadio.checked) {
                returningLearnerFieldsContainer.classList.remove('hidden');
            } else {
                returningLearnerFieldsContainer.classList.add('hidden');
            }
        }
        
        yesRadio.addEventListener('change', updateReturningLearnerVisibility);
        noRadio.addEventListener('change', updateReturningLearnerVisibility);
        updateReturningLearnerVisibility(); // initial state
    }
}

// ============================================
// Grade Level and Track-Based Electives
// ============================================
function setupGradeLevelTrackElectives() {
    const gradeLevelSelect = document.querySelector('select[name="gradeLevel"]');
    const semesterContainer = document.getElementById('semesterContainer');
    const trackContainer = document.getElementById('trackContainer');
    const trackSelect = document.querySelector('select[name="track"]');
    const electivesContainer = document.getElementById('electivesContainer');

    if (gradeLevelSelect) {
        function updateGradeLevelFields() {
            const grade = gradeLevelSelect.value;
            
            // Show semester/track only for grades 11-12
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
        updateGradeLevelFields(); // initial state
    }

    // Track-based electives display
    if (trackSelect) {
        function updateElectivesByTrack() {
            const track = trackSelect.value;
            
            if (!electivesContainer) return;
            
            // Get checkbox containers
            const academicElectives = document.querySelectorAll('input[name="electives"][data-type="academic"]');
            const techProElectives = document.querySelectorAll('input[name="electives"][data-type="techpro"]');
            
            // Hide all first
            academicElectives.forEach(el => {
                const container = el.closest('.elective-item');
                if (container) container.style.display = 'none';
            });
            techProElectives.forEach(el => {
                const container = el.closest('.elective-item');
                if (container) container.style.display = 'none';
            });
            
            if (track === 'Academic') {
                // Show only Academic electives, max 2
                academicElectives.forEach(el => {
                    const container = el.closest('.elective-item');
                    if (container) container.style.display = 'block';
                });
                setupElectiveMaxSelection('academic', 2);
                electivesContainer.style.display = 'block';
            } else if (track === 'TechPro' || track === 'Tech-Pro') {
                // Show only Tech-Pro electives, max 1
                techProElectives.forEach(el => {
                    const container = el.closest('.elective-item');
                    if (container) container.style.display = 'block';
                });
                setupElectiveMaxSelection('techpro', 1);
                electivesContainer.style.display = 'block';
            } else if (track === 'Doorway') {
                // Show both, max 1 from each
                academicElectives.forEach(el => {
                    const container = el.closest('.elective-item');
                    if (container) container.style.display = 'block';
                });
                techProElectives.forEach(el => {
                    const container = el.closest('.elective-item');
                    if (container) container.style.display = 'block';
                });
                setupElectiveMaxSelection('doorway', null); // custom logic for doorway
                electivesContainer.style.display = 'block';
            } else {
                electivesContainer.style.display = 'none';
            }
        }
        
        trackSelect.addEventListener('change', updateElectivesByTrack);
        updateElectivesByTrack(); // initial state
    }
}

function setupElectiveMaxSelection(track, maxCount) {
    if (track === 'doorway') {
        // Doorway: max 1 academic, max 1 techpro
        const academicElectives = document.querySelectorAll('input[name="electives"][data-type="academic"]');
        const techProElectives = document.querySelectorAll('input[name="electives"][data-type="techpro"]');
        
        academicElectives.forEach(el => {
            el.addEventListener('change', function() {
                const checkedCount = Array.from(academicElectives).filter(e => e.checked).length;
                if (checkedCount > 1) {
                    this.checked = false;
                    showNotification('Maximum 1 Academic elective allowed for Doorway', 'warning');
                }
            });
        });
        
        techProElectives.forEach(el => {
            el.addEventListener('change', function() {
                const checkedCount = Array.from(techProElectives).filter(e => e.checked).length;
                if (checkedCount > 1) {
                    this.checked = false;
                    showNotification('Maximum 1 Tech-Pro elective allowed for Doorway', 'warning');
                }
            });
        });
    } else {
        // Academic max 2, TechPro max 1
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
                    showNotification(`Maximum ${maxCount} electives allowed`, 'warning');
                }
            });
        });
    }
}

// ============================================
// Address Cascading and Same as Current
// ============================================
function setupAddressConditionals() {
    // Current Address cascading
    setupAddressCascade('current');
    
    // Permanent Address cascading
    setupAddressCascade('permanent');
    
    // Same as Current Address sync
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
                
                if (permanentCountry && currentCountry) {
                    permanentCountry.value = currentCountry.value;
                    permanentCountry.disabled = true;
                }
                if (permanentProvince && currentProvince) {
                    permanentProvince.value = currentProvince.value;
                    permanentProvince.disabled = true;
                }
                if (permanentMunicipality && currentMunicipality) {
                    permanentMunicipality.value = currentMunicipality.value;
                    permanentMunicipality.disabled = true;
                }
                if (permanentBarangay && currentBarangay) {
                    permanentBarangay.value = currentBarangay.value;
                    permanentBarangay.disabled = true;
                }
                if (permanentSitio && currentSitio) {
                    permanentSitio.value = currentSitio.value;
                    permanentSitio.disabled = true;
                }
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
        syncPermanentToCurrent(); // initial state
    }
}

function setupAddressCascade(type) {
    const countrySelect = document.querySelector(`select[name="${type}Country"]`);
    const provinceSelect = document.querySelector(`select[name="${type}Province"]`);
    const municipalitySelect = document.querySelector(`select[name="${type}Municipality"]`);
    const barangaySelect = document.querySelector(`select[name="${type}Barangay"]`);
    
    if (countrySelect && typeof ADDRESS_DATA !== 'undefined') {
        // Populate country dropdown
        countrySelect.innerHTML = '<option value="">Select Country</option>';
        Object.keys(ADDRESS_DATA).forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });
        
        // Country change handler
        countrySelect.addEventListener('change', function() {
            if (typeof updateAddressDropdowns === 'function') {
                updateAddressDropdowns(type, this.value);
            }
        });
        
        // Province change handler
        if (provinceSelect && typeof updateAddressMunicipalities === 'function') {
            provinceSelect.addEventListener('change', function() {
                updateAddressMunicipalities(type, countrySelect.value, this.value);
            });
        }
        
        // Municipality change handler
        if (municipalitySelect && typeof updateAddressBarangays === 'function') {
            municipalitySelect.addEventListener('change', function() {
                updateAddressBarangays(type, countrySelect.value, provinceSelect.value, this.value);
            });
        }
    }
}

// Auto-initialize when modal opens or form is injected
document.addEventListener('DOMContentLoaded', function() {
    // Check if form exists and setup
    const checkAndSetup = setInterval(function() {
        if (document.getElementById('enrollmentForm') || document.getElementById('enrollmentEditForm')) {
            setupEnrollmentModalConditionals();
            clearInterval(checkAndSetup);
        }
    }, 300);
    
    // Clear after 5 seconds
    setTimeout(() => clearInterval(checkAndSetup), 5000);
});

// Also trigger when opening the modal
function triggerEnrollmentConditionals() {
    setupEnrollmentModalConditionals();
}



