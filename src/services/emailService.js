import nodemailer from 'nodemailer';

/**
 * Email Service for sending OTP codes and other notifications
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@sensay.ai';
    this.setupTransporter();
  }

  /**
   * Setup email transporter based on environment
   */
  setupTransporter() {
    // For development, use Ethereal Email (test email service)
    // For production, use your actual SMTP service (Gmail, SendGrid, etc.)
    
    if (process.env.NODE_ENV === 'production') {
      // Production configuration (Gmail example)
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_SMTP_USER,
          pass: process.env.EMAIL_SMTP_PASS // Use App Password for Gmail
        }
      });
    } else {
      // Development configuration - Ethereal Email for testing
      this.setupEtherealEmail();
    }
  }

  /**
   * Setup Ethereal Email for development testing
   */
  async setupEtherealEmail() {
    try {
      // Create a test account
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });

      console.log('📧 Ethereal Email configured for development');
      console.log('📧 Test emails will be available at: https://ethereal.email');
    } catch (error) {
      console.error('❌ Failed to setup Ethereal Email:', error.message);
      
      // Fallback to a simple transporter that logs emails
      this.transporter = {
        sendMail: async (mailOptions) => {
          console.log('📧 [EMAIL SIMULATION]');
          console.log('To:', mailOptions.to);
          console.log('Subject:', mailOptions.subject);
          console.log('Body:', mailOptions.text || mailOptions.html);
          console.log('---');
          return { messageId: 'simulated-' + Date.now() };
        }
      };
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
      
      // For Ethereal Email, log the preview URL
      if (process.env.NODE_ENV !== 'production') {
        const previewURL = nodemailer.getTestMessageUrl(result);
        if (previewURL) {
          console.log('📧 Email preview URL:', previewURL);
        }
      }

      return {
        success: true,
        messageId: result.messageId,
        previewURL: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(result) : null
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
