const rateLimit = require('express-rate-limit');

/**
 * Limits how many bookings a single IP can submit.
 * Generous enough for a real customer (who might retry after a clash),
 * tight enough to stop someone from scripting hundreds of fake bookings.
 */
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,                    // 8 booking attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please wait a few minutes and try again.' },
  handler: (req, res) => {
    res.status(429).render('client/booking-error', {
      message: 'Too many booking attempts from this device. Please wait a few minutes and try again.'
    });
  }
});

/**
 * Looser limit for the slots-availability check, since the booking page
 * calls this automatically every time someone picks a date — legitimate
 * use is "clicky", not just one request.
 */
const slotsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60,                  // 60 slot lookups per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
});

/**
 * Applies to the whole site loosely, as a backstop against general abuse/scraping —
 * deliberately generous so it never gets in a real visitor's way.
 */
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { bookingLimiter, slotsLimiter, generalLimiter };
