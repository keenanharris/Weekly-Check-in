const APP_URL = () => process.env.APP_URL || 'http://localhost:3000';
const FROM = () => process.env.EMAIL_FROM || 'onboarding@resend.dev';
const API_KEY = () => process.env.RESEND_API_KEY;

async function sendEmail(to, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `Weekly Check-In <${FROM()}>`, to: [to], subject, html }),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${response.status} ${error}`);
  }
  return response.json();
}

async function sendCheckinEmail(user, token) {
  const link = `${APP_URL()}/checkin/${token}`;
  const firstName = user.name.split(' ')[0];
  await sendEmail(user.email, `Your weekly check-in is ready, ${firstName}`, `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#1a1a2e;padding:32px 40px;">
          <p style="margin:0;font-size:13px;color:#9b8fc4;font-family:Arial,sans-serif;">WEEKLY CHECK-IN</p>
          <h1 style="margin:8px 0 0;font-size:26px;color:#fff;font-weight:normal;">Hi ${firstName},</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 20px;font-size:16px;color:#444;line-height:1.7;">It's time for your weekly check-in. Take a few minutes to reflect on how you're doing and share your goals with your supervisor.</p>
          <p style="margin:0 0 32px;font-size:16px;color:#444;line-height:1.7;">Your responses go directly to your supervisor and help them support you well this week.</p>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#1a1a2e;border-radius:8px;">
              <a href="${link}" style="display:block;padding:16px 36px;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">Complete my check-in &rarr;</a>
            </td>
          </tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#999;font-family:Arial,sans-serif;">This link expires in 72 hours. Direct link: <a href="${link}" style="color:#6b5fa0;">${link}</a></p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #f0ede8;">
          <p style="margin:0;font-size:12px;color:#bbb;font-family:Arial,sans-serif;">Weekly Check-In &mdash; sent on behalf of your organization</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`);
}

async function sendSupervisorDigest(supervisor, directReports) {
  const questions = directReports[0]?.questions || [];
  const weekLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const reportHtml = directReports.map(({ user, checkin, responses }) => {
    if (!checkin || !checkin.submitted_at) {
      return `<div style="margin-bottom:28px;padding:20px 24px;background:#fafaf8;border-radius:8px;border:1px solid #eee;">
        <p style="margin:0 0 4px;font-size:15px;font-weight:bold;color:#1a1a2e;">${user.name}</p>
        <p style="margin:0;font-size:14px;color:#999;font-style:italic;">Has not submitted their check-in yet.</p>
      </div>`;
    }
    const answerHtml = questions.map(q => {
      const resp = responses.find(r => r.question_id === q.id);
      if (!resp) return '';
      let answerDisplay = '';
      if (q.type === 'scale' || q.type === 'scale_with_comment') {
        const dots = [1,2,3,4,5].map(i => `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${i <= (resp.scale_value||0) ? '#6b5fa0' : '#e0dce8'};margin-right:4px;"></span>`).join('');
        answerDisplay = `<div>${dots} <span style="font-size:13px;color:#666;">${resp.scale_value}/5</span></div>`;
        if (resp.text_value) answerDisplay += `<p style="margin:4px 0 0;font-size:14px;color:#444;font-style:italic;">"${resp.text_value}"</p>`;
      } else {
        answerDisplay = `<p style="margin:0;font-size:14px;color:#444;">${resp.text_value || '<em style="color:#bbb;">No response</em>'}</p>`;
      }
      return `<div style="margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:12px;color:#999;text-transform:uppercase;font-family:Arial,sans-serif;">${q.text}</p>
        ${answerDisplay}
      </div>`;
    }).join('');
    return `<div style="margin-bottom:28px;padding:20px 24px;background:#fafaf8;border-radius:8px;border:1px solid #eee;">
      <p style="margin:0 0 16px;font-size:15px;font-weight:bold;color:#1a1a2e;border-bottom:1px solid #e8e4f0;padding-bottom:12px;">${user.name}</p>
      ${answerHtml}
    </div>`;
  }).join('');

  await sendEmail(supervisor.email, `Team check-ins - week of ${weekLabel}`, `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#1a1a2e;padding:32px 40px;">
          <p style="margin:0;font-size:13px;color:#9b8fc4;font-family:Arial,sans-serif;">WEEKLY CHECK-IN</p>
          <h1 style="margin:8px 0 0;font-size:24px;color:#fff;font-weight:normal;">Your team's check-ins</h1>
          <p style="margin:6px 0 0;font-size:14px;color:#9b8fc4;font-family:Arial,sans-serif;">Week of ${weekLabel}</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          ${reportHtml}
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;">
            <a href="${APP_URL()}/dashboard" style="font-family:Arial,sans-serif;font-size:13px;color:#6b5fa0;">View full dashboard &rarr;</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`);
}

module.exports = { sendCheckinEmail, sendSupervisorDigest };
