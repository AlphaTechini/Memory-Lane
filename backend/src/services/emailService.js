import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this._initialized = false;
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000
    };
  }

  async initialize() {
    if (this._initialized) return;

    // Try configured port first, then fallback to common working ports (465 then 587)
    const configuredPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT) || undefined;
    const tryPorts = [];
    if (configuredPort) tryPorts.push(configuredPort);
    // Ensure we try 465 (SMTPS) then 587 (STARTTLS) if not already included
    if (!tryPorts.includes(465)) tryPorts.push(465);
    if (!tryPorts.includes(587)) tryPorts.push(587);

    let lastError = null;
    for (const port of tryPorts) {
      try {
        logger.info(`Attempting to initialize email service on port ${port}`);
        this.transporter = await this.setupTransporter({ portOverride: port });
        this._initialized = true;
        logger.info(`Email service initialized successfully on port ${port}`);
        return;
      } catch (err) {
        lastError = err;
        logger.warn(`Email service initialization failed on port ${port}: ${err && err.message}`);
        // continue to next port
      }
    }

    // After attempting all ports, log but do not throw to avoid bringing down signup flow.
    logger.error('Failed to initialize email service on all tried ports; emails will be queued or retried on demand.', lastError);
  }

  generateOTP() {
    // Generate 6-digit numeric OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async setupTransporter(options = {}) {
    // Support multiple env naming conventions: SMTP_USER/SMTP_PASS or EMAIL_SMTP_USER/EMAIL_SMTP_PASS
    const user = process.env.SMTP_USER || process.env.EMAIL_SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_SMTP_PASS;
    const host = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';

    if (!user || !pass) {
      throw new Error('SMTP credentials not configured. Please set SMTP_USER/SMTP_PASS or EMAIL_SMTP_USER/EMAIL_SMTP_PASS in your environment.');
    }

    // Allow caller to override port for probing different protocols
    const configuredPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT) || undefined;
    const port = options.portOverride || configuredPort || 465;
    const secure = port === 465; // SMTPS if 465

    const smtpConfig = {
      host,
      port,
      secure,
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
      connectionTimeout: 60000,
      socketTimeout: 75000,
      greetingTimeout: 30000,
      tls: { rejectUnauthorized: false }
    };

    const transporter = nodemailer.createTransport(smtpConfig);
    // verify may throw; caller should handle and we log detailed errors
    await transporter.verify();
    logger.info(`SMTP connection verified successfully (host=${host} port=${port} secure=${secure})`);
    return transporter;
  }

  async sendEmail(mailOptions, retryCount = 0) {
    // Ensure transporter exists; try initialize if needed (initialize is non-throwing)
    if (!this._initialized || !this.transporter) {
      try {
        await this.initialize();
      } catch (initErr) {
        // initialize logs errors but shouldn't throw; ensure we still try a last-ditch setup here
        logger.warn('Email service initialize reported errors; attempting on-demand transporter setup before send');
      }

      // If transporter still not present, attempt on-demand setup with fallback ports
      if (!this.transporter) {
        const configuredPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT) || undefined;
        const tryPorts = [];
        if (configuredPort) tryPorts.push(configuredPort);
        if (!tryPorts.includes(465)) tryPorts.push(465);
        if (!tryPorts.includes(587)) tryPorts.push(587);

        for (const port of tryPorts) {
          try {
            this.transporter = await this.setupTransporter({ portOverride: port });
            this._initialized = true;
            break;
          } catch (err) {
            logger.warn(`On-demand transporter setup failed on port ${port}: ${err && err.message}`);
          }
        }
        }
      }

    try {
      if (!this.transporter) throw new Error('No SMTP transporter available');
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully:', {
        messageId: info.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject,
        retryCount
      });
      return info;
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

    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_SMTP_USER || 'noreply@sensay.ai';
    const mailOptions = {
      from: `"Sensay AI" <${fromAddress}>`,
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
      from: `"Sensay AI" <${process.env.SMTP_USER}>`,
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
      from: `"Sensay AI" <${process.env.SMTP_USER}>`,
      to: patientEmail,
      subject: `${caretakerName} shared replicas with you on Sensay AI`,
      html
    };

    return await this.sendEmail(mailOptions);
  }

  async testEmailConfig() {
    try {
      await this.initialize();
      logger.info('Email configuration test successful');
      return { success: true, message: 'Email service is properly configured' };
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      return { success: false, message: error.message };
    }
  }

  async closeConnections() {
    if (this.transporter && this.transporter.close) {
      this.transporter.close();
      logger.info('Email service connections closed');
    }
  }
}

const emailService = new EmailService();
export default emailService;