const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { requireStaff } = require('../middleware/auth');

router.get('/notifications/count', requireStaff, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ isRead: false });
    res.json({ count });
  } catch (err) {
    res.json({ count: 0 });
  }
});

module.exports = router;
