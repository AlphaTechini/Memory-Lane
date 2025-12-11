import { Resend } from 'resend';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.resend = null;
    this._initialized = false;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    };
  }

  async initialize() {
    if (this._initialized) return;

    try {
      const apiKey = process.env.RESEND_API_KEY;
      
      if (!apiKey) {
        throw new Error('RESEND_API_KEY not configured. Please set RESEND_API_KEY in your environment.');
      }

      this.resend = new Resend(apiKey);
      this._initialized = true;
      logger.info('Email service initialized successfully with Resend API');
    } catch (error) {
      logger.error('Failed to initialize email service:', error.message);
      throw error;
    }
  }

  generateOTP() {
    // Generate 6-digit numeric OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendEmail(mailOptions, retryCount = 0) {
    // Ensure client exists; try initialize if needed
    if (!this._initialized || !this.resend) {
      try {
        await this.initialize();
      } catch (initErr) {
        logger.error('Email service initialization failed:', initErr.message);
        throw initErr;
      }
    }

    try {
      if (!this.resend) throw new Error('Resend client not available');

      const response = await this.resend.emails.send({
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      logger.info('Email sent successfully:', {
        messageId: response.data?.id,
        to: mailOptions.to,
        subject: mailOptions.subject,
        retryCount
      });

      return { messageId: response.data?.id };
    } catch (error) {
      logger.error('Email send failed:', {
        error: error.message,
        to: mailOptions.to,
        subject: mailOptions.subject,
        retryCount
      });

      if (retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, retryCount),
          this.retryConfig.maxDelay
        );
        
        logger.info(`Retrying email send in ${delay}ms (attempt ${retryCount + 1}/${this.retryConfig.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendEmail(mailOptions, retryCount + 1);
      }

      throw error;
    }
  }
  async sendOTPEmail(email, otp, isResend = false) {
    const subject = isResend ? 'Your New OTP Code - Sensay AI' : 'Your OTP Code - Sensay AI';
    const actionText = isResend ? 'requested a new' : 'requested an';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4A90E2; margin: 0;">Sensay AI</h1>
          </div>
          
          <h2 style="color: #333; text-align: center; margin-bottom: 20px;">
            ${isResend ? 'New ' : ''}OTP Verification Code
          </h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            You ${actionText} OTP code for your Sensay AI account. Please use the code below to complete your verification:
          </p>
          
          <div style="background-color: #f0f8ff; border: 2px solid #4A90E2; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #4A90E2; letter-spacing: 4px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
            This code will expire in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            <p>This email was sent from Sensay AI verification system.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </div>
    `;

    const fromAddress = process.env.EMAIL_FROM || 'noreply@memorylane.cyberpunk.work';
    const mailOptions = {
      from: fromAddress,
      to: email,
      subject,
      html
    };

    return await this.sendEmail(mailOptions);
  }

  async sendWelcomeEmail(email, userName) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4A90E2; margin: 0;">Welcome to Sensay AI!</h1>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">
            Hello ${userName || 'there'}!
          </h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            Thank you for joining Sensay AI. Your account has been successfully created and verified.
          </p>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            You can now access all the features of our platform. If you have any questions, our support team is here to help.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
               style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Get Started
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            <p>Welcome to the Sensay AI community!</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@memorylane.cyberpunk.work',
      to: email,
      subject: 'Welcome to Sensay AI!',
      html
    };

    return await this.sendEmail(mailOptions);
  }

  async sendPatientInviteEmail(patientEmail, caretakerName, replicaNames) {
    const replicaList = replicaNames.length > 0 
      ? replicaNames.map(name => `• ${name}`).join('\n') 
      : '• All available replicas';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4A90E2; margin: 0;">Sensay AI</h1>
          </div>
          
          <h2 style="color: #333; margin-bottom: 20px;">
            You've been granted access to shared replicas
          </h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
            ${caretakerName} has shared access to their Sensay AI replicas with you. You can now view the gallery and interact with the following replicas:
          </p>
          
          <div style="background-color: #f0f8ff; border-left: 4px solid #4A90E2; padding: 15px; margin: 20px 0;">
            <pre style="color: #333; font-size: 14px; margin: 0; white-space: pre-wrap;">${replicaList}</pre>
          </div>
          
          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            To access your shared replicas, please sign up or log in to your Sensay AI account.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
               style="background-color: #4A90E2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">
              Log In
            </a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup" 
               style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Sign Up
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; color: #999; font-size: 12px; text-align: center;">
            <p>This invitation was sent by ${caretakerName} via Sensay AI.</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@memorylane.cyberpunk.work',
      to: patientEmail,
      subject: `${caretakerName} shared replicas with you on Sensay AI`,
      html
    };

    return await this.sendEmail(mailOptions);
  }

  async testEmailConfig() {
    try {
      await this.initialize();
      
      // Test by sending a simple test email to the configured FROM address
      const testEmail = process.env.EMAIL_FROM || 'noreply@memorylane.cyberpunk.work';
      
      await this.sendEmail({
        from: testEmail,
        to: testEmail,
        subject: 'Sensay AI - Email Configuration Test',
        html: '<p>This is a test email from Sensay AI. Your email configuration is working correctly.</p>'
      });
      
      logger.info('Email configuration test successful');
      return { success: true, message: 'Email service is properly configured and working' };
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      return { success: false, message: error.message };
    }
  }

  async closeConnections() {
    // Resend API doesn't require connection cleanup
    logger.info('Email service ready for shutdown');
  }
}

const emailService = new EmailService();
export default emailService;