const parseLDT = require('./server/utils/ldtParser');

// Test with the actual LDT format provided by the user
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

console.log('🧪 Testing LDT Parser with Actual Format');
console.log('==========================================');

console.log('\n📋 Input LDT Message:');
console.log(testLDTMessage);

console.log('\n🔍 Parsing LDT Message...');
const parsedRecords = parseLDT(testLDTMessage);

console.log(`\n✅ Parsed ${parsedRecords.length} records:`);
console.log('==========================================');

parsedRecords.forEach((record, index) => {
  console.log(`\nRecord ${index + 1}:`);
  console.log(`  Raw: ${record.raw}`);
  console.log(`  Length: ${record.length}`);
  console.log(`  Record Type: ${record.recordType}`);
  console.log(`  Field ID: ${record.fieldId}`);
  console.log(`  Content: ${record.content}`);
});

console.log('\n📊 Summary:');
console.log(`Total Records: ${parsedRecords.length}`);

// Group by record type
const recordTypes = {};
parsedRecords.forEach(record => {
  const type = record.recordType;
  if (!recordTypes[type]) {
    recordTypes[type] = [];
  }
  recordTypes[type].push(record);
});

console.log('\n📈 Record Types Distribution:');
Object.keys(recordTypes).forEach(type => {
  console.log(`  ${type}: ${recordTypes[type].length} records`);
});

console.log('\n🎉 LDT Parser Test Complete!');