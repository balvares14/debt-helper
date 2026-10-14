// Application constants
const CONSTANTS = {
  // File uploads
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  PRESIGNED_URL_EXPIRY: 300, // 5 minutes
  
  // Auth
  MIN_PASSWORD_LENGTH: 4,

  // Database
  MAX_RECORDS_LIMIT: 50,

  // App permissions (rows in the demo `permissions` table)
  PERMISSIONS: {
    MISCELLANEOUS_INSERT: 'miscellaneous.insert'
  },
  
  // S3
  DEFAULT_UPLOAD_PATH: 'uploads',
  
  // API Response messages
  MESSAGES: {
    SUCCESS: 'Operation completed successfully',
    ERROR: 'An error occurred',
    VALIDATION_ERROR: 'Validation failed',
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden'
  }
};

module.exports = CONSTANTS;
