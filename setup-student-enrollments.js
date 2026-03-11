/**
 * Migration script to create student_enrollments table
 * Run this once to set up the new enrollment table structure
 */

const pool = require('./db');

async function setupStudentEnrollments() {
  try {
    console.log('Starting student_enrollments table setup...');

    // First, check if old enrollments table exists and back it up
    const [existingTable] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'ratings' 
      AND TABLE_NAME = 'enrollments'
    `);

    if (existingTable && existingTable.length > 0) {
      console.log('Found existing enrollments table. Backing up as enrollments_backup...');
      try {
        await pool.query('DROP TABLE IF EXISTS enrollments_backup');
        await pool.query('CREATE TABLE enrollments_backup LIKE enrollments');
        await pool.query('INSERT INTO enrollments_backup SELECT * FROM enrollments');
        console.log('✓ Backup created successfully');
      } catch (backupError) {
        console.warn('Warning: Could not back up existing table:', backupError.message);
      }
    }

    // Drop old enrollments table if it exists
    console.log('Dropping old enrollments table...');
    await pool.query('DROP TABLE IF EXISTS enrollments');
    console.log('✓ Old enrollments table dropped');

    // Create new student_enrollments table
    console.log('Creating new student_enrollments table...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS enrollments (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        with_lrn varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
        returning varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
        special_program varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        psa_no varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        lrn_no varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        lastname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        firstname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        middle_name varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        ext_name varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        birthdate date NOT NULL,
        sex varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        age varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        place_of_birth varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        is_ip_member varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        four_p_beneficiary varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
        learner_has_disability varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        disability_vi_blind tinyint(1) DEFAULT 0,
        disability_vi_low tinyint(1) DEFAULT 0,
        disability_hi tinyint(1) DEFAULT 0,
        disability_asd tinyint(1) DEFAULT 0,
        disability_sld tinyint(1) DEFAULT 0,
        disability_ld tinyint(1) DEFAULT 0,
        disability_ebd tinyint(1) DEFAULT 0,
        disability_cp tinyint(1) DEFAULT 0,
        disability_intel tinyint(1) DEFAULT 0,
        disability_oph tinyint(1) DEFAULT 0,
        disability_hsp tinyint(1) DEFAULT 0,
        disability_shp_cancer tinyint(1) DEFAULT 0,
        disability_multiple tinyint(1) DEFAULT 0,
        disability_unsure tinyint(1) DEFAULT 0,
        disability_other varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        cu_address_sitio_street varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        cu_address_house varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        cu_address_zip varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        address_permanent_current varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        pe_address_sitio_street varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        pe_address_house varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        pe_address_zip varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        father_lastname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        father_firstname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        father_middlename varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        father_contact varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        mother_lastname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        mother_firstname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        mother_middlename varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        mother_contact varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        guardian_lastname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        guardian_firstname varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        guardian_middlename varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        guardian_contact varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        last_school varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        last_school_scid varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        semester varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        modality_modular_print tinyint(1) DEFAULT 0,
        modality_modular_digital tinyint(1) DEFAULT 0,
        modality_online tinyint(1) DEFAULT 0,
        modality_tv tinyint(1) DEFAULT 0,
        modality_rbi tinyint(1) DEFAULT 0,
        modality_homeschooling tinyint(1) DEFAULT 0,
        modality_blended tinyint(1) DEFAULT 0,
        parent_guardian varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        consent tinyint(1) DEFAULT 0,
        subjects varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '-',
        interest varchar(250) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
        enrollment_files JSON DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        school_year_id INT DEFAULT NULL,
        grade_to_enroll_id INT DEFAULT NULL,
        mother_tongue_id INT DEFAULT NULL,
        ip_group_id INT DEFAULT NULL,
        cu_address_province_id INT DEFAULT NULL,
        cu_address_municipality_id INT DEFAULT NULL,
        cu_address_barangay_id INT DEFAULT NULL,
        pe_address_province_id INT DEFAULT NULL,
        pe_address_municipality_id INT DEFAULT NULL,
        pe_address_barangay_id INT DEFAULT NULL,
        last_grade_level_id INT DEFAULT NULL,
        last_school_year_id INT DEFAULT NULL,
        track_id INT DEFAULT NULL,
        strand_id INT DEFAULT NULL,
        user_id INT DEFAULT NULL,
        student_id INT DEFAULT NULL,
        CONSTRAINT fk_enrollments_school_year FOREIGN KEY (school_year_id) REFERENCES school_years(id),
        /*
          NOTE: grade_to_enroll_id originally referenced grades(id) but
          the `grades` table stores student grade records (scores), not
          grade levels.  This caused foreign key errors when level values
          like 10 had no matching row.  For now we keep grade_to_enroll_id
          as a plain INT without a foreign key.  A proper lookup table
          (e.g. grade_levels) can be added later if needed.
        */
        -- CONSTRAINT fk_enrollments_grade FOREIGN KEY (grade_to_enroll_id) REFERENCES grades(id),
        CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(createTableSQL);
    console.log('✓ New student_enrollments table created successfully');

    console.log('\n✅ Setup completed!');
    console.log('The enrollments table has been successfully migrated to the new structure.');
    console.log('\nNew table structure:');
    console.log('- Individual columns for student data (no more JSON blobs)');
    console.log('- Boolean flags for disabilities (disability_*)');
    console.log('- Boolean flags for modalities (modality_*)');
    console.log('- File upload data stored in enrollment_files JSON column');
    console.log('- Foreign key to students table via student_id');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during setup:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

setupStudentEnrollments();

