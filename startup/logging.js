const winston = require('winston');

module.exports = function () {
  // Handle uncaught exceptions
  winston.exceptions.handle(
    new winston.transports.Console()
  );

  // Handle unhandled promise rejections
  winston.rejections.handle(
    new winston.transports.Console()
  );

  // Main logger
  winston.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  );
};