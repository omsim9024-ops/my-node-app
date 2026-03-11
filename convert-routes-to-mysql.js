/**
 * Convert PostgreSQL parameterized queries to MySQL
 * Converts $1, $2, etc. to ? and handles .rows accessor
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Convert $1, $2, $3, etc. to ?
    let paramCount = 0;
    content = content.replace(/\$\d+/g, () => '?');
    
    // Handle .rows[0] -> [rows][0] (but only if preceded by pool.query or similar)
    content = content.replace(/pool\.query\([^)]*\)\s*;\s*if\s*\(\s*result\.rows\.length/g, (match) => {
        return match.replace('result = await pool.query', '[rows] = await pool.query').replace('result.rows.length', 'rows.length');
    });
    
    // Convert result.rows to [rows] destructuring and result.rows[0] to rows[0]
    content = content.replace(/const\s+result\s*=\s*await\s+pool\.query/g, 'const [rows] = await pool.query');
    content = content.replace(/result\.rows\[0\]/g, 'rows[0]');
    content = content.replace(/result\.rows\.length/g, 'rows.length');
    content = content.replace(/result\.rows/g, 'rows');
    
    // Remove RETURNING clauses
    content = content.replace(/\s+RETURNING\s+[^`'"]+/gi, '');
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✓ Converted: ${file}`);
    }
});

console.log('\n✅ All route files converted to MySQL syntax!');


