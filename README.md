# Bookly — a private booking site for one business

This is **not** a multi-business platform. Each deployment belongs to a single business — it's their own website. Clients book with no account; staff log in to a private `/admin` area to see and manage every appointment.

## Stack
- Node.js + Express 5
- MongoDB + Mongoose
- EJS templates, plain HTML/CSS/JS (no frontend framework)
- express-session for staff login, bcryptjs for password hashing

## How it's structured

There is no public registration. A business is configured two ways:

1. **Identity & branding** — via `.env` (`BUSINESS_NAME`, `BUSINESS_TAGLINE`, `BUSINESS_PHONE`, `BUSINESS_ADDRESS`, `BRAND_ACCENT`). These show up on the public booking page and across the admin area.
2. **Staff logins** — created via `node setup.js` the first time you deploy (creates the owner account), and afterward staff can add more logins from `/admin/staff`. Every staff account has equal access — there's no separate "limited" role, per how you wanted this to work.

## Setup

```bash
npm install
```

Edit `.env` with this business's real name, tagline, phone, address, and brand color:
```
MONGODB_URI=mongodb://localhost:27017/bookly
SESSION_SECRET=something_long_and_random
PORT=3000
BUSINESS_NAME=Queens Hair Salon
BUSINESS_TAGLINE=Professional hair care, by appointment
BUSINESS_PHONE=024 000 0000
BUSINESS_ADDRESS=East Legon, Accra
BRAND_ACCENT=#8B6F4E
```

Point `MONGODB_URI` at a real database — either a local MongoDB install or a free MongoDB Atlas cluster.

Create the first staff (owner) login:
```bash
npm run setup
```
This asks for a name, email, and password in the terminal, and seeds default business hours (Mon–Sat, 8am–6pm).

Then run the app:
```bash
npm start
```

- Public booking page: `http://localhost:3000/`
- Staff login: `http://localhost:3000/admin/auth/login`

## Deploying this for a new client

Since this is a personal site per business, the repeatable playbook is:
1. Copy this codebase into a new project/repo for the client.
2. Edit `.env` with their name, tagline, phone, address, and a brand color that matches them.
3. Point `MONGODB_URI` at a fresh database (a new MongoDB Atlas cluster, or a new database name on a shared cluster).
4. Run `npm run setup` to create their owner login.
5. Deploy (Render, Railway, a VPS, whatever you're using) and point their domain at it.

Each business's data is fully isolated because each one is its own database — there's no shared multi-tenant layer to misconfigure.

## Email notifications

When a client books, two emails go out: a confirmation to the client, and an alert to the business (if `BUSINESS_EMAIL` is set). Both are sent through Gmail using an **app password** — not your real Gmail password.

### Getting a Gmail app password

1. Go to your Google Account → Security → make sure **2-Step Verification** is turned on (app passwords require it).
2. Still under Security, search for **"App passwords"** (or go directly to myaccount.google.com/apppasswords).
3. Create a new app password — name it something like "Bookly" — and Google will show you a 16-character password.
4. Copy that into `.env`:
   ```
   GMAIL_USER=youraccount@gmail.com
   GMAIL_APP_PASSWORD=the16characterpassword
   BUSINESS_EMAIL=youraccount@gmail.com
   ```
   `GMAIL_USER` is the account sending the mail. `BUSINESS_EMAIL` is where booking alerts land — usually the same address, but it can be a different inbox if you want bookings going somewhere else.

If you leave `GMAIL_APP_PASSWORD` blank, the app still works completely normally — it just skips sending emails and logs a warning in the terminal instead of crashing. So you can deploy without email configured and add it later with zero code changes.

### Why a real password won't work

Google blocks plain-password login from apps like this one for security reasons — you specifically need the 16-character app password generated above, which only works for this one purpose and can be revoked anytime without changing your real password.

## Security

A few protections that exist specifically because public booking forms are an easy target for abuse:

- **Rate limiting** — the booking form is capped at 8 submissions per IP every 15 minutes, slot lookups at 60 per 5 minutes, staff login at 10 attempts per 15 minutes, and there's a loose site-wide cap (120 requests/minute per IP) as a general backstop. Limits are generous enough that a real customer or staff member never notices them, tight enough that scripting hundreds of fake bookings or brute-forcing a password isn't practical.
- **Server-side validation on every booking field** — name, email, phone, and notes are length-capped and shape-checked (`middleware/validation.js`) before anything touches the database. Dates can't be in the past or more than 6 months out; times must be well-formed.
- **The submitted time slot is re-verified server-side** — when a booking is submitted, the server independently checks that the requested time actually falls within business hours and matches the selected service's real duration, rather than trusting whatever the browser sent. This stops a forged request from claiming a time that was never actually offered.
- **XSS protection** — EJS auto-escapes all customer-supplied text in every admin view (`<%= %>`, never the unescaped `<%- %>`), and the same fields are explicitly HTML-escaped again before being inserted into emails, since email clients don't get the benefit of EJS's escaping.
- **Security headers via Helmet** — Content-Security-Policy, X-Frame-Options (stops the site being embedded in a malicious iframe), and related headers are set on every response.
- **Session hardening** — cookies are `httpOnly` (can't be read by JavaScript, even via XSS) and `sameSite: lax` (mitigates CSRF). Login regenerates the session ID on success to prevent session fixation.
- **Request body size capped** at 100kb, so someone can't try to exhaust server memory with an oversized payload.
- **ObjectId validation everywhere** an ID comes from the URL or a form, before it's ever passed to a database query.

What's still worth adding if this grows past a single small business: a Web Application Firewall or hosting-level DDoS protection (Cloudflare's free tier covers a lot of this), and moving rate-limit state to Redis if you ever run multiple server instances behind a load balancer (the current rate limiter tracks IPs in memory, which is fine for one server but resets if the process restarts, and doesn't share state across multiple instances).

## Project layout

```
app.js                    — entry point
setup.js                  — one-time CLI script to create the owner login + default hours
models/
  Staff.js                 — staff login (multiple staff, equal access; isOwner flag for staff management)
  Service.js                — a bookable service (name, duration, price)
  BusinessHours.js           — one document per day of the week
  Appointment.js              — a single booking
  Notification.js             — in-admin alerts
routes/
  client.js                — the public booking flow (root of the site)
  auth.js                   — staff login / logout
  admin.js                   — everything behind login: dashboard, bookings, services, hours, staff
  api.js                      — small AJAX helper (notification count)
middleware/auth.js        — requireStaff / requireOwner guards
middleware/rateLimit.js    — rate limiters for booking, slots, and login endpoints
middleware/validation.js    — server-side validation for booking form input
utils/timeHelpers.js      — slot generation & double-booking prevention (the core logic)
utils/mailer.js            — Gmail email sending for booking confirmations/alerts
views/
  client/                  — public booking pages (no login)
  admin/                    — staff dashboard pages (behind login)
  auth/                     — staff login page
  partials/                  — shared sidebar
public/css/main.css       — the whole design system, one file
```

## How no-clash booking works

For a chosen date and service, `utils/timeHelpers.js` builds time slots across that day's open hours, sized to the service's duration, then marks any slot unavailable if it overlaps an existing `pending` or `confirmed` appointment — including partial overlaps (a 45-minute booking blocks every 30-minute slot it touches, not just the one it starts in). There's a second check at the moment of submission in `routes/client.js`, so if two clients are racing for the same slot, the second one gets a clear message instead of double-booking silently.

## Design

Warm, neutral, premium — cream background, near-black text, a soft bronze accent, Fraunces for headings paired with Inter for body and UI. No emoji, no bright SaaS colors, no playful bounce — it's meant to feel like the business's own front door, not a tool they're renting.

The accent color is controlled by `BRAND_ACCENT` in `.env`, so each deployment can carry a slightly different tone without touching any CSS.

## What's intentionally left out (for now)

- **SMS notifications** — email is covered (client confirmation + business alert via Gmail). SMS would need a provider like Twilio or a local aggregator and a small budget per message — worth adding once you're seeing real no-show problems email alone doesn't solve.
- **Payments / deposits** — bookings are confirmed manually by staff. Mobile Money deposit-on-booking is a common ask once a business is using this daily.
- **Multiple locations or multiple calendars per business** — this assumes one shared calendar across all staff, which matches what you described.
