const jwt = require('jsonwebtoken');
const db = require('../db');

function requireAuth(role = null) {
  return (req, res, next) => {
    const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.redirect('/login');

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(payload.userId);
      if (!user) return res.redirect('/login');
      if (role && user.role !== role && !(role === 'supervisor' && user.role === 'admin')) {
        return res.status(403).send('Forbidden');
      }
      req.user = user;
      next();
    } catch {
      res.clearCookie('session');
      return res.redirect('/login');
    }
  };
}

module.exports = { requireAuth };
