#!/usr/bin/env node

/**
 * Create Initial Admin User Script
 * 
 * This script creates the initial admin user for production environments.
 * Run this script once to set up the first admin user.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// User roles
const USER_ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  LAB_TECHNICIAN: 'lab_technician',
  PATIENT: 'patient'
};

// Role permissions
const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: {
    canCreateUsers: true,
    canManageRoles: true,
    canViewAllResults: true,
    canManageSystem: true,
    canDownloadReports: true,
    canViewAnalytics: true
  }
};

class AdminUserCreator {
  constructor() {
    this.users = new Map();
    this.usersByEmail = new Map();
    this.usersByBsnrLanr = new Map();
  }

  async createAdminUser(userData) {
    const {
      email,
      password,
      firstName,
      lastName,
      role = USER_ROLES.ADMIN,
      bsnr,
      lanr,
      isActive = true
    } = userData;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      throw new Error('Missing required fields: email, password, firstName, lastName');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Password validation (relaxed for initial setup)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check if user already exists
    if (this.usersByEmail.has(email.toLowerCase())) {
      throw new Error('Email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate unique user ID
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user object
    const user = {
      id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role,
      bsnr,
      lanr,
      isActive,
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null,
      loginAttempts: 0,
      permissions: ROLE_PERMISSIONS[role]
    };

    // Store user
    this.users.set(userId, user);
    this.usersByEmail.set(email.toLowerCase(), userId);

    if (bsnr && lanr) {
      this.usersByBsnrLanr.set(`${bsnr}-${lanr}`, userId);
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async run() {
    console.log('🔐 Creating Initial Admin User');
    console.log('==============================\n');

    // Get admin details from command line or use defaults
    const email = process.argv[2] || 'admin@laborresults.de';
    const password = process.argv[3] || 'admin123';
    const firstName = process.argv[4] || 'System';
    const lastName = process.argv[5] || 'Administrator';

    console.log('Admin User Details:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Name: ${firstName} ${lastName}`);
    console.log(`  Role: ${USER_ROLES.ADMIN}`);
    console.log('');

    // Confirm creation
    if (!process.argv[6] || process.argv[6] !== '--confirm') {
      console.log('⚠️  WARNING: This will create an admin user with the specified credentials.');
      console.log('   To proceed, run with --confirm flag:');
      console.log(`   node create-admin-user.js "${email}" "${password}" "${firstName}" "${lastName}" --confirm`);
      console.log('');
      console.log('   Or use defaults:');
      console.log('   node create-admin-user.js --confirm');
      process.exit(0);
    }

    try {
      const adminUser = await this.createAdminUser({
        email,
        password,
        firstName,
        lastName,
        role: USER_ROLES.ADMIN,
        bsnr: '999999999',
        lanr: '9999999',
        isActive: true
      });

      console.log('✅ Admin user created successfully!');
      console.log('');
      console.log('User Details:');
      console.log(`  ID: ${adminUser.id}`);
      console.log(`  Email: ${adminUser.email}`);
      console.log(`  Name: ${adminUser.firstName} ${adminUser.lastName}`);
      console.log(`  Role: ${adminUser.role}`);
      console.log(`  Active: ${adminUser.isActive}`);
      console.log(`  Created: ${adminUser.createdAt}`);
      console.log('');

      // Generate JWT token for immediate use
      const jwt = require('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET || 'dev-jwt-secret-key-for-development-only-change-in-production';
      
      const token = jwt.sign({
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        permissions: adminUser.permissions
      }, jwtSecret, {
        expiresIn: '24h' // Longer token for initial setup
      });

      console.log('🔑 Initial Login Token (valid for 24 hours):');
      console.log(`  ${token}`);
      console.log('');

      console.log('📋 Next Steps:');
      console.log('  1. Use the token above to access the system');
      console.log('  2. Change the admin password immediately');
      console.log('  3. Set up 2FA for the admin account');
      console.log('  4. Create additional admin users if needed');
      console.log('');

      console.log('🔒 Security Recommendations:');
      console.log('  - Change the default password immediately');
      console.log('  - Enable 2FA for the admin account');
      console.log('  - Use a strong JWT_SECRET in production');
      console.log('  - Regularly rotate admin credentials');
      console.log('');

      // Save user data to a file for reference
      const fs = require('fs');
      const userData = {
        adminUser: {
          ...adminUser,
          initialPassword: password,
          initialToken: token
        },
        createdAt: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      };

      fs.writeFileSync('admin-user-created.json', JSON.stringify(userData, null, 2));
      console.log('📄 User data saved to: admin-user-created.json');
      console.log('   (Delete this file after setup for security)');

    } catch (error) {
      console.error('❌ Failed to create admin user:', error.message);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  const creator = new AdminUserCreator();
  creator.run().catch(console.error);
}

module.exports = AdminUserCreator;