const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { sendCheckinEmail } = require('./email');

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
}

async function sendWeeklyCheckins() {
  const employees = db.prepare("SELECT * FROM users WHERE role = 'employee' AND active = 1").all();
  const weekStart = getWeekStart();
  let sent = 0;

  for (const employee of employees) {
    try {
      // Expire old unused tokens for this user
      db.prepare("DELETE FROM checkins WHERE user_id = ? AND submitted_at IS NULL AND week_start != ?").run(employee.id, weekStart);

      // Check if already sent this week
      const existing = db.prepare('SELECT id FROM checkins WHERE user_id = ? AND week_start = ?').get(employee.id, weekStart);
      if (existing) continue;

      // Create checkin record with magic token
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];
      const checkinId = uuidv4();
      db.prepare('INSERT INTO checkins (id, user_id, week_start, token, token_expires_at) VALUES (?, ?, ?, ?, ?)')
        .run(checkinId, employee.id, weekStart, token, expiresAt);

      await sendCheckinEmail(employee, token);
      sent++;
      console.log(`[checkin] Sent to ${employee.email}`);
    } catch (err) {
      console.error(`[checkin] Failed for ${employee.email}:`, err.message);
    }
  }

  console.log(`[checkin] Sent ${sent} check-ins for week ${weekStart}`);
  return sent;
}

function startScheduler() {
  // Default: Friday 4pm (cron: "0 16 * * 5")
  const cronExpr = process.env.CHECKIN_CRON || '0 16 * * 5';
  console.log(`[scheduler] Check-in cron: ${cronExpr}`);

  cron.schedule(cronExpr, async () => {
    console.log('[scheduler] Running weekly check-in send...');
    try {
      await sendWeeklyCheckins();
    } catch (err) {
      console.error('[scheduler] Error:', err);
    }
  }, {
    timezone: process.env.TZ || 'America/Chicago',
  });
}

module.exports = { startScheduler, sendWeeklyCheckins };
