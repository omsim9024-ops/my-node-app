const pool = require('./db.js');

(async () => {
  try {
    // Insert grades 7-12 (standard Philippine high school grades)
    const grades = [
      { grade_number: 7, grade_name: 'Grade 7' },
      { grade_number: 8, grade_name: 'Grade 8' },
      { grade_number: 9, grade_name: 'Grade 9' },
      { grade_number: 10, grade_name: 'Grade 10' },
      { grade_number: 11, grade_name: 'Grade 11' },
      { grade_number: 12, grade_name: 'Grade 12' }
    ];

    for (const grade of grades) {
      await pool.query('INSERT INTO grades (grade_number, grade_name) VALUES (?, ?)', 
        [grade.grade_number, grade.grade_name]);
    }
    
    console.log('✓ Grades table populated successfully');
    
    const [result] = await pool.query('SELECT * FROM grades ORDER BY id');
    console.log('Grades created:', result.map(g => ({ id: g.id, number: g.grade_number, name: g.grade_name })));
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
})();

