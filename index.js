require('dotenv').config();

const express = require('express');
const winston = require('winston');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

// Startup modules
require('./startup/logging')();
require('./startup/db')();
require('./startup/security')(app);
require('./startup/routes')(app);

// Logging (after routes setup)
app.use(
  morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: {
      write: (message) => winston.info(message.trim())
    }
  })
);

// JWT check
if (!process.env.JWT_PRIVATE_KEY) {
  winston.error('FATAL ERROR: JWT_PRIVATE_KEY is not defined.');
  process.exit(1);
}

// Start server
const server = app.listen(port, () => {
  winston.info(`Listening on port ${port}...`);
});

// Graceful shutdown
const mongoose = require('mongoose');

const shutdown = async (signal) => {
  winston.info(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    winston.info('HTTP server closed.');

    try {
      await mongoose.connection.close();
      winston.info('MongoDB connection closed.');
      process.exit(0);
    } catch (err) {
      winston.error('Error closing MongoDB connection:', err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    winston.error('Force shutdown.');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = server;