const parseLDT = require('./server/utils/ldtParser');

const testLDTMessage = `01380008230
014810000204
0199212LDT1014.01
0180201798115000
0220203Labor Potsdam
0260205Charlottenstr. 72
0180212773351101
0158300ulab12
0170101V0011271
01091064
0158312KLEMMK
017910320250430
01380008218
014810000476
017831001376932
0108609K
0153101Krause
0153102Noreen
017310319800820
0193105G241376228
0193107Mittelstr.
01031091
01031081
014311214797
0233113Kloster Lehnin
011311683
0184111105836717
017843220250430
01384330401
0184218798115000
01042211
0184242773351101
011423927
01084031
0103110W
01086110
0128410KBB
0118410FE
0138410FERR
0158410TRANSF
0259901LOCATION|Potsdam
0589901*IMAGENAME\\\\172.16.70.245\\la\\scanner\\01376932.tif
01380008231
014810000044
017920200000724`;

console.log('🔍 Analyzing LDT Message for BSNR and LANR');
console.log('==========================================');

const parsedRecords = parseLDT(testLDTMessage);

console.log(`\n📋 Total records: ${parsedRecords.length}`);

// Look for potential BSNR and LANR values
console.log('\n🔍 Searching for BSNR and LANR values...');

// Common BSNR patterns (9 digits)
const bsnrPattern = /^\d{9}$/;
// Common LANR patterns (7 digits)
const lanrPattern = /^\d{7}$/;

const potentialBsnr = [];
const potentialLanr = [];

parsedRecords.forEach((record, index) => {
  // Check if content looks like BSNR (9 digits)
  if (record.content && bsnrPattern.test(record.content)) {
    potentialBsnr.push({
      index,
      recordType: record.recordType,
      fieldId: record.fieldId,
      content: record.content,
      raw: record.raw
    });
  }
  
  // Check if content looks like LANR (7 digits)
  if (record.content && lanrPattern.test(record.content)) {
    potentialLanr.push({
      index,
      recordType: record.recordType,
      fieldId: record.fieldId,
      content: record.content,
      raw: record.raw
    });
  }
});

console.log('\n📊 Potential BSNR values:');
if (potentialBsnr.length > 0) {
  potentialBsnr.forEach(item => {
    console.log(`  Record ${item.index + 1}: ${item.recordType}/${item.fieldId} = "${item.content}"`);
  });
} else {
  console.log('  No BSNR values found');
}

console.log('\n📊 Potential LANR values:');
if (potentialLanr.length > 0) {
  potentialLanr.forEach(item => {
    console.log(`  Record ${item.index + 1}: ${item.recordType}/${item.fieldId} = "${item.content}"`);
  });
} else {
  console.log('  No LANR values found');
}

// Look for specific record types that might contain identifiers
console.log('\n🔍 Records by type:');
const recordsByType = {};
parsedRecords.forEach(record => {
  if (!recordsByType[record.recordType]) {
    recordsByType[record.recordType] = [];
  }
  recordsByType[record.recordType].push(record);
});

Object.keys(recordsByType).sort().forEach(recordType => {
  console.log(`\n  Record Type ${recordType} (${recordsByType[recordType].length} records):`);
  recordsByType[recordType].forEach(record => {
    console.log(`    ${record.fieldId}: "${record.content}"`);
  });
});

// Look for patient data
console.log('\n🔍 Patient data records:');
const patientRecords = parsedRecords.filter(record => 
  record.recordType === '3101' || 
  record.recordType === '3102' || 
  record.recordType === '3103' || 
  record.recordType === '3110'
);

patientRecords.forEach(record => {
  console.log(`  ${record.recordType}/${record.fieldId}: "${record.content}"`);
});

console.log('\n🎯 Analysis Complete!');