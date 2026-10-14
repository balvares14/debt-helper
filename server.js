// Load environment variables
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

// Import routes
const healthRoutes = require('./api/health');
const databaseRoutes = require('./api/database');
const miscellaneousRoutes = require('./api/miscellaneous');
const s3Routes = require('./api/s3');
const authRoutes = require('./api/auth');
const emailRoutes = require('./api/emails');
const planRoutes = require('./api/plan');
const debtRoutes = require('./api/debts');
const cashEventRoutes = require('./api/cash-events');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import utilities
const logger = require('./utils/logger');

const app = express();
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 5001);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use(logger.requestLogger);

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'client/build')));

// API routes
app.use('/api/health', healthRoutes);
app.use('/api/db-test', databaseRoutes);
app.use('/api/miscellaneous', miscellaneousRoutes);
app.use('/api/s3', s3Routes);
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Debt payoff planner
app.use('/api/plan', planRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/cash-events', cashEventRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
});
