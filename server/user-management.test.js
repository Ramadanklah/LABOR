const { UserModel, USER_ROLES, ROLE_PERMISSIONS } = require('./models/User');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

describe('User Management System Tests', () => {
  let userModel;

  beforeEach(() => {
    userModel = new UserModel();
  });

  describe('User Model', () => {
    describe('User Creation', () => {
      it('should create a new user with valid data', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          role: USER_ROLES.LAB_TECHNICIAN,
          bsnr: '123456789',
          lanr: '987654321'
        };

        const user = await userModel.createUser(userData);
        
        expect(user).toHaveProperty('id');
        expect(user.email).toBe(userData.email);
        expect(user.firstName).toBe(userData.firstName);
        expect(user.lastName).toBe(userData.lastName);
        expect(user.role).toBe(userData.role);
        expect(user.bsnr).toBe(userData.bsnr);
        expect(user.lanr).toBe(userData.lanr);
        expect(user.isActive).toBe(true);
        expect(user.password).not.toBe(userData.password); // Should be hashed
      });

      it('should hash password during user creation', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'PlainTextPassword',
          firstName: 'John',
          lastName: 'Doe',
          role: USER_ROLES.PATIENT
        };

        const user = await userModel.createUser(userData);
        
        expect(user.password).not.toBe(userData.password);
        expect(user.password).toHaveLength(60); // bcrypt hash length
        
        // Verify password can be compared
        const isValid = await bcrypt.compare(userData.password, user.password);
        expect(isValid).toBe(true);
      });

      it('should validate required fields', async () => {
        const incompleteData = {
          email: 'test@example.com'
          // Missing required fields
        };

        await expect(userModel.createUser(incompleteData))
          .rejects.toThrow('Missing required fields');
      });

      it('should validate email format', async () => {
        const userData = {
          email: 'invalid-email',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          role: USER_ROLES.PATIENT
        };

        await expect(userModel.createUser(userData))
          .rejects.toThrow('Invalid email format');
      });

      it('should enforce unique email addresses', async () => {
        const userData = {
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          role: USER_ROLES.PATIENT
        };

        await userModel.createUser(userData);
        
        await expect(userModel.createUser(userData))
          .rejects.toThrow('User with this email already exists');
      });

      it('should validate password strength', async () => {
        const weakPasswords = [
          '123',           // Too short
          'password',      // No numbers/special chars
          '12345678',      // Only numbers
          'ABCDEFGH',      // Only uppercase
          'abcdefgh'       // Only lowercase
        ];

        for (const password of weakPasswords) {
          const userData = {
            email: `test${password}@example.com`,
            password: password,
            firstName: 'John',
            lastName: 'Doe',
            role: USER_ROLES.PATIENT
          };

          await expect(userModel.createUser(userData))
            .rejects.toThrow('Password does not meet strength requirements');
        }
      });

      it('should validate role assignment', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          role: 'invalid_role'
        };

        await expect(userModel.createUser(userData))
          .rejects.toThrow('Invalid user role');
      });

      it('should validate BSNR format for medical users', async () => {
        const userData = {
          email: 'doctor@example.com',
          password: 'SecurePass123!',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
          role: USER_ROLES.DOCTOR,
          bsnr: 'invalid_bsnr',
          lanr: '123456789'
        };

        await expect(userModel.createUser(userData))
          .rejects.toThrow('Invalid BSNR format');
      });

      it('should validate LANR format for medical users', async () => {
        const userData = {
          email: 'doctor@example.com',
          password: 'SecurePass123!',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
          role: USER_ROLES.DOCTOR,
          bsnr: '123456789',
          lanr: 'invalid_lanr'
        };

        await expect(userModel.createUser(userData))
          .rejects.toThrow('Invalid LANR format');
      });
    });

    describe('User Authentication', () => {
      let testUser;

      beforeEach(async () => {
        testUser = await userModel.createUser({
          email: 'auth@example.com',
          password: 'SecurePass123!',
          firstName: 'Auth',
          lastName: 'Test',
          role: USER_ROLES.PATIENT
        });
      });

      it('should authenticate user with correct credentials', async () => {
        const result = await userModel.authenticate('auth@example.com', 'SecurePass123!');
        
        expect(result.success).toBe(true);
        expect(result.user).toHaveProperty('id', testUser.id);
        expect(result.user).toHaveProperty('email', testUser.email);
        expect(result.user).not.toHaveProperty('password');
      });

      it('should reject authentication with wrong password', async () => {
        const result = await userModel.authenticate('auth@example.com', 'WrongPassword');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid credentials');
      });

      it('should reject authentication with non-existent email', async () => {
        const result = await userModel.authenticate('nonexistent@example.com', 'SecurePass123!');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid credentials');
      });

      it('should reject authentication for inactive users', async () => {
        await userModel.updateUser(testUser.id, { isActive: false });
        
        const result = await userModel.authenticate('auth@example.com', 'SecurePass123!');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Account is deactivated');
      });

      it('should handle authentication with BSNR/LANR', async () => {
        const doctorUser = await userModel.createUser({
          email: 'doctor@example.com',
          password: 'DoctorPass123!',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
          role: USER_ROLES.DOCTOR,
          bsnr: '123456789',
          lanr: '987654321'
        });

        const result = await userModel.authenticateWithBsnrLanr('123456789', '987654321', 'DoctorPass123!');
        
        expect(result.success).toBe(true);
        expect(result.user.id).toBe(doctorUser.id);
      });

      it('should track failed login attempts', async () => {
        // Make multiple failed attempts
        for (let i = 0; i < 3; i++) {
          await userModel.authenticate('auth@example.com', 'WrongPassword');
        }

        const user = await userModel.getUserById(testUser.id);
        expect(user.loginAttempts).toBe(3);
      });

      it('should lock account after maximum failed attempts', async () => {
        // Make maximum failed attempts
        for (let i = 0; i < 5; i++) {
          await userModel.authenticate('auth@example.com', 'WrongPassword');
        }

        const result = await userModel.authenticate('auth@example.com', 'SecurePass123!');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Account is temporarily locked');
      });

      it('should reset failed attempts after successful login', async () => {
        // Make some failed attempts
        await userModel.authenticate('auth@example.com', 'WrongPassword');
        await userModel.authenticate('auth@example.com', 'WrongPassword');

        // Successful login
        await userModel.authenticate('auth@example.com', 'SecurePass123!');

        const user = await userModel.getUserById(testUser.id);
        expect(user.loginAttempts).toBe(0);
      });
    });

    describe('Two-Factor Authentication', () => {
      let testUser;

      beforeEach(async () => {
        testUser = await userModel.createUser({
          email: '2fa@example.com',
          password: 'SecurePass123!',
          firstName: '2FA',
          lastName: 'Test',
          role: USER_ROLES.DOCTOR
        });
      });

      it('should generate 2FA secret', () => {
        const result = userModel.generateTwoFactorSecret(testUser.id);
        
        expect(result).toHaveProperty('otpauthUrl');
        expect(result).toHaveProperty('base32');
        expect(result.otpauthUrl).toContain('Lab Results');
        expect(result.otpauthUrl).toContain(testUser.email);
      });

      it('should enable 2FA with valid token', async () => {
        const { base32 } = userModel.generateTwoFactorSecret(testUser.id);
        const token = speakeasy.totp({
          secret: base32,
          encoding: 'base32'
        });

        const result = await userModel.enableTwoFactor(testUser.id, token);
        
        expect(result.success).toBe(true);

        const user = await userModel.getUserById(testUser.id);
        expect(user.isTwoFactorEnabled).toBe(true);
        expect(user.twoFactorSecret).toBeTruthy();
      });

      it('should reject invalid 2FA token', async () => {
        userModel.generateTwoFactorSecret(testUser.id);
        
        const result = await userModel.enableTwoFactor(testUser.id, '000000');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Invalid 2FA token');
      });

      it('should verify 2FA token during authentication', async () => {
        // Setup 2FA
        const { base32 } = userModel.generateTwoFactorSecret(testUser.id);
        const setupToken = speakeasy.totp({
          secret: base32,
          encoding: 'base32'
        });
        await userModel.enableTwoFactor(testUser.id, setupToken);

        // Try authentication with 2FA
        const authToken = speakeasy.totp({
          secret: base32,
          encoding: 'base32'
        });

        const result = await userModel.authenticateWith2FA(testUser.email, 'SecurePass123!', authToken);
        
        expect(result.success).toBe(true);
        expect(result.user.id).toBe(testUser.id);
      });

      it('should reject authentication without 2FA token when enabled', async () => {
        // Setup 2FA
        const { base32 } = userModel.generateTwoFactorSecret(testUser.id);
        const token = speakeasy.totp({
          secret: base32,
          encoding: 'base32'
        });
        await userModel.enableTwoFactor(testUser.id, token);

        const result = await userModel.authenticate(testUser.email, 'SecurePass123!');
        
        expect(result.success).toBe(false);
        expect(result.requiresTwoFactor).toBe(true);
      });
    });

    describe('User Retrieval', () => {
      let users;

      beforeEach(async () => {
        users = [];
        const roles = [USER_ROLES.ADMIN, USER_ROLES.DOCTOR, USER_ROLES.LAB_TECH, USER_ROLES.PATIENT];
        
        for (let i = 0; i < roles.length; i++) {
          const user = await userModel.createUser({
            email: `user${i}@example.com`,
            password: 'SecurePass123!',
            firstName: `User${i}`,
            lastName: `Test`,
            role: roles[i]
          });
          users.push(user);
        }
      });

      it('should get user by ID', async () => {
        const user = await userModel.getUserById(users[0].id);
        
        expect(user).toBeTruthy();
        expect(user.id).toBe(users[0].id);
        expect(user.email).toBe(users[0].email);
      });

      it('should return null for non-existent user ID', async () => {
        const user = await userModel.getUserById('non-existent-id');
        expect(user).toBeNull();
      });

      it('should get user by email', async () => {
        const user = await userModel.getUserByEmail(users[0].email);
        
        expect(user).toBeTruthy();
        expect(user.id).toBe(users[0].id);
        expect(user.email).toBe(users[0].email);
      });

      it('should return null for non-existent email', async () => {
        const user = await userModel.getUserByEmail('nonexistent@example.com');
        expect(user).toBeNull();
      });

      it('should get all users', () => {
        const allUsers = userModel.getAllUsers();
        
        expect(Array.isArray(allUsers)).toBe(true);
        expect(allUsers.length).toBeGreaterThanOrEqual(4);
      });

      it('should filter users by role', () => {
        const admins = userModel.getAllUsers({ role: USER_ROLES.ADMIN });
        const doctors = userModel.getAllUsers({ role: USER_ROLES.DOCTOR });
        
        expect(admins.every(user => user.role === USER_ROLES.ADMIN)).toBe(true);
        expect(doctors.every(user => user.role === USER_ROLES.DOCTOR)).toBe(true);
      });

      it('should filter users by active status', async () => {
        // Deactivate one user
        await userModel.updateUser(users[0].id, { isActive: false });
        
        const activeUsers = userModel.getAllUsers({ isActive: true });
        const inactiveUsers = userModel.getAllUsers({ isActive: false });
        
        expect(activeUsers.every(user => user.isActive === true)).toBe(true);
        expect(inactiveUsers.some(user => user.isActive === false)).toBe(true);
      });

      it('should search users by name', () => {
        const results = userModel.getAllUsers({ search: 'User0' });
        
        expect(results.some(user => 
          user.firstName.includes('User0') || 
          user.lastName.includes('User0')
        )).toBe(true);
      });

      it('should search users by email', () => {
        const results = userModel.getAllUsers({ search: 'user1@example.com' });
        
        expect(results.some(user => 
          user.email.includes('user1@example.com')
        )).toBe(true);
      });
    });

    describe('User Updates', () => {
      let testUser;

      beforeEach(async () => {
        testUser = await userModel.createUser({
          email: 'update@example.com',
          password: 'SecurePass123!',
          firstName: 'Update',
          lastName: 'Test',
          role: USER_ROLES.PATIENT
        });
      });

      it('should update user profile information', async () => {
        const updates = {
          firstName: 'UpdatedFirst',
          lastName: 'UpdatedLast',
          email: 'updated@example.com'
        };

        const updatedUser = await userModel.updateUser(testUser.id, updates);
        
        expect(updatedUser.firstName).toBe(updates.firstName);
        expect(updatedUser.lastName).toBe(updates.lastName);
        expect(updatedUser.email).toBe(updates.email);
      });

      it('should update user role', async () => {
        const updatedUser = await userModel.updateUser(testUser.id, { 
          role: USER_ROLES.LAB_TECH 
        });
        
        expect(updatedUser.role).toBe(USER_ROLES.LAB_TECH);
      });

      it('should update user active status', async () => {
        const updatedUser = await userModel.updateUser(testUser.id, { 
          isActive: false 
        });
        
        expect(updatedUser.isActive).toBe(false);
      });

      it('should update password with hashing', async () => {
        const newPassword = 'NewSecurePass123!';
        const updatedUser = await userModel.updateUser(testUser.id, { 
          password: newPassword 
        });
        
        expect(updatedUser.password).not.toBe(newPassword);
        
        // Verify new password works
        const authResult = await userModel.authenticate(testUser.email, newPassword);
        expect(authResult.success).toBe(true);
      });

      it('should validate email uniqueness on update', async () => {
        const anotherUser = await userModel.createUser({
          email: 'another@example.com',
          password: 'SecurePass123!',
          firstName: 'Another',
          lastName: 'User',
          role: USER_ROLES.PATIENT
        });

        await expect(userModel.updateUser(testUser.id, { 
          email: 'another@example.com' 
        })).rejects.toThrow('Email already exists');
      });

      it('should update BSNR and LANR for medical users', async () => {
        const doctorUser = await userModel.createUser({
          email: 'doctor@example.com',
          password: 'DoctorPass123!',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
          role: USER_ROLES.DOCTOR,
          bsnr: '123456789',
          lanr: '987654321'
        });

        const updates = {
          bsnr: '999888777',
          lanr: '111222333'
        };

        const updatedUser = await userModel.updateUser(doctorUser.id, updates);
        
        expect(updatedUser.bsnr).toBe(updates.bsnr);
        expect(updatedUser.lanr).toBe(updates.lanr);
      });

      it('should reject invalid updates', async () => {
        await expect(userModel.updateUser(testUser.id, {
          email: 'invalid-email'
        })).rejects.toThrow('Invalid email format');

        await expect(userModel.updateUser(testUser.id, {
          role: 'invalid_role'
        })).rejects.toThrow('Invalid user role');
      });

      it('should handle non-existent user updates', async () => {
        await expect(userModel.updateUser('non-existent-id', {
          firstName: 'New Name'
        })).rejects.toThrow('User not found');
      });
    });

    describe('User Deletion', () => {
      let testUser;

      beforeEach(async () => {
        testUser = await userModel.createUser({
          email: 'delete@example.com',
          password: 'SecurePass123!',
          firstName: 'Delete',
          lastName: 'Test',
          role: USER_ROLES.PATIENT
        });
      });

      it('should delete user by ID', async () => {
        const result = await userModel.deleteUser(testUser.id);
        
        expect(result.success).toBe(true);
        
        const deletedUser = await userModel.getUserById(testUser.id);
        expect(deletedUser).toBeNull();
      });

      it('should handle deletion of non-existent user', async () => {
        const result = await userModel.deleteUser('non-existent-id');
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('User not found');
      });

      it('should soft delete instead of hard delete (if implemented)', async () => {
        // This test assumes soft delete is implemented
        // If using hard delete, this test should be adjusted
        const result = await userModel.deleteUser(testUser.id);
        
        if (result.softDelete) {
          const user = await userModel.getUserById(testUser.id, { includeDeleted: true });
          expect(user).toBeTruthy();
          expect(user.deletedAt).toBeTruthy();
        }
      });
    });
  });

  describe('Role-Based Permissions', () => {
    it('should define all required user roles', () => {
      expect(USER_ROLES).toHaveProperty('ADMIN');
      expect(USER_ROLES).toHaveProperty('DOCTOR');
      expect(USER_ROLES).toHaveProperty('LAB_TECH');
      expect(USER_ROLES).toHaveProperty('PATIENT');
    });

    it('should define role permissions', () => {
      expect(ROLE_PERMISSIONS).toHaveProperty(USER_ROLES.ADMIN);
      expect(ROLE_PERMISSIONS).toHaveProperty(USER_ROLES.DOCTOR);
      expect(ROLE_PERMISSIONS).toHaveProperty(USER_ROLES.LAB_TECH);
      expect(ROLE_PERMISSIONS).toHaveProperty(USER_ROLES.PATIENT);
    });

    it('should grant admin all permissions', () => {
      const adminPermissions = ROLE_PERMISSIONS[USER_ROLES.ADMIN];
      
      expect(adminPermissions).toContain('manage_users');
      expect(adminPermissions).toContain('view_all_results');
      expect(adminPermissions).toContain('assign_results');
      expect(adminPermissions).toContain('system_admin');
    });

    it('should grant doctor appropriate permissions', () => {
      const doctorPermissions = ROLE_PERMISSIONS[USER_ROLES.DOCTOR];
      
      expect(doctorPermissions).toContain('upload_ldt');
      expect(doctorPermissions).toContain('view_own_results');
      expect(doctorPermissions).toContain('export_results');
    });

    it('should grant lab technician appropriate permissions', () => {
      const labTechPermissions = ROLE_PERMISSIONS[USER_ROLES.LAB_TECH];
      
      expect(labTechPermissions).toContain('process_results');
      expect(labTechPermissions).toContain('view_assigned_results');
    });

    it('should grant patient minimal permissions', () => {
      const patientPermissions = ROLE_PERMISSIONS[USER_ROLES.PATIENT];
      
      expect(patientPermissions).toContain('view_own_results');
      expect(patientPermissions).toContain('download_own_results');
      expect(patientPermissions).not.toContain('manage_users');
      expect(patientPermissions).not.toContain('upload_ldt');
    });
  });

  describe('User Model Validation', () => {
    it('should validate user data structure', () => {
      const userModel = new UserModel();
      const validUser = {
        id: 'user-123',
        email: 'valid@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: USER_ROLES.PATIENT,
        isActive: true,
        isTwoFactorEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const isValid = userModel.validateUserStructure(validUser);
      expect(isValid).toBe(true);
    });

    it('should reject invalid user data structure', () => {
      const userModel = new UserModel();
      const invalidUser = {
        id: 'user-123',
        // Missing required fields
      };

      const isValid = userModel.validateUserStructure(invalidUser);
      expect(isValid).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent user creation', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          userModel.createUser({
            email: `concurrent${i}@example.com`,
            password: 'SecurePass123!',
            firstName: `User${i}`,
            lastName: 'Test',
            role: USER_ROLES.PATIENT
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful.length).toBe(5);
    });

    it('should handle concurrent authentication attempts', async () => {
      const testUser = await userModel.createUser({
        email: 'concurrent@example.com',
        password: 'SecurePass123!',
        firstName: 'Concurrent',
        lastName: 'Test',
        role: USER_ROLES.PATIENT
      });

      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          userModel.authenticate('concurrent@example.com', 'SecurePass123!')
        );
      }

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});