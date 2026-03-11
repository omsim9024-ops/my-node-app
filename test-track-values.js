// quick script to replicate value array size
const TRACK_NAME_TO_ID = { academic:1, techpro:2, doorway:3 };
const payload = {
  student_id:1, gradeLevel:'11', semester:'First', track:'academic', electives:[], returningLearner:'no', lastName:'Test', firstName:'Track', middleName:'', extensionName:'', birthdate:'2008-01-01', age:17, sex:'Male', placeOfBirth:'Nowhere', isIP:'no', is4Ps:'no', disability:[], disabilityDetails:null, currentSitio:'', currentZipCode:'', sameAsCurrentAddress:true, permanentSitio:'', permanentZipCode:'', fatherName:'', fatherContact:'', motherMaidenName:'', motherContact:'', guardianName:'', guardianContact:'', learningModality:'online', certification:true, dataPrivacy:true, enrollmentFiles:{}
};

const {
  student_id,
  gradeLevel,
  semester,
  track,
  electives,
  returningLearner,
  lastSchoolAttended,
  hasLRN,
  lrn,
  lastName,
  firstName,
  middleName,
  extensionName,
  birthdate,
  age,
  sex,
  placeOfBirth,
  isIP,
  is4Ps,
  currentSitio,
  currentZipCode,
  sameAsCurrentAddress,
  permanentSitio,
  permanentZipCode,
  guardianName,
  certification,
  dataPrivacy,
  enrollmentFiles
} = payload;

let gradeValue = gradeLevel ? parseInt(gradeLevel, 10) : null;
if (gradeValue !== null && isNaN(gradeValue)) gradeValue = null;
let trackId = null;
if (track && typeof track === 'string') {
  const key = track.toLowerCase();
  if (TRACK_NAME_TO_ID[key]) trackId = TRACK_NAME_TO_ID[key];
}

const subjectsStr = Array.isArray(electives) ? electives.join(', ') : (electives || '');

const values = [
  hasLRN === 'yes' ? 'Yes' : 'No',
  returningLearner === 'yes' ? 'Yes' : 'No',
  null,
  lrn || null,
  lastName || '',
  firstName || '',
  middleName || '-',
  extensionName || '-',
  birthdate || null,
  sex || '',
  age || null,
  placeOfBirth || '-',
  isIP === 'yes' ? 'Yes' : 'No',
  is4Ps === 'yes' ? 'Yes' : 'No',
  // disability flags stub - just put placeholders
  'No',0,0,0,0,0,0,0,0,0,0,0,0,0,0, null,
  currentSitio || '-',
  '-',
  currentZipCode || '-',
  sameAsCurrentAddress ? '1' : '0',
  permanentSitio || '-',
  '-',
  permanentZipCode || '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  '-',
  lastSchoolAttended || '-',
  semester || 'First',
  0,0,0,0,0,0,0,
  guardianName || '',
  (certification === true || certification === 'true') ? 1 : 0,
  subjectsStr || '-',
  JSON.stringify(enrollmentFiles || {}),
  null,
  gradeValue,
  trackId,
  student_id
];

console.log('values length', values.length);
console.log('last values', values.slice(-5));

