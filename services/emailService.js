const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Email Service
 * Handles sending emails using nodemailer
 */
class EmailService {
  constructor() {
    // Initialize transporter based on EMAIL_SERVICE
    const emailService = process.env.EMAIL_SERVICE || 'gmail';
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_APP_PASSWORD;
    const emailFrom = process.env.EMAIL_FROM || emailUser;

    if (!emailUser || !emailPassword) {
      logger.warn('Email service not configured. EMAIL_USER and EMAIL_APP_PASSWORD must be set in .env');
      this.transporter = null;
      return;
    }

    // Configure transporter based on service type
    const transporterConfig = {
      service: emailService,
      auth: {
        user: emailUser,
        pass: emailPassword
      }
    };

    // For Gmail, we can use service directly
    // For other services, you may need to add host/port
    if (emailService === 'gmail') {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword
        }
      });
    } else {
      // For other services, use generic SMTP
      this.transporter = nodemailer.createTransport(transporterConfig);
    }

    this.emailFrom = emailFrom;
  }

  /**
   * Send email notification
   * @param {string} subject - Email subject
   * @param {string} body - Email body (HTML or plain text)
   * @param {string[]} recipients - Array of recipient email addresses
   * @returns {Promise<object>} - Send result
   */
  async sendNotification(subject, body, recipients) {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    if (!recipients || recipients.length === 0) {
      return {
        success: false,
        error: 'No recipients specified'
      };
    }

    try {
      // Demo is a bulk blast: BCC everyone, no To.
      // For transactional mail (receipts, password reset), send one message
      // per address with `to: recipient` instead — see README.
      const mailOptions = {
        from: this.emailFrom,
        bcc: recipients.join(', '),
        subject: subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ''),
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        recipients: recipients,
        subject: subject
      });

      return {
        success: true,
        messageId: info.messageId,
        recipients: recipients
      };
    } catch (error) {
      logger.logError(error, {
        operation: 'send_email',
        recipients: recipients,
        subject: subject
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify email configuration
   * @returns {Promise<object>} - Verification result
   */
  async verifyConnection() {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'Email service is properly configured'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();
