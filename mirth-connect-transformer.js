// Mirth Connect JavaScript Transformer
// Converts LDT messages to JSON format for web app integration

// LDT Parser function
function parseLDT(ldtString) {
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
    logger.error('Error parsing LDT record:', raw, error);
    return null;
  }
}

// Extract identifiers from LDT records
function extractLDTIdentifiers(parsedRecords) {
  let bsnr = null;
  let lanr = null;
  let patientData = {};
  let labData = {};
  let testData = {};

  for (const record of parsedRecords) {
    // Look for BSNR in record type 0201 (Lab info) - field 7981
    if (record.recordType === '0201' && record.fieldId === '7981') {
      bsnr = record.content;
    }

    // Look for LANR in record type 0212 (Lab info) - field 7733
    if (record.recordType === '0212' && record.fieldId === '7733') {
      lanr = record.content;
    }

    // Look for patient data in various record types
    if (record.recordType === '3101') {
      patientData.lastName = record.content;
    } else if (record.recordType === '3102') {
      patientData.firstName = record.content;
    } else if (record.recordType === '3103') {
      patientData.birthDate = record.content;
    } else if (record.recordType === '3105') {
      patientData.patientId = record.content;
    } else if (record.recordType === '3107') {
      patientData.address = record.content;
    } else if (record.recordType === '3112') {
      patientData.postalCode = record.content;
    } else if (record.recordType === '3113') {
      patientData.city = record.content;
    }

    // Look for lab information
    if (record.recordType === '0203') {
      labData.name = record.content;
    } else if (record.recordType === '0205') {
      labData.address = record.content;
    }

    // Look for test information
    if (record.recordType === '8300') {
      testData.requestId = record.content;
    } else if (record.recordType === '8432') {
      testData.testDate = record.content;
    }

    // Look for test parameters (8400 series)
    if (record.recordType === '8410') {
      if (!testData.parameters) testData.parameters = [];
      testData.parameters.push({
        fieldId: record.fieldId,
        content: record.content
      });
    }
  }

  return { bsnr, lanr, patientData, labData, testData };
}

// Main transformer function
function transformLDTToJSON(ldtMessage) {
  try {
    // Parse LDT message
    const parsedRecords = parseLDT(ldtMessage);
    
    if (parsedRecords.length === 0) {
      throw new Error('No valid LDT records found');
    }

    // Extract identifiers and data
    const ldtData = extractLDTIdentifiers(parsedRecords);
    
    if (!ldtData.bsnr || !ldtData.lanr) {
      throw new Error('BSNR or LANR not found in LDT message');
    }

    // Build patient name
    const patientName = `${ldtData.patientData.firstName || ''} ${ldtData.patientData.lastName || ''}`.trim() || 'Unknown Patient';

    // Build JSON payload
    const jsonPayload = {
      lanr: ldtData.lanr,
      bsnr: ldtData.bsnr,
      patient: patientName,
      type: 'Laboratory Test',
      status: 'Final',
      date: ldtData.testData.testDate || new Date().toISOString().slice(0, 10),
      resultId: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: {
        patientId: ldtData.patientData.patientId,
        birthDate: ldtData.patientData.birthDate,
        address: ldtData.patientData.address,
        postalCode: ldtData.patientData.postalCode,
        city: ldtData.patientData.city,
        labName: ldtData.labData.name,
        labAddress: ldtData.labData.address,
        requestId: ldtData.testData.requestId,
        testDate: ldtData.testData.testDate,
        parameters: ldtData.testData.parameters || [],
        recordCount: parsedRecords.length,
        rawLDT: ldtMessage
      }
    };

    return jsonPayload;

  } catch (error) {
    logger.error('Error transforming LDT to JSON:', error);
    throw error;
  }
}

// Mirth Connect transformer entry point
// This function is called by Mirth Connect
function transform(msg, channelMap, sourceMap) {
  try {
    // Get the LDT message from the incoming message
    const ldtMessage = msg.toString();
    
    // Transform LDT to JSON
    const jsonPayload = transformLDTToJSON(ldtMessage);
    
    // Return the JSON payload
    return JSON.stringify(jsonPayload);
    
  } catch (error) {
    logger.error('Transformer error:', error);
    
    // Return error response
    return JSON.stringify({
      error: true,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    transform,
    transformLDTToJSON,
    parseLDT,
    extractLDTIdentifiers
  };
}