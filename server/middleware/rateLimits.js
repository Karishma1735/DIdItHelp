const rateLimit = require('express-rate-limit');

const make = (max, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in a few minutes.' },
  });

module.exports = { authLimiter: make(20), answerLimiter: make(60) };
