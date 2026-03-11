const fs=require('fs');
const f=fs.readFileSync('d:\\Projects\\SMS\\routes\\enrollments.js','utf8');
const m=f.match(/INSERT INTO enrollments \(([^)]+)\) VALUES/);
if(m){
  const cols=m[1].split(',').map(s=>s.trim());
  console.log('columns count',cols.length);
  cols.forEach((c,i)=> console.log(i+1, c));
  // also show placeholders and their index, side by side with columns
  const valsMatch=f.match(/VALUES \(([^)]+)\)/);
  if(valsMatch){
    const vals=valsMatch[1];
    const placeholders=vals.split(',').map(s=>s.trim());
    console.log('placeholders count', placeholders.length);
    const max = Math.max(cols.length, placeholders.length);
    for(let i=0;i<max;i++){
      console.log(i+1, cols[i]||'<none>', placeholders[i]||'<none>');
    }
  }
} else console.log('no match');


