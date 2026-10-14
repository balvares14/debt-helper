// Validation middleware

const validateRequired = (fields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    fields.forEach(field => {
      if (!req.body[field]) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }
    
    next();
  };
};

const validateFileUpload = (req, res, next) => {
  const { fileName, fileType } = req.body;
  
  if (!fileName || !fileType) {
    return res.status(400).json({
      success: false,
      message: 'File name and type are required'
    });
  }
  
  next();
};

module.exports = {
  validateRequired,
  validateFileUpload
};
