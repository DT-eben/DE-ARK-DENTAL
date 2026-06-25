const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Email not configured — GMAIL_USER / GMAIL_APP_PASSWORD missing in .env. Skipping email sends.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  return transporter;
}

/**
 * Sends an email. Never throws — logs and swallows errors instead,
 * so a broken mail setup can never prevent a booking from completing.
 */
async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) return { sent: false, reason: 'not_configured' };

  try {
    await t.sendMail({
      from: `"${process.env.BUSINESS_NAME || 'Bookings'}" <${process.env.GMAIL_USER}>`,
      to, subject, html
    });
    return { sent: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function clientConfirmationEmail({ appointment, site, formatDateDisplay, formatTime12 }) {
  const accent = site.accent || '#8B6F4E';
  return `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1C1814;">
    <h2 style="font-weight:600;margin-bottom:4px;">${escapeHtml(site.name)}</h2>
    <p style="color:#756B5C;font-size:14px;margin-top:0;margin-bottom:28px;">Appointment confirmation</p>

    <p style="font-size:15px;line-height:1.6;">Hi ${escapeHtml(appointment.customerName)}, your appointment has been received.</p>

    <div style="background:#F3EEE5;border-radius:10px;padding:18px 20px;margin:20px 0;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:5px 0;color:#756B5C;">Service</td><td style="padding:5px 0;text-align:right;font-weight:600;">${escapeHtml(appointment.service.name)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Date</td><td style="padding:5px 0;text-align:right;font-weight:600;">${formatDateDisplay(appointment.date)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Time</td><td style="padding:5px 0;text-align:right;font-weight:600;">${formatTime12(appointment.startTime)} – ${formatTime12(appointment.endTime)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Reference</td><td style="padding:5px 0;text-align:right;font-weight:600;letter-spacing:0.04em;">${escapeHtml(appointment.refNumber)}</td></tr>
      </table>
    </div>

    <p style="font-size:13px;color:#756B5C;line-height:1.6;">We'll see you then. ${site.phone ? `If anything changes, you can reach us at ${escapeHtml(site.phone)}.` : ''}</p>
  </div>`;
}

function businessAlertEmail({ appointment, site, formatDateDisplay, formatTime12 }) {
  return `
  <div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1C1814;">
    <h2 style="font-weight:600;margin-bottom:4px;">New booking</h2>
    <p style="color:#756B5C;font-size:14px;margin-top:0;margin-bottom:28px;">${escapeHtml(site.name)}</p>

    <div style="background:#F3EEE5;border-radius:10px;padding:18px 20px;margin:20px 0;">
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:5px 0;color:#756B5C;">Client</td><td style="padding:5px 0;text-align:right;font-weight:600;">${escapeHtml(appointment.customerName)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Phone</td><td style="padding:5px 0;text-align:right;font-weight:600;">${escapeHtml(appointment.customerPhone)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Service</td><td style="padding:5px 0;text-align:right;font-weight:600;">${escapeHtml(appointment.service.name)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Date</td><td style="padding:5px 0;text-align:right;font-weight:600;">${formatDateDisplay(appointment.date)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Time</td><td style="padding:5px 0;text-align:right;font-weight:600;">${formatTime12(appointment.startTime)} – ${formatTime12(appointment.endTime)}</td></tr>
        <tr><td style="padding:5px 0;color:#756B5C;">Reference</td><td style="padding:5px 0;text-align:right;font-weight:600;letter-spacing:0.04em;">${escapeHtml(appointment.refNumber)}</td></tr>
      </table>
    </div>
    ${appointment.notes ? `<p style="font-size:13px;color:#756B5C;"><strong>Note from client:</strong> ${escapeHtml(appointment.notes)}</p>` : ''}
  </div>`;
}

module.exports = { sendMail, clientConfirmationEmail, businessAlertEmail };
