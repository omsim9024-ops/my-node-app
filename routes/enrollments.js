const express = require('express');
const pool = require('../db');
const { resolveTenantForRequest } = require('../middleware/tenant-context');
const router = express.Router();

let enrollmentRouteSchemaCache = null;

function shouldApplyTenantIdFilter(req, hasTenantColumn) {
    const tenantId = Number(req?.tenant?.id || 0);
    if (!hasTenantColumn || !tenantId) return false;
    const isolationMode = String(req?.tenant?.isolationMode || '').trim().toLowerCase();
    return isolationMode !== 'database-per-tenant';
}

async function getEnrollmentRouteSchema() {
    if (enrollmentRouteSchemaCache) return enrollmentRouteSchemaCache;

    async function hasTenantColumn(tableName) {
        try {
            const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE 'tenant_id'`);
            return Array.isArray(rows) && rows.length > 0;
        } catch (_err) {
            return false;
        }
    }

    async function hasColumn(tableName, columnName) {
        try {
            const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [String(columnName || '')]);
            return Array.isArray(rows) && rows.length > 0;
        } catch (_err) {
            return false;
        }
    }

    enrollmentRouteSchemaCache = {
        enrollments_has_tenant_id: await hasTenantColumn('enrollments'),
        enrollments_has_section_id: await hasColumn('enrollments', 'section_id'),
        enrollments_has_section_name: await hasColumn('enrollments', 'section_name'),
        enrollments_has_section_code: await hasColumn('enrollments', 'section_code'),
        students_has_tenant_id: await hasTenantColumn('students'),
        school_years_has_tenant_id: await hasTenantColumn('school_years')
    };

    return enrollmentRouteSchemaCache;
}

async function resolveTenantId(req, res) {
    const existingTenantId = Number(req.tenantId || req.tenant?.id || 0);
    if (existingTenantId > 0) return existingTenantId;

    const tenant = await resolveTenantForRequest(req, { allowDefault: true, requireActive: true });
    if (!tenant || !tenant.id) {
        res.status(503).json({ error: 'No active tenant is configured' });
        return null;
    }

    req.tenant = tenant;
    req.tenantId = Number(tenant.id);
    return req.tenantId;
}

// track name ↔ id mappings for SHS
// front-end sends strings like 'academic', 'techpro', 'doorway'
// we persist them as numeric IDs so the column stays an INT.  This
// also allows legacy data to continue using numeric codes.
const TRACK_NAME_TO_ID = {
    academic: 1,
    techpro: 2,
    doorway: 3
};

// explicitly list display names so capitalization stays consistent
const TRACK_ID_TO_NAME = {
    1: 'Academic',
    2: 'TechPro',
    3: 'Doorway'
};

function safeParseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function normalizeTrackName(trackId, enrollmentDataTrack) {
    const fromId = trackId ? (TRACK_ID_TO_NAME[trackId] || null) : null;
    if (fromId) return fromId;
    if (!enrollmentDataTrack) return null;
    const key = String(enrollmentDataTrack).toLowerCase().trim();
    if (!key) return null;
    if (key === 'academic') return 'Academic';
    if (key === 'techpro') return 'TechPro';
    if (key === 'doorway') return 'Doorway';
    return enrollmentDataTrack;
}

function parseElectiveList(value) {
    const asArray = Array.isArray(value)
        ? value
        : (typeof value === 'string' ? value.split(',') : []);

    const invalidTokens = new Set(['-', '--', 'none', 'null', 'undefined', 'n/a', 'na']);

    return Array.from(new Set(
        asArray
            .map(item => (item === undefined || item === null ? '' : String(item).trim()))
            .filter(item => item && !invalidTokens.has(item.toLowerCase()))
    ));
}

async function ensureEnrollmentStudentRecord({
    tenantId,
    submittedStudentId,
    firstName,
    lastName,
    gradeLevel
}) {
    const rawStudentIdentifier = String(submittedStudentId || '').trim();
    if (!rawStudentIdentifier) {
        throw new Error('Missing student identifier for enrollment');
    }

    const numericStudentId = Number.parseInt(rawStudentIdentifier, 10);
    if (Number.isFinite(numericStudentId) && numericStudentId > 0) {
        const [existingById] = await pool.query(
            'SELECT id FROM students WHERE id = ? AND tenant_id = ? LIMIT 1',
            [numericStudentId, tenantId]
        );
        if (Array.isArray(existingById) && existingById.length) {
            return Number(existingById[0].id);
        }
    }

    const [existingByStudentCode] = await pool.query(
        'SELECT id FROM students WHERE student_id = ? AND tenant_id = ? LIMIT 1',
        [rawStudentIdentifier, tenantId]
    );
    if (Array.isArray(existingByStudentCode) && existingByStudentCode.length) {
        return Number(existingByStudentCode[0].id);
    }

    const normalizedStudentCode = rawStudentIdentifier.slice(0, 50);
    const generatedEmailBase = `enroll.${tenantId}.${normalizedStudentCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'student'}`;
    const generatedEmail = `${generatedEmailBase}.${Date.now()}@tenant.local`;

    try {
        const [insertResult] = await pool.query(
            `INSERT INTO students (student_id, first_name, last_name, grade_level, email, phone, class_id, tenant_id)
             VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
            [
                normalizedStudentCode,
                String(firstName || '').trim() || 'Student',
                String(lastName || '').trim() || 'Pending',
                String(gradeLevel || '').trim() || null,
                generatedEmail,
                tenantId
            ]
        );
        return Number(insertResult.insertId);
    } catch (err) {
        if (err && err.code === 'ER_DUP_ENTRY') {
            const [retryRows] = await pool.query(
                'SELECT id FROM students WHERE student_id = ? AND tenant_id = ? LIMIT 1',
                [normalizedStudentCode, tenantId]
            );
            if (Array.isArray(retryRows) && retryRows.length) {
                return Number(retryRows[0].id);
            }
        }
        throw err;
    }
}

function buildEnrollmentDataFromRow(row) {
    const existing = safeParseJson(row.enrollment_data, {});
    const files = safeParseJson(row.enrollment_files, {});
    const trackName = normalizeTrackName(row.track_id, existing.track);
    const subjectElectives = parseElectiveList(row.subjects || '');
    const interestElectives = parseElectiveList(row.interest || '');
    const existingCombinedElectives = parseElectiveList([
        ...(Array.isArray(existing.electives) ? existing.electives : []),
        ...(Array.isArray(existing.academicElectives) ? existing.academicElectives : []),
        ...(Array.isArray(existing.techproElectives) ? existing.techproElectives : []),
        ...(Array.isArray(existing.doorwayAcademic) ? existing.doorwayAcademic : []),
        ...(Array.isArray(existing.doorwayTechpro) ? existing.doorwayTechpro : [])
    ]);
    // Canonical priority for Enrollment Details modal:
    // 1) DB column `subjects` (immediately updated on admin edit)
    // 2) enrollment_data.electives and legacy JSON fields
    // 3) legacy `interest`
    const resolvedElectives = subjectElectives.length
        ? subjectElectives
        : (existingCombinedElectives.length ? existingCombinedElectives : interestElectives);
    const yesNo = (value) => {
        if (value === undefined || value === null) return null;
        const text = String(value).trim().toLowerCase();
        if (!text) return null;
        if (['yes', 'y', 'true', '1'].includes(text)) return 'yes';
        if (['no', 'n', 'false', '0'].includes(text)) return 'no';
        return null;
    };

    const disabilities = Array.isArray(existing.disabilities) ? existing.disabilities : [];
    if (disabilities.length === 0) {
        if (String(row.disability_vi_blind || '') === '1') disabilities.push('blind');
        if (String(row.disability_vi_low || '') === '1') disabilities.push('low-vision');
        if (String(row.disability_hi || '') === '1') disabilities.push('hearing-impairment');
        if (String(row.disability_asd || '') === '1') disabilities.push('autism-spectrum');
        if (String(row.disability_sld || '') === '1') disabilities.push('speech-language');
        if (String(row.disability_ld || '') === '1') disabilities.push('learning-disability');
        if (String(row.disability_ebd || '') === '1') disabilities.push('emotional-behavioral');
        if (String(row.disability_cp || '') === '1') disabilities.push('cerebral-palsy');
        if (String(row.disability_intel || '') === '1') disabilities.push('intellectual-disability');
        if (String(row.disability_oph || '') === '1') disabilities.push('orthopedic-handicap');
        if (String(row.disability_hsp || '') === '1') disabilities.push('special-health');
        if (String(row.disability_shp_cancer || '') === '1') disabilities.push('cancer');
        if (String(row.disability_multiple || '') === '1') disabilities.push('multiple-disability');
        if (String(row.disability_unsure || '') === '1') disabilities.push('unsure');
        if (row.disability_other) disabilities.push(String(row.disability_other));
    }

    return {
        ...existing,
        firstName: row.firstname || existing.firstName || '',
        middleName: row.middle_name || existing.middleName || '',
        lastName: row.lastname || existing.lastName || '',
        gradeLevel: existing.gradeLevel || existing.gradelevel || row.grade_to_enroll_id || null,
        lrn: row.lrn_no || existing.lrn || null,
        studentLRN: row.lrn_no || existing.studentLRN || null,
        track: trackName || existing.track || null,
        sectionCode: row.section_name || existing.sectionCode || null,
        email: existing.email || row.email || null,
        birthdate: row.birthdate || existing.birthdate || null,
        sex: row.sex || existing.sex || existing.gender || null,
        gender: row.sex || existing.gender || existing.sex || null,
        placeOfBirth: row.place_of_birth || existing.placeOfBirth || null,
        motherTongue: existing.motherTongue || existing.mother_tongue || row.mother_tongue || row.motherTongue || null,
        motherTongueOther: existing.motherTongueOther || existing.mother_tongue_other || row.mother_tongue_other || null,
        currentSitio: row.cu_address_sitio_street || existing.currentSitio || null,
        currentCountry: existing.currentCountry || row.cu_address_country_id || row.currentCountry || null,
        currentProvince: existing.currentProvince || row.cu_address_province_id || row.currentProvince || null,
        currentMunicipality: existing.currentMunicipality || row.cu_address_municipality_id || row.currentMunicipality || null,
        currentBarangay: existing.currentBarangay || row.cu_address_barangay_id || row.currentBarangay || null,
        currentZipCode: row.cu_address_zip || existing.currentZipCode || null,
        permanentSitio: row.pe_address_sitio_street || existing.permanentSitio || null,
        permanentCountry: existing.permanentCountry || row.pe_address_country_id || row.permanentCountry || null,
        permanentProvince: existing.permanentProvince || row.pe_address_province_id || row.permanentProvince || null,
        permanentMunicipality: existing.permanentMunicipality || row.pe_address_municipality_id || row.permanentMunicipality || null,
        permanentBarangay: existing.permanentBarangay || row.pe_address_barangay_id || row.permanentBarangay || null,
        permanentZipCode: row.pe_address_zip || existing.permanentZipCode || null,
        isIP: yesNo(existing.isIP) || yesNo(row.is_ip_member) || 'no',
        ipGroup: existing.ipGroup || existing.ip_group || row.ip_group || null,
        is4Ps: yesNo(existing.is4Ps) || yesNo(existing.four_ps) || yesNo(row.four_p_beneficiary) || 'no',
        householdID: existing.householdID || existing.household_no || existing.fourPsHouseholdNo || null,
        hasPWD: yesNo(existing.hasPWD) || yesNo(row.learner_has_disability) || 'no',
        disabilities,
        returningLearner: yesNo(row.returning) || yesNo(existing.returningLearner) || 'no',
        lastGradeLevel: existing.lastGradeLevel || row.last_grade_level_id || null,
        lastSchoolYear: existing.lastSchoolYear || row.last_school_year_id || null,
        electives: resolvedElectives,
        lastSchoolAttended: row.last_school || existing.lastSchoolAttended || null,
        semester: row.semester || existing.semester || null,
        enrollmentFiles: (files && typeof files === 'object') ? files : (existing.enrollmentFiles || {})
    };
}

// Helper function to get active school year
async function getActiveSchoolYear(tenantId) {
    try {
        const [rows] = await pool.query(
            `SELECT id
             FROM school_years
             WHERE is_active = true AND tenant_id = ?
             ORDER BY updated_at DESC, id DESC
             LIMIT 1`,
            [tenantId]
        );
        return rows.length > 0 ? Number(rows[0].id) : null;
    } catch (err) {
        console.error('Error fetching active school year:', err);
        return null;
    }
}

// Helper function to map learning modality to boolean flags
function mapModality(modality) {
    const flags = {
        modality_modular_print: 0,
        modality_modular_digital: 0,
        modality_online: 0,
        modality_tv: 0,
        modality_rbi: 0,
        modality_homeschooling: 0,
        modality_blended: 0
    };

    const values = Array.isArray(modality)
        ? modality
        : (typeof modality === 'string' && modality.trim()
            ? modality.split(',').map((item) => item.trim())
            : []);

    values.forEach((item) => {
        switch (String(item || '').toLowerCase()) {
            case 'modular-print':
                flags.modality_modular_print = 1;
                break;
            case 'modular-digital':
                flags.modality_modular_digital = 1;
                break;
            case 'online':
                flags.modality_online = 1;
                break;
            case 'educational-tv':
                flags.modality_tv = 1;
                break;
            case 'radio-based':
                flags.modality_rbi = 1;
                break;
            case 'homeschooling':
                flags.modality_homeschooling = 1;
                break;
            case 'blended':
                flags.modality_blended = 1;
                break;
        }
    });

    return flags;
}

// Helper function to map disabilities to boolean flags
function mapDisabilities(disabilityArray) {
    const flags = {
        learner_has_disability: 'No',
        disability_vi_blind: 0,
        disability_vi_low: 0,
        disability_hi: 0,
        disability_asd: 0,
        disability_sld: 0,
        disability_ld: 0,
        disability_ebd: 0,
        disability_cp: 0,
        disability_intel: 0,
        disability_oph: 0,
        disability_hsp: 0,
        disability_shp_cancer: 0,
        disability_multiple: 0,
        disability_unsure: 0,
        disability_other: null
    };

    if (!disabilityArray || disabilityArray.length === 0) {
        return flags;
    }

    flags.learner_has_disability = 'Yes';

    disabilityArray.forEach(disability => {
        switch (disability.toLowerCase()) {
            case 'blind':
                flags.disability_vi_blind = 1;
                break;
            case 'low-vision':
                flags.disability_vi_low = 1;
                break;
            case 'autism-spectrum':
                flags.disability_asd = 1;
                break;
            case 'speech-language':
                flags.disability_sld = 1;
                break;
            case 'emotional-behavioral':
                flags.disability_ebd = 1;
                break;
            case 'cerebral-palsy':
                flags.disability_cp = 1;
                break;
            case 'orthopedic-handicap':
                flags.disability_oph = 1;
                break;
            case 'special-health':
                flags.disability_hsp = 1;
                break;
            case 'cancer':
                flags.disability_shp_cancer = 1;
                break;
        }
    });

    return flags;
}

// Helper function to extract parent/guardian names and split names
function parseFullName(fullName) {
    if (!fullName) return { firstname: '', middlename: '', lastname: '' };
    
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
        return { lastname: parts[0], firstname: '', middlename: '' };
    } else if (parts.length === 2) {
        return { lastname: parts[1], firstname: parts[0], middlename: '' };
    } else {
        return {
            lastname: parts[parts.length - 1],
            firstname: parts[0],
            middlename: parts.slice(1, -1).join(' ')
        };
    }
}

// Create a new enrollment
router.post('/', async (req, res) => {
    const {
        student_id,
        gradeLevel,
        semester,
        track,
        electives,
        returningLearner,
        lastGradeLevel,
        lastSchoolYear,
        lastSchoolAttended,
        schoolID,
        hasLRN,
        lrn,
        lastName,
        firstName,
        middleName,
        extensionName,
        birthdate,
        age,
        sex,
        placeOfBirth,
        motherTongue,
        motherTongueOtherText,
        isIP,
        ipGroup,
        ipOtherText,
        is4Ps,
        householdID,
        hasPWD,
        disability,
        disabilityDetails,
        currentSitio,
        currentCountry,
        currentProvince,
        currentMunicipality,
        currentBarangay,
        currentZipCode,
        permanentSitio,
        permanentCountry,
        permanentProvince,
        permanentMunicipality,
        permanentBarangay,
        permanentZipCode,
        sameAsCurrentAddress,
        fatherName,
        fatherContact,
        motherMaidenName,
        motherContact,
        guardianName,
        guardianContact,
        learningModality,
        learningModalities,
        certification,
        dataPrivacy,
        enrollmentFiles
    } = req.body;

    // The grade_level dropdown returns numeric strings (7-12); convert to int
    // We dropped the foreign key, so any integer is acceptable. Use null for
    // invalid values.
    let gradeValue = gradeLevel ? parseInt(gradeLevel, 10) : null;
    if (gradeValue !== null && isNaN(gradeValue)) gradeValue = null;

    // Convert incoming track string to numeric ID, if possible.  Only SHS grades
    // use a track; others will simply have `trackId` left null.
    let trackId = null;
    if (track && typeof track === 'string') {
        const key = track.toLowerCase();
        if (TRACK_NAME_TO_ID[key]) {
            trackId = TRACK_NAME_TO_ID[key];
        }
    }

    let lastGradeValue = lastGradeLevel ? parseInt(lastGradeLevel, 10) : null;
    if (lastGradeValue !== null && isNaN(lastGradeValue)) lastGradeValue = null;

    // Validate required fields
    if (!student_id || !firstName || !lastName || !birthdate || !sex) {
        return res.status(400).json({ 
            error: 'Missing required fields: student_id, firstName, lastName, birthdate, sex' 
        });
    }

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const enrollmentStudentId = await ensureEnrollmentStudentRecord({
            tenantId,
            submittedStudentId: student_id,
            firstName,
            lastName,
            gradeLevel
        });

        // Get active school year (authoritative source from School Years settings)
        const schoolYearId = await getActiveSchoolYear(tenantId);
        if (!schoolYearId) {
            return res.status(400).json({
                error: 'No active school year configured. Please ask admin to activate a school year before enrollment submission.'
            });
        }

        // Parse parent names
        const fatherParsed = parseFullName(fatherName);
        const motherParsed = parseFullName(motherMaidenName);
        const guardianParsed = parseFullName(guardianName);

        // Map disabilities
        const disabilityFlags = mapDisabilities(Array.isArray(disability) ? disability : []);

        // Map learning modality
        const normalizedLearningModalities = Array.isArray(learningModalities)
            ? learningModalities
            : (typeof learningModality === 'string' ? learningModality.split(',').map((item) => item.trim()).filter(Boolean) : []);
        const modalityFlags = mapModality(normalizedLearningModalities.length > 0 ? normalizedLearningModalities : learningModality);

        // Prepare permanent address (same as current if checkbox is selected)
        const permSitio = sameAsCurrentAddress ? currentSitio : permanentSitio;
        const permCountry = sameAsCurrentAddress ? currentCountry : permanentCountry;
        const permProvince = sameAsCurrentAddress ? currentProvince : permanentProvince;
        const permMunicipality = sameAsCurrentAddress ? currentMunicipality : permanentMunicipality;
        const permBarangay = sameAsCurrentAddress ? currentBarangay : permanentBarangay;
        const permZipCode = sameAsCurrentAddress ? currentZipCode : permanentZipCode;

        // Prepare subjects (electives) string
        const normalizedCreateElectives = parseElectiveList(electives);
        const subjectsStr = normalizedCreateElectives.join(', ');

        const parseNullableInt = (value) => {
            if (value === undefined || value === null || value === '') return null;
            const parsed = parseInt(String(value), 10);
            return Number.isNaN(parsed) ? null : parsed;
        };

        const enrollmentDataPayload = {
            tenantId,
            student_id,
            hasLRN,
            lrn,
            firstName,
            middleName,
            lastName,
            extensionName,
            birthdate,
            age,
            sex,
            placeOfBirth,
            motherTongue,
            motherTongueOtherText,
            gradeLevel,
            semester,
            track,
            electives: normalizedCreateElectives,
            returningLearner,
            lastGradeLevel,
            lastSchoolYear,
            lastSchoolAttended,
            schoolID,
            isIP,
            ipGroup,
            ipOtherText,
            is4Ps,
            householdID,
            hasPWD,
            disabilities: Array.isArray(disability) ? disability : [],
            disabilityDetails,
            currentSitio,
            currentCountry,
            currentProvince,
            currentMunicipality,
            currentBarangay,
            currentZipCode,
            permanentSitio: permSitio,
            permanentCountry: permCountry,
            permanentProvince: permProvince,
            permanentMunicipality: permMunicipality,
            permanentBarangay: permBarangay,
            permanentZipCode: permZipCode,
            sameAsCurrentAddress,
            fatherName,
            fatherContact,
            motherMaidenName,
            motherContact,
            guardianName,
            guardianContact,
            learningModality,
            learningModalities: normalizedLearningModalities,
            certification,
            dataPrivacy
        };

        const currentProvinceId = parseNullableInt(currentProvince);
        const currentMunicipalityId = parseNullableInt(currentMunicipality);
        const currentBarangayId = parseNullableInt(currentBarangay);
        const permanentProvinceId = parseNullableInt(permProvince);
        const permanentMunicipalityId = parseNullableInt(permMunicipality);
        const permanentBarangayId = parseNullableInt(permBarangay);
        const motherTongueId = parseNullableInt(motherTongue);
        const ipGroupId = parseNullableInt(ipGroup);

        const values = [
            hasLRN === 'yes' ? 'Yes' : 'No',           // with_lrn
            returningLearner === 'yes' ? 'Yes' : 'No', // returning
            null,                                        // psa_no
            lrn || null,                                // lrn_no
            lastName || '',                             // lastname
            firstName || '',                            // firstname
            middleName || '-',                          // middle_name
            extensionName || '-',                       // ext_name
            birthdate || null,                          // birthdate
            sex || '',                                  // sex
            age || null,                                // age
            placeOfBirth || '-',                        // place_of_birth
            isIP === 'yes' ? 'Yes' : 'No',             // is_ip_member
            is4Ps === 'yes' ? 'Yes' : 'No',            // four_p_beneficiary
            disabilityFlags.learner_has_disability,     // learner_has_disability
            disabilityFlags.disability_vi_blind,        // disability_vi_blind
            disabilityFlags.disability_vi_low,          // disability_vi_low
            disabilityFlags.disability_hi,              // disability_hi
            disabilityFlags.disability_asd,             // disability_asd
            disabilityFlags.disability_sld,             // disability_sld
            disabilityFlags.disability_ld,              // disability_ld
            disabilityFlags.disability_ebd,             // disability_ebd
            disabilityFlags.disability_cp,              // disability_cp
            disabilityFlags.disability_intel,           // disability_intel
            disabilityFlags.disability_oph,             // disability_oph
            disabilityFlags.disability_hsp,             // disability_hsp
            disabilityFlags.disability_shp_cancer,      // disability_shp_cancer
            disabilityFlags.disability_multiple,        // disability_multiple
            disabilityFlags.disability_unsure,          // disability_unsure
            disabilityDetails || null,                  // disability_other
            currentSitio || '-',                        // cu_address_sitio_street
            '-',                                        // cu_address_house (placeholder)
            currentZipCode || '-',                      // cu_address_zip
            sameAsCurrentAddress ? '1' : '0',           // address_permanent_current
            permSitio || '-',                           // pe_address_sitio_street
            '-',                                        // pe_address_house (placeholder)
            permZipCode || '-',                         // pe_address_zip
            fatherParsed.lastname || '-',               // father_lastname
            fatherParsed.firstname || '-',              // father_firstname
            fatherParsed.middlename || '-',             // father_middlename
            fatherContact || '-',                       // father_contact
            motherParsed.lastname || '-',               // mother_lastname
            motherParsed.firstname || '-',              // mother_firstname
            motherParsed.middlename || '-',             // mother_middlename
            motherContact || '-',                       // mother_contact
            guardianParsed.lastname || '-',             // guardian_lastname
            guardianParsed.firstname || '-',            // guardian_firstname
            guardianParsed.middlename || '-',           // guardian_middlename
            guardianContact || '-',                     // guardian_contact
            lastSchoolAttended || '-',                  // last_school
            semester || 'First',                        // semester
            modalityFlags.modality_modular_print,       // modality_modular_print
            modalityFlags.modality_modular_digital,     // modality_modular_digital
            modalityFlags.modality_online,              // modality_online
            modalityFlags.modality_tv,                  // modality_tv
            modalityFlags.modality_rbi,                 // modality_rbi
            modalityFlags.modality_homeschooling,       // modality_homeschooling
            modalityFlags.modality_blended,             // modality_blended
            guardianName || fatherName || motherMaidenName || '',  // parent_guardian
            (certification === true || certification === 'true') ? 1 : 0,  // consent
            subjectsStr || null,                        // subjects
            JSON.stringify(enrollmentFiles || {}),      // enrollment_files
            schoolYearId,                               // school_year_id
            gradeValue,                         // grade_to_enroll_id (numeric level)
            motherTongueId,                             // mother_tongue_id (nullable int)
            ipGroupId,                                  // ip_group_id (nullable int)
            currentProvinceId,                          // cu_address_province_id
            currentMunicipalityId,                      // cu_address_municipality_id
            currentBarangayId,                          // cu_address_barangay_id
            permanentProvinceId,                        // pe_address_province_id
            permanentMunicipalityId,                    // pe_address_municipality_id
            permanentBarangayId,                        // pe_address_barangay_id
            lastGradeValue,                             // last_grade_level_id
            parseNullableInt(lastSchoolYear),           // last_school_year_id
            trackId,                             // track_id (mapped from track string)
            enrollmentStudentId,                        // student_id (FK to students.id)
            JSON.stringify(enrollmentDataPayload),      // enrollment_data
            new Date(),                                 // enrollment_date
            tenantId                                    // tenant_id
        ];

        console.log('[ENROLLMENT DEBUG] values count', values.length, 'last items', values.slice(-5));

        
        // generate SQL with matching placeholders
        const columnNames = 'with_lrn, returning, psa_no, lrn_no, lastname, firstname, middle_name, ext_name, birthdate, sex, age, place_of_birth, is_ip_member, four_p_beneficiary, learner_has_disability, disability_vi_blind, disability_vi_low, disability_hi, disability_asd, disability_sld, disability_ld, disability_ebd, disability_cp, disability_intel, disability_oph, disability_hsp, disability_shp_cancer, disability_multiple, disability_unsure, disability_other, cu_address_sitio_street, cu_address_house, cu_address_zip, address_permanent_current, pe_address_sitio_street, pe_address_house, pe_address_zip, father_lastname, father_firstname, father_middlename, father_contact, mother_lastname, mother_firstname, mother_middlename, mother_contact, guardian_lastname, guardian_firstname, guardian_middlename, guardian_contact, last_school, semester, modality_modular_print, modality_modular_digital, modality_online, modality_tv, modality_rbi, modality_homeschooling, modality_blended, parent_guardian, consent, subjects, enrollment_files, school_year_id, grade_to_enroll_id, mother_tongue_id, ip_group_id, cu_address_province_id, cu_address_municipality_id, cu_address_barangay_id, pe_address_province_id, pe_address_municipality_id, pe_address_barangay_id, last_grade_level_id, last_school_year_id, track_id, student_id, enrollment_data, enrollment_date, tenant_id';
        const placeholders = values.map(() => '?').join(', ');
        const sql = `INSERT INTO enrollments (${columnNames}) VALUES (${placeholders})`;


        const [result] = await pool.query(sql, values);

        res.status(201).json({
            success: true,
            message: 'Enrollment submitted successfully',
            enrollment_id: result.insertId
        });
    } catch (err) {
        console.error('Error creating enrollment:', err);
        res.status(500).json({ error: 'Failed to submit enrollment', details: err.message });
    }
});

// Get all enrollments (admin) - must come before /:id route
router.get('/', async (req, res) => {
    try {
        const schema = await getEnrollmentRouteSchema();
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const applyEnrollmentTenantFilter = shouldApplyTenantIdFilter(req, schema.enrollments_has_tenant_id);
        const applyStudentTenantJoin = shouldApplyTenantIdFilter(req, schema.students_has_tenant_id);
        const applySchoolYearTenantFilter = shouldApplyTenantIdFilter(req, schema.school_years_has_tenant_id);

        const status = req.query.status;
        const filterByActiveYear = req.query.activeYear !== 'false'; // Default to true
        const dashboardView = req.query.view === 'dashboard';
        const limit = parseInt(req.query.limit, 10);
        const sort = req.query.sort; // e.g. "recent"

        let idQuery = `SELECT e.id FROM enrollments e`;
        const params = [];
        const whereConditions = [];

        if (applyEnrollmentTenantFilter) {
            whereConditions.push('e.tenant_id = ?');
            params.push(tenantId);
        }

        // Filter by active school year if requested.
        if (filterByActiveYear) {
            const activeYearSubquery = applySchoolYearTenantFilter
                ? 'SELECT id FROM school_years WHERE is_active = true AND tenant_id = ? LIMIT 1'
                : 'SELECT id FROM school_years WHERE is_active = true LIMIT 1';

            whereConditions.push(`e.school_year_id = (${activeYearSubquery})`);

            if (applySchoolYearTenantFilter) {
                params.push(tenantId);
            }
        }

        // Filter by status (Pending, Approved, Rejected)
        if (status) {
            whereConditions.push(`e.status = ?`);
            params.push(status);
        }

        if (whereConditions.length > 0) {
            idQuery += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        // Sorting
        // Use id DESC instead of created_at DESC to avoid MySQL sort-memory errors
        // when sorting wide rows (e.* includes large JSON/base64 fields).
        if (sort === 'recent') {
            idQuery += ` ORDER BY e.id DESC`;
        } else {
            idQuery += ` ORDER BY e.id DESC`; // default same order
        }

        // Limit
        if (!isNaN(limit) && limit > 0) {
            idQuery += ` LIMIT ${limit}`;
        }

        const [idRows] = await pool.query(idQuery, params);
        const ids = idRows.map(r => r.id).filter(Boolean);

        if (ids.length === 0) {
            return res.json([]);
        }

        const placeholders = ids.map(() => '?').join(', ');
        const studentJoinTenantClause = applyStudentTenantJoin ? ' AND s.tenant_id = e.tenant_id' : '';
        const detailWherePrefix = applyEnrollmentTenantFilter ? 'e.tenant_id = ? AND ' : '';

           const detailQuery = dashboardView
              ? `SELECT
                 e.id,
                 e.student_id,
                 e.status,
                 e.enrollment_date,
                 e.created_at,
                 e.grade_to_enroll_id,
                 e.track_id,
                 ${schema.enrollments_has_section_id ? 'e.section_id' : 'NULL AS section_id'},
                 ${schema.enrollments_has_section_name ? 'e.section_name' : 'NULL AS section_name'},
                 ${schema.enrollments_has_section_code ? 'e.section_code' : 'NULL AS section_code'},
                 e.lrn_no,
                 e.firstname,
                 e.lastname,
                 e.enrollment_data,
                 s.first_name,
                 s.last_name,
                 s.email
                FROM enrollments e
                    LEFT JOIN students s ON e.student_id = s.id${studentJoinTenantClause}
                    WHERE ${detailWherePrefix}e.id IN (${placeholders})
                ORDER BY e.id DESC`
            : `SELECT e.*, s.first_name, s.last_name, s.email
               FROM enrollments e
                    LEFT JOIN students s ON e.student_id = s.id${studentJoinTenantClause}
                    WHERE ${detailWherePrefix}e.id IN (${placeholders})
               ORDER BY e.id DESC`;

          const detailParams = applyEnrollmentTenantFilter ? [tenantId, ...ids] : [...ids];
          const [rows] = await pool.query(detailQuery, detailParams);

        // Build enrollment_data object while preserving full JSON for edit modal
        rows.forEach(r => {
            // if enrollment_date is missing (some old rows), fall back to created_at
            if (!r.enrollment_date) {
                r.enrollment_date = r.created_at;
            }

            // convert numeric track_id to readable name
            const parsedData = safeParseJson(r.enrollment_data, {});
            const trackName = normalizeTrackName(r.track_id, parsedData.track);
            // also expose at top level for dashboard row builder
            r.track = trackName;
            r.enrollment_data = buildEnrollmentDataFromRow(r);
        });

        res.json(rows);
    } catch (err) {
        console.error('Error fetching all enrollments:', err);
        res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
});

// Get all enrollments for a student (more specific route - must come before /:id)
router.get('/student/:student_id', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const identifier = String(req.params.student_id || '').trim();
        const filterByActiveYear = req.query.activeYear !== 'false';
        const activeYearClause = filterByActiveYear
            ? ' AND school_year_id = (SELECT id FROM school_years WHERE is_active = true AND tenant_id = ? LIMIT 1)'
            : '';
        let rows = [];
        try {
            const [result] = await pool.query(
                `SELECT * FROM enrollments
                 WHERE tenant_id = ?
                   AND (student_id = ?
                    OR lrn_no = ?
                    OR JSON_EXTRACT(enrollment_data, '$.lrn') = ?)
                    ${activeYearClause}
                      ORDER BY id DESC`,
                filterByActiveYear
                    ? [tenantId, identifier, identifier, identifier, tenantId]
                    : [tenantId, identifier, identifier, identifier]
            );
            rows = result;
        } catch (e) {
            if (e.code && e.message && e.message.toLowerCase().includes('json_extract')) {
                const [result] = await pool.query(
                    `SELECT * FROM enrollments
                     WHERE tenant_id = ?
                       AND (student_id = ?
                        OR lrn_no = ?
                        OR enrollment_data LIKE ?)
                        ${activeYearClause}
                            ORDER BY id DESC`,
                    filterByActiveYear
                        ? [tenantId, identifier, identifier, `%%\"lrn\":\"${identifier}\"%%`, tenantId]
                        : [tenantId, identifier, identifier, `%%\"lrn\":\"${identifier}\"%%`]
                );
                rows = result;
            } else {
                throw e;
            }
        }

        rows.forEach(r => {
            if (!r.enrollment_date) {
                r.enrollment_date = r.created_at;
            }
            const parsedData = safeParseJson(r.enrollment_data, {});
            const trackName = normalizeTrackName(r.track_id, parsedData.track);
            r.track = trackName;
            r.enrollment_data = buildEnrollmentDataFromRow(r);
        });

        res.json(rows);
    } catch (err) {
        console.error('Error fetching enrollments:', err);
        res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
});

// Get enrollment statistics - must come BEFORE /:id route
router.get('/stats', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const filterByActiveYear = req.query.activeYear !== 'false';

        let whereClause = 'WHERE e.tenant_id = ?';
        const params = [tenantId];
        if (filterByActiveYear) {
            whereClause += ` AND e.school_year_id = (SELECT id FROM school_years WHERE is_active = true AND tenant_id = ? LIMIT 1)`;
            params.push(tenantId);
        }

        // count by status as well as total
        const [rows] = await pool.query(
            `SELECT 
                SUM(e.status = 'Pending') as pendingCount,
                SUM(e.status = 'Approved') as approvedCount,
                SUM(e.status = 'Rejected') as rejectedCount,
                COUNT(*) as totalEnrollments,
                COUNT(DISTINCT COALESCE(
                    NULLIF(CAST(e.student_id AS CHAR), ''),
                    NULLIF(TRIM(e.lrn_no), ''),
                    CONCAT('enrollment:', e.id)
                )) as totalStudents
             FROM enrollments e ${whereClause}`
              ,
              params
        );

        const stats = rows[0] || {};

        res.json({
            totalEnrollments: parseInt(stats.totalEnrollments) || 0,
            totalStudents: parseInt(stats.totalStudents) || 0,
            pendingCount: parseInt(stats.pendingCount) || 0,
            approvedCount: parseInt(stats.approvedCount) || 0,
            rejectedCount: parseInt(stats.rejectedCount) || 0,
            activeYear: filterByActiveYear ? 'true' : 'false'
        });
    } catch (err) {
        console.error('Error fetching enrollment stats:', err);
        res.status(500).json({ error: 'Failed to fetch enrollment statistics' });
    }
});

// Update enrollment (admin only) - must come before GET /:id
router.put('/:id', async (req, res) => {
    const { status, remarks } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status is required' });
    }

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        await pool.query(
            'UPDATE enrollments SET status = ?, remarks = ? WHERE id = ? AND tenant_id = ?',
            [status, remarks || null, req.params.id, tenantId]
        );

        const [rows] = await pool.query('SELECT * FROM enrollments WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        res.json({
            success: true,
            message: 'Enrollment updated successfully',
            enrollment: rows[0]
        });
    } catch (err) {
        console.error('Error updating enrollment:', err);
        res.status(500).json({ error: 'Failed to update enrollment' });
    }
});

// Update enrollment data by student identifier (id or LRN) - admin editable
// This endpoint syncs student edits from the directory to the enrollments table
router.patch('/by-student/:identifier', async (req, res) => {
    const identifier = req.params.identifier;
    const updates = req.body || {};

    // allow clients to send either camelCase or snake_case for files
    if (updates.enrollment_data && updates.enrollment_data.enrollment_files) {
        updates.enrollment_data.enrollmentFiles = updates.enrollment_data.enrollment_files;
    }

    console.log('[Enrollments] PATCH /by-student/:identifier received');
    console.log('[Enrollments] Identifier:', identifier);
    console.log('[Enrollments] updates.section_id exists?', 'section_id' in updates);
    console.log('[Enrollments] updates.section_id value:', updates.section_id);

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        console.log('[Enrollments] payload received for identifier', identifier, 'updates:', updates);
        // Determine which school year to target. Prefer explicit query param, else
        // use the active school year for the tenant (ensures we don't modify other years).
        let targetYearId = null;
        if (req.query && req.query.schoolYearId) {
            targetYearId = Number(req.query.schoolYearId) || null;
        }
        if (!targetYearId) {
            targetYearId = await getActiveSchoolYear(tenantId);
        }

        // Find matching enrollments by student_id or enrollment_data lrn field,
        // limited to the target school year if known.
        let rows = [];
        try {
            let baseSql =
                `SELECT * FROM enrollments 
                 WHERE tenant_id = ?
                   AND (student_id = ? OR lrn_no = ? OR JSON_EXTRACT(enrollment_data, '$.lrn') = ?)`;
            const params = [tenantId, identifier, identifier, identifier];
            if (targetYearId) {
                baseSql += ' AND school_year_id = ?';
                params.push(targetYearId);
            }
            const [result] = await pool.query(baseSql, params);
            rows = result;
        } catch (e) {
            // MySQL versions prior to 5.7 do not support JSON_EXTRACT; fall back
            if (e.code && e.message && e.message.toLowerCase().includes('json_extract')) {
                console.warn('[Enrollments] JSON_EXTRACT not available, using LIKE fallback');
                let fallbackSql =
                    `SELECT * FROM enrollments 
                     WHERE tenant_id = ?
                       AND (student_id = ? OR lrn_no = ? OR enrollment_data LIKE ?)`;
                const params = [tenantId, identifier, identifier, `%%\"lrn\":\"${identifier}\"%%`];
                if (targetYearId) {
                    fallbackSql += ' AND school_year_id = ?';
                    params.push(targetYearId);
                }
                const [result] = await pool.query(fallbackSql, params);
                rows = result;
            } else {
                throw e;
            }
        }

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No enrollments found for the given identifier' });
        }

        const updatedEnrollments = [];
        for (const row of rows) {
            let data = safeParseJson(row.enrollment_data, {});
            if (!data || typeof data !== 'object') data = {};

            const existingFiles = safeParseJson(row.enrollment_files, {});
            if (!data.enrollmentFiles || typeof data.enrollmentFiles !== 'object') {
                data.enrollmentFiles = (existingFiles && typeof existingFiles === 'object') ? existingFiles : {};
            }

            // Merge updates into enrollment_data
            if (updates.enrollment_data && typeof updates.enrollment_data === 'object') {
                Object.keys(updates.enrollment_data).forEach(k => {
                    data[k] = updates.enrollment_data[k];
                });
                console.log('[Enrollments] merged enrollment_data:', data);
            }

            // Canonical elective source for immediate DB sync:
            // explicit enrollment_data.electives (even empty) OR explicit subjects OR existing data.electives.
            let normalizedUpdateElectives = [];
            if (
                updates.enrollment_data
                && typeof updates.enrollment_data === 'object'
                && Object.prototype.hasOwnProperty.call(updates.enrollment_data, 'electives')
            ) {
                normalizedUpdateElectives = parseElectiveList(updates.enrollment_data.electives);
            } else if (Object.prototype.hasOwnProperty.call(updates, 'subjects')) {
                normalizedUpdateElectives = parseElectiveList(updates.subjects);
            } else {
                normalizedUpdateElectives = parseElectiveList(data.electives);
            }

            data.electives = normalizedUpdateElectives;

            // Keep legacy elective buckets aligned to prevent stale values from resurfacing.
            data.academicElectives = [];
            data.techproElectives = [];
            data.doorwayAcademic = [];
            data.doorwayTechpro = [];

            // Update top-level fields from updates object
            if (updates.fullName) {
                const parts = String(updates.fullName).split(/\s+/);
                data.firstName = parts.shift() || data.firstName || '';
                data.lastName = parts.join(' ') || data.lastName || '';
            }
            if (updates.firstName) data.firstName = updates.firstName;
            if (updates.lastName) data.lastName = updates.lastName;
            if (typeof updates.middleName !== 'undefined') data.middleName = updates.middleName;
            if (typeof updates.middle_name !== 'undefined' && typeof updates.middleName === 'undefined') {
                data.middleName = updates.middle_name;
            }
            if (updates.lrn) data.lrn = updates.lrn;
            if (updates.grade) data.gradeLevel = updates.grade;
            if (updates.track) data.track = updates.track;
            if (updates.birthdate) data.birthdate = updates.birthdate;
            if (updates.gender) data.gender = updates.gender;
            if (typeof updates.currentAddress !== 'undefined') data.currentAddress = updates.currentAddress;

            const oldGrade = parseInt(String(row.grade_to_enroll_id ?? ''), 10);
            const newGrade = parseInt(String(data.gradeLevel ?? updates.grade ?? ''), 10);
            const gradeChanged = !Number.isNaN(newGrade) && String(oldGrade) !== String(newGrade);

            if (gradeChanged) {
                console.log('[Enrollments] Grade changed for row', row.id, 'from', row.grade_to_enroll_id, 'to', newGrade, '- clearing section assignment');
                data.section_id = null;
                data.sectionId = null;
                data.section_code = null;
                data.sectionCode = null;
                data.section_name = null;
                data.sectionName = null;
            }

            // Update enrollments table with updated enrollment_data and status
            try {
                const dataToStore = { ...data };
                delete dataToStore.enrollmentFiles;
                delete dataToStore.files;

                // Force JSON payload to mirror the exact electives written to `subjects`.
                dataToStore.electives = normalizedUpdateElectives;
                dataToStore.academicElectives = [];
                dataToStore.techproElectives = [];
                dataToStore.doorwayAcademic = [];
                dataToStore.doorwayTechpro = [];

                const setParts = ['enrollment_data = ?'];
                const setValues = [JSON.stringify(dataToStore)];

                if (typeof updates.status !== 'undefined') {
                    setParts.push('status = ?');
                    setValues.push(updates.status);
                }

                const hasLrnUpdate = updates.lrn !== undefined || (updates.enrollment_data && updates.enrollment_data.lrn !== undefined);
                if (hasLrnUpdate) {
                    setParts.push('lrn_no = ?');
                    setValues.push((updates.lrn ?? updates.enrollment_data?.lrn ?? data.lrn) || null);
                }

                if (data.gradeLevel !== undefined || updates.grade !== undefined) {
                    const numericGrade = parseInt(String(data.gradeLevel ?? updates.grade ?? ''), 10);
                    setParts.push('grade_to_enroll_id = ?');
                    setValues.push(Number.isNaN(numericGrade) ? null : numericGrade);
                }

                if (data.track !== undefined || updates.track !== undefined) {
                    const trackValue = String(data.track ?? updates.track ?? '').toLowerCase().trim();
                    setParts.push('track_id = ?');
                    setValues.push(TRACK_NAME_TO_ID[trackValue] || null);
                }

                // Map firstname/lastname from data back to columns
                if (data.firstName) {
                    setParts.push('firstname = ?');
                    setValues.push(data.firstName);
                }
                if (data.lastName) {
                    setParts.push('lastname = ?');
                    setValues.push(data.lastName);
                }
                if (typeof data.middleName !== 'undefined') {
                    const middleNameValue = String(data.middleName || '').trim();
                    setParts.push('middle_name = ?');
                    setValues.push(middleNameValue || '-');
                }

                // --- new mappings for other demographic/fields ---
                if (data.birthdate) {
                    setParts.push('birthdate = ?');
                    setValues.push(data.birthdate);
                }
                if (data.sex || data.gender) {
                    // allow either key since UI uses both interchangeably
                    setParts.push('sex = ?');
                    setValues.push(data.sex || data.gender);
                }
                if (data.age) {
                    setParts.push('age = ?');
                    setValues.push(data.age);
                }
                if (data.placeOfBirth) {
                    setParts.push('place_of_birth = ?');
                    setValues.push(data.placeOfBirth);
                }

                if (data.currentSitio !== undefined) {
                    setParts.push('cu_address_sitio_street = ?');
                    setValues.push(data.currentSitio || null);
                }
                if (data.currentProvince !== undefined) {
                    const parsed = parseInt(String(data.currentProvince), 10);
                    setParts.push('cu_address_province_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.currentMunicipality !== undefined) {
                    const parsed = parseInt(String(data.currentMunicipality), 10);
                    setParts.push('cu_address_municipality_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.currentBarangay !== undefined) {
                    const parsed = parseInt(String(data.currentBarangay), 10);
                    setParts.push('cu_address_barangay_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.currentZipCode !== undefined) {
                    setParts.push('cu_address_zip = ?');
                    setValues.push(data.currentZipCode || null);
                }
                if (data.permanentSitio !== undefined) {
                    setParts.push('pe_address_sitio_street = ?');
                    setValues.push(data.permanentSitio || null);
                }
                if (data.permanentProvince !== undefined) {
                    const parsed = parseInt(String(data.permanentProvince), 10);
                    setParts.push('pe_address_province_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.permanentMunicipality !== undefined) {
                    const parsed = parseInt(String(data.permanentMunicipality), 10);
                    setParts.push('pe_address_municipality_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.permanentBarangay !== undefined) {
                    const parsed = parseInt(String(data.permanentBarangay), 10);
                    setParts.push('pe_address_barangay_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.permanentZipCode !== undefined) {
                    setParts.push('pe_address_zip = ?');
                    setValues.push(data.permanentZipCode || null);
                }

                if (data.isIP !== undefined) {
                    setParts.push('is_ip_member = ?');
                    setValues.push(String(data.isIP).toLowerCase() === 'yes' ? 'Yes' : 'No');
                }
                if (data.is4Ps !== undefined) {
                    setParts.push('four_p_beneficiary = ?');
                    setValues.push(String(data.is4Ps).toLowerCase() === 'yes' ? 'Yes' : 'No');
                }
                if (data.hasPWD !== undefined) {
                    setParts.push('learner_has_disability = ?');
                    setValues.push(String(data.hasPWD).toLowerCase() === 'yes' ? 'Yes' : 'No');
                }

                if (data.motherTongue !== undefined) {
                    const parsed = parseInt(String(data.motherTongue), 10);
                    setParts.push('mother_tongue_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.ipGroup !== undefined) {
                    const parsed = parseInt(String(data.ipGroup), 10);
                    setParts.push('ip_group_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }

                if (data.returningLearner !== undefined) {
                    setParts.push('returning = ?');
                    setValues.push(String(data.returningLearner).toLowerCase() === 'yes' ? 'Yes' : 'No');
                }
                if (data.lastGradeLevel !== undefined) {
                    const parsed = parseInt(String(data.lastGradeLevel), 10);
                    setParts.push('last_grade_level_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.lastSchoolYear !== undefined) {
                    const parsed = parseInt(String(data.lastSchoolYear), 10);
                    setParts.push('last_school_year_id = ?');
                    setValues.push(Number.isNaN(parsed) ? null : parsed);
                }
                if (data.lastSchoolAttended !== undefined) {
                    setParts.push('last_school = ?');
                    setValues.push(data.lastSchoolAttended || null);
                }
                if (data.semester !== undefined) {
                    setParts.push('semester = ?');
                    setValues.push(data.semester || null);
                }

                setParts.push('subjects = ?');
                setValues.push(normalizedUpdateElectives.length ? normalizedUpdateElectives.join(', ') : null);

                if (data.enrollmentFiles !== undefined) {
                    setParts.push('enrollment_files = ?');
                    setValues.push(JSON.stringify(data.enrollmentFiles || {}));
                }
                // note: email/phone remain only in JSON; enrollments table has no columns for them

                // execute enrollment update
                const sqlEnroll = `UPDATE enrollments SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?${targetYearId ? ' AND school_year_id = ?' : ''}`;
                setValues.push(row.id, tenantId);
                if (targetYearId) setValues.push(targetYearId);

                // DEBUG: print exactly what we're sending to MySQL so we can
                // trace any missing columns/values when troubleshooting.
                console.log('[Enrollments] Executing enrollment update for row', row.id);

                await pool.query(sqlEnroll, setValues);
                // keep track of which rows we actually touched so the response
                // can report a sensible count instead of always zero
                updatedEnrollments.push(row.id);
            } catch (e) {
                console.error('[Enrollments] Error updating enrollment:', e.message);
            }

            // Also update students table if student_id exists
            if (row.student_id) {
                try {
                    const setParts = [];
                    const setValues = [];

                    if (data.firstName) { setParts.push('first_name = ?'); setValues.push(data.firstName); }
                    if (data.lastName) { setParts.push('last_name = ?'); setValues.push(data.lastName); }
                    const normalizedEmail = (data.email || '').toString().trim();
                    const looksLikeEmail = normalizedEmail.includes('@') && normalizedEmail.includes('.');
                    if (looksLikeEmail) { setParts.push('email = ?'); setValues.push(normalizedEmail); }
                    if (data.gradeLevel) { setParts.push('grade_level = ?'); setValues.push(data.gradeLevel); }
                    if (data.birthdate) { setParts.push('birthdate = ?'); setValues.push(data.birthdate); }
                    if (data.sex || data.gender) { setParts.push('gender = ?'); setValues.push(data.sex || data.gender); }

                    // Handle section_id/class_id clearing on track change
                    const shouldClearSectionFromGradeChange = gradeChanged;
                    const nextSectionId = shouldClearSectionFromGradeChange
                        ? null
                        : (typeof updates.section_id !== 'undefined' ? updates.section_id : undefined);
                    const nextClassId = shouldClearSectionFromGradeChange
                        ? null
                        : (typeof updates.class_id !== 'undefined' ? updates.class_id : undefined);

                    if (typeof nextSectionId !== 'undefined') {
                        console.log('[Enrollments] Updating student.section_id:', nextSectionId);
                        setParts.push('section_id = ?');
                        setValues.push(nextSectionId);
                    }
                    if (typeof nextClassId !== 'undefined') {
                        console.log('[Enrollments] Updating student.class_id:', nextClassId);
                        setParts.push('class_id = ?');
                        setValues.push(nextClassId);
                    }

                    if (setParts.length > 0) {
                        setValues.push(row.student_id);
                        setValues.push(tenantId);
                        const sql = `UPDATE students SET ${setParts.join(', ')} WHERE id = ? AND tenant_id = ?`;
                        console.log('[Enrollments] Executing student update:', sql);
                        await pool.query(sql, setValues);
                        console.log('[Enrollments] ✅ Student record updated successfully');
                    }
                } catch (e) {
                    console.error('[Enrollments] Error updating student record:', e.message);
                }
            }
        }

        // Fetch updated enrollments to return
        let finalRows = [];
        if (updatedEnrollments.length > 0) {
            const placeholders = updatedEnrollments.map(() => '?').join(', ');
            const [result] = await pool.query(
                `SELECT * FROM enrollments WHERE id IN (${placeholders}) AND tenant_id = ? ORDER BY created_at DESC`,
                [...updatedEnrollments, tenantId]
            );
            finalRows = result;
        } else {
            try {
                // fallback selection – also restrict by school_year_id if available
                let fbSql =
                    `SELECT * FROM enrollments 
                     WHERE tenant_id = ?
                       AND (student_id = ? OR lrn_no = ? OR JSON_EXTRACT(enrollment_data, '$.lrn') = ?)`;
                const fbParams = [tenantId, identifier, identifier, identifier];
                if (targetYearId) {
                    fbSql += ' AND school_year_id = ?';
                    fbParams.push(targetYearId);
                }
                const [result] = await pool.query(fbSql, fbParams);
                finalRows = result;
            } catch (e) {
                if (e.code && e.message && e.message.toLowerCase().includes('json_extract')) {
                    console.warn('[Enrollments] JSON_EXTRACT not available on final fetch, using LIKE fallback');
                    let fbSql2 =
                        `SELECT * FROM enrollments 
                         WHERE tenant_id = ?
                           AND (student_id = ? OR lrn_no = ? OR enrollment_data LIKE ?)`;
                    const fbParams2 = [tenantId, identifier, identifier, `%%\"lrn\":\"${identifier}\"%%`];
                    if (targetYearId) {
                        fbSql2 += ' AND school_year_id = ?';
                        fbParams2.push(targetYearId);
                    }
                    const [result] = await pool.query(fbSql2, fbParams2);
                    finalRows = result;
                } else {
                    throw e;
                }
            }
        }

        finalRows.forEach(r => {
            if (!r.enrollment_date) {
                r.enrollment_date = r.created_at;
            }
            const parsedData = safeParseJson(r.enrollment_data, {});
            r.track = normalizeTrackName(r.track_id, parsedData.track);
            r.enrollment_data = buildEnrollmentDataFromRow(r);
        });

        res.json({ 
            success: true,
            updated: updatedEnrollments.length,
            enrollments: finalRows
        });
    } catch (err) {
        console.error('[Enrollments] Error in PATCH /by-student:', err);
        res.status(500).json({ error: 'Failed to update enrollment data' });
    }
});

// Update enrollment status (PATCH - for approve/reject) OR full enrollment data
router.patch('/:id', async (req, res) => {
    const { status, remarks } = req.body;
    const updates = req.body || {};

    // Handle status-only updates (backward compatibility)
    if (status && Object.keys(updates).length === 1 || (Object.keys(updates).length === 2 && remarks)) {
        // This is a status-only update
        try {
            const tenantId = await resolveTenantId(req, res);
            if (!tenantId) return;

            await pool.query(
                'UPDATE enrollments SET status = ?, remarks = ? WHERE id = ? AND tenant_id = ?',
                [status, remarks || null, req.params.id, tenantId]
            );

            const [rows] = await pool.query('SELECT * FROM enrollments WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Enrollment not found' });
            }

            res.json({
                success: true,
                message: 'Enrollment status updated successfully',
                enrollment: rows[0]
            });
        } catch (err) {
            console.error('Error updating enrollment status:', err);
            res.status(500).json({ error: 'Failed to update enrollment status' });
        }
        return;
    }

    // Handle full enrollment data updates (like /by-student endpoint but for specific enrollment)
    console.log('[Enrollments] PATCH /:id received for full enrollment update');
    console.log('[Enrollments] Enrollment ID:', req.params.id);
    console.log('[Enrollments] updates.section_id exists?', 'section_id' in updates);
    console.log('[Enrollments] updates.section_id value:', updates.section_id);

    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const enrollmentId = req.params.id;

        // First, get the current enrollment to merge with updates
        const [currentRows] = await pool.query(
            'SELECT * FROM enrollments WHERE id = ? AND tenant_id = ?',
            [enrollmentId, tenantId]
        );

        if (currentRows.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        const currentEnrollment = currentRows[0];
        let currentEnrollmentData = {};
        try {
            if (currentEnrollment.enrollment_data) {
                currentEnrollmentData = typeof currentEnrollment.enrollment_data === 'string' 
                    ? JSON.parse(currentEnrollment.enrollment_data) 
                    : currentEnrollment.enrollment_data;
            }
        } catch (e) {
            console.warn('[Enrollments] Failed to parse existing enrollment_data:', e);
        }

        // Merge enrollment_data if provided
        let finalEnrollmentData = { ...currentEnrollmentData };
        if (updates.enrollment_data) {
            finalEnrollmentData = { ...finalEnrollmentData, ...updates.enrollment_data };
        }

        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];

        // Handle standard enrollment fields
        if (updates.status !== undefined) {
            updateFields.push('status = ?');
            updateValues.push(updates.status);
        }
        if (updates.remarks !== undefined) {
            updateFields.push('remarks = ?');
            updateValues.push(updates.remarks);
        }
        if (updates.section_id !== undefined) {
            updateFields.push('section_id = ?');
            updateValues.push(updates.section_id);
        }
        if (updates.class_id !== undefined) {
            updateFields.push('class_id = ?');
            updateValues.push(updates.class_id);
        }
        if (updates.subjects !== undefined) {
            updateFields.push('subjects = ?');
            updateValues.push(updates.subjects);
        }

        // Always update enrollment_data if there are changes
        updateFields.push('enrollment_data = ?');
        updateValues.push(JSON.stringify(finalEnrollmentData));

        // Add updated_at timestamp
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        // Add enrollment ID and tenant ID to values
        updateValues.push(enrollmentId, tenantId);

        // Execute the update
        const updateQuery = `
            UPDATE enrollments 
            SET ${updateFields.join(', ')} 
            WHERE id = ? AND tenant_id = ?
        `;

        console.log('[Enrollments] Update query:', updateQuery);
        console.log('[Enrollments] Update values:', updateValues);

        await pool.query(updateQuery, updateValues);

        // Update students table if section_id or class_id is provided (sync with /by-student logic)
        if (updates.section_id !== undefined || updates.class_id !== undefined) {
            try {
                const studentId = currentEnrollment.student_id;
                if (studentId) {
                    const studentUpdateFields = [];
                    const studentUpdateValues = [];

                    if (updates.section_id !== undefined) {
                        studentUpdateFields.push('section_id = ?');
                        studentUpdateValues.push(updates.section_id);
                    }
                    if (updates.class_id !== undefined) {
                        studentUpdateFields.push('class_id = ?');
                        studentUpdateValues.push(updates.class_id);
                    }

                    if (studentUpdateFields.length > 0) {
                        studentUpdateValues.push(studentId, tenantId);
                        const studentUpdateQuery = `
                            UPDATE students 
                            SET ${studentUpdateFields.join(', ')} 
                            WHERE id = ? AND tenant_id = ?
                        `;
                        await pool.query(studentUpdateQuery, studentUpdateValues);
                        console.log('[Enrollments] Updated students table for student_id:', studentId);
                    }
                }
            } catch (studentErr) {
                console.warn('[Enrollments] Failed to update students table:', studentErr);
                // Don't fail the main update if student sync fails
            }
        }

        // Get the updated enrollment
        const [updatedRows] = await pool.query(
            'SELECT * FROM enrollments WHERE id = ? AND tenant_id = ?',
            [enrollmentId, tenantId]
        );

        console.log('[Enrollments] Enrollment updated successfully, ID:', enrollmentId);

        res.json({
            success: true,
            message: 'Enrollment updated successfully',
            enrollment: updatedRows[0]
        });

    } catch (err) {
        console.error('Error updating enrollment:', err);
        res.status(500).json({ error: 'Failed to update enrollment data' });
    }
});

// Delete enrollment (admin only) - must come before GET /:id
router.delete('/:id', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [checkResult] = await pool.query('SELECT id FROM enrollments WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);

        if (checkResult.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        await pool.query('DELETE FROM enrollments WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);

        res.json({
            success: true,
            message: 'Enrollment deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting enrollment:', err);
        res.status(500).json({ error: 'Failed to delete enrollment' });
    }
});

// Get specific enrollment - must come AFTER DELETE and PUT
router.get('/:id', async (req, res) => {
    try {
        const tenantId = await resolveTenantId(req, res);
        if (!tenantId) return;

        const [rows] = await pool.query(
            'SELECT * FROM enrollments WHERE id = ? AND tenant_id = ?',
            [req.params.id, tenantId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' });
        }

        const enrol = rows[0];

        // backfill missing dates and convert track id as on the list route
        if (!enrol.enrollment_date) {
            enrol.enrollment_date = enrol.created_at;
        }
        const trackName = enrol.track_id ? (TRACK_ID_TO_NAME[enrol.track_id] || null) : null;
        enrol.track = trackName;

        // mirror flattened structure while preserving full JSON payload for edit modal
        enrol.enrollment_data = buildEnrollmentDataFromRow(enrol);

        res.json(enrol);
    } catch (err) {
        console.error('Error fetching enrollment:', err);
        res.status(500).json({ error: 'Failed to fetch enrollment' });
    }
});

module.exports = router;



