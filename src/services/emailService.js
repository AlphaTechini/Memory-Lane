import nodemailer from 'nodemailer';

/**
 * Email Service for sending OTP codes and other notifications
 */
class EmailService {
  constructor() {
    this.transporter = null;
    // Prefer explicit EMAIL_FROM; if absent fall back to SMTP user so it matches the authenticated account
    this.fromEmail = process.env.EMAIL_FROM && process.env.EMAIL_FROM.trim() !== ''
      ? process.env.EMAIL_FROM.trim()
      : (process.env.EMAIL_SMTP_USER || 'noreply@sensay.ai');
    console.log('📧 Initializing EmailService with real SMTP...');
    this.setupTransporter();
  }

  /**
   * Setup email transporter using real SMTP configuration
   */
  setupTransporter() {
  const host = process.env.EMAIL_SMTP_HOST;
    const port = process.env.EMAIL_SMTP_PORT ? parseInt(process.env.EMAIL_SMTP_PORT, 10) : undefined;
    const user = process.env.EMAIL_SMTP_USER;
    const pass = process.env.EMAIL_SMTP_PASS;
    const from = process.env.EMAIL_FROM || this.fromEmail;

    if (!user || !pass) {
  console.warn('⚠️ EMAIL_SMTP_USER and EMAIL_SMTP_PASS not set. Email features will be disabled. (From will be mocked)');
      
      // Create a mock transporter for development
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 [EMAIL MOCK - SMTP not configured]');
          console.log('To:', mailOptions.to);
          console.log('Subject:', mailOptions.subject);
          console.log('From:', mailOptions.from);
          console.log('---');
          return { messageId: 'mock-' + Date.now() };
        },
        verify: async () => {
          throw new Error('SMTP not configured');
        }
      };
      return;
    }

    // Prefer explicit host/port; fall back to Gmail service if host not provided
    try {
      if (host) {
        this.transporter = nodemailer.createTransport({
          host,
          port: port || 587,
            secure: (port === 465),
          auth: { user, pass }
        });
      } else {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass }
        });
      }
  console.log(`📧 Email service configured (${host ? host : 'gmail service'})`);
  console.log(`   From: ${this.fromEmail}`);
  console.log(`   Auth user: ${user}`);
    } catch (err) {
      console.error('❌ Failed to create SMTP transporter:', err.message);
    }
  }

  /**
   * Generate a 6-digit OTP code
   * @returns {String} 6-digit numeric OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP email to user
   * @param {String} email - User's email address
   * @param {String} otpCode - 6-digit OTP code
   * @param {String} firstName - User's first name (optional)
   * @returns {Object} Send result
   */
  async sendOTPEmail(email, otpCode, firstName = '') {
    try {
      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: 'Verify Your Sensay AI Account - OTP Code',
        text: this.getOTPEmailText(otpCode, firstName),
        html: this.getOTPEmailHTML(otpCode, firstName)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('❌ Failed to send OTP email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get plain text version of OTP email
   */
  getOTPEmailText(otpCode, firstName) {
    return `
Hello ${firstName ? firstName : 'there'},

Welcome to Sensay AI! Please verify your email address to activate your account.

Your verification code is: ${otpCode}

This code will expire in 10 minutes for security reasons.

If you didn't request this verification, please ignore this email.

Best regards,
The Sensay AI Team

---
This is an automated message, please do not reply.
    `.trim();
  }

  /**
   * Get HTML version of OTP email
   */
  getOTPEmailHTML(otpCode, firstName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Account</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .otp-code { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .otp-number { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; }
        .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #666; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Sensay AI</h1>
            <p>Account Verification</p>
        </div>
        <div class="content">
            <h2>Hello ${firstName ? firstName : 'there'}! 👋</h2>
            <p>Welcome to <strong>Sensay AI</strong>! We're excited to have you on board.</p>
            <p>Please verify your email address to activate your account and start creating amazing AI replicas.</p>
            
            <div class="otp-code">
                <p>Your verification code is:</p>
                <div class="otp-number">${otpCode}</div>
            </div>
            
            <div class="warning">
                <strong>⏰ Important:</strong> This code will expire in 10 minutes for security reasons.
            </div>
            
            <p>If you didn't request this verification, please ignore this email.</p>
            
            <p>Best regards,<br>
            The Sensay AI Team</p>
        </div>
        <div class="footer">
            <p>This is an automated message, please do not reply.</p>
            <p>© 2024 Sensay AI. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Send welcome email after successful verification
   * @param {String} email - User's email address
   * @param {String} firstName - User's first name
   * @returns {Object} Send result
   */
  async sendWelcomeEmail(email, firstName = '') {
    try {
      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: 'Welcome to Sensay AI! 🎉',
        text: `Hello ${firstName},\n\nWelcome to Sensay AI! Your account has been verified successfully.\n\nYou can now start creating and training your AI replicas.\n\nBest regards,\nThe Sensay AI Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Sensay AI! 🎉</h2>
            <p>Hello ${firstName},</p>
            <p>Congratulations! Your account has been verified successfully.</p>
            <p>You can now start creating and training your AI replicas.</p>
            <p>Get started by visiting your dashboard and exploring our features.</p>
            <p>Best regards,<br>The Sensay AI Team</p>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test email configuration
   * @returns {Object} Test result
   */
  async testEmailConfig() {
    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'Email configuration is valid'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Email configuration failed',
        error: error.message
      };
    }
  }
}

export default new EmailService();
