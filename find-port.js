const http=require('http');
function check(port){return new Promise(res=>{const req=http.request({host:'localhost',port,path:'/api/health',method:'GET',timeout:2000},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res({port,status:r.statusCode,body:d}));});req.on('error',e=>res({port,error:e.message}));req.end();});}
(async()=>{for(let p=3001;p<=3010;p++){let r=await check(p);console.log(r);if(r.status===200)break;} process.exit(0);})();

