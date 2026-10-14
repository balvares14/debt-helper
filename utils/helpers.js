// Utility helper functions

/**
 * Sanitize filename by removing invalid characters
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

/**
 * Extract file extension from filename
 * @param {string} filename - Full filename
 * @returns {string} - File extension
 */
const getFileExtension = (filename) => {
  return filename.split('.').pop();
};

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate timestamp-based filename
 * @param {string} originalFilename - Original filename
 * @returns {string} - Timestamped filename
 */
const generateTimestampedFilename = (originalFilename) => {
  const timestamp = Date.now();
  const sanitizedFileName = sanitizeFilename(originalFilename);
  return `${timestamp}_${sanitizedFileName}`;
};

/**
 * Generate custom filename with preserved extension
 * @param {string} customName - Custom filename without extension
 * @param {string} originalFilename - Original filename with extension
 * @returns {string} - Custom filename with extension
 */
const generateCustomFilename = (customName, originalFilename) => {
  const sanitizedCustomFilename = sanitizeFilename(customName);
  const originalExtension = getFileExtension(originalFilename);
  const customNameWithoutExt = sanitizedCustomFilename.replace(/\.[^/.]+$/, '');
  return customNameWithoutExt + '.' + originalExtension;
};

/**
 * Validate JSON data
 * @param {any} data - Data to validate
 * @returns {object} - Validation result
 */
const validateJsonData = (data) => {
  try {
    const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
    return { isValid: true, data: jsonData };
  } catch (error) {
    return { isValid: false, error: error.message };
  }
};

module.exports = {
  sanitizeFilename,
  getFileExtension,
  formatFileSize,
  generateTimestampedFilename,
  generateCustomFilename,
  validateJsonData
};
