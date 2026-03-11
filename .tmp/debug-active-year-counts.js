const pool = require('../db');

(async () => {
  try {
    const [tenantCols] = await pool.query("SHOW COLUMNS FROM tenants");
    console.log('TENANT_COLUMNS', tenantCols.map(c => c.Field));

    const [syCols] = await pool.query("SHOW COLUMNS FROM school_years");
    console.log('SCHOOL_YEAR_COLUMNS', syCols.map(c => c.Field));

    const [enCols] = await pool.query("SHOW COLUMNS FROM enrollments");
    console.log('ENROLLMENT_COLUMNS_HAS_STATUS', enCols.some(c => c.Field === 'status'));

    const [activeRows] = await pool.query("SELECT * FROM school_years WHERE is_active = 1 LIMIT 10");
    console.log('ACTIVE_SY_ROWS', activeRows);

    const [counts] = await pool.query("SELECT school_year_id, status, COUNT(*) AS cnt FROM enrollments GROUP BY school_year_id, status ORDER BY school_year_id, status");
    console.log('ENROLLMENT_COUNTS_BY_SY_STATUS', counts);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
})();



