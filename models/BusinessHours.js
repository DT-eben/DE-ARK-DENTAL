const mongoose = require('mongoose');

const businessHoursSchema = new mongoose.Schema({
  day: { type: String, required: true, unique: true }, // Monday, Tuesday...
  open: { type: String, default: '08:00' },
  close: { type: String, default: '18:00' },
  isOpen: { type: Boolean, default: true }
});

businessHoursSchema.statics.defaults = function () {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days.map(day => ({ day, open: '08:00', close: '18:00', isOpen: day !== 'Sunday' }));
};

module.exports = mongoose.model('BusinessHours', businessHoursSchema);
