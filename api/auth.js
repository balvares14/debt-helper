const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const DatabaseService = require('../services/databaseService');
const { generateToken, authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const CONSTANTS = require('../utils/constants');

const isRegistrationAllowed = () => {
  const value = String(process.env.ALLOW_REGISTER || '').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
};

/**
 * Whether public signup is open. Unauthenticated — this is an app setting, not a user permission.
 * GET /api/auth/registration
 */
router.get('/registration', (req, res) => {
  res.json({
    success: true,
    data: { allowed: isRegistrationAllowed() }
  });
});

/**
 * Register a new user. No JWT — the caller is not a user yet.
 * Gated by ALLOW_REGISTER in .env (default off).
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  if (!isRegistrationAllowed()) {
    return res.status(403).json({
      success: false,
      message: 'Registration is disabled. Create users with npm run create-user.',
      code: 'REGISTRATION_DISABLED'
    });
  }

  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'All fields (email, password, firstName, lastName) are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (password.length < CONSTANTS.MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${CONSTANTS.MIN_PASSWORD_LENGTH} characters long`
      });
    }

    const existingUserResult = await DatabaseService.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!existingUserResult.success) {
      throw new Error(existingUserResult.error);
    }

    if (existingUserResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insertResult = await DatabaseService.query(
      'INSERT INTO users (email, first_name, last_name, password_hash, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, first_name, last_name, avatar, created_at',
      [email.toLowerCase(), firstName, lastName, passwordHash]
    );

    if (!insertResult.success) {
      throw new Error(insertResult.error);
    }

    const newUser = insertResult.rows[0];
    const token = generateToken(newUser);

    logger.info('User registered successfully', {
      userId: newUser.id,
      email: newUser.email
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          avatar: newUser.avatar,
          createdAt: newUser.created_at
        },
        token
      }
    });
  } catch (error) {
    logger.error('Registration failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const userResult = await DatabaseService.query(
      'SELECT id, email, first_name, last_name, avatar, password_hash, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!userResult.success) {
      throw new Error(userResult.error);
    }

    if (userResult.rows.length === 0) {
      logger.warn('Login attempt with non-existent email', {
        email: email.toLowerCase(),
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user);

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          avatar: user.avatar,
          createdAt: user.created_at
        },
        token
      }
    });

  } catch (error) {
    logger.error('Login failed', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const profileResult = await DatabaseService.query(
      'SELECT id, email, first_name, last_name, avatar, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (!profileResult.success) {
      throw new Error(profileResult.error);
    }

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = profileResult.rows[0];

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          avatar: user.avatar,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Profile retrieval failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user.userId
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during profile retrieval'
    });
  }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, version } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'firstName and lastName are required'
      });
    }

    // Optimistic concurrency check using version (updated_at timestamp)
    if (version) {
      const currentUserResult = await DatabaseService.query('SELECT updated_at FROM users WHERE id = $1', [userId]);
      if (!currentUserResult.success) {
        throw new Error(currentUserResult.error);
      }
      
      const currentUpdatedAt = currentUserResult.rows[0].updated_at;
      const providedVersion = new Date(version);
      
      // Check if versions match (allowing for small precision differences)
      const timeDiff = Math.abs(currentUpdatedAt.getTime() - providedVersion.getTime());
      if (timeDiff > 1000) { // More than 1 second difference
        return res.status(409).json({
          success: false,
          message: 'Profile has been modified by another user. Please refresh and try again.',
          code: 'VERSION_CONFLICT',
          currentVersion: currentUpdatedAt
        });
      }
    }

    const updateResult = await DatabaseService.query(
      'UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3 RETURNING id, email, first_name, last_name, avatar, created_at, updated_at',
      [firstName, lastName, userId]
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error);
    }

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = updateResult.rows[0];

    logger.info('User profile updated successfully', {
      userId: user.id,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          avatar: user.avatar,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Profile update failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user.userId,
      body: req.body
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during profile update'
    });
  }
});

/**
 * Change password
 * PUT /api/auth/change-password
 */
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword, version } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < CONSTANTS.MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `New password must be at least ${CONSTANTS.MIN_PASSWORD_LENGTH} characters long`
      });
    }

    // Get current user with password hash and updated_at
    const userResult = await DatabaseService.query(
      'SELECT password_hash, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.success) {
      throw new Error(userResult.error);
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Optional optimistic concurrency check using updated_at version
    if (version) {
      const currentUpdatedAt = new Date(user.updated_at);
      const providedVersion = new Date(version);
      const timeDiffMs = Math.abs(currentUpdatedAt.getTime() - providedVersion.getTime());
      if (timeDiffMs > 1000) {
        return res.status(409).json({
          success: false,
          message: 'Profile has been modified by another user. Please refresh and try again.',
          code: 'VERSION_CONFLICT',
          currentVersion: user.updated_at
        });
      }
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      logger.warn('Password change attempt with invalid current password', {
        userId: userId,
        ip: req.ip
      });
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const updateResult = await DatabaseService.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    if (!updateResult.success) {
      throw new Error(updateResult.error);
    }

    logger.info('Password changed successfully', {
      userId: userId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    logger.error('Password change failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user.userId
    });

    res.status(500).json({
      success: false,
      message: 'Internal server error during password change'
    });
  }
});

module.exports = router;
