module.exports = function (req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Access denied. Admins only.');
  }
  next();
};