const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'routes', 'system-health.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the route definition
content = content.replace("router.get('/system-health',", "router.get('/',");

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed system-health router path');


