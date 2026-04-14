const express = require('express');
const db = require('../db');
const { layout } = require('./layout');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/dashboard', requireAuth('supervisor'), (req, res) => {
  const supervisor = req.user;

  // Get all direct reports
  const staff = db.prepare("SELECT * FROM users WHERE supervisor_id = ? AND active = 1 ORDER BY name").all(supervisor.id);

  // Get this week's checkins
  const weekStart = getWeekStart();
  const checkinData = staff.map(employee => {
    const checkin = db.prepare(`
      SELECT * FROM checkins WHERE user_id = ? AND week_start = ?
    `).get(employee.id, weekStart);
    const responses = checkin ? db.prepare('SELECT * FROM responses WHERE checkin_id = ?').all(checkin.id) : [];
    return { employee, checkin, responses };
  });

  const submitted = checkinData.filter(d => d.checkin?.submitted_at).length;
  const pending = staff.length - submitted;

  // Trend data: last 8 weeks, avg personal + spiritual scores
  const trendData = getLast8WeeksTrend(staff.map(s => s.id));

  const scaleQuestions = db.prepare("SELECT * FROM questions WHERE type != 'text' AND active = 1 ORDER BY order_index").all();

  res.send(layout('Dashboard', `
    <div class="container-wide">
      <div style="margin-bottom:32px;">
        <h1 class="page-title">Your team</h1>
        <p class="page-sub">Week of ${formatWeek(weekStart)}</p>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Team size</div>
          <div class="stat-value">${staff.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Submitted</div>
          <div class="stat-value" style="color:var(--success);">${submitted}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pending</div>
          <div class="stat-value" style="color:${pending > 0 ? '#c07a00' : 'var(--success)'};">${pending}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Response rate</div>
          <div class="stat-value">${staff.length > 0 ? Math.round((submitted/staff.length)*100) : 0}%</div>
        </div>
      </div>

      ${trendData.length > 0 && scaleQuestions.length > 0 ? `
      <div class="card" style="margin-bottom:28px;">
        <h2 style="font-size:17px;margin-bottom:4px;">Team pulse — last 8 weeks</h2>
        <p style="font-size:13px;color:var(--muted);margin-bottom:20px;">Average score across scale questions (1–5)</p>
        <canvas id="trendChart" height="90"></canvas>
      </div>` : ''}

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h2 style="font-size:17px;">This week's check-ins</h2>
          <div style="display:flex;gap:8px;">
            <a href="/dashboard/week/${weekStart}" class="btn btn-outline btn-sm">View all responses</a>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Personal</th>
              <th>Spiritual</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${checkinData.length === 0 ? `<tr><td colspan="5"><div class="empty-state"><p>No staff assigned to you yet.</p></div></td></tr>` :
              checkinData.map(({ employee, checkin, responses }) => {
                const status = !checkin ? 'not_sent' : !checkin.submitted_at ? 'pending' : 'submitted';
                const personalQ = scaleQuestions.find(q => q.text.toLowerCase().includes('personal'));
                const spiritualQ = scaleQuestions.find(q => q.text.toLowerCase().includes('spirit'));
                const personalResp = personalQ ? responses.find(r => r.question_id === personalQ.id) : null;
                const spiritualResp = spiritualQ ? responses.find(r => r.question_id === spiritualQ.id) : null;

                return `<tr>
                  <td style="font-weight:500;">${employee.name}</td>
                  <td>
                    ${status === 'submitted' ? '<span class="badge badge-green">Submitted</span>' :
                      status === 'pending' ? '<span class="badge badge-amber">Awaiting</span>' :
                      '<span class="badge badge-gray">Not sent</span>'}
                  </td>
                  <td>${personalResp?.scale_value ? scaleDots(personalResp.scale_value) : '<span style="color:var(--muted);">—</span>'}</td>
                  <td>${spiritualResp?.scale_value ? scaleDots(spiritualResp.scale_value) : '<span style="color:var(--muted);">—</span>'}</td>
                  <td style="text-align:right;">
                    ${checkin?.submitted_at ? `<a href="/dashboard/employee/${employee.id}" class="btn btn-outline btn-sm">View</a>` : ''}
                  </td>
                </tr>`;
              }).join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    ${trendData.length > 0 ? `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
      const ctx = document.getElementById('trendChart');
      if (ctx) {
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: ${JSON.stringify(trendData.map(d => d.label))},
            datasets: [{
              label: 'Avg score',
              data: ${JSON.stringify(trendData.map(d => d.avg))},
              borderColor: '#6b5fa0',
              backgroundColor: 'rgba(107,95,160,0.08)',
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: '#6b5fa0',
              fill: true,
              tension: 0.3
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: { min: 1, max: 5, ticks: { stepSize: 1 }, grid: { color: '#f0ede8' } },
              x: { grid: { display: false } }
            }
          }
        });
      }
    </script>` : ''}
  `, supervisor));
});

// View all responses for a given week
router.get('/dashboard/week/:weekStart', requireAuth('supervisor'), (req, res) => {
  const supervisor = req.user;
  const { weekStart } = req.params;
  const staff = db.prepare("SELECT * FROM users WHERE supervisor_id = ? AND active = 1 ORDER BY name").all(supervisor.id);
  const questions = db.prepare('SELECT * FROM questions WHERE active = 1 ORDER BY order_index').all();

  const allData = staff.map(employee => {
    const checkin = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND week_start = ?').get(employee.id, weekStart);
    const responses = checkin ? db.prepare('SELECT * FROM responses WHERE checkin_id = ?').all(checkin.id) : [];
    return { employee, checkin, responses };
  }).filter(d => d.checkin?.submitted_at);

  res.send(layout(`Week of ${formatWeek(weekStart)}`, `
    <div class="container">
      <div style="margin-bottom:28px;">
        <a href="/dashboard" style="font-size:13px;color:var(--muted);">← Back to dashboard</a>
        <h1 class="page-title" style="margin-top:12px;">Week of ${formatWeek(weekStart)}</h1>
        <p class="page-sub">${allData.length} of ${staff.length} submitted</p>
      </div>
      ${allData.length === 0 ? `<div class="card"><div class="empty-state"><h3>No submissions yet</h3><p>Check back after your team submits their check-ins.</p></div></div>` :
        allData.map(({ employee, checkin, responses }) => renderEmployeeCard(employee, checkin, responses, questions)).join('')
      }
    </div>
  `, supervisor));
});

// View employee history
router.get('/dashboard/employee/:id', requireAuth('supervisor'), (req, res) => {
  const supervisor = req.user;
  const employee = db.prepare('SELECT * FROM users WHERE id = ? AND supervisor_id = ? AND active = 1').get(req.params.id, supervisor.id);
  if (!employee) return res.redirect('/dashboard');

  const questions = db.prepare('SELECT * FROM questions WHERE active = 1 ORDER BY order_index').all();
  const checkins = db.prepare(`
    SELECT * FROM checkins WHERE user_id = ? AND submitted_at IS NOT NULL
    ORDER BY week_start DESC LIMIT 12
  `).all(employee.id);

  // Scale questions for trend
  const scaleQs = questions.filter(q => q.type !== 'text');
  const trendPoints = checkins.map(c => {
    const responses = db.prepare('SELECT * FROM responses WHERE checkin_id = ?').all(c.id);
    const scaleResponses = responses.filter(r => scaleQs.some(q => q.id === r.question_id) && r.scale_value);
    const avg = scaleResponses.length > 0 ? (scaleResponses.reduce((s, r) => s + r.scale_value, 0) / scaleResponses.length).toFixed(1) : null;
    return { week: c.week_start, avg, label: formatWeekShort(c.week_start) };
  }).reverse();

  const recentCheckins = checkins.slice(0, 6).map(c => {
    const responses = db.prepare('SELECT * FROM responses WHERE checkin_id = ?').all(c.id);
    return { checkin: c, responses };
  });

  res.send(layout(employee.name, `
    <div class="container">
      <div style="margin-bottom:28px;">
        <a href="/dashboard" style="font-size:13px;color:var(--muted);">← Back to dashboard</a>
        <h1 class="page-title" style="margin-top:12px;">${employee.name}</h1>
        <p class="page-sub">${checkins.length} check-ins submitted</p>
      </div>

      ${trendPoints.filter(p => p.avg).length >= 2 ? `
      <div class="card" style="margin-bottom:24px;">
        <h2 style="font-size:16px;margin-bottom:4px;">Wellbeing trend</h2>
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px;">Average scale scores over time</p>
        <canvas id="empTrend" height="100"></canvas>
      </div>` : ''}

      ${recentCheckins.map(({ checkin, responses }) => renderEmployeeCard(employee, checkin, responses, questions, true)).join('')}
    </div>

    ${trendPoints.filter(p => p.avg).length >= 2 ? `
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script>
      new Chart(document.getElementById('empTrend'), {
        type: 'line',
        data: {
          labels: ${JSON.stringify(trendPoints.filter(p => p.avg).map(p => p.label))},
          datasets: [{
            data: ${JSON.stringify(trendPoints.filter(p => p.avg).map(p => parseFloat(p.avg)))},
            borderColor: '#6b5fa0', backgroundColor: 'rgba(107,95,160,0.08)',
            borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#6b5fa0', fill: true, tension: 0.3
          }]
        },
        options: {
          responsive: true, plugins: { legend: { display: false } },
          scales: {
            y: { min: 1, max: 5, ticks: { stepSize: 1 }, grid: { color: '#f0ede8' } },
            x: { grid: { display: false } }
          }
        }
      });
    </script>` : ''}
  `, supervisor));
});

function renderEmployeeCard(employee, checkin, responses, questions, showWeekHeader = false) {
  const weekLabel = formatWeek(checkin.week_start);
  const qHtml = questions.map(q => {
    const resp = responses.find(r => r.question_id === q.id);
    if (!resp) return '';
    let answerHtml = '';
    if (q.type === 'scale' || q.type === 'scale_with_comment') {
      answerHtml = `<div style="display:flex;align-items:center;gap:8px;">${scaleDots(resp.scale_value)}<span style="font-size:13px;color:var(--muted);">${resp.scale_value}/5</span></div>`;
      if (resp.text_value) answerHtml += `<p style="margin:6px 0 0;font-size:14px;color:var(--ink2);font-style:italic;">"${resp.text_value}"</p>`;
    } else {
      answerHtml = `<p style="margin:0;font-size:14px;color:var(--ink2);line-height:1.6;">${resp.text_value || '<em style="color:var(--muted);">No response</em>'}</p>`;
    }
    return `<div style="margin-bottom:16px;">
      <p style="font-size:12px;letter-spacing:0.06em;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">${q.text}</p>
      ${answerHtml}
    </div>`;
  }).join('');

  return `<div class="card card-sm" style="margin-bottom:16px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid var(--border);">
      <div>
        ${showWeekHeader ? `<p style="font-size:13px;color:var(--muted);margin-bottom:2px;">Week of</p>` : `<p style="font-size:13px;color:var(--muted);margin-bottom:2px;">${employee.name}</p>`}
        <p style="font-weight:500;font-size:15px;">${weekLabel}</p>
      </div>
      <span class="badge badge-green">Submitted</span>
    </div>
    ${qHtml || '<p style="color:var(--muted);font-size:14px;">No responses recorded.</p>'}
  </div>`;
}

function scaleDots(value) {
  return `<div class="scale-display">${[1,2,3,4,5].map(i =>
    `<div class="scale-dot ${i <= value ? 'scale-dot-filled' : 'scale-dot-empty'}"></div>`
  ).join('')}</div>`;
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getLast8WeeksTrend(employeeIds) {
  if (employeeIds.length === 0) return [];
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    weeks.push(monday.toISOString().split('T')[0]);
  }

  return weeks.map(weekStart => {
    const checkins = employeeIds.flatMap(uid => {
      const c = db.prepare('SELECT * FROM checkins WHERE user_id = ? AND week_start = ? AND submitted_at IS NOT NULL').get(uid, weekStart);
      if (!c) return [];
      return db.prepare("SELECT r.scale_value FROM responses r JOIN questions q ON r.question_id = q.id WHERE r.checkin_id = ? AND q.type != 'text' AND r.scale_value IS NOT NULL").all(c.id);
    });
    const avg = checkins.length > 0 ? parseFloat((checkins.reduce((s, r) => s + r.scale_value, 0) / checkins.length).toFixed(1)) : null;
    return { label: formatWeekShort(weekStart), avg };
  }).filter(d => d.avg !== null);
}

function formatWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatWeekShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

module.exports = router;
