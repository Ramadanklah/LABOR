const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');

// User roles with hierarchical permissions
const USER_ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  LAB_TECHNICIAN: 'lab_technician',
  PATIENT: 'patient'
};

const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: {
    canCreateUsers: true,
    canManageRoles: true,
    canViewAllResults: true,
    canManageSystem: true,
    canDownloadReports: true,
    canViewAnalytics: true
  },
  [USER_ROLES.DOCTOR]: {
    canCreateUsers: false,
    canManageRoles: false,
    canViewAllResults: false, // Only their assigned patients
    canManageSystem: false,
    canDownloadReports: true,
    canViewAnalytics: false,
    canViewPatientResults: true
  },
  [USER_ROLES.LAB_TECHNICIAN]: {
    canCreateUsers: false,
    canManageRoles: false,
    canViewAllResults: true, // Can see all lab results
    canManageSystem: false,
    canDownloadReports: true,
    canViewAnalytics: true,
    canUploadResults: true
  },
  [USER_ROLES.PATIENT]: {
    canCreateUsers: false,
    canManageRoles: false,
    canViewAllResults: false, // Only their own results
    canManageSystem: false,
    canDownloadReports: true,
    canViewAnalytics: false
  }
};

class UserModel {
  constructor() {
    // In-memory user store (replace with database in production)
    this.users = new Map();
    this.usersByEmail = new Map();
    this.usersByBsnrLanr = new Map();

    // Initialize with default admin user
    if (process.env.NODE_ENV !== 'production') {
      this.initializeDefaultUsers();
    }
  }

  // Initialize default users for testing ONLY
  async initializeDefaultUsers() {
    // CRITICAL: Never create default users in production
    if (process.env.NODE_ENV === 'production') {
      console.log('Production mode: Skipping default user creation for security');
      return;
    }
    
    // Only create default users in development/testing
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      try {
        // Create default admin user
        const adminUser = await this.createUser({
          email: 'admin@laborresults.de',
          password: 'admin123',
          firstName: 'System',
          lastName: 'Administrator',
          role: USER_ROLES.ADMIN,
          bsnr: '999999999',
          lanr: '9999999',
          isActive: true
        });

        // Create default doctor user
        const doctorUser = await this.createUser({
          email: 'doctor@laborresults.de',
          password: 'doctor123',
          firstName: 'Dr. Maria',
          lastName: 'Schmidt',
          role: USER_ROLES.DOCTOR,
          bsnr: '123456789',
          lanr: '1234567',
          specialization: 'Internal Medicine',
          isActive: true
        });

        // Create default lab technician
        const labUser = await this.createUser({
          email: 'lab@laborresults.de',
          password: 'lab123',
          firstName: 'Hans',
          lastName: 'Mueller',
          role: USER_ROLES.LAB_TECHNICIAN,
          bsnr: '123456789',
          lanr: '1234568',
          isActive: true
        });

        console.log('Default users initialized successfully (development mode only)');
      } catch (error) {
        console.error('Error initializing default users:', error);
      }
    } else {
      console.log('Environment not set to development/test: Skipping default user creation');
    }
  }

  // Create new user
  async createUser(userData) {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      bsnr,
      lanr,
      specialization,
      department,
      isActive = true,
      isTwoFactorEnabled = false,
      twoFactorSecret = null
    } = userData;

    // Validation
    if (!email || !password || !firstName || !lastName || !role) {
      throw new Error('Missing required fields');
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Strong password validation for production
    if (process.env.NODE_ENV === 'production') {
      if (password.length < 12) {
        throw new Error('Password must be at least 12 characters long');
      }
      if (!/(?=.*[a-z])/.test(password)) {
        throw new Error('Password must contain at least one lowercase letter');
      }
      if (!/(?=.*[A-Z])/.test(password)) {
        throw new Error('Password must contain at least one uppercase letter');
      }
      if (!/(?=.*\d)/.test(password)) {
        throw new Error('Password must contain at least one number');
      }
      if (!/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)) {
        throw new Error('Password must contain at least one special character');
      }
    } else {
      // Development mode: minimum 8 characters
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
    }

    if (!Object.values(USER_ROLES).includes(role)) {
      throw new Error('Invalid role');
    }

    if (this.usersByEmail.has(email.toLowerCase())) {
      throw new Error('Email already exists');
    }

    if (bsnr && lanr) {
      const bsnrLanrKey = `${bsnr}-${lanr}`;
      if (this.usersByBsnrLanr.has(bsnrLanrKey)) {
        throw new Error('BSNR/LANR combination already exists');
      }
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
      specialization,
      department,
      isActive,
      isTwoFactorEnabled,
      twoFactorSecret,
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

  // Authenticate user
  async authenticateUser(email, password, bsnr = null, lanr = null, otp = null) {
    let user;

    // Find user by email or BSNR/LANR
    if (email) {
      const userId = this.usersByEmail.get(email.toLowerCase());
      user = userId ? this.users.get(userId) : null;
    } else if (bsnr && lanr) {
      const userId = this.usersByBsnrLanr.get(`${bsnr}-${lanr}`);
      user = userId ? this.users.get(userId) : null;
    }

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.isActive) {
      throw new Error('User account is disabled');
    }

    // Check for account lockout (after 5 failed attempts)
    if (user.loginAttempts >= 5) {
      throw new Error('Account locked due to too many failed login attempts');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.updatedAt = new Date().toISOString();
      throw new Error('Invalid credentials');
    }

    // If 2FA is enabled, require OTP verification
    if (user.isTwoFactorEnabled) {
      if (!otp) {
        throw new Error('Two-factor authentication code required');
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: otp,
        window: 1
      });

      if (!verified) {
        throw new Error('Invalid two-factor authentication code');
      }
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.lastLogin = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    // Generate JWT token
    const token = this.generateToken(user);

    // Return user info and token (without password)
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token
    };
  }

  // Generate JWT token
  generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      bsnr: user.bsnr,
      lanr: user.lanr,
      permissions: user.permissions
    };

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return jwt.sign(payload, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRATION || '15m'
    });
  }

  // Verify JWT token
  verifyToken(token) {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      return jwt.verify(token, jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Get user by ID
  getUserById(userId) {
    const user = this.users.get(userId);
    if (!user) return null;

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Get user by email
  getUserByEmail(email) {
    const userId = this.usersByEmail.get(email.toLowerCase());
    return userId ? this.getUserById(userId) : null;
  }

  // Get user by BSNR/LANR
  getUserByBsnrLanr(bsnr, lanr) {
    const userId = this.usersByBsnrLanr.get(`${bsnr}-${lanr}`);
    return userId ? this.getUserById(userId) : null;
  }

  // Update user
  async updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Handle password update
    if (updates.password) {
      const saltRounds = 12;
      updates.password = await bcrypt.hash(updates.password, saltRounds);
    }

    // Handle email update
    if (updates.email && updates.email !== user.email) {
      if (this.usersByEmail.has(updates.email.toLowerCase())) {
        throw new Error('Email already exists');
      }

      // Remove old email mapping
      this.usersByEmail.delete(user.email);
      // Add new email mapping
      this.usersByEmail.set(updates.email.toLowerCase(), userId);
    }

    // Handle BSNR/LANR update
    if ((updates.bsnr || updates.lanr) &&
        (updates.bsnr !== user.bsnr || updates.lanr !== user.lanr)) {

      const newBsnr = updates.bsnr || user.bsnr;
      const newLanr = updates.lanr || user.lanr;
      const newKey = `${newBsnr}-${newLanr}`;

      if (this.usersByBsnrLanr.has(newKey)) {
        throw new Error('BSNR/LANR combination already exists');
      }

      // Remove old mapping
      if (user.bsnr && user.lanr) {
        this.usersByBsnrLanr.delete(`${user.bsnr}-${user.lanr}`);
      }
      // Add new mapping
      this.usersByBsnrLanr.set(newKey, userId);
    }

    // Update role permissions if role changed
    if (updates.role && updates.role !== user.role) {
      if (!Object.values(USER_ROLES).includes(updates.role)) {
        throw new Error('Invalid role');
      }
      updates.permissions = ROLE_PERMISSIONS[updates.role];
    }

    // Apply updates
    Object.assign(user, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Delete user
  deleteUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Remove from all mappings
    this.users.delete(userId);
    this.usersByEmail.delete(user.email);

    if (user.bsnr && user.lanr) {
      this.usersByBsnrLanr.delete(`${user.bsnr}-${user.lanr}`);
    }

    return true;
  }

  // List all users (admin only)
  getAllUsers(filters = {}) {
    const users = Array.from(this.users.values())
      .map(user => {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

    // Apply filters
    let filteredUsers = users;

    if (filters.role) {
      filteredUsers = filteredUsers.filter(user => user.role === filters.role);
    }

    if (filters.isActive !== undefined) {
      filteredUsers = filteredUsers.filter(user => user.isActive === filters.isActive);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredUsers = filteredUsers.filter(user =>
        user.firstName.toLowerCase().includes(searchTerm) ||
        user.lastName.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        (user.bsnr && user.bsnr.includes(searchTerm)) ||
        (user.lanr && user.lanr.includes(searchTerm))
      );
    }

    return filteredUsers;
  }

  // Check user permissions
  hasPermission(user, permission) {
    return user.permissions && user.permissions[permission] === true;
  }

  // Get user statistics
  getUserStats() {
    const users = Array.from(this.users.values());

    return {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
      byRole: {
        admin: users.filter(u => u.role === USER_ROLES.ADMIN).length,
        doctor: users.filter(u => u.role === USER_ROLES.DOCTOR).length,
        lab_technician: users.filter(u => u.role === USER_ROLES.LAB_TECHNICIAN).length,
        patient: users.filter(u => u.role === USER_ROLES.PATIENT).length
      }
    };
  }

  // Generate a temporary 2FA secret for the user to scan
  generateTwoFactorSecret(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isTwoFactorEnabled) {
      throw new Error('Two-factor authentication is already enabled for this account');
    }

    const secret = speakeasy.generateSecret({
      name: `Laboratory Results (${user.email})`
    });

    // Store secret temporarily until verified
    user.twoFactorSecret = secret.base32;

    return {
      otpauthUrl: secret.otpauth_url,
      base32: secret.base32
    };
  }

  // Verify the OTP and permanently enable 2FA
  verifyAndEnableTwoFactor(userId, token) {
    const user = this.users.get(userId);
    if (!user || !user.twoFactorSecret) {
      throw new Error('Two-factor setup has not been initiated');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      throw new Error('Invalid two-factor authentication code');
    }

    user.isTwoFactorEnabled = true;
    user.updatedAt = new Date().toISOString();
    return true;
  }
}

module.exports = {
  UserModel,
  USER_ROLES,
  ROLE_PERMISSIONS
};