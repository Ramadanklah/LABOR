/**
 * LDT (Labor Daten Transfer) Parser
 * Parses LDT content and returns structured data
 * 
 * @param {string} ldtString – raw LDT payload
 * @returns {Object} - {success: boolean, data?: Object, message?: string}
 */
function parseLDT(ldtString = '') {
  try {
    // Handle empty or invalid input
    if (typeof ldtString !== 'string' || !ldtString.trim()) {
      return {
        success: false,
        message: 'Empty LDT content provided'
      };
    }

    if (ldtString === null || ldtString === undefined) {
      return {
        success: false,
        message: 'Null or undefined LDT content'
      };
    }

    // Parse the LDT content
    const data = parseSimpleLDTFormat(ldtString);
    
    if (!data) {
      return {
        success: false,
        message: 'Failed to parse LDT content - malformed data'
      };
    }

    // Validate required fields
    const validationResult = validateLDTData(data);
    if (!validationResult.valid) {
      return {
        success: false,
        message: validationResult.message
      };
    }

    return {
      success: true,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      message: `Error parsing LDT: ${error.message}`,
      error: error
    };
  }
}

/**
 * Parse simple LDT format (key: value pairs)
 */
function parseSimpleLDTFormat(ldtString) {
  const lines = ldtString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const data = {
    bsnr: null,
    lanr: null,
    patientData: {},
    results: []
  };

  let currentResult = null;

  for (const line of lines) {
    // Parse key: value format
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    switch (key) {
      case '8220': // BSNR
        data.bsnr = value;
        break;
      case '8221': // LANR
        data.lanr = value;
        break;
      case '3000': // Patient number or test code
        if (!data.patientData.patientNumber) {
          data.patientData.patientNumber = value;
        } else {
          // This is a test code, start new result
          if (currentResult) {
            data.results.push(currentResult);
          }
          currentResult = { testCode: value };
        }
        break;
      case '3101': // Last name
        data.patientData.lastName = value;
        break;
      case '3102': // First name
        data.patientData.firstName = value;
        break;
      case '3103': // Date of birth
        data.patientData.dateOfBirth = value;
        break;
      case '3110': // Gender
        data.patientData.gender = value;
        break;
      case '8410': // Test name
        if (currentResult) {
          currentResult.testName = value;
        }
        break;
      case '8411': // Test value
        if (currentResult) {
          currentResult.value = value;
        }
        break;
      case '8421': // Unit
        if (currentResult) {
          currentResult.unit = value;
        }
        break;
      case '8422': // Reference range
        if (currentResult) {
          currentResult.referenceRange = value;
        }
        break;
    }
  }

  // Add the last result if exists
  if (currentResult) {
    data.results.push(currentResult);
  }

  return data;
}

/**
 * Validate LDT data structure
 */
function validateLDTData(data) {
  const errors = [];

  // Validate BSNR (9 digits)
  if (data.bsnr && !/^\d{9}$/.test(data.bsnr)) {
    errors.push('Invalid BSNR format - must be 9 digits');
  }

  // Validate LANR (9 digits)
  if (data.lanr && !/^\d{9}$/.test(data.lanr)) {
    errors.push('Invalid LANR format - must be 9 digits');
  }

  // Validate date format (DD.MM.YYYY)
  if (data.patientData.dateOfBirth && !/^\d{2}\.\d{2}\.\d{4}$/.test(data.patientData.dateOfBirth)) {
    errors.push('Invalid date format - must be DD.MM.YYYY');
  }

  // Validate gender (m/w/d)
  if (data.patientData.gender && !/^[mwd]$/.test(data.patientData.gender)) {
    errors.push('Invalid gender format - must be m, w, or d');
  }

  // Validate email if present
  if (data.patientData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.patientData.email)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    message: errors.length > 0 ? errors.join('; ') : null
  };
}

/**
 * Extract numeric value from test result
 */
function extractNumericValue(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/[\d.,]+/);
  return match ? parseFloat(match[0].replace(',', '.')) : null;
}

/**
 * Parse reference range
 */
function parseReferenceRange(range) {
  if (!range) return null;
  
  // Handle different formats: "70-110", "<5", ">100", "70 - 110"
  const cleanRange = range.replace(/\s+/g, '');
  
  if (cleanRange.includes('-')) {
    const parts = cleanRange.split('-');
    return {
      min: parseFloat(parts[0]) || null,
      max: parseFloat(parts[1]) || null,
      original: range
    };
  }
  
  if (cleanRange.startsWith('<')) {
    return {
      max: parseFloat(cleanRange.substring(1)) || null,
      original: range
    };
  }
  
  if (cleanRange.startsWith('>')) {
    return {
      min: parseFloat(cleanRange.substring(1)) || null,
      original: range
    };
  }
  
  return { original: range };
}

module.exports = parseLDT;