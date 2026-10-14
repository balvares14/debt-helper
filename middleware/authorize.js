const DatabaseService = require('../services/databaseService');
const logger = require('../utils/logger');

/**
 * Authorization (step 2). Use after authenticateToken.
 *
 * authenticateToken → 401 if there is no valid JWT (who are you?).
 * requirePermission → 403 if that user lacks the named action (may they?).
 *
 * Copy onto real routes the same way miscellaneous.js uses it:
 *   router.post('/...', authenticateToken, requirePermission('your.action'), handler)
 *
 * Demo permission: CONSTANTS.PERMISSIONS.MISCELLANEOUS_INSERT
 */
const requirePermission = (permission) => async (req, res, next) => {
  const userId = req.user && req.user.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
      code: 'UNAUTHENTICATED'
    });
  }

  const result = await DatabaseService.hasPermission(userId, permission);

  if (!result.success) {
    logger.logError(new Error(result.error), {
      operation: 'require_permission',
      userId,
      permission
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to check permissions',
      error: result.error
    });
  }

  if (!result.allowed) {
    logger.warn('Authorization failed: missing permission', {
      userId,
      permission,
      path: req.path
    });
    return res.status(403).json({
      success: false,
      message: `Access denied. Missing permission: ${permission}`,
      code: 'FORBIDDEN',
      permission
    });
  }

  next();
};

module.exports = {
  requirePermission
};
