const http = require('http');
const data = JSON.stringify({school_year:'2026-2027',start_date:'2026-07-01',end_date:'2027-03-29'});
const req = http.request({hostname:'localhost',port:3001,path:'/api/school-years',method:'POST',headers:{'Content-Type':'application/json','Content-Length':data.length}}, res => {
  let d='';
  res.on('data', c=> d+=c);
  res.on('end', ()=>{
    console.log(res.statusCode);
    console.log(d);
  });
});
req.on('error', e=> console.error('req error', e));
req.write(data);
req.end();

