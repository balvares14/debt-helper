const express = require('express');
const router = express.Router();
const S3Service = require('../services/s3Service');
const { validateFileUpload } = require('../middleware/validation');

// Generate presigned URL for S3 upload
router.post('/presigned-url', validateFileUpload, async (req, res) => {
  const { fileName, fileType, fileLocation, useCustomFilename, customFilename } = req.body;
  
  const result = await S3Service.generatePresignedUrl({
    fileName,
    fileType,
    fileLocation,
    useCustomFilename,
    customFilename
  });
  
  if (result.success) {
    res.json({
      success: true,
      message: 'Presigned URL generated successfully!',
      data: result.data
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Failed to generate presigned URL',
      error: result.error
    });
  }
});

module.exports = router;
