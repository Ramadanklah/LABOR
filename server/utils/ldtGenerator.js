/**
 * LDT (Labor Daten Transfer) Format Generator
 * German standard for laboratory data exchange
 * 
 * LDT Record Types:
 * 8000 - Header record
 * 8100 - Practice/Lab identification
 * 8200 - Patient data
 * 8300 - Request data
 * 8400 - Result data
 * 8500 - Footer record
 */

class LDTGenerator {
  constructor() {
    this.records = [];
    this.recordNumber = 1;
  }

  // Add a record with proper formatting
  addRecord(recordType, fieldId, content) {
    const recordNum = this.recordNumber.toString().padStart(3, '0');
    const length = (content.length + 13).toString().padStart(3, '0');
    const record = `${length}${recordType}${fieldId}${content}`;
    this.records.push(record);
    this.recordNumber++;
    return record;
  }

  // Generate header record
  generateHeader() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    
    this.addRecord('8000', '9218', 'LABOR_RESULTS_V2.1'); // Software version
    this.addRecord('8000', '9103', date); // Creation date
    this.addRecord('8000', '9104', time); // Creation time
    this.addRecord('8000', '9106', 'UTF-8'); // Character set
  }

  // Generate practice/lab identification
  generateLabInfo(labInfo = {}) {
    this.addRecord('8100', '0201', labInfo.name || 'Labor Results System');
    this.addRecord('8100', '0203', labInfo.street || 'Medical Center Street 1');
    this.addRecord('8100', '0204', labInfo.zipCode || '12345');
    this.addRecord('8100', '0205', labInfo.city || 'Medical City');
    this.addRecord('8100', '0247', labInfo.phone || '+49-123-456789');
    this.addRecord('8100', '0249', labInfo.email || 'info@laborresults.de');
  }

  // Generate patient data record
  generatePatientData(patient) {
    this.addRecord('8200', '3101', patient.lastName || 'Unknown');
    this.addRecord('8200', '3102', patient.firstName || 'Patient');
    this.addRecord('8200', '3103', patient.birthDate || '19800101'); // YYYYMMDD format
    this.addRecord('8200', '3110', patient.gender || 'U'); // M/F/U
    this.addRecord('8200', '3000', patient.patientId || 'P001');
  }

  // Generate request data
  generateRequestData(request) {
    this.addRecord('8300', '7303', request.requestId || 'REQ001');
    this.addRecord('8300', '7304', request.requestDate || new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    this.addRecord('8300', '7311', request.doctorId || 'DR001');
    this.addRecord('8300', '7313', request.doctorName || 'Dr. Medical');
  }

  // Generate result data for a single test
  generateTestResult(test) {
    // Test identification
    this.addRecord('8400', '7260', test.testCode || test.type.replace(/\s/g, '').toUpperCase());
    this.addRecord('8400', '7261', test.testName || test.type);
    
    // Result value and unit
    if (test.value) {
      this.addRecord('8400', '7262', test.value.toString());
    }
    if (test.unit) {
      this.addRecord('8400', '7263', test.unit);
    }
    
    // Reference range
    if (test.referenceRange) {
      this.addRecord('8400', '7264', test.referenceRange);
    }
    
    // Result status
    this.addRecord('8400', '7265', test.status === 'Final' ? 'F' : 'P'); // F=Final, P=Preliminary
    
    // Test timestamp
    const testDate = new Date(test.date).toISOString().slice(0, 10).replace(/-/g, '');
    const testTime = new Date(test.date).toTimeString().slice(0, 8).replace(/:/g, '');
    this.addRecord('8400', '7268', testDate);
    this.addRecord('8400', '7269', testTime);
    
    // Additional info
    if (test.comment) {
      this.addRecord('8400', '7295', test.comment);
    }
  }

  // Generate footer record
  generateFooter() {
    this.addRecord('8500', '9218', 'EOF'); // End of file marker
  }

  // Convert lab results to LDT format
  generateLDT(results, options = {}) {
    this.records = [];
    this.recordNumber = 1;

    // Header
    this.generateHeader();

    // Lab information
    this.generateLabInfo(options.labInfo);

    // Group results by patient
    const patientGroups = this.groupResultsByPatient(results);

    Object.keys(patientGroups).forEach(patientName => {
      const patientResults = patientGroups[patientName];
      const firstResult = patientResults[0];

      // Extract patient info from first result
      const patient = {
        lastName: firstResult.patient.split(' ').pop(),
        firstName: firstResult.patient.split(' ').slice(0, -1).join(' '),
        patientId: firstResult.patient.replace(/\s/g, '').toUpperCase(),
        birthDate: '19800101', // Default - would need real patient data
        gender: 'U' // Unknown - would need real patient data
      };

      // Patient data
      this.generatePatientData(patient);

      // Request data (one per patient)
      const request = {
        requestId: firstResult.id,
        requestDate: new Date(firstResult.date).toISOString().slice(0, 10).replace(/-/g, ''),
        doctorId: firstResult.bsnr,
        doctorName: `Practice ${firstResult.bsnr}`
      };
      this.generateRequestData(request);

      // Results for this patient
      patientResults.forEach(result => {
        const test = {
          testCode: result.type.replace(/\s/g, '').toUpperCase(),
          testName: result.type,
          status: result.status,
          date: result.date,
          value: this.generateMockValue(result.type),
          unit: this.getMockUnit(result.type),
          referenceRange: this.getMockReferenceRange(result.type)
        };
        this.generateTestResult(test);
      });
    });

    // Footer
    this.generateFooter();

    return this.records.join('\r\n');
  }

  // Helper function to group results by patient
  groupResultsByPatient(results) {
    return results.reduce((groups, result) => {
      const patient = result.patient;
      if (!groups[patient]) {
        groups[patient] = [];
      }
      groups[patient].push(result);
      return groups;
    }, {});
  }

  // Generate mock test values (in real system, these would come from actual lab data)
  generateMockValue(testType) {
    const mockValues = {
      'Blood Count': '4.5',
      'Urinalysis': 'Normal',
      'Microbiology': 'No growth'
    };
    return mockValues[testType] || 'Normal';
  }

  // Get mock units for different test types
  getMockUnit(testType) {
    const mockUnits = {
      'Blood Count': '10^6/μL',
      'Urinalysis': '',
      'Microbiology': ''
    };
    return mockUnits[testType] || '';
  }

  // Get mock reference ranges
  getMockReferenceRange(testType) {
    const mockRanges = {
      'Blood Count': '4.0-5.5',
      'Urinalysis': 'Normal',
      'Microbiology': 'No growth expected'
    };
    return mockRanges[testType] || 'Normal';
  }
}

module.exports = LDTGenerator;