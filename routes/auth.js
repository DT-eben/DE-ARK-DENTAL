const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Staff = require('../models/Staff');

// Login attempts are limited per-IP to slow down password guessing.
// Generous enough that a real staff member mistyping their password
// a few times never gets locked out, tight enough to make brute-forcing impractical.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    req.flash('error', 'Too many login attempts. Please wait 15 minutes and try again.');
    res.status(429).render('auth/login', { email: req.body.email || '' });
  }
});

router.get('/login', (req, res) => {
  if (req.session.staffId) return res.redirect('/admin');
  res.render('auth/login');
});

router.post('/login', loginLimiter, async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    req.flash('error', 'Please enter both email and password.');
    return res.render('auth/login', { email });
  }

  try {
    const staff = await Staff.findOne({ email, isActive: true });
    if (!staff || !(await staff.comparePassword(password))) {
      req.flash('error', 'Incorrect email or password.');
      return res.render('auth/login', { email });
    }
    // Regenerate the session on login to prevent session fixation —
    // makes sure a fresh session ID is issued rather than reusing
    // whatever pre-login session existed.
    req.session.regenerate((err) => {
      if (err) {
        req.flash('error', 'Something went wrong. Please try again.');
        return res.render('auth/login', { email });
      }
      req.session.staffId = staff._id;
      req.session.staff = { name: staff.name, email: staff.email, isOwner: staff.isOwner };
      res.redirect('/admin');
    });
  } catch (err) {
    console.error('Login error:', err.message);
    req.flash('error', 'Something went wrong. Please try again.');
    res.render('auth/login', { email });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/auth/login'));
});

module.exports = router;
