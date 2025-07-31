const nodemailer = require('nodemailer');
const crypto = require('crypto');

class GmailAuthService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Store verification codes temporarily (in production, use Redis)
    this.verificationCodes = new Map();
    
    // Clean up expired codes every 10 minutes
    setInterval(() => {
      this.cleanupExpiredCodes();
    }, 10 * 60 * 1000);
  }

  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification code to email
   */
  async sendVerificationCode(email, type = 'login') {
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the code with expiration
    this.verificationCodes.set(email, {
      code,
      expiresAt,
      type,
      attempts: 0
    });

    const subject = type === 'login' 
      ? 'Your Lab Results Login Code' 
      : 'Email Verification Code';

    const html = this.generateEmailTemplate(code, type);

    try {
      await this.transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject,
        html
      });

      return { success: true, message: 'Verification code sent successfully' };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Verify the code provided by user
   */
  verifyCode(email, providedCode) {
    const stored = this.verificationCodes.get(email);

    if (!stored) {
      return { 
        success: false, 
        message: 'No verification code found. Please request a new one.' 
      };
    }

    // Check if code is expired
    if (new Date() > stored.expiresAt) {
      this.verificationCodes.delete(email);
      return { 
        success: false, 
        message: 'Verification code has expired. Please request a new one.' 
      };
    }

    // Check attempts limit
    if (stored.attempts >= 3) {
      this.verificationCodes.delete(email);
      return { 
        success: false, 
        message: 'Too many verification attempts. Please request a new code.' 
      };
    }

    // Increment attempts
    stored.attempts += 1;

    // Verify code
    if (stored.code !== providedCode) {
      return { 
        success: false, 
        message: `Invalid verification code. ${3 - stored.attempts} attempts remaining.` 
      };
    }

    // Success - remove the code
    this.verificationCodes.delete(email);
    return { 
      success: true, 
      message: 'Email verified successfully' 
    };
  }

  /**
   * Generate HTML email template
   */
  generateEmailTemplate(code, type) {
    const title = type === 'login' ? 'Login Verification' : 'Email Verification';
    const message = type === 'login' 
      ? 'Use this code to complete your login to the Lab Results System:'
      : 'Use this code to verify your email address:';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
          .code { background: #fff; border: 2px solid #007bff; border-radius: 5px; font-size: 24px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; letter-spacing: 3px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 3px; padding: 10px; margin: 15px 0; color: #856404; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>${message}</p>
            <div class="code">${code}</div>
            <div class="warning">
              <strong>Security Notice:</strong><br>
              • This code expires in 10 minutes<br>
              • Do not share this code with anyone<br>
              • If you didn't request this code, please ignore this email
            </div>
            <p>If you're having trouble, please contact your system administrator.</p>
          </div>
          <div class="footer">
            <p>This email was sent from the Lab Results System<br>
            Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Clean up expired verification codes
   */
  cleanupExpiredCodes() {
    const now = new Date();
    for (const [email, data] of this.verificationCodes.entries()) {
      if (now > data.expiresAt) {
        this.verificationCodes.delete(email);
      }
    }
  }

  /**
   * Check if email has pending verification
   */
  hasPendingVerification(email) {
    const stored = this.verificationCodes.get(email);
    return stored && new Date() <= stored.expiresAt;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 3px; padding: 10px; margin: 15px 0; color: #856404; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have requested to reset your password for the Lab Results System.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <div class="warning">
              <strong>Security Notice:</strong><br>
              • This link expires in 1 hour<br>
              • If you didn't request this reset, please ignore this email<br>
              • Your password will not be changed until you click the link above
            </div>
          </div>
          <div class="footer">
            <p>This email was sent from the Lab Results System<br>
            Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'Password Reset Request - Lab Results System',
        html
      });

      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      console.error('Password reset email error:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'Email configuration is valid' };
    } catch (error) {
      return { success: false, message: 'Email configuration error: ' + error.message };
    }
  }
}

module.exports = GmailAuthService;