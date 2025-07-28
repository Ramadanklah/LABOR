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

console.log('🔍 Debugging LDT Format');
console.log('=======================');

const lines = testLDTMessage.split('\n').map(line => line.trim()).filter(line => line.length > 0);

console.log(`\n📋 Total lines: ${lines.length}`);
console.log('\n📝 Analyzing each line:');

lines.forEach((line, index) => {
  console.log(`\nLine ${index + 1}: "${line}"`);
  console.log(`  Length: ${line.length} characters`);
  
  if (line.length >= 11) {
    const length = line.slice(0, 3);
    const recordType = line.slice(3, 7);
    const fieldId = line.slice(7, 11);
    const content = line.slice(11);
    
    console.log(`  Parsed Length: ${length}`);
    console.log(`  Parsed Record Type: ${recordType}`);
    console.log(`  Parsed Field ID: ${fieldId}`);
    console.log(`  Parsed Content: "${content}"`);
    
    // Check if length is numeric
    const isLengthNumeric = /^\d{3}$/.test(length);
    const isRecordTypeNumeric = /^\d{4}$/.test(recordType);
    const isFieldIdNumeric = /^\d{4}$/.test(fieldId);
    
    console.log(`  Length numeric: ${isLengthNumeric}`);
    console.log(`  Record Type numeric: ${isRecordTypeNumeric}`);
    console.log(`  Field ID numeric: ${isFieldIdNumeric}`);
    
    if (!isLengthNumeric || !isRecordTypeNumeric || !isFieldIdNumeric) {
      console.log(`  ❌ Would be rejected by parser`);
    } else {
      console.log(`  ✅ Would be accepted by parser`);
    }
  } else {
    console.log(`  ❌ Too short (minimum 11 characters required)`);
  }
});

console.log('\n🎯 Parser Test:');
const parsedRecords = parseLDT(testLDTMessage);
console.log(`Parsed records: ${parsedRecords.length}`);