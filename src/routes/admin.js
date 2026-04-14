const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { layout } = require('./layout');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// ── Staff management ──────────────────────────────────────────────────────────

router.get('/admin/staff', requireAuth('admin'), (req, res) => {
  const staff = db.prepare(`
    SELECT u.*, s.name as supervisor_name
    FROM users u LEFT JOIN users s ON u.supervisor_id = s.id
    WHERE u.active = 1 ORDER BY u.role DESC, u.name
  `).all();
  const supervisors = db.prepare("SELECT id, name FROM users WHERE role IN ('admin','supervisor') AND active = 1 ORDER BY name").all();

  res.send(layout('Staff', `
    <div class="container-wide">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:16px;">
        <div>
          <h1 class="page-title">Staff</h1>
          <p class="page-sub">${staff.length} active ${staff.length === 1 ? 'member' : 'members'}</p>
        </div>
        <button class="btn btn-primary" onclick="document.getElementById('addModal').style.display='flex'">+ Add staff member</button>
      </div>

      <div class="card" style="padding:0;overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Supervisor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${staff.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><h3>No staff yet</h3><p>Add your first team member above.</p></div></td></tr>` :
              staff.map(u => `
                <tr>
                  <td style="font-weight:500;">${u.name}</td>
                  <td style="color:var(--muted);">${u.email}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-purple' : u.role === 'supervisor' ? 'badge-green' : 'badge-gray'}">${u.role}</span></td>
                  <td style="color:var(--muted);">${u.supervisor_name || '—'}</td>
                  <td style="text-align:right;">
                    <button class="btn btn-outline btn-sm" onclick="openEdit(${JSON.stringify(u).split('"').join('&quot;')})">Edit</button>
                    <form method="POST" action="/admin/staff/${u.id}/deactivate" style="display:inline;" onsubmit="return confirm('Remove ${u.name}?')">
                      <button type="submit" class="btn btn-sm" style="color:var(--danger);border-color:transparent;background:transparent;">Remove</button>
                    </form>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>

      <div style="margin-top:20px;">
        <a href="/admin/send-checkins" class="btn btn-outline">Send check-ins now (manual)</a>
      </div>
    </div>

    <!-- Add Modal -->
    <div id="addModal" style="display:none;min-height:100vh;background:rgba(0,0,0,0.45);align-items:center;justify-content:center;padding:20px;">
      <div class="card" style="width:100%;max-width:460px;margin:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:18px;">Add staff member</h2>
          <button onclick="document.getElementById('addModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);">✕</button>
        </div>
        <form method="POST" action="/admin/staff">
          <div class="form-row">
            <div class="form-group"><label>Name</label><input type="text" name="name" required></div>
            <div class="form-group"><label>Email</label><input type="email" name="email" required></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Role</label>
              <select name="role" onchange="this.form.querySelector('.pw-field').style.display=this.value!=='employee'?'block':'none'">
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label>Supervisor</label>
              <select name="supervisor_id">
                <option value="">— None —</option>
                ${supervisors.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group pw-field" style="display:none;">
            <label>Password <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:12px;">(required for supervisors/admins)</span></label>
            <input type="password" name="password" minlength="8">
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('addModal').style.display='none'">Cancel</button>
            <button type="submit" class="btn btn-primary">Add member</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Modal -->
    <div id="editModal" style="display:none;min-height:100vh;background:rgba(0,0,0,0.45);align-items:center;justify-content:center;padding:20px;">
      <div class="card" style="width:100%;max-width:460px;margin:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:18px;">Edit staff member</h2>
          <button onclick="document.getElementById('editModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);">✕</button>
        </div>
        <form method="POST" id="editForm">
          <input type="hidden" name="_method" value="PUT">
          <div class="form-row">
            <div class="form-group"><label>Name</label><input type="text" name="name" id="editName" required></div>
            <div class="form-group"><label>Email</label><input type="email" name="email" id="editEmail" required></div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Role</label>
              <select name="role" id="editRole">
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div class="form-group">
              <label>Supervisor</label>
              <select name="supervisor_id" id="editSupervisor">
                <option value="">— None —</option>
                ${supervisors.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>New password <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:12px;">(leave blank to keep current)</span></label>
            <input type="password" name="password" minlength="8">
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" class="btn btn-outline" onclick="document.getElementById('editModal').style.display='none'">Cancel</button>
            <button type="submit" class="btn btn-primary">Save changes</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      function openEdit(u) {
        document.getElementById('editName').value = u.name;
        document.getElementById('editEmail').value = u.email;
        document.getElementById('editRole').value = u.role;
        document.getElementById('editSupervisor').value = u.supervisor_id || '';
        document.getElementById('editForm').action = '/admin/staff/' + u.id;
        document.getElementById('editModal').style.display = 'flex';
      }
    </script>
  `, req.user));
});

router.post('/admin/staff', requireAuth('admin'), async (req, res) => {
  const { name, email, role, supervisor_id, password } = req.body;
  const id = uuidv4();
  const hash = (role !== 'employee' && password) ? await bcrypt.hash(password, 10) : null;
  try {
    db.prepare('INSERT INTO users (id, name, email, role, supervisor_id, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, name, email.toLowerCase().trim(), role || 'employee', supervisor_id || null, hash);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.redirect('/admin/staff?error=duplicate_email');
  }
  res.redirect('/admin/staff');
});

router.post('/admin/staff/:id', requireAuth('admin'), async (req, res) => {
  const { name, email, role, supervisor_id, password } = req.body;
  const updates = { name, email: email.toLowerCase().trim(), role: role || 'employee', supervisor_id: supervisor_id || null };
  if (password) updates.password_hash = await bcrypt.hash(password, 10);
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  res.redirect('/admin/staff');
});

router.post('/admin/staff/:id/deactivate', requireAuth('admin'), (req, res) => {
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/staff');
});

// ── Question management ────────────────────────────────────────────────────────

router.get('/admin/questions', requireAuth('admin'), (req, res) => {
  const questions = db.prepare('SELECT * FROM questions WHERE active = 1 ORDER BY order_index').all();
  res.send(layout('Questions', `
    <div class="container" style="max-width:640px;">
      <div style="margin-bottom:32px;">
        <h1 class="page-title">Check-in questions</h1>
        <p class="page-sub">These questions are sent to all employees each week.</p>
      </div>

      <div id="questionList">
        ${questions.map((q, i) => `
          <div class="card card-sm" style="margin-bottom:10px;display:flex;align-items:center;gap:14px;" data-id="${q.id}">
            <div style="color:var(--muted);font-size:13px;min-width:20px;text-align:center;">${i+1}</div>
            <div style="flex:1;">
              <p style="margin:0 0 4px;font-size:15px;">${q.text}</p>
              <span class="badge badge-gray" style="font-size:11px;">${q.type.replace('_', ' ')}</span>
            </div>
            <form method="POST" action="/admin/questions/${q.id}/delete" onsubmit="return confirm('Delete this question?')">
              <button type="submit" class="btn btn-sm" style="color:var(--danger);border:none;background:none;">Remove</button>
            </form>
          </div>
        `).join('')}
      </div>

      <div class="card" style="margin-top:20px;">
        <h2 style="font-size:16px;margin-bottom:16px;">Add a question</h2>
        <form method="POST" action="/admin/questions">
          <div class="form-group">
            <label>Question text</label>
            <input type="text" name="text" required placeholder="e.g. What are you grateful for this week?">
          </div>
          <div class="form-group">
            <label>Response type</label>
            <select name="type">
              <option value="scale_with_comment">1–5 scale + optional comment</option>
              <option value="scale">1–5 scale only</option>
              <option value="text">Text response only</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Add question</button>
        </form>
      </div>
    </div>
  `, req.user));
});

router.post('/admin/questions', requireAuth('admin'), (req, res) => {
  const { text, type } = req.body;
  const maxOrder = db.prepare('SELECT MAX(order_index) as m FROM questions WHERE active = 1').get();
  db.prepare('INSERT INTO questions (id, text, type, order_index) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), text, type || 'text', (maxOrder.m || 0) + 1);
  res.redirect('/admin/questions');
});

router.post('/admin/questions/:id/delete', requireAuth('admin'), (req, res) => {
  db.prepare('UPDATE questions SET active = 0 WHERE id = ?').run(req.params.id);
  res.redirect('/admin/questions');
});

// ── Manual send ────────────────────────────────────────────────────────────────

router.get('/admin/send-checkins', requireAuth('admin'), (req, res) => {
  res.send(layout('Send check-ins', `
    <div class="container" style="max-width:480px;padding-top:40px;">
      <a href="/admin/staff" style="font-size:13px;color:var(--muted);">← Back to staff</a>
      <h1 class="page-title" style="margin-top:16px;margin-bottom:8px;">Send check-ins manually</h1>
      <p style="color:var(--muted);margin-bottom:28px;line-height:1.7;">This will send check-in emails to all active employees right now, in addition to the automatic Friday send. Use for testing or catch-up weeks.</p>
      <div class="card">
        <form method="POST" action="/admin/send-checkins" onsubmit="this.querySelector('button').textContent='Sending...';this.querySelector('button').disabled=true;">
          <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:13px;">Send check-ins to all staff now</button>
        </form>
      </div>
    </div>
  `, req.user));
});

router.post('/admin/send-checkins', requireAuth('admin'), async (req, res) => {
  const { sendWeeklyCheckins } = require('../scheduler');
  try {
    const count = await sendWeeklyCheckins();
    res.send(layout('Sent!', `
      <div class="container" style="max-width:480px;padding-top:80px;text-align:center;">
        <div class="card">
          <div style="font-size:40px;margin-bottom:16px;">✓</div>
          <h2 style="margin-bottom:10px;">Check-ins sent!</h2>
          <p style="color:var(--muted);">Sent to ${count} employee${count !== 1 ? 's' : ''}.</p>
          <div style="margin-top:20px;"><a href="/admin/staff" class="btn btn-outline">Back to staff</a></div>
        </div>
      </div>
    `, req.user));
  } catch (e) {
    res.send(layout('Error', `<div class="container" style="max-width:480px;padding-top:80px;"><div class="alert alert-error">Error sending: ${e.message}</div><a href="/admin/staff" class="btn btn-outline">Back</a></div>`, req.user));
  }
});

module.exports = router;
