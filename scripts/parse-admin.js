const fs = require('fs');
const vm = require('vm');
const path = require('path');
const file = path.join(__dirname, '..', 'admin-dashboard.js');
const code = fs.readFileSync(file, 'utf8');
try {
  new vm.Script(code);
  console.log('Parsed successfully.');
} catch (err) {
  console.error('Parse error:', err.message);
  console.error(err.stack);
  if (err.loc) {
    console.error('Error location:', err.loc);
  }
}
