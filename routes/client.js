const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Service = require('../models/Service');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const BusinessHours = require('../models/BusinessHours');
const { generateSlots, getDayName, formatDateDisplay, formatTime12 } = require('../utils/timeHelpers');
const { sendMail, clientConfirmationEmail, businessAlertEmail } = require('../utils/mailer');
const { validateBookingInput } = require('../middleware/validation');
const { bookingLimiter, slotsLimiter } = require('../middleware/rateLimit');


// Homepage / booking page
router.get('/', async (req, res) => {
  res.render('client/index')
});
// Homepage / booking page
router.get('/book', async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
  const today = new Date().toISOString().split('T')[0];
  res.render('client/booking', { services, today });
});

// Available slots for a date + service (AJAX)
router.get('/slots', slotsLimiter, async (req, res) => {
  try {
    const { date, serviceId } = req.query;

    if (!date || !serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.json({ error: 'Invalid request' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.json({ error: 'Invalid date' });
    }

    const service = await Service.findById(serviceId);
    if (!service) return res.json({ error: 'Service not found' });

    const dayName = getDayName(date);
    const hours = await BusinessHours.findOne({ day: dayName });

    if (!hours || !hours.isOpen) {
      return res.json({ slots: [], closed: true, dayName });
    }

    const existingBookings = await Appointment.find({
      date,
      status: { $in: ['pending', 'confirmed'] }
    });

    const slots = generateSlots(
      hours.open, hours.close, service.duration,
      existingBookings.map(b => ({ startTime: b.startTime, endTime: b.endTime }))
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const filteredSlots = date === todayStr
      ? slots.filter(s => {
          const [h, m] = s.start.split(':').map(Number);
          return h * 60 + m > now.getHours() * 60 + now.getMinutes();
        })
      : slots;

    res.json({ slots: filteredSlots, service: { name: service.name, duration: service.duration, price: service.price }, dayName });
  } catch (err) {
    res.json({ error: 'Failed to get availability' });
  }
});

// Submit booking
router.post('/book', bookingLimiter, async (req, res) => {
  try {
    // Validate and sanitize everything before it touches the database,
    // gets emailed out, or gets reflected back into any page.
    const check = validateBookingInput(req.body);
    if (!check.valid) {
      return res.render('client/booking-error', { message: check.message });
    }
    const { customerName, customerEmail, customerPhone, notes, serviceId, date, startTime, endTime } = check.data;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.render('client/booking-error', { message: 'Invalid service selected.' });
    }

    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.render('client/booking-error', { message: 'That service is no longer available.' });
    }

    // Re-validate the slot actually falls within business hours and matches
    // the service duration — stops a forged request claiming an arbitrary
    // time range that was never offered by /slots in the first place.
    const dayName = getDayName(date);
    const hours = await BusinessHours.findOne({ day: dayName });
    if (!hours || !hours.isOpen) {
      return res.render('client/booking-error', { message: 'The business is closed on that day.' });
    }
    const { timeToMinutes } = require('../utils/timeHelpers');
    const requestedMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
    if (requestedMinutes !== service.duration) {
      return res.render('client/booking-error', { message: 'That time slot does not match the selected service.' });
    }
    if (startTime < hours.open || endTime > hours.close) {
      return res.render('client/booking-error', { message: 'That time falls outside business hours.' });
    }

    const clash = await Appointment.findOne({
      date,
      status: { $in: ['pending', 'confirmed'] },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    if (clash) {
      return res.render('client/booking-error', {
        message: 'That time was just taken by someone else. Please choose another time.'
      });
    }

    const appointment = await Appointment.create({
      customerName, customerEmail, customerPhone,
      service: { name: service.name, duration: service.duration, price: service.price },
      date, startTime, endTime, notes
    });

    await Notification.create({
      appointment: appointment._id,
      type: 'new_booking',
      message: `${customerName} booked ${service.name} on ${formatDateDisplay(date)} at ${formatTime12(startTime)}.`
    });

    const site = res.locals.site;

    // Send confirmation/alert emails. These never throw — a broken mail
    // setup should never prevent the booking itself from completing —
    // but we still await them so delivery failures show up in the logs
    // rather than vanishing into an unhandled background promise.
    await Promise.all([
      sendMail({
        to: customerEmail,
        subject: `You're booked — ${service.name} on ${formatDateDisplay(date)}`,
        html: clientConfirmationEmail({ appointment, site, formatDateDisplay, formatTime12 })
      }),
      process.env.BUSINESS_EMAIL
        ? sendMail({
            to: process.env.BUSINESS_EMAIL,
            subject: `New booking — ${customerName}, ${formatDateDisplay(date)}`,
            html: businessAlertEmail({ appointment, site, formatDateDisplay, formatTime12 })
          })
        : Promise.resolve()
    ]);

    res.render('client/booking-success', { appointment, formatDateDisplay, formatTime12 });
  } catch (err) {
    console.error(err);
    res.render('client/booking-error', { message: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
