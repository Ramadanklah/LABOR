// Debug script to see what records are being parsed
const ldtMessage = `01380008230
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

function parseLDT(ldtString = '') {
  if (!ldtString || typeof ldtString !== 'string') {
    return [];
  }

  const lines = ldtString.split('\n').filter(line => line.trim());
  const records = [];

  for (const line of lines) {
    const record = parseRecord(line);
    if (record) {
      records.push(record);
    }
  }

  return records;
}

function parseRecord(raw) {
  if (!raw || raw.length < 8) {
    return null;
  }

  try {
    if (raw.length >= 11) {
      const length = raw.slice(0, 3);
      const recordType = raw.slice(3, 7);
      const fieldId = raw.slice(7, 11);
      const content = raw.slice(11);

      if (!/^\d{3}$/.test(length)) {
        return null;
      }

      if (!/^\d{4}$/.test(recordType)) {
        return null;
      }

      if (!/^[A-Za-z0-9*]{4}$/.test(fieldId)) {
        return null;
      }

      return { raw, length, recordType, fieldId, content };
    } else if (raw.length >= 8) {
      const length = raw.slice(0, 3);
      const recordType = raw.slice(3, 7);
      const fieldId = raw.slice(7, 8);
      const content = '';

      if (!/^\d{3}$/.test(length)) {
        return null;
      }

      if (!/^\d{4}$/.test(recordType)) {
        return null;
      }

      if (!/^[A-Za-z0-9]$/.test(fieldId)) {
        return null;
      }

      return { raw, length, recordType, fieldId, content };
    }

    return null;
  } catch (error) {
    console.error('Error parsing LDT record:', raw, error);
    return null;
  }
}

console.log('🔍 Debugging LDT Parsing');
console.log('========================');

const parsedRecords = parseLDT(ldtMessage);
console.log(`Total records parsed: ${parsedRecords.length}`);

console.log('\n🔍 Looking for BSNR/LANR records:');
parsedRecords.forEach((record, index) => {
  // Look for records that might contain BSNR or LANR
  if (record.recordType === '0201' || record.recordType === '0212' || 
      record.fieldId === '7981' || record.fieldId === '7733' ||
      record.content.includes('93860200') || record.content.includes('72720053')) {
    console.log(`   ${index + 1}. ${record.raw}`);
    console.log(`      Type: ${record.recordType}, Field: ${record.fieldId}, Content: ${record.content}`);
  }
});

console.log('\n🔍 All records with 0201 or 0212 type:');
parsedRecords.forEach((record, index) => {
  if (record.recordType === '0201' || record.recordType === '0212') {
    console.log(`   ${index + 1}. ${record.raw}`);
    console.log(`      Type: ${record.recordType}, Field: ${record.fieldId}, Content: ${record.content}`);
  }
});

console.log('\n🔍 Records containing BSNR or LANR values:');
parsedRecords.forEach((record, index) => {
  if (record.content.includes('93860200') || record.content.includes('72720053')) {
    console.log(`   ${index + 1}. ${record.raw}`);
    console.log(`      Type: ${record.recordType}, Field: ${record.fieldId}, Content: ${record.content}`);
  }
});

console.log('\n🔍 Checking specific BSNR/LANR records:');
parsedRecords.forEach((record, index) => {
  if (record.recordType === '0201' || record.recordType === '0212') {
    console.log(`   ${index + 1}. ${record.raw}`);
    console.log(`      Type: ${record.recordType}, Field: ${record.fieldId}, Content: "${record.content}"`);
    console.log(`      Raw length: ${record.raw.length}, Content length: ${record.content.length}`);
  }
});

console.log('\n🔍 First 10 records for reference:');
parsedRecords.slice(0, 10).forEach((record, index) => {
  console.log(`   ${index + 1}. ${record.raw}`);
  console.log(`      Type: ${record.recordType}, Field: ${record.fieldId}, Content: ${record.content}`);
});