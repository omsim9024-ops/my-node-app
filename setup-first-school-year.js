const pool = require('./db');

async function createSchoolYear() {
  try {
    // Check if any school years exist
    const check = await pool.query('SELECT * FROM school_years LIMIT 1');
    console.log('Existing school years:', check.rows.length);
    
    if (check.rows.length === 0) {
      console.log('No school years found. Creating first school year...');
      const result = await pool.query(
        'INSERT INTO school_years (school_year, start_date, end_date, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
        ['2025-2026', '2025-06-01', '2026-05-31', true]
      );
      console.log('✓ Created school year:', result.rows[0]);
    } else {
      console.log('✓ School years already exist:');
      check.rows.forEach(row => {
        console.log(`  - ${row.school_year} (${row.start_date} to ${row.end_date}) - Active: ${row.is_active}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createSchoolYear();

