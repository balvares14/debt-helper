const AWS = require('aws-sdk');
const { generateTimestampedFilename, generateCustomFilename } = require('../utils/helpers');
const CONSTANTS = require('../utils/constants');
const logger = require('../utils/logger');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

class S3Service {
  /**
   * Generate presigned URL for S3 upload
   * @param {object} options - Upload options
   * @returns {Promise<object>} - Presigned URL result
   */
  static async generatePresignedUrl(options) {
    try {
      const { fileName, fileType, fileLocation, useCustomFilename, customFilename } = options;
      
      logger.logS3('presigned_url_generation_started', {
        fileName,
        fileType,
        fileLocation,
        useCustomFilename,
        bucket: process.env.S3_BUCKET_NAME
      });
      
      let s3Key;
      
      if (useCustomFilename && customFilename) {
        const finalCustomFilename = generateCustomFilename(customFilename, fileName);
        s3Key = fileLocation 
          ? `${fileLocation}/${finalCustomFilename}`
          : `${CONSTANTS.DEFAULT_UPLOAD_PATH}/${finalCustomFilename}`;
      } else {
        const timestampedFilename = generateTimestampedFilename(fileName);
        s3Key = fileLocation 
          ? `${fileLocation}/${timestampedFilename}`
          : `${CONSTANTS.DEFAULT_UPLOAD_PATH}/${timestampedFilename}`;
      }
      
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Key,
        ContentType: fileType,
        Expires: CONSTANTS.PRESIGNED_URL_EXPIRY
      };
      
      const presignedUrl = s3.getSignedUrl('putObject', params);
      
      logger.logS3('presigned_url_generation_success', {
        s3Key,
        bucket: process.env.S3_BUCKET_NAME,
        region: process.env.AWS_REGION,
        filenameMode: useCustomFilename && customFilename ? 'custom' : 'timestamped'
      });
      
      return {
        success: true,
        data: {
          presignedUrl,
          s3Key,
          bucket: process.env.S3_BUCKET_NAME,
          region: process.env.AWS_REGION,
          filenameMode: useCustomFilename && customFilename ? 'custom' : 'timestamped'
        }
      };
    } catch (error) {
      logger.logError(error, {
        operation: 's3_presigned_url_generation',
        fileName: options.fileName,
        fileType: options.fileType,
        bucket: process.env.S3_BUCKET_NAME
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = S3Service;
