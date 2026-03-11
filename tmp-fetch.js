const http=require('http');
const options={host:'localhost',port:3001,path:'/api/enrollments?limit=10&sort=recent',method:'GET'};
const req=http.request(options,res=>{console.log('status',res.statusCode);
let data='';res.on('data',c=>data+=c);res.on('end',()=>{try{const arr=JSON.parse(data);console.log('rows',arr.length,arr.map(r=>r.id));}catch(e){console.log('body length',data.length);console.log(data);} });});
req.on('error',e=>console.error('req err',e));req.end();

