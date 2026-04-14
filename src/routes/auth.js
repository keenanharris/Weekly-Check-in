const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { layout } = require('./layout');
const router = express.Router();

const SECRET = () => process.env.JWT_SECRET || 'dev-secret';

router.get('/login', (req, res) => {
  const error = req.query.error;
  res.send(layout('Sign in', `
    <div class="container" style="max-width:420px;padding-top:80px;">
      <div style="text-align:center;margin-bottom:36px;">
        <h1 style="font-size:32px;margin-bottom:8px;">Weekly Check-In</h1>
        <p style="color:var(--muted);font-size:15px;">Sign in to your supervisor account</p>
      </div>
      <div class="card">
        ${error ? `<div class="alert alert-error">${error === 'invalid' ? 'Invalid email or password.' : 'An error occurred.'}</div>` : ''}
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Email address</label>
            <input type="email" name="email" required autofocus>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;">Sign in</button>
        </form>
      </div>
    </div>
  `));
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email?.toLowerCase().trim());
  if (!user || !user.password_hash) return res.redirect('/login?error=invalid');
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.redirect('/login?error=invalid');

  const token = jwt.sign({ userId: user.id }, SECRET(), { expiresIn: '30d' });
  res.cookie('session', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  res.redirect(user.role === 'admin' ? '/admin/staff' : '/dashboard');
});

router.get('/logout', (req, res) => {
  res.clearCookie('session');
  res.redirect('/login');
});

// First-time setup — only works if no admin exists
router.get('/setup', (req, res) => {
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (adminExists) return res.redirect('/login');
  res.send(layout('Setup', `
    <div class="container" style="max-width:480px;padding-top:60px;">
      <div style="text-align:center;margin-bottom:36px;">
        <h1 style="font-size:28px;margin-bottom:8px;">Welcome to Weekly Check-In</h1>
        <p style="color:var(--muted);">Create your admin account to get started.</p>
      </div>
      <div class="card">
        <form method="POST" action="/setup">
          <div class="form-group">
            <label>Your name</label>
            <input type="text" name="name" required autofocus>
          </div>
          <div class="form-group">
            <label>Email address</label>
            <input type="email" name="email" required>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" required minlength="8">
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;">Create admin account</button>
        </form>
      </div>
    </div>
  `));
});

router.post('/setup', async (req, res) => {
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (adminExists) return res.redirect('/login');
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const id = uuidv4();
  db.prepare("INSERT INTO users (id, name, email, role, password_hash) VALUES (?, ?, ?, 'admin', ?)").run(id, name, email.toLowerCase().trim(), hash);
  const token = jwt.sign({ userId: id }, SECRET(), { expiresIn: '30d' });
  res.cookie('session', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
  res.redirect('/admin/staff');
});

module.exports = router;
