/**
 * SHS Track & Electives Configuration
 * Maps tracks to their available electives
 * This file provides the electivesMap for the admin dashboard section assignment
 */

// Initialize electives map for tracks
function initializeElectivesMap() {
    // Get electives from enrollment form (window.ELECTIVES)
    if (!window.ELECTIVES) {
        console.warn('[SHS-Config] window.ELECTIVES not found, trying to load...');
        return;
    }

    // Create flat arrays of electives for each track
    window.electivesMap = {
        'Academic': getAcademicElectives(),
        'TechPro': getTechProElectives(),
        'Doorway': getDoorwayElectives()
    };

    console.log('[SHS-Config] electivesMap initialized:', window.electivesMap);
}

/**
 * Get all Academic track electives (flattened from categories)
 */
function getAcademicElectives() {
    if (!window.ELECTIVES?.academic) return [];
    
    const electives = [];
    Object.values(window.ELECTIVES.academic).forEach(categoryElectives => {
        electives.push(...categoryElectives);
    });
    return electives.sort();
}

/**
 * Get all TechPro track electives (flattened from categories)
 */
function getTechProElectives() {
    if (!window.ELECTIVES?.techpro) return [];
    
    const electives = [];
    Object.values(window.ELECTIVES.techpro).forEach(categoryElectives => {
        electives.push(...categoryElectives);
    });
    return electives.sort();
}

/**
 * Get all Doorway track electives (combination of academic and techpro)
 */
function getDoorwayElectives() {
    const academic = getAcademicElectives();
    const techpro = getTechProElectives();
    return Array.from(new Set([...academic, ...techpro])).sort();
}

/**
 * Get electives by category for a specific track
 */
function getElectivesByCategory(track) {
    if (track === 'Academic' && window.ELECTIVES?.academic) {
        return window.ELECTIVES.academic;
    }
    if (track === 'TechPro' && window.ELECTIVES?.techpro) {
        return window.ELECTIVES.techpro;
    }
    if (track === 'Doorway' && window.ELECTIVES) {
        return {
            'Academic': window.ELECTIVES.academic || {},
            'TechPro': window.ELECTIVES.techpro || {}
        };
    }
    return {};
}

/**
 * Validate if electives belong to a specific track
 */
function validateElectivesForTrack(track, electives) {
    const trackElectives = window.electivesMap?.[track] || [];
    return electives.every(e => trackElectives.includes(e));
}

/**
 * Get a display name for an elective (truncated if needed)
 */
function formatElectiveName(elective) {
    // Return as-is for now, can add truncation logic if needed
    return elective;
}

// Initialize on page load if ELECTIVES is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for enrollment form to load first
    setTimeout(() => {
        if (window.ELECTIVES) {
            initializeElectivesMap();
        }
    }, 100);
});

// Also initialize if this file loads after ELECTIVES
if (window.ELECTIVES && !window.electivesMap) {
    initializeElectivesMap();
}

