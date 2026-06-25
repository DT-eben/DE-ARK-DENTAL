module.exports.requireStaff = (req, res, next) => {
  if (!req.session.staffId) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/admin/auth/login');
  }
  next();
};

module.exports.requireOwner = (req, res, next) => {
  if (!req.session.staff || !req.session.staff.isOwner) {
    req.flash('error', 'Only the owner account can do that.');
    return res.redirect('/admin');
  }
  next();
};
