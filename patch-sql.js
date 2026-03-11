const fs=require('fs');
const path='d:/Projects/SMS/routes/enrollments.js';
let txt=fs.readFileSync(path,'utf8');
// replace the static SQL declaration with dynamic version
const regex=/const sql = 'INSERT INTO enrollments \([\s\S]*?\) VALUES \([\s\S]*?\)' ;/;
const replacement = `
        // generate SQL with matching placeholders
        const columnNames = 'with_lrn, returning, psa_no, lrn_no, lastname, firstname, middle_name, ext_name, birthdate, sex, age, place_of_birth, is_ip_member, four_p_beneficiary, learner_has_disability, disability_vi_blind, disability_vi_low, disability_hi, disability_asd, disability_sld, disability_ld, disability_ebd, disability_cp, disability_intel, disability_oph, disability_hsp, disability_shp_cancer, disability_multiple, disability_unsure, disability_other, cu_address_sitio_street, cu_address_house, cu_address_zip, address_permanent_current, pe_address_sitio_street, pe_address_house, pe_address_zip, father_lastname, father_firstname, father_middlename, father_contact, mother_lastname, mother_firstname, mother_middlename, mother_contact, guardian_lastname, guardian_firstname, guardian_middlename, guardian_contact, last_school, semester, modality_modular_print, modality_modular_digital, modality_online, modality_tv, modality_rbi, modality_homeschooling, modality_blended, parent_guardian, consent, subjects, enrollment_files, school_year_id, grade_to_enroll_id, track_id, student_id';
        const placeholders = values.map(() => '?').join(', ');
        const sql = \`INSERT INTO enrollments (\${columnNames}) VALUES (\${placeholders})\`;
`;
if(regex.test(txt)){
    txt=txt.replace(regex, replacement);
    fs.writeFileSync(path, txt,'utf8');
    console.log('static SQL replaced');
} else {
    console.log('regex not matched');
}

