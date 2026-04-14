const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { layout } = require('./layout');
const router = express.Router();

router.get('/checkin/:token', (req, res) => {
  const { token } = req.params;
  const checkin = db.prepare(`
    SELECT c.*, u.name as user_name FROM checkins c
    JOIN users u ON c.user_id = u.id
    WHERE c.token = ? AND datetime(c.token_expires_at) > datetime('now')
  `).get(token);

  if (!checkin) {
    return res.send(layout('Link expired', `
      <div class="container" style="max-width:480px;padding-top:80px;text-align:center;">
        <div class="card">
          <h2 style="margin-bottom:12px;">This link has expired</h2>
          <p style="color:var(--muted);line-height:1.7;">Check-in links are valid for 72 hours. Your supervisor can resend you a link, or you'll receive a new one next Friday.</p>
        </div>
      </div>
    `));
  }

  if (checkin.submitted_at) {
    return res.send(layout('Already submitted', `
      <div class="container" style="max-width:480px;padding-top:80px;text-align:center;">
        <div class="card">
          <div style="font-size:48px;margin-bottom:16px;">✓</div>
          <h2 style="margin-bottom:12px;">You're all set, ${checkin.user_name.split(' ')[0]}!</h2>
          <p style="color:var(--muted);">You've already submitted your check-in for this week. See you next Friday!</p>
        </div>
      </div>
    `));
  }

  const questions = db.prepare('SELECT * FROM questions WHERE active = 1 ORDER BY order_index').all();

  const questionHtml = questions.map((q, i) => {
    if (q.type === 'text') {
      return `
        <div class="card" style="margin-bottom:16px;">
          <div style="margin-bottom:14px;">
            <span style="font-size:12px;letter-spacing:0.08em;color:var(--muted);text-transform:uppercase;">${i + 1} of ${questions.length}</span>
            <h3 style="font-size:18px;margin-top:6px;line-height:1.4;">${q.text}</h3>
          </div>
          <textarea name="q_${q.id}_text" placeholder="Your response..." rows="3"></textarea>
        </div>`;
    }
    if (q.type === 'scale' || q.type === 'scale_with_comment') {
      const scaleHtml = `
        <div class="scale-group">
          ${[1,2,3,4,5].map(n => `
            <div class="scale-opt">
              <input type="radio" name="q_${q.id}_scale" id="q_${q.id}_${n}" value="${n}">
              <label for="q_${q.id}_${n}">${n}</label>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;">
          <span style="font-size:12px;color:var(--muted);">Not well</span>
          <span style="font-size:12px;color:var(--muted);">Really well</span>
        </div>`;
      const commentHtml = q.type === 'scale_with_comment' ? `
        <div style="margin-top:14px;">
          <label>Anything you want to add? <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:12px;">(optional)</span></label>
          <textarea name="q_${q.id}_text" placeholder="Optional comment..." rows="2"></textarea>
        </div>` : '';
      return `
        <div class="card" style="margin-bottom:16px;">
          <div style="margin-bottom:14px;">
            <span style="font-size:12px;letter-spacing:0.08em;color:var(--muted);text-transform:uppercase;">${i + 1} of ${questions.length}</span>
            <h3 style="font-size:18px;margin-top:6px;line-height:1.4;">${q.text}</h3>
          </div>
          ${scaleHtml}
          ${commentHtml}
        </div>`;
    }
    return '';
  }).join('');

  res.send(layout('Weekly Check-In', `
    <div class="container" style="max-width:580px;">
      <div style="margin-bottom:32px;padding-top:8px;">
        <p style="font-size:13px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">Weekly Check-In</p>
        <h1 class="page-title">Hi, ${checkin.user_name.split(' ')[0]} 👋</h1>
        <p style="color:var(--muted);font-size:15px;line-height:1.6;">Take a few minutes to reflect. Your responses go directly to your supervisor.</p>
      </div>
      <form method="POST" action="/checkin/${token}" id="checkinForm">
        ${questionHtml}
        <div style="margin-top:8px;">
          <button type="submit" class="btn btn-primary" style="padding:13px 36px;font-size:15px;" id="submitBtn">
            Submit my check-in
          </button>
        </div>
      </form>
    </div>
    <script>
      document.getElementById('checkinForm').addEventListener('submit', function() {
        const btn = document.getElementById('submitBtn');
        btn.textContent = 'Submitting...';
        btn.disabled = true;
      });
    </script>
  `));
});

router.post('/checkin/:token', (req, res) => {
  const { token } = req.params;
  const checkin = db.prepare(`
    SELECT * FROM checkins WHERE token = ?
    AND datetime(token_expires_at) > datetime('now')
    AND submitted_at IS NULL
  `).get(token);

  if (!checkin) return res.redirect(`/checkin/${token}`);

  const questions = db.prepare('SELECT * FROM questions WHERE active = 1').all();
  const insertResp = db.prepare('INSERT INTO responses (id, checkin_id, question_id, scale_value, text_value) VALUES (?, ?, ?, ?, ?)');

  const saveAll = db.transaction(() => {
    questions.forEach(q => {
      const scaleVal = req.body[`q_${q.id}_scale`] ? parseInt(req.body[`q_${q.id}_scale`]) : null;
      const textVal = req.body[`q_${q.id}_text`]?.trim() || null;
      if (scaleVal || textVal) {
        insertResp.run(uuidv4(), checkin.id, q.id, scaleVal, textVal);
      }
    });
    db.prepare("UPDATE checkins SET submitted_at = datetime('now') WHERE id = ?").run(checkin.id);
  });

  saveAll();

  // Notify supervisor async
  notifySupervisor(checkin).catch(console.error);

  res.send(layout('Submitted!', `
    <div class="container" style="max-width:480px;padding-top:80px;text-align:center;">
      <div class="card">
        <div style="width:56px;height:56px;background:#e8f5ee;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:24px;">✓</div>
        <h2 style="margin-bottom:12px;">Check-in submitted!</h2>
        <p style="color:var(--muted);line-height:1.7;">Thanks for taking the time. Your supervisor will be in touch if needed. Have a great week!</p>
      </div>
    </div>
  `));
});

async function notifySupervisor(checkin) {
  try {
    const { sendSupervisorDigest } = require('../email');
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(checkin.user_id);
    if (!user.supervisor_id) return;
    const supervisor = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(user.supervisor_id);
    if (!supervisor) return;

    const questions = db.prepare('SELECT * FROM questions WHERE active = 1 ORDER BY order_index').all();
    const responses = db.prepare('SELECT * FROM responses WHERE checkin_id = ?').all(checkin.id);

    await sendSupervisorDigest(supervisor, [{ user, checkin, responses, questions }]);
  } catch (err) {
    console.error('Failed to notify supervisor:', err.message);
  }
}

module.exports = router;
