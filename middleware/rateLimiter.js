const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.',
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // max 10 registrations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many accounts created from this IP. Please try again later.',
});

module.exports = {
  authLimiter,
  registerLimiter,
};