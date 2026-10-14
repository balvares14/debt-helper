const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT secret key - must be set in environment variables
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Authentication will not work.');
}

/**
 * Authentication only: a valid JWT means we know who the caller is.
 * It does not mean they may perform the action. For that, add
 * requirePermission from ./authorize after this middleware
 * (see api/miscellaneous.js POST /authorized).
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Authentication failed: No token provided', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    logger.info('Token verified successfully', {
      userId: decoded.userId,
      email: decoded.email,
      path: req.path
    });
    next();
  } catch (error) {
    const isExpired = error && error.name === 'TokenExpiredError';
    logger.warn('Authentication failed', {
      reason: isExpired ? 'TokenExpired' : 'InvalidToken',
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    return res.status(401).json({
      success: false,
      message: isExpired ? 'Access denied. Token expired.' : 'Access denied. Invalid token.',
      code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
};

/**
 * Generate JWT token for user
 * @param {Object} user - User object with id, email, first_name, last_name
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'your-app-name',
    audience: 'your-app-users'
  });
};

module.exports = {
  authenticateToken,
  generateToken
};
