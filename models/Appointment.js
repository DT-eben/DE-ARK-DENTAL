const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },

  service: {
    name: { type: String, required: true },
    duration: { type: Number, required: true },
    price: { type: Number, default: 0 }
  },

  date: { type: String, required: true },     // "2024-12-15"
  startTime: { type: String, required: true }, // "10:00"
  endTime: { type: String, required: true },   // "10:30"

  notes: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },

  refNumber: { type: String, unique: true },

  createdAt: { type: Date, default: Date.now }
});

appointmentSchema.pre('save', function () {
  if (!this.refNumber) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let ref = '';
    for (let i = 0; i < 7; i++) ref += chars[Math.floor(Math.random() * chars.length)];
    this.refNumber = ref;
  }
});

module.exports = mongoose.model('Appointment', appointmentSchema);
