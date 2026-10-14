const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/databaseService');
const EmailService = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequired } = require('../middleware/validation');
const logger = require('../utils/logger');

/**
 * Send email notification
 * POST /api/emails/send
 * Requires authentication
 */
router.post('/send', authenticateToken, validateRequired(['subject', 'body', 'recipients']), async (req, res) => {
  try {
    const { subject, body, recipients, type = 'Notification' } = req.body;
    const userId = req.user.userId;
    const userEmail = req.user.email;

    // Validate recipients is an array
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Recipients must be a non-empty array'
      });
    }

    // Validate email addresses and normalize to lowercase
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipients.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email addresses',
        invalidEmails: invalidEmails
      });
    }

    // Normalize all recipient emails to lowercase for consistent storage
    const normalizedRecipients = recipients.map(email => email.toLowerCase());

    // Send email
    const emailResult = await EmailService.sendNotification(subject, body, recipients);

    if (!emailResult.success) {
      logger.error('Failed to send email', {
        userId: userId,
        recipients: recipients,
        error: emailResult.error
      });

      return res.status(500).json({
        success: false,
        message: 'Failed to send email',
        error: emailResult.error
      });
    }

    // Save email to database (with normalized lowercase recipients)
    const dbResult = await DatabaseService.query(
      `INSERT INTO emails (type, subject, body, recipients, created_by, sent_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [type, subject, body, normalizedRecipients, userId]
    );

    if (!dbResult.success) {
      logger.error('Failed to save email to database', {
        userId: userId,
        error: dbResult.error
      });

      // Email was sent but not saved - still return success but log warning
      logger.warn('Email sent but not saved to database', {
        userId: userId,
        recipients: recipients
      });
    }

    res.json({
      success: true,
      message: 'Email sent successfully',
      data: {
        email: dbResult.success ? dbResult.rows[0] : null,
        messageId: emailResult.messageId
      }
    });
  } catch (error) {
    logger.logError(error, {
      operation: 'send_email',
      userId: req.user?.userId,
      body: req.body
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error while sending email',
      error: error.message
    });
  }
});

/**
 * Get inbox emails (emails where user's email is in recipients array)
 * GET /api/emails/inbox
 * Requires authentication
 */
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    // Normalize user email to lowercase (recipients are stored lowercase)
    const userEmail = req.user.email.toLowerCase();

    // Query emails where user's email is in recipients array
    // Recipients are stored as lowercase array, so simple ANY comparison works
    const result = await DatabaseService.query(
      `SELECT e.*, 
              u.email as creator_email, 
              u.first_name as creator_first_name, 
              u.last_name as creator_last_name
       FROM emails e
       JOIN users u ON e.created_by = u.id
       WHERE $1 = ANY(e.recipients)
       ORDER BY e.sent_at DESC`,
      [userEmail]
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      message: 'Inbox emails retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    logger.logError(error, {
      operation: 'get_inbox',
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve inbox emails',
      error: error.message
    });
  }
});

/**
 * Get sent emails (emails created by the current user)
 * GET /api/emails/sent
 * Requires authentication
 */
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Query emails created by current user
    const result = await DatabaseService.query(
      `SELECT e.*, 
              u.email as creator_email, 
              u.first_name as creator_first_name, 
              u.last_name as creator_last_name
       FROM emails e
       JOIN users u ON e.created_by = u.id
       WHERE e.created_by = $1
       ORDER BY e.sent_at DESC`,
      [userId]
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    res.json({
      success: true,
      message: 'Sent emails retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    logger.logError(error, {
      operation: 'get_sent',
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve sent emails',
      error: error.message
    });
  }
});

/**
 * Get single email by ID (if user has access)
 * GET /api/emails/:id
 * Requires authentication
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const emailId = req.params.id;
    const userId = req.user.userId;
    // Normalize user email to lowercase (recipients are stored lowercase)
    const userEmail = req.user.email.toLowerCase();

    // Query email - user can access if they created it or are in recipients
    const result = await DatabaseService.query(
      `SELECT e.*, 
              u.email as creator_email, 
              u.first_name as creator_first_name, 
              u.last_name as creator_last_name
       FROM emails e
       JOIN users u ON e.created_by = u.id
       WHERE e.id = $1 
         AND (e.created_by = $2 OR $3 = ANY(e.recipients))`,
      [emailId, userId, userEmail]
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email not found or access denied'
      });
    }

    res.json({
      success: true,
      message: 'Email retrieved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.logError(error, {
      operation: 'get_email',
      emailId: req.params.id,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve email',
      error: error.message
    });
  }
});

module.exports = router;
