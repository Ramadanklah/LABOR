const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Configure email transporter based on environment
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.fromEmail = process.env.FROM_EMAIL || 'noreply@laborresults.de';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  // Send email verification
  async sendActivationEmail(userEmail, userName, activationToken) {
    const activationUrl = `${this.frontendUrl}/verify-email?token=${activationToken}`;
    
    const mailOptions = {
      from: this.fromEmail,
      to: userEmail,
      subject: 'Activate Your Laboratory Results Account',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Activate Your Account</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              background: #2563eb; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
            }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Laboratory Results System</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>Thank you for creating an account with Laboratory Results System. To complete your registration and secure your account, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${activationUrl}" class="button">Activate Account</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #2563eb;">${activationUrl}</p>
              
              <p>This link will expire in 24 hours for security reasons.</p>
              
              <p><strong>Important:</strong> Once your email is verified, you will be required to set up Two-Factor Authentication (2FA) on your first login for enhanced security.</p>
              
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>Laboratory Results System - Secure Medical Data Management</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Activation email sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error sending activation email:', error);
      throw new Error('Failed to send activation email');
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(userEmail, userName, resetToken) {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: this.fromEmail,
      to: userEmail,
      subject: 'Reset Your Laboratory Results Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              background: #dc2626; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
            }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
            .warning { background: #fef3cd; border: 1px solid #ffd60a; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>We received a request to reset the password for your Laboratory Results System account.</p>
              
              <div class="warning">
                <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email and contact your system administrator immediately.
              </div>
              
              <p>To reset your password, click the button below:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #dc2626;">${resetUrl}</p>
              
              <p>This link will expire in 1 hour for security reasons.</p>
              
              <p><strong>After resetting your password:</strong></p>
              <ul>
                <li>All existing sessions will be terminated</li>
                <li>You will need to log in again with your new password</li>
                <li>Two-factor authentication will remain enabled if previously set up</li>
              </ul>
            </div>
            <div class="footer">
              <p>Laboratory Results System - Secure Medical Data Management</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  // Send new user welcome email (for admin-created users)
  async sendWelcomeEmail(userEmail, userName, tempPassword, activationToken) {
    const activationUrl = `${this.frontendUrl}/verify-email?token=${activationToken}`;
    
    const mailOptions = {
      from: this.fromEmail,
      to: userEmail,
      subject: 'Welcome to Laboratory Results System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Laboratory Results</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9fafb; }
            .button { 
              display: inline-block; 
              background: #059669; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 6px; 
              margin: 20px 0;
            }
            .credentials { 
              background: #e5f3ff; 
              border: 1px solid #3b82f6; 
              padding: 20px; 
              border-radius: 6px; 
              margin: 20px 0;
              font-family: monospace;
            }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
            .warning { background: #fef3cd; border: 1px solid #ffd60a; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Laboratory Results System</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>An account has been created for you in the Laboratory Results System. To get started, please follow these steps:</p>
              
              <h3>Step 1: Activate Your Account</h3>
              <p>First, verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${activationUrl}" class="button">Activate Account</a>
              </div>
              
              <h3>Step 2: Login Credentials</h3>
              <p>Use these temporary credentials to log in after activation:</p>
              
              <div class="credentials">
                <strong>Email:</strong> ${userEmail}<br>
                <strong>Temporary Password:</strong> ${tempPassword}
              </div>
              
              <div class="warning">
                <strong>Important Security Steps:</strong>
                <ul>
                  <li>Change your password immediately after first login</li>
                  <li>You will be required to set up Two-Factor Authentication (2FA)</li>
                  <li>Keep your login credentials secure and never share them</li>
                </ul>
              </div>
              
              <h3>Step 3: First Login</h3>
              <p>After email verification, log in at: <a href="${this.frontendUrl}/login">${this.frontendUrl}/login</a></p>
              
              <p>The activation link will expire in 24 hours for security reasons.</p>
            </div>
            <div class="footer">
              <p>Laboratory Results System - Secure Medical Data Management</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw new Error('Failed to send welcome email');
    }
  }

  // Send 2FA setup notification
  async send2FAEnabledNotification(userEmail, userName) {
    const mailOptions = {
      from: this.fromEmail,
      to: userEmail,
      subject: 'Two-Factor Authentication Enabled',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>2FA Enabled</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9fafb; }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
            .security-info { background: #e5f3ff; border: 1px solid #3b82f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Two-Factor Authentication Enabled</h1>
            </div>
            <div class="content">
              <h2>Hello ${userName},</h2>
              <p>Two-Factor Authentication (2FA) has been successfully enabled for your Laboratory Results System account.</p>
              
              <div class="security-info">
                <h3>Enhanced Security Active</h3>
                <p>Your account is now protected with an additional layer of security. You will need to provide both your password and a verification code from your authenticator app when logging in.</p>
              </div>
              
              <h3>Important Backup Information:</h3>
              <ul>
                <li>Save your backup codes in a secure location</li>
                <li>Backup codes can be used if you lose access to your authenticator app</li>
                <li>Each backup code can only be used once</li>
                <li>Contact your administrator if you lose both your authenticator and backup codes</li>
              </ul>
              
              <p>If you did not enable 2FA yourself, please contact your system administrator immediately.</p>
            </div>
            <div class="footer">
              <p>Laboratory Results System - Secure Medical Data Management</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`2FA enabled notification sent to ${userEmail}`);
      return true;
    } catch (error) {
      console.error('Error sending 2FA notification:', error);
      // Don't throw error for notifications - they're not critical
      return false;
    }
  }

  // Test email configuration
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service connected successfully');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = EmailService;