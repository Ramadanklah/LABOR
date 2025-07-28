const rawMessage = `01380008230
014810000205
0199212LDT1014.01
0180201793860200
0220203Labor Potsdam
0260205Charlottenstr. 72
0180212772720053
0158300ulab12
0170101V0011271
01091064
0168312FREITAG
017910320250430
01380008218
014810000575
017831000598252
0108609K
0133101Bohr
0133102Anke
017310319630624
0193105H329268036
0193107Habichtweg
01031095
01031081
014311214469
0163113Potsdam
011311683
0184111100580002
017843220250430
0184218793860200
01042211
0184242772720053
011423927
01084031
0103110W
01086110
0128410GBB
0148410HBA1C
0118410NA
0108410K
0118410CA
0118410HN
0138410KREA
0138410ALAT
0138410ASAT
0128410GGT
0158410GLUCEX
0128410CRP
0128410TSH
0158410VITB12
0259901LOCATION|Potsdam
0589901*IMAGENAME\\\\172.16.70.245\\la\\scanner\\00598252.tif
01380008231
014810000044
017920200000824`;

console.log('🔍 Debugging BSNR Extraction');
console.log('=============================');

// Look for patterns that might contain BSNR
console.log('\n🔍 Looking for BSNR patterns:');

// Pattern 1: 0180201793860200
const pattern1 = rawMessage.match(/018020179(\d{8})/);
console.log(`Pattern 1 (018020179...): ${pattern1 ? pattern1[1] : 'Not found'}`);

// Pattern 2: 0184218793860200
const pattern2 = rawMessage.match(/018421879(\d{8})/);
console.log(`Pattern 2 (018421879...): ${pattern2 ? pattern2[1] : 'Not found'}`);

// Pattern 3: Look for any 8-digit number after 0201
const pattern3 = rawMessage.match(/0201(\d{8})/);
console.log(`Pattern 3 (0201...): ${pattern3 ? pattern3[1] : 'Not found'}`);

// Pattern 4: Look for any 8-digit number after 4218
const pattern4 = rawMessage.match(/4218(\d{8})/);
console.log(`Pattern 4 (4218...): ${pattern4 ? pattern4[1] : 'Not found'}`);

// Pattern 5: Look for any 8-digit number
const pattern5 = rawMessage.match(/(\d{8})/);
console.log(`Pattern 5 (any 8 digits): ${pattern5 ? pattern5[1] : 'Not found'}`);

// Look for all 8-digit numbers
const all8DigitNumbers = rawMessage.match(/(\d{8})/g);
console.log('\n🔍 All 8-digit numbers found:');
if (all8DigitNumbers) {
  all8DigitNumbers.forEach((num, index) => {
    console.log(`   ${index + 1}. ${num}`);
  });
}

// Look for all 7-digit numbers (LANR)
const all7DigitNumbers = rawMessage.match(/(\d{7})/g);
console.log('\n🔍 All 7-digit numbers found:');
if (all7DigitNumbers) {
  all7DigitNumbers.forEach((num, index) => {
    console.log(`   ${index + 1}. ${num}`);
  });
}

// Look for specific lines containing BSNR/LANR
console.log('\n🔍 Lines containing potential BSNR/LANR:');
const lines = rawMessage.split('\n');
lines.forEach((line, index) => {
  if (line.includes('93860200') || line.includes('72720053') || 
      line.includes('0201') || line.includes('0212')) {
    console.log(`   Line ${index + 1}: ${line}`);
  }
});