const winston = require('winston');

module.exports = function (err, req, res, next) {
  winston.error(err.message, err);

  if (err.statusCode) {
    return res.status(err.statusCode).send(err.message);
  }

  if (err.code === 11000) {
    return res.status(409).send('Duplicate field value.');
  }

  res.status(500).send('Something failed.');
};