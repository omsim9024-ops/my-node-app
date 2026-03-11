const pool=require('./db');
const {resolveAdviserRecord} = require('./routes/teacher-auth');

(async()=>{
 try{
  const req={tenant:{id:0,code:''}};
  const adv = await resolveAdviserRecord('5', req);
  console.log('resolveAdviserRecord result', adv);
 }catch(e){console.error(e)}
 process.exit();
})();