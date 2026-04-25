const mongoose = require('mongoose');
const winston = require('winston');

module.exports = function () {
  if (!process.env.MONGO_URI) {
    winston.error('FATAL ERROR: MONGO_URI is not defined.');
    process.exit(1);
  }

  mongoose.connect(process.env.MONGO_URI)
    .then(() => winston.info('Connected to MongoDB...'))
    .catch(err => {
      winston.error('Could not connect to MongoDB...', err);
      process.exit(1);
    });
};