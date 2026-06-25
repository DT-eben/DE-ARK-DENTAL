const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const Service = require('../models/Service');
const BusinessHours = require('../models/BusinessHours');
const Staff = require('../models/Staff');
const { requireStaff, requireOwner } = require('../middleware/auth');
const { formatDateDisplay, formatTime12 } = require('../utils/timeHelpers');

const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

router.use(requireStaff);

// Dashboard — today's bookings
router.get('/', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const todayAppointments = await Appointment.find({ date: today }).sort({ startTime: 1 });
  const upcomingAppointments = await Appointment.find({
    date: { $gt: today },
    status: { $in: ['pending', 'confirmed'] }
  }).sort({ date: 1, startTime: 1 }).limit(8);

  const stats = {
    todayCount: todayAppointments.length,
    pendingCount: await Appointment.countDocuments({ status: 'pending' }),
    monthCount: await Appointment.countDocuments({ date: { $gte: today.slice(0, 7) + '-01' } }),
    totalCount: await Appointment.countDocuments()
  };

  const unreadNotifs = await Notification.countDocuments({ isRead: false });

  res.render('admin/dashboard', {
    today, todayAppointments, upcomingAppointments, stats, unreadNotifs,
    formatDateDisplay, formatTime12, page: 'dashboard', req
  });
});

// All bookings
router.get('/bookings', async (req, res) => {
  const { date, status } = req.query;
  const today = new Date().toISOString().split('T')[0];

  const filter = {};
  if (date) filter.date = date;
  if (status) filter.status = status;

  const appointments = await Appointment.find(filter).sort({ date: -1, startTime: 1 });
  const unreadNotifs = await Notification.countDocuments({ isRead: false });

  res.render('admin/bookings', {
    appointments, today, selectedDate: date || '', selectedStatus: status || '',
    unreadNotifs, formatDateDisplay, formatTime12, page: 'bookings'
  });
});

router.post('/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID.' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Booking not found.' });
    appt.status = status;
    await appt.save();
    res.json({ success: true, status });
  } catch (err) {
    console.error('Status update error:', err.message);
    res.status(500).json({ success: false });
  }
});

// Notifications
router.get('/notifications', async (req, res) => {
  const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
  await Notification.updateMany({ isRead: false }, { isRead: true });
  res.render('admin/notifications', { notifications, unreadNotifs: 0, page: 'notifications' });
});

// Services
router.get('/services', async (req, res) => {
  const services = await Service.find().sort({ sortOrder: 1, name: 1 });
  const unreadNotifs = await Notification.countDocuments({ isRead: false });
  res.render('admin/services', { services, unreadNotifs, page: 'services' });
});

router.post('/services/add', async (req, res) => {
  const { name, duration, price, description } = req.body;

  const nameVal = typeof name === 'string' ? name.trim() : '';
  const durationVal = parseInt(duration, 10);
  const priceVal = parseFloat(price);

  if (!nameVal || nameVal.length > 100) {
    req.flash('error', 'Please enter a valid service name (1–100 characters).');
    return res.redirect('/admin/services');
  }
  if (!Number.isFinite(durationVal) || durationVal < 5 || durationVal > 480) {
    req.flash('error', 'Duration must be between 5 and 480 minutes.');
    return res.redirect('/admin/services');
  }
  if (price && (!Number.isFinite(priceVal) || priceVal < 0)) {
    req.flash('error', 'Price must be a positive number.');
    return res.redirect('/admin/services');
  }

  await Service.create({
    name: nameVal,
    duration: durationVal,
    price: Number.isFinite(priceVal) && priceVal > 0 ? priceVal : 0,
    description: typeof description === 'string' ? description.trim().slice(0, 300) : ''
  });
  req.flash('success', 'Service added.');
  res.redirect('/admin/services');
});

router.post('/services/:id/delete', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false });
    }
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post('/services/:id/toggle', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false });
    }
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false });
    service.isActive = !service.isActive;
    await service.save();
    res.json({ success: true, isActive: service.isActive });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Business hours
router.get('/hours', async (req, res) => {
  let hours = await BusinessHours.find();
  if (hours.length === 0) {
    await BusinessHours.insertMany(BusinessHours.defaults());
    hours = await BusinessHours.find();
  }
  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  hours.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
  const unreadNotifs = await Notification.countDocuments({ isRead: false });
  res.render('admin/hours', { hours, unreadNotifs, page: 'hours' });
});

router.post('/hours', async (req, res) => {
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  for (const day of days) {
    await BusinessHours.findOneAndUpdate(
      { day },
      {
        open: req.body[`open_${day}`] || '08:00',
        close: req.body[`close_${day}`] || '18:00',
        isOpen: req.body[`enable_${day}`] ? true : false
      },
      { upsert: true }
    );
  }
  req.flash('success', 'Business hours updated.');
  res.redirect('/admin/hours');
});

// Staff management (owner only)
router.get('/staff', requireOwner, async (req, res) => {
  const staffList = await Staff.find().sort({ createdAt: 1 });
  const unreadNotifs = await Notification.countDocuments({ isRead: false });
  res.render('admin/staff', { staffList, unreadNotifs, page: 'staff' });
});

router.post('/staff/add', requireOwner, async (req, res) => {
  const nameVal = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const emailVal = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
  const passwordVal = typeof req.body.password === 'string' ? req.body.password : '';

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nameVal || nameVal.length > 100) {
    req.flash('error', 'Please enter a valid name.');
    return res.redirect('/admin/staff');
  }
  if (!emailPattern.test(emailVal)) {
    req.flash('error', 'Please enter a valid email address.');
    return res.redirect('/admin/staff');
  }
  if (passwordVal.length < 8) {
    req.flash('error', 'Password must be at least 8 characters.');
    return res.redirect('/admin/staff');
  }

  try {
    const existing = await Staff.findOne({ email: emailVal });
    if (existing) {
      req.flash('error', 'A staff account with that email already exists.');
      return res.redirect('/admin/staff');
    }
    await Staff.create({ name: nameVal, email: emailVal, password: passwordVal });
    req.flash('success', `${nameVal} can now log in.`);
    res.redirect('/admin/staff');
  } catch (err) {
    console.error('Add staff error:', err.message);
    req.flash('error', 'Could not add that staff member.');
    res.redirect('/admin/staff');
  }
});

router.post('/staff/:id/toggle', requireOwner, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false });
    }
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ success: false });
    if (staff.isOwner) return res.json({ success: false, message: 'Cannot deactivate the owner account.' });
    staff.isActive = !staff.isActive;
    await staff.save();
    res.json({ success: true, isActive: staff.isActive });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
