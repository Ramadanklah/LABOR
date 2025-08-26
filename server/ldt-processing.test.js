const parseLDT = require('./utils/ldtParser');
const LDTGenerator = require('./utils/ldtGenerator');
const fs = require('fs');
const path = require('path');

describe('LDT Processing Tests', () => {
  let ldtGenerator;

  beforeEach(() => {
    ldtGenerator = new LDTGenerator();
  });

  describe('LDT Parser', () => {
    describe('Basic Parsing', () => {
      it('should parse valid LDT content', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95
8421: mg/dl
8422: 70-110`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('bsnr', '123456789');
        expect(result.data).toHaveProperty('lanr', '987654321');
        expect(result.data.patientData).toHaveProperty('patientNumber', 'DR12345');
        expect(result.data.patientData).toHaveProperty('lastName', 'Mustermann');
        expect(result.data.patientData).toHaveProperty('firstName', 'Max');
        expect(result.data.patientData).toHaveProperty('dateOfBirth', '01.01.1980');
        expect(result.data.patientData).toHaveProperty('gender', 'm');
        expect(result.data.results).toHaveLength(1);
        expect(result.data.results[0]).toHaveProperty('testCode', 'TEST001');
        expect(result.data.results[0]).toHaveProperty('testName', 'Glucose');
        expect(result.data.results[0]).toHaveProperty('value', '95');
        expect(result.data.results[0]).toHaveProperty('unit', 'mg/dl');
        expect(result.data.results[0]).toHaveProperty('referenceRange', '70-110');
      });

      it('should handle empty LDT content', () => {
        const result = parseLDT('');
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Empty LDT content');
      });

      it('should handle null LDT content', () => {
        const result = parseLDT(null);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid LDT content');
      });

      it('should handle malformed LDT content', () => {
        const malformedContent = `invalid ldt content
no proper format
8220 missing colon`;

        const result = parseLDT(malformedContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid LDT format');
      });

      it('should parse LDT with multiple test results', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95
8421: mg/dl
8422: 70-110
3000: TEST002
8410: Cholesterol
8411: 180
8421: mg/dl
8422: <200
3000: TEST003
8410: Hemoglobin
8411: 14.5
8421: g/dl
8422: 12-16`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data.results).toHaveLength(3);
        expect(result.data.results[0].testName).toBe('Glucose');
        expect(result.data.results[1].testName).toBe('Cholesterol');
        expect(result.data.results[2].testName).toBe('Hemoglobin');
      });

      it('should handle LDT with special characters in names', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Müller-Schmidt
3102: Hans-Jürgen
3103: 01.01.1980
3110: m`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data.patientData.lastName).toBe('Müller-Schmidt');
        expect(result.data.patientData.firstName).toBe('Hans-Jürgen');
      });

      it('should validate required fields', () => {
        const incompleteContent = `8220: 123456789
3101: Mustermann
3102: Max`;

        const result = parseLDT(incompleteContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Missing required fields');
      });

      it('should parse LDT with optional fields', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3105: Musterstraße 123
3106: 12345
3107: Musterstadt
3108: 01234567890
3109: max.mustermann@email.com`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data.patientData).toHaveProperty('address', 'Musterstraße 123');
        expect(result.data.patientData).toHaveProperty('zipCode', '12345');
        expect(result.data.patientData).toHaveProperty('city', 'Musterstadt');
        expect(result.data.patientData).toHaveProperty('phone', '01234567890');
        expect(result.data.patientData).toHaveProperty('email', 'max.mustermann@email.com');
      });
    });

    describe('LDT Format Validation', () => {
      it('should validate BSNR format', () => {
        const ldtContent = `8220: invalid_bsnr
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid BSNR format');
      });

      it('should validate LANR format', () => {
        const ldtContent = `8220: 123456789
8221: invalid_lanr
3000: DR12345
3101: Mustermann
3102: Max`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid LANR format');
      });

      it('should validate date format', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: invalid_date`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid date format');
      });

      it('should validate gender format', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: invalid`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid gender format');
      });

      it('should validate email format in optional fields', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3109: invalid_email`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Invalid email format');
      });
    });

    describe('LDT Data Extraction', () => {
      it('should extract numeric test values correctly', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95.5
8421: mg/dl`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data.results[0].value).toBe('95.5');
        expect(typeof result.data.results[0].numericValue).toBe('number');
        expect(result.data.results[0].numericValue).toBe(95.5);
      });

      it('should handle non-numeric test values', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Blood Type
8411: A+
8421: ABO`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data.results[0].value).toBe('A+');
        expect(result.data.results[0].numericValue).toBeNull();
      });

      it('should extract reference ranges correctly', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95
8421: mg/dl
8422: 70-110`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data.results[0].referenceRange).toBe('70-110');
        expect(result.data.results[0].referenceLow).toBe(70);
        expect(result.data.results[0].referenceHigh).toBe(110);
      });

      it('should handle complex reference ranges', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Cholesterol
8411: 180
8421: mg/dl
8422: <200`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data.results[0].referenceRange).toBe('<200');
        expect(result.data.results[0].referenceLow).toBeNull();
        expect(result.data.results[0].referenceHigh).toBe(200);
      });

      it('should handle timestamp information', () => {
        const ldtContent = `8220: 123456789
8221: 987654321
8200: 20240101
8201: 1430
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m`;

        const result = parseLDT(ldtContent);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('sampleDate', '20240101');
        expect(result.data).toHaveProperty('sampleTime', '1430');
      });
    });

    describe('Error Handling', () => {
      it('should provide detailed error messages', () => {
        const invalidContent = `8220: 123456789
8221: 987654321
3000: DR12345`;

        const result = parseLDT(invalidContent);
        
        expect(result.success).toBe(false);
        expect(result.message).toBeTruthy();
        expect(result.errors).toBeTruthy();
        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should handle line parsing errors gracefully', () => {
        const contentWithErrors = `8220: 123456789
invalid line without colon
8221: 987654321
another invalid line
3000: DR12345
3101: Mustermann
3102: Max`;

        const result = parseLDT(contentWithErrors);
        
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should provide line numbers in error messages', () => {
        const contentWithErrors = `8220: 123456789
8221: invalid_lanr
3000: DR12345
3101: Mustermann
3102: Max`;

        const result = parseLDT(contentWithErrors);
        
        expect(result.success).toBe(false);
        expect(result.errors.some(error => error.includes('line'))).toBe(true);
      });
    });
  });

  describe('LDT Generator', () => {
    describe('Basic Generation', () => {
      it('should generate valid LDT content from data', () => {
        const testData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'm'
          },
          results: [
            {
              testCode: 'TEST001',
              testName: 'Glucose',
              value: '95',
              unit: 'mg/dl',
              referenceRange: '70-110'
            }
          ]
        };

        const ldtContent = ldtGenerator.generate(testData);
        
        expect(ldtContent).toContain('8220: 123456789');
        expect(ldtContent).toContain('8221: 987654321');
        expect(ldtContent).toContain('3000: DR12345');
        expect(ldtContent).toContain('3101: Mustermann');
        expect(ldtContent).toContain('3102: Max');
        expect(ldtContent).toContain('3103: 01.01.1980');
        expect(ldtContent).toContain('3110: m');
        expect(ldtContent).toContain('8410: Glucose');
        expect(ldtContent).toContain('8411: 95');
        expect(ldtContent).toContain('8421: mg/dl');
        expect(ldtContent).toContain('8422: 70-110');
      });

      it('should generate LDT with multiple test results', () => {
        const testData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'm'
          },
          results: [
            {
              testCode: 'TEST001',
              testName: 'Glucose',
              value: '95',
              unit: 'mg/dl',
              referenceRange: '70-110'
            },
            {
              testCode: 'TEST002',
              testName: 'Cholesterol',
              value: '180',
              unit: 'mg/dl',
              referenceRange: '<200'
            }
          ]
        };

        const ldtContent = ldtGenerator.generate(testData);
        
        expect(ldtContent).toContain('8410: Glucose');
        expect(ldtContent).toContain('8410: Cholesterol');
        expect((ldtContent.match(/3000:/g) || []).length).toBe(3); // Patient + 2 tests
      });

      it('should include optional patient data when provided', () => {
        const testData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'm',
            address: 'Musterstraße 123',
            zipCode: '12345',
            city: 'Musterstadt',
            phone: '01234567890',
            email: 'max.mustermann@email.com'
          },
          results: []
        };

        const ldtContent = ldtGenerator.generate(testData);
        
        expect(ldtContent).toContain('3105: Musterstraße 123');
        expect(ldtContent).toContain('3106: 12345');
        expect(ldtContent).toContain('3107: Musterstadt');
        expect(ldtContent).toContain('3108: 01234567890');
        expect(ldtContent).toContain('3109: max.mustermann@email.com');
      });

      it('should include timestamp information', () => {
        const testData = {
          bsnr: '123456789',
          lanr: '987654321',
          sampleDate: '20240101',
          sampleTime: '1430',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'm'
          },
          results: []
        };

        const ldtContent = ldtGenerator.generate(testData);
        
        expect(ldtContent).toContain('8200: 20240101');
        expect(ldtContent).toContain('8201: 1430');
      });
    });

    describe('Validation', () => {
      it('should validate required fields before generation', () => {
        const incompleteData = {
          bsnr: '123456789'
          // Missing required fields
        };

        expect(() => {
          ldtGenerator.generate(incompleteData);
        }).toThrow('Missing required fields');
      });

      it('should validate BSNR format', () => {
        const invalidData = {
          bsnr: 'invalid',
          lanr: '987654321',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'm'
          },
          results: []
        };

        expect(() => {
          ldtGenerator.generate(invalidData);
        }).toThrow('Invalid BSNR format');
      });

      it('should validate LANR format', () => {
        const invalidData = {
          bsnr: '123456789',
          lanr: 'invalid',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'm'
          },
          results: []
        };

        expect(() => {
          ldtGenerator.generate(invalidData);
        }).toThrow('Invalid LANR format');
      });

      it('should validate patient data structure', () => {
        const invalidData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            // Missing required patient fields
          },
          results: []
        };

        expect(() => {
          ldtGenerator.generate(invalidData);
        }).toThrow('Invalid patient data');
      });

      it('should validate date format', () => {
        const invalidData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: 'invalid-date',
            gender: 'm'
          },
          results: []
        };

        expect(() => {
          ldtGenerator.generate(invalidData);
        }).toThrow('Invalid date format');
      });

      it('should validate gender format', () => {
        const invalidData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'invalid'
          },
          results: []
        };

        expect(() => {
          ldtGenerator.generate(invalidData);
        }).toThrow('Invalid gender format');
      });
    });

    describe('Round-trip Testing', () => {
      it('should maintain data integrity in parse-generate cycle', () => {
        const originalData = {
          bsnr: '123456789',
          lanr: '987654321',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Mustermann',
            firstName: 'Max',
            dateOfBirth: '01.01.1980',
            gender: 'm'
          },
          results: [
            {
              testCode: 'TEST001',
              testName: 'Glucose',
              value: '95',
              unit: 'mg/dl',
              referenceRange: '70-110'
            }
          ]
        };

        // Generate LDT content
        const ldtContent = ldtGenerator.generate(originalData);
        
        // Parse the generated content
        const parseResult = parseLDT(ldtContent);
        
        expect(parseResult.success).toBe(true);
        expect(parseResult.data.bsnr).toBe(originalData.bsnr);
        expect(parseResult.data.lanr).toBe(originalData.lanr);
        expect(parseResult.data.patientData.patientNumber).toBe(originalData.patientData.patientNumber);
        expect(parseResult.data.patientData.lastName).toBe(originalData.patientData.lastName);
        expect(parseResult.data.patientData.firstName).toBe(originalData.patientData.firstName);
        expect(parseResult.data.results).toHaveLength(originalData.results.length);
        expect(parseResult.data.results[0].testName).toBe(originalData.results[0].testName);
        expect(parseResult.data.results[0].value).toBe(originalData.results[0].value);
      });

      it('should handle complex data in round-trip', () => {
        const complexData = {
          bsnr: '123456789',
          lanr: '987654321',
          sampleDate: '20240101',
          sampleTime: '1430',
          patientData: {
            patientNumber: 'DR12345',
            lastName: 'Müller-Schmidt',
            firstName: 'Hans-Jürgen',
            dateOfBirth: '01.01.1980',
            gender: 'm',
            address: 'Musterstraße 123',
            zipCode: '12345',
            city: 'Musterstadt',
            phone: '01234567890',
            email: 'hans.mueller@email.com'
          },
          results: [
            {
              testCode: 'TEST001',
              testName: 'Glucose',
              value: '95.5',
              unit: 'mg/dl',
              referenceRange: '70-110'
            },
            {
              testCode: 'TEST002',
              testName: 'Blood Type',
              value: 'A+',
              unit: 'ABO',
              referenceRange: ''
            }
          ]
        };

        const ldtContent = ldtGenerator.generate(complexData);
        const parseResult = parseLDT(ldtContent);
        
        expect(parseResult.success).toBe(true);
        expect(parseResult.data.patientData.lastName).toBe(complexData.patientData.lastName);
        expect(parseResult.data.patientData.firstName).toBe(complexData.patientData.firstName);
        expect(parseResult.data.patientData.email).toBe(complexData.patientData.email);
        expect(parseResult.data.results).toHaveLength(2);
        expect(parseResult.data.results[1].value).toBe('A+');
      });
    });
  });

  describe('File Processing', () => {
    const testDir = path.join(__dirname, 'test-files');
    
    beforeAll(() => {
      // Create test directory
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should process LDT file from disk', () => {
      const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95
8421: mg/dl
8422: 70-110`;

      const filePath = path.join(testDir, 'test.ldt');
      fs.writeFileSync(filePath, ldtContent, 'utf8');
      
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const result = parseLDT(fileContent);
      
      expect(result.success).toBe(true);
      expect(result.data.bsnr).toBe('123456789');
    });

    it('should handle different file encodings', () => {
      const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Müller
3102: Jürgen
3103: 01.01.1980
3110: m`;

      const filePath = path.join(testDir, 'encoding-test.ldt');
      
      // Test UTF-8 encoding
      fs.writeFileSync(filePath, ldtContent, 'utf8');
      const utf8Content = fs.readFileSync(filePath, 'utf8');
      const utf8Result = parseLDT(utf8Content);
      
      expect(utf8Result.success).toBe(true);
      expect(utf8Result.data.patientData.lastName).toBe('Müller');
      expect(utf8Result.data.patientData.firstName).toBe('Jürgen');
    });

    it('should handle large LDT files', () => {
      const baseContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m`;

      // Add many test results
      let largeContent = baseContent;
      for (let i = 1; i <= 100; i++) {
        largeContent += `
3000: TEST${i.toString().padStart(3, '0')}
8410: Test ${i}
8411: ${i}
8421: unit
8422: 0-100`;
      }

      const result = parseLDT(largeContent);
      
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(100);
    });

    it('should handle corrupted file content gracefully', () => {
      const corruptedContent = `8220: 123456789
\x00\x01\x02\x03 corrupted data
8221: 987654321
3000: DR12345`;

      const result = parseLDT(corruptedContent);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid');
    });
  });

  describe('Performance', () => {
    it('should parse LDT content efficiently', () => {
      const ldtContent = `8220: 123456789
8221: 987654321
3000: DR12345
3101: Mustermann
3102: Max
3103: 01.01.1980
3110: m
3000: TEST001
8410: Glucose
8411: 95
8421: mg/dl
8422: 70-110`;

      const startTime = Date.now();
      
      // Parse multiple times to test performance
      for (let i = 0; i < 1000; i++) {
        parseLDT(ldtContent);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 parses in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should generate LDT content efficiently', () => {
      const testData = {
        bsnr: '123456789',
        lanr: '987654321',
        patientData: {
          patientNumber: 'DR12345',
          lastName: 'Mustermann',
          firstName: 'Max',
          dateOfBirth: '01.01.1980',
          gender: 'm'
        },
        results: [
          {
            testCode: 'TEST001',
            testName: 'Glucose',
            value: '95',
            unit: 'mg/dl',
            referenceRange: '70-110'
          }
        ]
      };

      const startTime = Date.now();
      
      // Generate multiple times to test performance
      for (let i = 0; i < 1000; i++) {
        ldtGenerator.generate(testData);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 generations in under 500ms
      expect(duration).toBeLessThan(500);
    });
  });
});