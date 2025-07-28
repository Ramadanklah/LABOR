const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const bcrypt = require('bcrypt');

class BulkUserManager {
  constructor(userModel) {
    this.userModel = userModel;
  }

  /**
   * Import users from CSV file
   * @param {string} filePath - Path to CSV file
   * @returns {Promise<Object>} Import results
   */
  async importUsersFromCSV(filePath) {
    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    return new Promise((resolve, reject) => {
      const users = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          results.total++;
          users.push(row);
        })
        .on('end', async () => {
          try {
            // Process users in batches
            const batchSize = 10;
            for (let i = 0; i < users.length; i += batchSize) {
              const batch = users.slice(i, i + batchSize);
              await this.processUserBatch(batch, results);
            }
            resolve(results);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Process a batch of users
   * @param {Array} users - Array of user objects
   * @param {Object} results - Results object to update
   */
  async processUserBatch(users, results) {
    for (const userData of users) {
      try {
        // Validate required fields
        const requiredFields = ['email', 'password', 'firstName', 'lastName', 'role', 'bsnr', 'lanr'];
        const missingFields = requiredFields.filter(field => !userData[field]);
        
        if (missingFields.length > 0) {
          results.failed++;
          results.errors.push({
            email: userData.email || 'unknown',
            error: `Missing required fields: ${missingFields.join(', ')}`
          });
          continue;
        }

        // Validate role
        const validRoles = ['admin', 'doctor', 'lab_technician', 'patient'];
        if (!validRoles.includes(userData.role)) {
          results.failed++;
          results.errors.push({
            email: userData.email,
            error: `Invalid role: ${userData.role}`
          });
          continue;
        }

        // Validate BSNR/LANR format
        if (!/^\d{8}$/.test(userData.bsnr)) {
          results.failed++;
          results.errors.push({
            email: userData.email,
            error: `Invalid BSNR format: ${userData.bsnr} (must be 8 digits)`
          });
          continue;
        }

        if (!/^\d{7}$/.test(userData.lanr)) {
          results.failed++;
          results.errors.push({
            email: userData.email,
            error: `Invalid LANR format: ${userData.lanr} (must be 7 digits)`
          });
          continue;
        }

        // Create user
        await this.userModel.createUser({
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          bsnr: userData.bsnr,
          lanr: userData.lanr,
          specialization: userData.specialization || null,
          department: userData.department || null,
          isActive: userData.isActive !== 'false'
        });

        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: userData.email || 'unknown',
          error: error.message
        });
      }
    }
  }

  /**
   * Export users to CSV file
   * @param {string} filePath - Path to save CSV file
   * @param {Object} filters - Optional filters
   * @returns {Promise<string>} File path
   */
  async exportUsersToCSV(filePath, filters = {}) {
    const users = this.userModel.getAllUsers(filters);
    
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'email', title: 'Email' },
        { id: 'firstName', title: 'First Name' },
        { id: 'lastName', title: 'Last Name' },
        { id: 'role', title: 'Role' },
        { id: 'bsnr', title: 'BSNR' },
        { id: 'lanr', title: 'LANR' },
        { id: 'specialization', title: 'Specialization' },
        { id: 'department', title: 'Department' },
        { id: 'isActive', title: 'Active' },
        { id: 'createdAt', title: 'Created At' },
        { id: 'lastLogin', title: 'Last Login' }
      ]
    });

    // Prepare user data for CSV
    const userData = users.map(user => ({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      bsnr: user.bsnr || '',
      lanr: user.lanr || '',
      specialization: user.specialization || '',
      department: user.department || '',
      isActive: user.isActive ? 'true' : 'false',
      createdAt: user.createdAt,
      lastLogin: user.lastLogin || ''
    }));

    await csvWriter.writeRecords(userData);
    return filePath;
  }

  /**
   * Generate sample CSV template
   * @param {string} filePath - Path to save template
   * @returns {Promise<string>} File path
   */
  async generateCSVTemplate(filePath) {
    const templateData = [
      {
        email: 'doctor1@example.com',
        password: 'password123',
        firstName: 'Dr. Maria',
        lastName: 'Schmidt',
        role: 'doctor',
        bsnr: '12345678',
        lanr: '1234567',
        specialization: 'Internal Medicine',
        department: 'Cardiology',
        isActive: 'true'
      },
      {
        email: 'doctor2@example.com',
        password: 'password123',
        firstName: 'Dr. Hans',
        lastName: 'Mueller',
        role: 'doctor',
        bsnr: '87654321',
        lanr: '7654321',
        specialization: 'Pediatrics',
        department: 'General Practice',
        isActive: 'true'
      }
    ];

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'email', title: 'Email' },
        { id: 'password', title: 'Password' },
        { id: 'firstName', title: 'First Name' },
        { id: 'lastName', title: 'Last Name' },
        { id: 'role', title: 'Role' },
        { id: 'bsnr', title: 'BSNR' },
        { id: 'lanr', title: 'LANR' },
        { id: 'specialization', title: 'Specialization' },
        { id: 'department', title: 'Department' },
        { id: 'isActive', title: 'Active' }
      ]
    });

    await csvWriter.writeRecords(templateData);
    return filePath;
  }

  /**
   * Generate 100 sample doctors
   * @returns {Promise<Array>} Array of generated users
   */
  async generateSampleDoctors() {
    const doctors = [];
    const specializations = [
      'Internal Medicine', 'Cardiology', 'Pediatrics', 'Dermatology',
      'Neurology', 'Orthopedics', 'Gynecology', 'Urology',
      'Ophthalmology', 'Psychiatry', 'General Practice', 'Emergency Medicine'
    ];

    const departments = [
      'Cardiology', 'Pediatrics', 'Internal Medicine', 'Surgery',
      'Emergency', 'Radiology', 'Laboratory', 'Pharmacy',
      'Rehabilitation', 'Oncology', 'Geriatrics', 'Family Medicine'
    ];

    for (let i = 1; i <= 100; i++) {
      const specialization = specializations[Math.floor(Math.random() * specializations.length)];
      const department = departments[Math.floor(Math.random() * departments.length)];
      
      // Generate unique BSNR and LANR
      const bsnr = String(10000000 + i).padStart(8, '0');
      const lanr = String(1000000 + i).padStart(7, '0');

      doctors.push({
        email: `doctor${i}@laborresults.de`,
        password: 'doctor123',
        firstName: `Dr. ${this.generateFirstName()}`,
        lastName: this.generateLastName(),
        role: 'doctor',
        bsnr,
        lanr,
        specialization,
        department,
        isActive: 'true'
      });
    }

    return doctors;
  }

  /**
   * Generate random first name
   * @returns {string} First name
   */
  generateFirstName() {
    const names = [
      'Maria', 'Hans', 'Anna', 'Peter', 'Elisabeth', 'Michael',
      'Claudia', 'Thomas', 'Sabine', 'Andreas', 'Monika', 'Wolfgang',
      'Petra', 'Klaus', 'Brigitte', 'Manfred', 'Renate', 'Dieter',
      'Ursula', 'Helmut', 'Gabriele', 'Jürgen', 'Karin', 'Horst',
      'Christine', 'Werner', 'Angelika', 'Günther', 'Inge', 'Rolf'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Generate random last name
   * @returns {string} Last name
   */
  generateLastName() {
    const names = [
      'Schmidt', 'Mueller', 'Weber', 'Meyer', 'Wagner', 'Becker',
      'Schulz', 'Hoffmann', 'Schaefer', 'Koch', 'Bauer', 'Richter',
      'Klein', 'Wolf', 'Schroeder', 'Neumann', 'Schwarz', 'Zimmermann',
      'Braun', 'Krueger', 'Hofmann', 'Hartmann', 'Lange', 'Schmitt',
      'Werner', 'Krause', 'Meier', 'Lehmann', 'Schmid', 'Schulze'
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * Get user statistics
   * @returns {Object} Statistics
   */
  getUserStatistics() {
    const users = this.userModel.getAllUsers();
    const stats = {
      total: users.length,
      byRole: {},
      byStatus: {
        active: 0,
        inactive: 0
      },
      bySpecialization: {},
      withBSNRLANR: 0,
      withoutBSNRLANR: 0
    };

    users.forEach(user => {
      // Count by role
      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

      // Count by status
      if (user.isActive) {
        stats.byStatus.active++;
      } else {
        stats.byStatus.inactive++;
      }

      // Count by specialization
      if (user.specialization) {
        stats.bySpecialization[user.specialization] = (stats.bySpecialization[user.specialization] || 0) + 1;
      }

      // Count BSNR/LANR
      if (user.bsnr && user.lanr) {
        stats.withBSNRLANR++;
      } else {
        stats.withoutBSNRLANR++;
      }
    });

    return stats;
  }

  /**
   * Validate user data
   * @param {Object} userData - User data to validate
   * @returns {Object} Validation results
   */
  validateUserData(userData) {
    const errors = [];

    // Required fields
    const requiredFields = ['email', 'password', 'firstName', 'lastName', 'role', 'bsnr', 'lanr'];
    requiredFields.forEach(field => {
      if (!userData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Email validation
    if (userData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
      errors.push('Invalid email format');
    }

    // Role validation
    const validRoles = ['admin', 'doctor', 'lab_technician', 'patient'];
    if (userData.role && !validRoles.includes(userData.role)) {
      errors.push(`Invalid role: ${userData.role}`);
    }

    // BSNR validation
    if (userData.bsnr && !/^\d{8}$/.test(userData.bsnr)) {
      errors.push(`Invalid BSNR format: ${userData.bsnr} (must be 8 digits)`);
    }

    // LANR validation
    if (userData.lanr && !/^\d{7}$/.test(userData.lanr)) {
      errors.push(`Invalid LANR format: ${userData.lanr} (must be 7 digits)`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = BulkUserManager;