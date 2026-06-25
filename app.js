require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const path = require('path');
const { generalLimiter } = require('./middleware/rateLimit');

const app = express();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bookly')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers. CSP is relaxed for 'unsafe-inline' on style/script because
// the views use inline <style> (for the per-deployment brand color) and inline
// <script> (the booking page's step logic) rather than separate bundled files —
// fine for a small single-tenant app like this, but worth knowing it's not the
// strictest possible policy if this ever needs a stricter audit later.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
    }
  }
}));

// Caps request body size — stops someone sending a huge payload to exhaust memory.
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// A loose, site-wide backstop against general abuse/scraping.
// The booking form itself has its own tighter limit (see middleware/rateLimit.js).
app.use(generalLimiter);

app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

app.use(flash());

// Global locals — business identity comes from .env, not from a database lookup,
// since this entire deployment belongs to one business.
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.staff = req.session.staff || null;
  res.locals.site = {
    name: process.env.BUSINESS_NAME || 'Your Business',
    tagline: process.env.BUSINESS_TAGLINE || '',
    phone: process.env.BUSINESS_PHONE || '',
    address: process.env.BUSINESS_ADDRESS || '',
    accent: process.env.BRAND_ACCENT || '#8B6F4E'
  };
  next();
});

app.use('/', require('./routes/client'));
app.use('/admin/auth', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
