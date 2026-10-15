const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Log level - configurable via LOG_LEVEL env var, defaults to 'debug'
const level = () => {
  return process.env.LOG_LEVEL || 'debug';
};

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports. Vercel functions can only write under /tmp, so file logs
// stay on the local server. A failed mkdir used to crash every API route.
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

if (!process.env.VERCEL) {
  const logsDir = path.join(__dirname, '..', 'logs');
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: fileFormat,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: fileFormat,
      }),
    );
  } catch (error) {
    console.error('File logging disabled:', error.message);
  }
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  transports,
});

// Add request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.http('HTTP Request', logData);
    }
  });
  
  next();
};

// Add error logging helper
logger.logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

// Add database operation logging
logger.logDatabase = (operation, data = {}) => {
  logger.info(`Database ${operation}`, data);
};

// Add S3 operation logging
logger.logS3 = (operation, data = {}) => {
  logger.info(`S3 ${operation}`, data);
};

module.exports = logger;
