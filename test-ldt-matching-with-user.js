const crypto = require('crypto');

// Mock user model for testing
const userModel = {
  getUserByBsnrLanr: (bsnr, lanr) => {
    if (bsnr === '123456789' && lanr === '1234567') {
      return {
        id: 'user_123',
        email: 'doctor@laborresults.de',
        bsnr: '123456789',
        lanr: '1234567',
        role: 'doctor'
      };
    }
    return null;
  }
};

// Mock database functions
const mockDatabase = {
  extractLDTIdentifiers: (parsedRecords) => {
    let bsnr = null;
    let lanr = null;
    let patientData = {};

    for (const record of parsedRecords) {
      // Look for BSNR and LANR in various record types
      if (record.recordType === '8100') {
        if (record.fieldId === '0201' || record.fieldId === '0020') {
          bsnr = record.content;
        } else if (record.fieldId === '0202' || record.fieldId === '0021') {
          lanr = record.content;
        }
      }

      // Look for BSNR in record type 0201 (Lab info)
      if (record.recordType === '0201') {
        if (record.fieldId === '7981') {
          bsnr = record.content;
        }
      }

      // Look for LANR in record type 0212 (Lab info)
      if (record.recordType === '0212') {
        if (record.fieldId === '7733') {
          lanr = record.content;
        }
      }

      // Look for patient data in record type 8200 (Patient data)
      if (record.recordType === '8200') {
        if (record.fieldId === '3101') {
          patientData.lastName = record.content;
        } else if (record.fieldId === '3102') {
          patientData.firstName = record.content;
        }
      }
    }

    return { bsnr, lanr, patientData };
  },

  findUserByBsnrLanr: (bsnr, lanr) => {
    return userModel.getUserByBsnrLanr(bsnr, lanr);
  },

  createResultFromLDT: (ldtData, ldtMessageId) => {
    const resultId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = {
      id: resultId,
      date: new Date().toISOString().slice(0, 10),
      type: 'LDT Import',
      status: 'Final',
      patient: `${ldtData.patientData.firstName || ''} ${ldtData.patientData.lastName || ''}`.trim() || 'Unknown Patient',
      bsnr: ldtData.bsnr,
      lanr: ldtData.lanr,
      doctorId: null,
      assignedUsers: [],
      assignedTo: null,
      ldtMessageId: ldtMessageId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patientData: ldtData.patientData
    };

    // Try to find and assign user
    if (ldtData.bsnr && ldtData.lanr) {
      const user = mockDatabase.findUserByBsnrLanr(ldtData.bsnr, ldtData.lanr);
      if (user) {
        result.assignedTo = user.email;
        result.assignedUsers = [user.email];
        result.doctorId = user.id;
        console.log(`✅ Result assigned to user: ${user.email}`);
      } else {
        console.log(`❌ No user found for BSNR: ${ldtData.bsnr}, LANR: ${ldtData.lanr}`);
      }
    } else {
      console.log(`❌ BSNR or LANR not found in LDT data`);
    }

    return result;
  }
};

// LDT Parser function
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

// Test LDT message with explicit BSNR and LANR
const testLDTMessage = `01380008230
0148100123456789
01481001234567
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

console.log('🧪 Testing LDT Matching with User Assignment');
console.log('============================================');

// Parse the LDT message
console.log('\n1. Parsing LDT message...');
const parsedRecords = parseLDT(testLDTMessage);
console.log(`   ✅ Parsed ${parsedRecords.length} records`);

// Extract identifiers
console.log('\n2. Extracting BSNR/LANR...');
const ldtData = mockDatabase.extractLDTIdentifiers(parsedRecords);
console.log(`   BSNR: ${ldtData.bsnr || 'Not found'}`);
console.log(`   LANR: ${ldtData.lanr || 'Not found'}`);
console.log(`   Patient: ${ldtData.patientData.firstName || ''} ${ldtData.patientData.lastName || ''}`);

// Create result with assignment
console.log('\n3. Creating result and assigning to user...');
const messageId = crypto.randomUUID();
const newResult = mockDatabase.createResultFromLDT(ldtData, messageId);

console.log('\n4. Result Details:');
console.log(`   ID: ${newResult.id}`);
console.log(`   Patient: ${newResult.patient}`);
console.log(`   BSNR: ${newResult.bsnr}`);
console.log(`   LANR: ${newResult.lanr}`);
console.log(`   Assigned To: ${newResult.assignedTo || 'Unassigned'}`);
console.log(`   Assigned Users: ${newResult.assignedUsers.join(', ') || 'None'}`);

// Test different user scenarios
console.log('\n5. Testing different user scenarios...');

// Test 1: Doctor with matching BSNR/LANR
const doctorUser = {
  id: 'user_123',
  email: 'doctor@laborresults.de',
  bsnr: '123456789',
  lanr: '1234567',
  role: 'doctor'
};

// Test 2: Admin user
const adminUser = {
  id: 'user_456',
  email: 'admin@laborresults.de',
  bsnr: '999999999',
  lanr: '9999999',
  role: 'admin'
};

// Test 3: Lab technician
const labUser = {
  id: 'user_789',
  email: 'lab@laborresults.de',
  bsnr: '123456789',
  lanr: '1234568',
  role: 'lab_technician'
};

// Simulate result filtering for different users
const allResults = [newResult];

function getResultsForUser(user) {
  switch (user.role) {
    case 'admin':
      return allResults; // Can see all results
      
    case 'lab_technician':
      return allResults; // Can see all results
      
    case 'doctor':
      return allResults.filter(result => 
        result.assignedTo === user.email ||
        (result.bsnr === user.bsnr && result.lanr === user.lanr) ||
        result.assignedUsers.includes(user.email) ||
        result.doctorId === user.id
      );
      
    default:
      return [];
  }
}

console.log('\n   Doctor access:');
const doctorResults = getResultsForUser(doctorUser);
console.log(`     Can see ${doctorResults.length} results`);

console.log('\n   Admin access:');
const adminResults = getResultsForUser(adminUser);
console.log(`     Can see ${adminResults.length} results`);

console.log('\n   Lab technician access:');
const labResults = getResultsForUser(labUser);
console.log(`     Can see ${labResults.length} results`);

console.log('\n✅ LDT Matching and User Assignment Test Complete!');

// Additional check: LDT generator includes BSNR and LANR
try {
  const LDTGenerator = require('./server/utils/ldtGenerator');
  const gen = new LDTGenerator();
  const content = gen.generateLDT([{
    id: 'r1',
    date: '2024-01-01',
    type: 'Blood Count',
    status: 'Final',
    patient: 'Test User',
    bsnr: '123456789',
    lanr: '1234567',
  }], { labInfo: { name: 'Test Lab' }, provider: { bsnr: '123456789', lanr: '1234567' } });
  if (!content.includes('81000201' + '123456789') && !content.includes('81000020' + '123456789')) {
    console.error('❌ LDT does not include BSNR field for provider');
    process.exit(1);
  }
  if (!content.includes('81000202' + '1234567') && !content.includes('81000021' + '1234567')) {
    console.error('❌ LDT does not include LANR field for provider');
    process.exit(1);
  }
  console.log('✅ LDT generation includes BSNR and LANR');
} catch (e) {
  console.error('❌ Failed to validate LDT generator for BSNR/LANR:', e.message);
  process.exit(1);
}