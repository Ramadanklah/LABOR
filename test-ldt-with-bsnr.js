const parseLDT = require('./server/utils/ldtParser');

// Test LDT message with BSNR and LANR values that match existing users
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
017920200000724
0148100123456789
01481001234567`;

console.log('🧪 Testing LDT with BSNR/LANR Matching');
console.log('=======================================');

// Mock the userModel and mockDatabase for testing
const mockUserModel = {
  getUserByBsnrLanr: (bsnr, lanr) => {
    if (bsnr === '123456789' && lanr === '1234567') {
      return {
        id: 'user_doctor',
        email: 'doctor@laborresults.de',
        firstName: 'Dr. Maria',
        lastName: 'Schmidt',
        role: 'doctor',
        bsnr: '123456789',
        lanr: '1234567'
      };
    }
    if (bsnr === '123456789' && lanr === '1234568') {
      return {
        id: 'user_lab',
        email: 'lab@laborresults.de',
        firstName: 'Hans',
        lastName: 'Mueller',
        role: 'lab_technician',
        bsnr: '123456789',
        lanr: '1234568'
      };
    }
    return null;
  }
};

const mockDatabase = {
  extractLDTIdentifiers: (parsedRecords) => {
    let bsnr = null;
    let lanr = null;
    let patientData = {};

    for (const record of parsedRecords) {
      // Look for BSNR and LANR in various record types
      if (record.recordType === '8100') {
        // BSNR and LANR might be in different field IDs
        if (record.fieldId === '0201' || record.fieldId === '0020') {
          bsnr = record.content;
        } else if (record.fieldId === '0202' || record.fieldId === '0021') {
          lanr = record.content;
        }
      }

      // Look for patient data in various record types
      if (record.recordType === '3101') {
        patientData.lastName = record.content;
      } else if (record.recordType === '3102') {
        patientData.firstName = record.content;
      } else if (record.recordType === '3103') {
        patientData.birthDate = record.content;
      } else if (record.recordType === '3110') {
        patientData.gender = record.content;
      }
    }

    // If we don't find standard BSNR/LANR, try to extract from other fields
    if (!bsnr || !lanr) {
      for (const record of parsedRecords) {
        // Look for potential identifiers in various fields
        if (record.content && record.content.length >= 5) {
          // Try to find BSNR-like patterns (9 digits)
          if (/^\d{9}$/.test(record.content)) {
            bsnr = record.content;
          }
          // Try to find LANR-like patterns (7 digits)
          else if (/^\d{7}$/.test(record.content)) {
            lanr = record.content;
          }
        }
      }
    }

    return { bsnr, lanr, patientData };
  },

  findUserByBsnrLanr: (bsnr, lanr) => {
    return mockUserModel.getUserByBsnrLanr(bsnr, lanr);
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
      assignedTo: null, // Will be set if user is found
      ldtMessageId: ldtMessageId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      patientData: ldtData.patientData
    };

    // Try to find and assign user
    if (ldtData.bsnr && ldtData.lanr) {
      const user = this.findUserByBsnrLanr(ldtData.bsnr, ldtData.lanr);
      if (user) {
        result.assignedTo = user.email;
        result.assignedUsers = [user.email];
        result.doctorId = user.id;
      }
    }

    return result;
  }
};

console.log('\n📋 Test LDT Message with BSNR/LANR:');
console.log(testLDTMessage);

console.log('\n🔍 Parsing LDT Message...');
const parsedRecords = parseLDT(testLDTMessage);

console.log(`\n✅ Parsed ${parsedRecords.length} records`);

console.log('\n🔍 Extracting BSNR, LANR, and Patient Data...');
const ldtData = mockDatabase.extractLDTIdentifiers(parsedRecords);

console.log('Extracted Data:');
console.log(`  BSNR: ${ldtData.bsnr || 'Not found'}`);
console.log(`  LANR: ${ldtData.lanr || 'Not found'}`);
console.log(`  Patient Data:`, ldtData.patientData);

console.log('\n🔍 Testing User Matching...');
if (ldtData.bsnr && ldtData.lanr) {
  const matchedUser = mockDatabase.findUserByBsnrLanr(ldtData.bsnr, ldtData.lanr);
  
  if (matchedUser) {
    console.log('✅ User Found:');
    console.log(`  Email: ${matchedUser.email}`);
    console.log(`  Name: ${matchedUser.firstName} ${matchedUser.lastName}`);
    console.log(`  Role: ${matchedUser.role}`);
    console.log(`  BSNR: ${matchedUser.bsnr}`);
    console.log(`  LANR: ${matchedUser.lanr}`);
  } else {
    console.log('❌ No user found for BSNR/LANR combination');
  }
} else {
  console.log('❌ BSNR or LANR not found in LDT message');
}

console.log('\n🔍 Testing Result Creation...');
const newResult = mockDatabase.createResultFromLDT(ldtData, 'test_message_id');

console.log('Created Result:');
console.log(`  ID: ${newResult.id}`);
console.log(`  Patient: ${newResult.patient}`);
console.log(`  BSNR: ${newResult.bsnr}`);
console.log(`  LANR: ${newResult.lanr}`);
console.log(`  Assigned To: ${newResult.assignedTo || 'Unassigned'}`);
console.log(`  Assigned Users: ${newResult.assignedUsers.join(', ') || 'None'}`);

console.log('\n🎉 LDT with BSNR/LANR Test Complete!');