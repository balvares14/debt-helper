/**
 * DEMO ROUTES for InsertItem.tsx — not a real product API.
 *
 * Three write paths, same miscellaneous table:
 *   POST /                     anonymous (step 1: no auth)
 *   POST /protected            JWT only (step 2: authentication)
 *   POST /authorized           JWT + miscellaneous.insert (step 3: authorization)
 *
 * Delete this file, the Insert Item page, and the demo tables in
 * database-setup.sql (users / permissions / miscellaneous) when you
 * replace the starter. Copy requirePermission onto real routes instead
 * of importing this file everywhere.
 */

const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/databaseService');
const { validateJsonData } = require('../utils/helpers');
const { validateRequired } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/authorize');
const CONSTANTS = require('../utils/constants');

const INSERT_PERMISSION = CONSTANTS.PERMISSIONS.MISCELLANEOUS_INSERT;

const parseBodyData = (data) => {
  if (!data) return { ok: true, jsonData: null };
  const validation = validateJsonData(data);
  if (!validation.isValid) {
    return { ok: false, error: validation.error };
  }
  return { ok: true, jsonData: validation.data };
};

const respondInsert = async (res, title, jsonData, extras = {}) => {
  const result = await DatabaseService.insertMiscellaneousItem(title, jsonData);

  if (result.success) {
    return res.json({
      success: true,
      message: extras.message || 'Item inserted successfully!',
      data: extras.mapData ? extras.mapData(result.data) : result.data
    });
  }

  return res.status(500).json({
    success: false,
    message: extras.failureMessage || 'Failed to insert item',
    error: result.error
  });
};

// Insert item into miscellaneous table
router.post('/', validateRequired(['title']), async (req, res) => {
  const { title, data } = req.body;
  const parsed = parseBodyData(data);
  if (!parsed.ok) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON data format',
      error: parsed.error
    });
  }
  return respondInsert(res, title, parsed.jsonData);
});

/**
 * TEMPLATE EXAMPLE: Protected Insert Endpoint
 * JWT required. Any logged-in user can call this — no permission row needed.
 */
router.post('/protected', authenticateToken, validateRequired(['title']), async (req, res) => {
  const { title, data } = req.body;
  const parsed = parseBodyData(data);
  if (!parsed.ok) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON data format',
      error: parsed.error
    });
  }

  return respondInsert(res, title, parsed.jsonData, {
    message: 'Protected item inserted successfully!',
    failureMessage: 'Failed to insert protected item',
    mapData: (row) => ({
      ...row,
      insertedBy: {
        userId: req.user.userId,
        email: req.user.email,
        name: `${req.user.firstName} ${req.user.lastName}`
      }
    })
  });
});

/**
 * TEMPLATE EXAMPLE: Authenticated + authorized insert.
 * Logged in is not enough — the user must have miscellaneous.insert
 * in the demo permissions table.
 */
router.post(
  '/authorized',
  authenticateToken,
  requirePermission(INSERT_PERMISSION),
  validateRequired(['title']),
  async (req, res) => {
    const { title, data } = req.body;
    const parsed = parseBodyData(data);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON data format',
        error: parsed.error
      });
    }

    return respondInsert(res, title, parsed.jsonData, {
      message: 'Authorized item inserted successfully!',
      failureMessage: 'Failed to insert authorized item',
      mapData: (row) => ({
        ...row,
        insertedBy: {
          userId: req.user.userId,
          email: req.user.email,
          name: `${req.user.firstName} ${req.user.lastName}`
        },
        permission: INSERT_PERMISSION
      })
    });
  }
);

/**
 * Current user's permission names. Used by the Insert Item demo page.
 */
router.get('/me/permissions', authenticateToken, async (req, res) => {
  const result = await DatabaseService.listPermissions(req.user.userId);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load permissions',
      error: result.error
    });
  }

  return res.json({
    success: true,
    data: {
      permissions: result.permissions,
      hasInsert: result.permissions.includes(INSERT_PERMISSION)
    }
  });
});

/**
 * DEMO ONLY: grant miscellaneous.insert to the current user so the
 * authorized insert can be tried after a 403. Real apps must not let
 * callers grant themselves permissions.
 */
router.post('/me/permissions', authenticateToken, async (req, res) => {
  const result = await DatabaseService.grantPermission(req.user.userId, INSERT_PERMISSION);

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: 'Failed to grant permission',
      error: result.error
    });
  }

  const listed = await DatabaseService.listPermissions(req.user.userId);
  return res.json({
    success: true,
    message: result.granted
      ? `Granted ${INSERT_PERMISSION}`
      : `Already had ${INSERT_PERMISSION}`,
    data: {
      permission: INSERT_PERMISSION,
      granted: result.granted,
      permissions: listed.success ? listed.permissions : []
    }
  });
});

// Get all items from miscellaneous table
router.get('/', async (req, res) => {
  const result = await DatabaseService.getMiscellaneousItems();

  if (result.success) {
    res.json({
      success: true,
      message: 'Items retrieved successfully!',
      data: result.data
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve items',
      error: result.error
    });
  }
});

module.exports = router;
