const pool=require('./db');
const {resolveTeacherRecord, resolveAdviserRecord} = require('./routes/teacher-auth');
(async()=>{
 try{
   const req={tenant:{id:1,code:'default-school'}};
   const teacherIdentifier='5';
   let teacher = await resolveTeacherRecord(teacherIdentifier, req);
   console.log('initial teacher', teacher);
   if (!teacher || !teacher.id) {
     console.log('no teacher, checking adviser');
     const adviser = await resolveAdviserRecord(teacherIdentifier, req);
     console.log('adviser', adviser);
     if (adviser && adviser.id) {
       // simulate the fallback logic for creation (only the relevant part)
       teacher = await resolveTeacherRecord(adviser.adviser_id || adviser.email || '', req);
       console.log('resolved before insert', teacher);
       if (!teacher || !teacher.id) {
         const columns = await pool.query('SHOW COLUMNS FROM teachers');
         const columnSet = new Set(columns[0].map(c=>c.Field));
         const hasTenant = columnSet.has('tenant_id');
         const defaultDept = 'Unassigned';
         const displayName = adviser.name || [adviser.first_name, adviser.last_name].filter(Boolean).join(' ').trim() || '';
         const insertSql = hasTenant
            ? 'INSERT INTO teachers (teacher_id, name, department, email, tenant_id, created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)'
            : 'INSERT INTO teachers (teacher_id, name, department, email, created_at) VALUES (?,?,?, ?,CURRENT_TIMESTAMP)';
         const params = hasTenant
            ? [adviser.adviser_id || '', displayName, defaultDept, adviser.email || '', Number(req?.tenant?.id || 0) || null]
            : [adviser.adviser_id || '', displayName, defaultDept, adviser.email || ''];
         try{
           const [result] = await pool.query(insertSql, params);
           console.log('inserted teacher id', result.insertId);
           teacher = {id: result.insertId, teacher_id: adviser.adviser_id || '', name: displayName || adviser.name, email: adviser.email};
         }catch(e){
           console.error('insert error', e.code);
           if(e && e.code==='ER_DUP_ENTRY'){
              console.log('duplicate encountered');
              teacher=await resolveTeacherRecord(adviser.adviser_id||adviser.email||'',req);
           }
         }
       }
     }
   }
   console.log('final teacher', teacher);
 }catch(e){console.error(e);}
 process.exit();
})();