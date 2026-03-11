const fs=require('fs');
const f=fs.readFileSync('d:\\Projects\\SMS\\routes\\enrollments.js','utf8');
const m=f.match(/VALUES \(([^)]+)\)/);
if(m){
  const vals=m[1];
  const count=(vals.match(/\?/g)||[]).length;
  console.log('placeholder count',count);
  console.log('last 50 chars of vals', vals.slice(-50));
}
else console.log('no match');


