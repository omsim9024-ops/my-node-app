const pool = require('./db');

async function createSchoolYear() {
  try {
    // Check if any school years exist
    const [rows] = await pool.query('SELECT * FROM school_years LIMIT 1');
    console.log('Existing school years:', rows.length);
    
    if (rows.length === 0) {
      console.log('No school years found. Creating first school year...');
      const [result] = await pool.query(
        'INSERT INTO school_years (school_year, start_date, end_date, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        ['2025-2026', '2025-06-01', '2026-05-31', 1]
      );

      // Fetch inserted row
      const [newRows] = await pool.query('SELECT * FROM school_years WHERE id = ?', [result.insertId]);
      console.log('✓ Created school year:', newRows[0]);
    } else {
      console.log('✓ School years already exist:');
      rows.forEach(row => {
        console.log(`  - ${row.school_year} (${row.start_date} to ${row.end_date}) - Active: ${row.is_active}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

createSchoolYear();

