/**
 * LDT (Labor Daten Transfer) Parser
 * Handles both XML format (legacy) and line-based format (current)
 * 
 * Line-based format example:
 * 01380008230
 * 014810000204
 * 0199212LDT1014.01
 * 
 * XML format example (legacy):
 * <column1>0278000921818LABOR_RESULTS_V2.1</column1>
 * 
 * Record structure:
 * length   – first 3 chars  (total record length including prefix)
 * type     – next 4 chars   (record type e.g. 8000, 8100 …)
 * fieldId  – next 4 chars   (field identifier e.g. 9218, 7260 …)
 * content  – remainder      (actual payload)
 *
 * @param {string} ldtString – raw LDT payload as received via HTTP POST
 * @returns {Array<{raw:string,length:string,recordType:string,fieldId:string,content:string}>}
 */
function parseLDT(ldtString = '') {
  if (typeof ldtString !== 'string' || !ldtString.trim()) {
    return [];
  }

  const records = [];
  
  // Check if it's XML format (legacy)
  if (ldtString.includes('<column1>')) {
    return parseXMLFormat(ldtString);
  }
  
  // Parse line-based format (current)
  return parseLineFormat(ldtString);
}

/**
 * Parse XML format (legacy)
 */
function parseXMLFormat(xmlString) {
  const COLUMN_REGEX = /<column1>(.*?)<\/column1>/g;
  const records = [];
  const iterator = xmlString.matchAll(COLUMN_REGEX);

  for (const match of iterator) {
    const raw = match[1] || '';
    if (!raw) continue;
    
    const parsed = parseRecord(raw);
    if (parsed) {
      records.push(parsed);
    }
  }

  return records;
}

/**
 * Parse line-based format (current)
 */
function parseLineFormat(ldtString) {
  const records = [];
  const lines = ldtString.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (const line of lines) {
    const parsed = parseRecord(line);
    if (parsed) {
      records.push(parsed);
    }
  }

  return records;
}

/**
 * Parse a single LDT record with enhanced security
 */
function parseRecord(raw) {
  if (!raw || raw.length < 8) {
    return null;
  }

  try {
    // Input sanitization: ensure raw is a string and trim whitespace
    const sanitizedRaw = String(raw).trim();
    
    // Additional length validation
    if (sanitizedRaw.length > 1000) {
      console.warn('LDT record too long, potential attack:', sanitizedRaw.length);
      return null;
    }

    // Handle different record lengths
    if (sanitizedRaw.length >= 11) {
      // Standard format: length(3) + recordType(4) + fieldId(4) + content
      const length = sanitizedRaw.slice(0, 3);
      const recordType = sanitizedRaw.slice(3, 7);
      const fieldId = sanitizedRaw.slice(7, 11);
      const content = sanitizedRaw.slice(11);

      // Enhanced validation that length is numeric and reasonable
      if (!/^\d{3}$/.test(length)) {
        return null;
      }
      
      // Validate length is reasonable (not 000 or 999)
      const lengthNum = parseInt(length, 10);
      if (lengthNum < 8 || lengthNum > 999) {
        return null;
      }

      // Validate that record type is numeric and in valid range
      if (!/^\d{4}$/.test(recordType)) {
        return null;
      }
      
      // Validate record type is in expected range (8000-8599)
      const recordTypeNum = parseInt(recordType, 10);
      if (recordTypeNum < 8000 || recordTypeNum > 8599) {
        return null;
      }

      // Field ID can be alphanumeric with special characters, but limit length
      if (!/^[A-Za-z0-9*]{4}$/.test(fieldId)) {
        return null;
      }

      // Sanitize content to prevent injection
      const sanitizedContent = sanitizeContent(content);

      return { raw: sanitizedRaw, length, recordType, fieldId, content: sanitizedContent };
    } else if (sanitizedRaw.length >= 8) {
      // Short format: length(3) + recordType(4) + fieldId(1)
      const length = sanitizedRaw.slice(0, 3);
      const recordType = sanitizedRaw.slice(3, 7);
      const fieldId = sanitizedRaw.slice(7, 8);
      const content = '';

      // Validate that length is numeric and reasonable
      if (!/^\d{3}$/.test(length)) {
        return null;
      }
      
      const lengthNum = parseInt(length, 10);
      if (lengthNum < 8 || lengthNum > 999) {
        return null;
      }

      // Validate that record type is numeric and in valid range
      if (!/^\d{4}$/.test(recordType)) {
        return null;
      }
      
      const recordTypeNum = parseInt(recordType, 10);
      if (recordTypeNum < 8000 || recordTypeNum > 8599) {
        return null;
      }

      // Field ID can be alphanumeric
      if (!/^[A-Za-z0-9]$/.test(fieldId)) {
        return null;
      }

      return { raw: sanitizedRaw, length, recordType, fieldId, content };
    }

    return null;
  } catch (error) {
    console.error('Error parsing LDT record:', raw, error);
    return null;
  }
}

/**
 * Sanitize content to prevent injection attacks
 */
function sanitizeContent(content) {
  if (!content) return '';
  
  // Remove potentially dangerous characters and limit length
  return String(content)
    .replace(/[<>\"'&]/g, '') // Remove HTML/XML special characters
    .replace(/\r\n/g, '\n')   // Normalize line endings
    .replace(/\r/g, '\n')     // Normalize line endings
    .substring(0, 500);       // Limit content length
}

module.exports = parseLDT;