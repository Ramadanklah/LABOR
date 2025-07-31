const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// User roles with hierarchical permissions
const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  DOCTOR: 'doctor',
  LAB_TECHNICIAN: 'lab_technician',
  VIEWER: 'viewer',
  PATIENT: 'patient'
};

const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: {
    canCreateUsers: true,
    canManageRoles: true,
    canViewAllUsers: true,
    canViewAllResults: true,
    canManageSystem: true,
    canDownloadReports: true,
    canViewAnalytics: true,
    canDeleteUsers: true,
    canResetPasswords: true,
    canManagePermissions: true
  },
  [USER_ROLES.MANAGER]: {
    canCreateUsers: true,
    canManageRoles: false,
    canViewAllUsers: true,
    canViewAllResults: true,
    canManageSystem: false,
    canDownloadReports: true,
    canViewAnalytics: true,
    canDeleteUsers: false,
    canResetPasswords: true,
    canManagePermissions: false
  },
  [USER_ROLES.DOCTOR]: {
    canCreateUsers: false,
    canManageRoles: false,
    canViewAllUsers: false,
    canViewAllResults: false, // Only their assigned patients
    canManageSystem: false,
    canDownloadReports: true,
    canViewAnalytics: false,
    canViewPatientResults: true,
    canDeleteUsers: false,
    canResetPasswords: false,
    canManagePermissions: false
  },
  [USER_ROLES.LAB_TECHNICIAN]: {
    canCreateUsers: false,
    canManageRoles: false,
    canViewAllUsers: false,
    canViewAllResults: true, // Can see all lab results
    canManageSystem: false,
    canDownloadReports: true,
    canViewAnalytics: true,
    canUploadResults: true,
    canDeleteUsers: false,
    canResetPasswords: false,
    canManagePermissions: false
  },
  [USER_ROLES.VIEWER]: {
    canCreateUsers: false,
    canManageRoles: false,
    canViewAllUsers: false,
    canViewAllResults: false,
    canManageSystem: false,
    canDownloadReports: false,
    canViewAnalytics: false,
    canDeleteUsers: false,
    canResetPasswords: false,
    canManagePermissions: false
  },
  [USER_ROLES.PATIENT]: {
    canCreateUsers: false,
    canManageRoles: false,
    canViewAllUsers: false,
    canViewAllResults: false, // Only their own results
    canManageSystem: false,
    canDownloadReports: true,
    canViewAnalytics: false,
    canDeleteUsers: false,
    canResetPasswords: false,
    canManagePermissions: false
  }
};

class UserModel {
  constructor() {
    this.initializeDefaultUsers();
  }

  // Initialize default admin user
  async initializeDefaultUsers() {
    try {
      // Check if admin user already exists
      const existingAdmin = await prisma.user.findUnique({
        where: { email: 'admin@laborresults.de' }
      });

      if (!existingAdmin) {
        // Create default admin user
        await this.createUser({
          email: 'admin@laborresults.de',
          password: 'admin123',
          firstName: 'System',
          lastName: 'Administrator',
          role: USER_ROLES.ADMIN,
          bsnr: '999999999',
          lanr: '9999999',
          isActive: true,
          isEmailVerified: true,
          mustSetup2FA: false // Admin can set up 2FA later
        });

        console.log('Default admin user created successfully');
      }
    } catch (error) {
      console.error('Error initializing default users:', error);
    }
  }

  // Create new user
  async createUser(userData, createdBy = null) {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      bsnr,
      lanr,
      isActive = true,
      isEmailVerified = false,
      mustSetup2FA = true
    } = userData;

    // Validation
    if (!email || !password || !firstName || !lastName || !role) {
      throw new Error('Missing required fields');
    }

    if (!Object.values(USER_ROLES).includes(role)) {
      throw new Error('Invalid role');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Check BSNR/LANR combination if provided
    if (bsnr && lanr) {
      const existingBsnrLanr = await prisma.user.findFirst({
        where: {
          AND: [
            { bsnr: bsnr },
            { lanr: lanr }
          ]
        }
      });

      if (existingBsnrLanr) {
        throw new Error('BSNR/LANR combination already exists');
      }
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate activation token if email verification is required
    const activationToken = !isEmailVerified ? crypto.randomBytes(32).toString('hex') : null;
    const activationExpires = !isEmailVerified ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null; // 24 hours

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        role,
        bsnr,
        lanr,
        isActive,
        isEmailVerified,
        mustSetup2FA,
        activationToken,
        activationExpires,
        createdBy
      }
    });

    // Log user creation
    await this.logAction(createdBy, 'USER_CREATED', {
      createdUserId: user.id,
      createdUserEmail: user.email,
      role: user.role
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return {
      ...userWithoutPassword,
      activationToken: activationToken // Include for email sending
    };
  }

  // Authenticate user
  async authenticateUser(email, password, otp = null, ipAddress = null, userAgent = null) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('User account is disabled');
    }

    if (!user.isEmailVerified) {
      throw new Error('Email not verified. Please check your email for verification link.');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if 2FA is required but not set up
    if (user.mustSetup2FA && !user.isTwoFactorEnabled) {
      throw new Error('Two-factor authentication setup required');
    }

    // If 2FA is enabled, require OTP verification
    if (user.isTwoFactorEnabled) {
      if (!otp) {
        throw new Error('Two-factor authentication code required');
      }

      // Try regular TOTP first
      let verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: otp,
        window: 1
      });

      // If TOTP fails, check backup codes
      if (!verified && user.backupCodes && user.backupCodes.length > 0) {
        const hashedBackupCodes = user.backupCodes;
        for (let i = 0; i < hashedBackupCodes.length; i++) {
          if (await bcrypt.compare(otp, hashedBackupCodes[i])) {
            verified = true;
            // Remove used backup code
            const updatedBackupCodes = hashedBackupCodes.filter((_, index) => index !== i);
            await prisma.user.update({
              where: { id: user.id },
              data: { backupCodes: updatedBackupCodes }
            });
            break;
          }
        }
      }

      if (!verified) {
        throw new Error('Invalid two-factor authentication code');
      }
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate JWT token
    const token = this.generateToken(user);

    // Create session record
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

    // Log successful login
    await this.logAction(user.id, 'LOGIN', {}, ipAddress, userAgent);

    // Return user info and token (without password and sensitive data)
    const { password: _, twoFactorSecret: __, backupCodes: ___, ...userWithoutSensitiveData } = user;
    return {
      user: {
        ...userWithoutSensitiveData,
        permissions: ROLE_PERMISSIONS[user.role]
      },
      token,
      requiresSetup2FA: user.mustSetup2FA && !user.isTwoFactorEnabled
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
      permissions: ROLE_PERMISSIONS[user.role]
    };

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return jwt.sign(payload, jwtSecret, {
      expiresIn: process.env.JWT_EXPIRATION || '24h'
    });
  }

  // Verify JWT token
  async verifyToken(token) {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is required');
      }
      
      const decoded = jwt.verify(token, jwtSecret);
      
      // Check if session is still active
      const session = await prisma.userSession.findUnique({
        where: { token },
        include: { user: true }
      });

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        throw new Error('Session expired or invalid');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Get user by ID
  async getUserById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return null;

    const { password: _, twoFactorSecret: __, backupCodes: ___, ...userWithoutSensitiveData } = user;
    return {
      ...userWithoutSensitiveData,
      permissions: ROLE_PERMISSIONS[user.role]
    };
  }

  // Update user
  async updateUser(userId, updates, updatedBy = null) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

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
      const existingUser = await prisma.user.findUnique({
        where: { email: updates.email.toLowerCase() }
      });

      if (existingUser) {
        throw new Error('Email already exists');
      }

      updates.email = updates.email.toLowerCase();
      updates.isEmailVerified = false; // Require re-verification
      updates.activationToken = crypto.randomBytes(32).toString('hex');
      updates.activationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Handle BSNR/LANR update
    if ((updates.bsnr || updates.lanr) && 
        (updates.bsnr !== user.bsnr || updates.lanr !== user.lanr)) {
      
      const newBsnr = updates.bsnr || user.bsnr;
      const newLanr = updates.lanr || user.lanr;
      
      if (newBsnr && newLanr) {
        const existingBsnrLanr = await prisma.user.findFirst({
          where: {
            AND: [
              { bsnr: newBsnr },
              { lanr: newLanr },
              { id: { not: userId } }
            ]
          }
        });

        if (existingBsnrLanr) {
          throw new Error('BSNR/LANR combination already exists');
        }
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates
    });

    // Log user update
    await this.logAction(updatedBy, 'USER_UPDATED', {
      updatedUserId: userId,
      updates: Object.keys(updates).filter(key => key !== 'password')
    });

    const { password: _, twoFactorSecret: __, backupCodes: ___, ...userWithoutSensitiveData } = updatedUser;
    return {
      ...userWithoutSensitiveData,
      permissions: ROLE_PERMISSIONS[updatedUser.role]
    };
  }

  // Delete user
  async deleteUser(userId, deletedBy = null) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Delete user (cascades to sessions)
    await prisma.user.delete({
      where: { id: userId }
    });

    // Log user deletion
    await this.logAction(deletedBy, 'USER_DELETED', {
      deletedUserId: userId,
      deletedUserEmail: user.email
    });

    return true;
  }

  // Get all users with filtering and pagination
  async getAllUsers(filters = {}, pagination = {}) {
    const { role, isActive, search } = filters;
    const { page = 1, limit = 50 } = pagination;

    const where = {};

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { bsnr: { contains: search } },
        { lanr: { contains: search } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          bsnr: true,
          lanr: true,
          isActive: true,
          isTwoFactorEnabled: true,
          mustSetup2FA: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          createdBy: true
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users: users.map(user => ({
        ...user,
        permissions: ROLE_PERMISSIONS[user.role]
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Generate 2FA setup for user
  async setup2FA(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isTwoFactorEnabled) {
      throw new Error('Two-factor authentication is already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `Lab Results (${user.email})`,
      issuer: 'Laboratory Results System'
    });

    // Store secret temporarily
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 }
    });

    // Generate QR code
    const qrCodeDataURL = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeDataURL,
      otpauthUrl: secret.otpauth_url
    };
  }

  // Verify and enable 2FA
  async verify2FA(userId, token) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

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

    // Generate backup codes
    const backupCodes = [];
    const plainBackupCodes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex');
      plainBackupCodes.push(code);
      backupCodes.push(await bcrypt.hash(code, 10));
    }

    // Enable 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: true,
        mustSetup2FA: false,
        backupCodes
      }
    });

    // Log 2FA setup
    await this.logAction(userId, '2FA_ENABLED');

    return {
      success: true,
      backupCodes: plainBackupCodes
    };
  }

  // Disable 2FA
  async disable2FA(userId, disabledBy = null) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isTwoFactorEnabled: false,
        twoFactorSecret: null,
        backupCodes: []
      }
    });

    // Log 2FA disable
    await this.logAction(disabledBy || userId, '2FA_DISABLED', { targetUserId: userId });

    return true;
  }

  // Generate password reset token
  async generatePasswordResetToken(email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists
      return { success: true };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires
      }
    });

    return {
      success: true,
      resetToken, // Use this to send email
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`
    };
  }

  // Reset password with token
  async resetPassword(token, newPassword) {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() }
      }
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });

    // Invalidate all existing sessions
    await prisma.userSession.updateMany({
      where: { userId: user.id },
      data: { isActive: false }
    });

    // Log password reset
    await this.logAction(user.id, 'PASSWORD_RESET');

    return true;
  }

  // Verify email with activation token
  async verifyEmail(token) {
    const user = await prisma.user.findFirst({
      where: {
        activationToken: token,
        activationExpires: { gt: new Date() }
      }
    });

    if (!user) {
      throw new Error('Invalid or expired activation token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        activationToken: null,
        activationExpires: null
      }
    });

    // Log email verification
    await this.logAction(user.id, 'EMAIL_VERIFIED');

    return true;
  }

  // Get user statistics
  async getUserStats() {
    const [total, active, byRole] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      })
    ]);

    const roleStats = Object.values(USER_ROLES).reduce((acc, role) => {
      acc[role] = 0;
      return acc;
    }, {});

    byRole.forEach(item => {
      roleStats[item.role] = item._count.role;
    });

    return {
      total,
      active,
      inactive: total - active,
      byRole: roleStats
    };
  }

  // Log user action
  async logAction(userId, action, details = {}, ipAddress = null, userAgent = null) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details,
          ipAddress,
          userAgent
        }
      });
    } catch (error) {
      console.error('Error logging action:', error);
    }
  }

  // Get audit logs
  async getAuditLogs(filters = {}, pagination = {}) {
    const { userId, action, startDate, endDate } = filters;
    const { page = 1, limit = 50 } = pagination;

    const where = {};

    if (userId) {
      where.userId = userId;
    }

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Logout user (invalidate session)
  async logout(token, userId = null, ipAddress = null, userAgent = null) {
    await prisma.userSession.updateMany({
      where: { token },
      data: { isActive: false }
    });

    if (userId) {
      await this.logAction(userId, 'LOGOUT', {}, ipAddress, userAgent);
    }

    return true;
  }

  // Check user permissions
  hasPermission(user, permission) {
    const permissions = ROLE_PERMISSIONS[user.role];
    return permissions && permissions[permission] === true;
  }
}

module.exports = {
  UserModel,
  USER_ROLES,
  ROLE_PERMISSIONS
};