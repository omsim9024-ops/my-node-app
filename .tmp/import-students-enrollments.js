const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const sqlFilePath = path.join(__dirname, '..', 'students.sql');

function extractSqlSections(rawSql) {
  const createMatch = rawSql.match(/CREATE TABLE `enrollments`[\s\S]*?;\s*/);
  const insertMatches = rawSql.match(/INSERT INTO `enrollments`[\s\S]*?;\s*/g) || [];

  if (!createMatch) {
    throw new Error('Could not find CREATE TABLE `enrollments` statement in students.sql');
  }

  return {
    createSql: createMatch[0],
    insertSqlList: insertMatches
  };
}

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ratings',
    multipleStatements: true
  });

  try {
    const rawSql = fs.readFileSync(sqlFilePath, 'utf8');
    const { createSql, insertSqlList } = extractSqlSections(rawSql);

    if (!insertSqlList.length) {
      throw new Error('No INSERT statements for `enrollments` found in students.sql');
    }

    const stagingTable = '`_import_enrollments_raw`';
    const createStagingSql = createSql.replace(/`enrollments`/g, stagingTable);

    await conn.query(`DROP TABLE IF EXISTS ${stagingTable}`);
    await conn.query(createStagingSql);

    for (const insertSql of insertSqlList) {
      const insertIntoStagingSql = insertSql.replace(/INSERT INTO `enrollments`/g, `INSERT INTO ${stagingTable}`);
      await conn.query(insertIntoStagingSql);
    }

    const [[{ beforeCount }]] = await conn.query('SELECT COUNT(*) AS beforeCount FROM enrollments');
    const [[{ stagingCount }]] = await conn.query(`SELECT COUNT(*) AS stagingCount FROM ${stagingTable}`);
    const [[{ distinctIds }]] = await conn.query(`SELECT COUNT(DISTINCT id) AS distinctIds FROM ${stagingTable}`);

    const insertSql = `
      INSERT INTO enrollments (
        id,
        with_lrn,
        returning,
        special_program,
        psa_no,
        lrn_no,
        lastname,
        firstname,
        middle_name,
        ext_name,
        birthdate,
        sex,
        age,
        place_of_birth,
        is_ip_member,
        four_p_beneficiary,
        learner_has_disability,
        disability_vi_blind,
        disability_vi_low,
        disability_hi,
        disability_asd,
        disability_sld,
        disability_ld,
        disability_ebd,
        disability_cp,
        disability_intel,
        disability_oph,
        disability_hsp,
        disability_shp_cancer,
        disability_multiple,
        disability_unsure,
        disability_other,
        cu_address_sitio_street,
        cu_address_house,
        cu_address_zip,
        address_permanent_current,
        pe_address_sitio_street,
        pe_address_house,
        pe_address_zip,
        father_lastname,
        father_firstname,
        father_middlename,
        father_contact,
        mother_lastname,
        mother_firstname,
        mother_middlename,
        mother_contact,
        guardian_lastname,
        guardian_firstname,
        guardian_middlename,
        guardian_contact,
        last_school,
        last_school_scid,
        semester,
        modality_modular_print,
        modality_modular_digital,
        modality_online,
        modality_tv,
        modality_rbi,
        modality_homeschooling,
        modality_blended,
        parent_guardian,
        consent,
        subjects,
        interest,
        created_at,
        updated_at,
        deleted_at,
        school_year_id,
        grade_to_enroll_id,
        mother_tongue_id,
        ip_group_id,
        cu_address_province_id,
        cu_address_municipality_id,
        cu_address_barangay_id,
        pe_address_province_id,
        pe_address_municipality_id,
        pe_address_barangay_id,
        last_grade_level_id,
        last_school_year_id,
        track_id,
        strand_id,
        user_id,
        enrollment_data
      )
      SELECT
        src.id,
        src.with_lrn,
        src.returning,
        src.special_program,
        src.psa_no,
        src.lrn_no,
        src.lastname,
        src.firstname,
        src.middle_name,
        src.ext_name,
        src.birthdate,
        src.sex,
        src.age,
        src.place_of_birth,
        src.is_ip_member,
        src.four_p_beneficiary,
        src.learner_has_disability,
        src.disability_vi_blind,
        src.disability_vi_low,
        src.disability_hi,
        src.disability_asd,
        src.disability_sld,
        src.disability_ld,
        src.disability_ebd,
        src.disability_cp,
        src.disability_intel,
        src.disability_oph,
        src.disability_hsp,
        src.disability_shp_cancer,
        src.disability_multiple,
        src.disability_unsure,
        src.disability_other,
        src.cu_address_sitio_street,
        src.cu_address_house,
        src.cu_address_zip,
        src.address_permanent_current,
        src.pe_address_sitio_street,
        src.pe_address_house,
        src.pe_address_zip,
        src.father_lastname,
        src.father_firstname,
        src.father_middlename,
        src.father_contact,
        src.mother_lastname,
        src.mother_firstname,
        src.mother_middlename,
        src.mother_contact,
        src.guardian_lastname,
        src.guardian_firstname,
        src.guardian_middlename,
        src.guardian_contact,
        src.last_school,
        src.last_school_scid,
        src.semester,
        src.modality_modular_print,
        src.modality_modular_digital,
        src.modality_online,
        src.modality_tv,
        src.modality_rbi,
        src.modality_homeschooling,
        src.modality_blended,
        src.parent_guardian,
        src.consent,
        src.subjects,
        src.interest,
        src.created_at,
        src.updated_at,
        src.deleted_at,
        CASE
          WHEN src.school_year_id IS NULL THEN NULL
          WHEN EXISTS (SELECT 1 FROM school_years sy WHERE sy.id = src.school_year_id) THEN src.school_year_id
          ELSE NULL
        END,
        src.grade_to_enroll_id,
        src.mother_tongue_id,
        src.ip_group_id,
        src.cu_address_province_id,
        src.cu_address_municipality_id,
        src.cu_address_barangay_id,
        src.pe_address_province_id,
        src.pe_address_municipality_id,
        src.pe_address_barangay_id,
        src.last_grade_level_id,
        src.last_school_year_id,
        src.track_id,
        src.strand_id,
        src.user_id,
        JSON_OBJECT(
          'section', src.section,
          'schoolYearLabel', src.SY,
          'quarter', src.quarter,
          'gradeLevel', src.gradelevel
        )
      FROM ${stagingTable} src
      LEFT JOIN enrollments dst ON dst.id = src.id
      WHERE dst.id IS NULL
    `;

    const [insertResult] = await conn.query(insertSql);
    const [[{ afterCount }]] = await conn.query('SELECT COUNT(*) AS afterCount FROM enrollments');

    await conn.query(`DROP TABLE IF EXISTS ${stagingTable}`);

    console.log('IMPORT_COMPLETE');
    console.log('STAGING_ROWS:', stagingCount);
    console.log('STAGING_DISTINCT_IDS:', distinctIds);
    console.log('TARGET_BEFORE:', beforeCount);
    console.log('INSERTED_ROWS:', insertResult.affectedRows);
    console.log('TARGET_AFTER:', afterCount);
    console.log('SKIPPED_ROWS:', stagingCount - insertResult.affectedRows);
  } catch (error) {
    try {
      await conn.query('DROP TABLE IF EXISTS `_import_enrollments_raw`');
    } catch (_) {}

    console.error('IMPORT_FAILED');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();



