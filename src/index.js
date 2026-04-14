require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use(require('./routes/auth'));
app.use(require('./routes/checkin'));
app.use(require('./routes/dashboard'));
app.use(require('./routes/admin'));

// Home redirect
app.get('/', (req, res) => {
  const token = req.cookies?.session;
  if (token) return res.redirect('/dashboard');
  // First time? Go to setup if no admin exists
  const db = require('./db');
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  res.redirect(adminExists ? '/login' : '/setup');
});

// 404
app.use((req, res) => {
  res.status(404).send(`
    <div style="font-family:sans-serif;text-align:center;padding:80px 20px;">
      <h2>Page not found</h2>
      <p style="color:#888;margin-bottom:20px;">That page doesn't exist.</p>
      <a href="/" style="color:#6b5fa0;">Go home →</a>
    </div>
  `);
});

// Start scheduler
const { startScheduler } = require('./scheduler');
startScheduler();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✓ Weekly Check-In running at http://localhost:${PORT}`);
  console.log(`  First time? Visit http://localhost:${PORT}/setup\n`);
});
