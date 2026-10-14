const express = require('express');
const router = express.Router();
const DatabaseService = require('../services/databaseService');

// Database test endpoint
router.get('/', async (req, res) => {
  const result = await DatabaseService.testConnection();
  
  if (result.success) {
    res.json({
      success: true,
      message: 'Database connection successful!',
      data: result.data
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: result.error,
      connectionInfo: result.connectionInfo
    });
  }
});

module.exports = router;
