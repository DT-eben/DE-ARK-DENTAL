/**
 * Validates and normalizes booking form input.
 * Returns { valid: true, data } or { valid: false, message }.
 * Keeping this as one explicit function (rather than scattering checks through
 * the route) makes it easy to see everything a booking submission is checked against.
 */
function validateBookingInput(body) {
  const { customerName, customerEmail, customerPhone, serviceId, date, startTime, endTime, notes } = body;

  // Required fields present at all
  if (!customerName || !customerEmail || !customerPhone || !serviceId || !date || !startTime || !endTime) {
    return { valid: false, message: 'Please fill in all required fields.' };
  }

  const name = String(customerName).trim();
  const email = String(customerEmail).trim();
  const phone = String(customerPhone).trim();
  const notesVal = notes ? String(notes).trim() : '';

  // Length caps — stops someone pasting megabytes of text into a form field
  if (name.length < 1 || name.length > 100) {
    return { valid: false, message: 'Name must be between 1 and 100 characters.' };
  }
  if (email.length > 150) {
    return { valid: false, message: 'Email address is too long.' };
  }
  if (phone.length < 6 || phone.length > 25) {
    return { valid: false, message: 'Please enter a valid phone number.' };
  }
  if (notesVal.length > 500) {
    return { valid: false, message: 'Notes must be 500 characters or fewer.' };
  }

  // Basic shape checks
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  const phonePattern = /^[0-9+\-\s()]+$/;
  if (!phonePattern.test(phone)) {
    return { valid: false, message: 'Phone number can only contain digits, spaces, and + - ( ).' };
  }

  // Date must be a real, well-formed calendar date — not just any string
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(date)) {
    return { valid: false, message: 'Invalid date format.' };
  }
  const parsedDate = new Date(date + 'T00:00:00');
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, message: 'Invalid date.' };
  }

  // Don't allow booking dates in the past
  const todayStr = new Date().toISOString().split('T')[0];
  if (date < todayStr) {
    return { valid: false, message: 'You cannot book a date in the past.' };
  }

  // Don't allow booking absurdly far in the future (also limits junk data / calendar spam)
  const maxFuture = new Date();
  maxFuture.setMonth(maxFuture.getMonth() + 6);
  if (parsedDate > maxFuture) {
    return { valid: false, message: 'Bookings can only be made up to 6 months in advance.' };
  }

  // Time format
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
    return { valid: false, message: 'Invalid time format.' };
  }
  if (startTime >= endTime) {
    return { valid: false, message: 'Invalid time range.' };
  }

  return {
    valid: true,
    data: { customerName: name, customerEmail: email, customerPhone: phone, notes: notesVal, date, startTime, endTime, serviceId }
  };
}

module.exports = { validateBookingInput };
