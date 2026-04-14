function layout(title, body, user = null) {
  const nav = user ? `
    <nav>
      <div class="nav-brand">Weekly Check-In</div>
      <div class="nav-links">
        ${user.role === 'admin' || user.role === 'supervisor' ? `<a href="/dashboard">Dashboard</a>` : ''}
        ${user.role === 'admin' ? `<a href="/admin/staff">Staff</a><a href="/admin/questions">Questions</a>` : ''}
        <span class="nav-user">${user.name}</span>
        <a href="/logout" class="nav-logout">Sign out</a>
      </div>
    </nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Weekly Check-In</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --ink: #1a1a2e;
      --ink2: #3d3b52;
      --muted: #888;
      --purple: #6b5fa0;
      --purple-light: #f0eef8;
      --purple-mid: #9b8fc4;
      --bg: #f5f4f0;
      --white: #fff;
      --border: #e8e4e0;
      --success: #2d7a4f;
      --danger: #c0392b;
    }
    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--ink); min-height: 100vh; font-size: 15px; }
    h1, h2, h3 { font-family: 'Lora', serif; font-weight: 400; }
    a { color: var(--purple); text-decoration: none; }
    a:hover { text-decoration: underline; }

    nav {
      background: var(--ink);
      padding: 0 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      position: sticky; top: 0; z-index: 100;
    }
    .nav-brand { font-family: 'Lora', serif; color: #fff; font-size: 17px; letter-spacing: 0.01em; }
    .nav-links { display: flex; align-items: center; gap: 24px; }
    .nav-links a { color: var(--purple-mid); font-size: 14px; }
    .nav-links a:hover { color: #fff; text-decoration: none; }
    .nav-user { font-size: 13px; color: #666; }
    .nav-logout { font-size: 13px !important; color: #666 !important; }

    .container { max-width: 760px; margin: 0 auto; padding: 48px 24px; }
    .container-wide { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }

    .card {
      background: var(--white);
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 32px;
      margin-bottom: 20px;
    }
    .card-sm { padding: 20px 24px; }

    label { display: block; font-size: 13px; letter-spacing: 0.06em; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; }
    input[type=text], input[type=email], input[type=password], select, textarea {
      width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 7px;
      font-size: 15px; font-family: 'DM Sans', sans-serif; background: var(--white); color: var(--ink);
      transition: border-color 0.15s;
    }
    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--purple-mid); }
    textarea { resize: vertical; min-height: 80px; }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 24px; border-radius: 7px; font-size: 14px; font-family: 'DM Sans', sans-serif;
      cursor: pointer; border: none; font-weight: 500; transition: opacity 0.15s, transform 0.1s;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: var(--ink); color: #fff; }
    .btn-primary:hover { opacity: 0.85; }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--ink2); }
    .btn-outline:hover { background: var(--bg); }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-sm { padding: 6px 14px; font-size: 13px; }

    .scale-group { display: flex; gap: 10px; flex-wrap: wrap; margin: 8px 0; }
    .scale-opt input { display: none; }
    .scale-opt label {
      display: flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--border);
      font-size: 16px; font-weight: 500; cursor: pointer; color: var(--ink2);
      transition: all 0.15s; text-transform: none; letter-spacing: 0;
    }
    .scale-opt input:checked + label { background: var(--ink); border-color: var(--ink); color: #fff; }
    .scale-opt label:hover { border-color: var(--purple); color: var(--purple); }

    .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-green { background: #e8f5ee; color: #2d7a4f; }
    .badge-amber { background: #fef3e2; color: #9a6200; }
    .badge-gray { background: #f0ede8; color: #666; }
    .badge-purple { background: var(--purple-light); color: var(--purple); }

    .alert { padding: 12px 16px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; }
    .alert-error { background: #fdecea; color: var(--danger); border: 1px solid #f5c6c3; }
    .alert-success { background: #e8f5ee; color: var(--success); border: 1px solid #b8dfc8; }

    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 12px; letter-spacing: 0.08em; color: var(--muted); text-transform: uppercase; padding: 10px 14px; border-bottom: 1px solid var(--border); font-weight: 500; }
    td { padding: 12px 14px; border-bottom: 1px solid #f5f3ef; font-size: 14px; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fafaf8; }

    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .stat-card { background: var(--white); border-radius: 10px; border: 1px solid var(--border); padding: 16px 20px; }
    .stat-label { font-size: 12px; color: var(--muted); letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 6px; }
    .stat-value { font-size: 28px; font-family: 'Lora', serif; color: var(--ink); }

    .page-title { font-size: 28px; color: var(--ink); margin-bottom: 6px; }
    .page-sub { font-size: 14px; color: var(--muted); margin-bottom: 32px; }

    .scale-display { display: flex; gap: 4px; }
    .scale-dot { width: 10px; height: 10px; border-radius: 50%; }
    .scale-dot-filled { background: var(--purple); }
    .scale-dot-empty { background: #e0dce8; }

    .form-group { margin-bottom: 20px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } .nav-links { gap: 12px; } }

    .empty-state { text-align: center; padding: 48px 24px; color: var(--muted); }
    .empty-state h3 { font-size: 18px; margin-bottom: 8px; color: var(--ink2); }

    .progress-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--purple); border-radius: 3px; transition: width 0.3s; }
  </style>
</head>
<body>
  ${nav}
  ${body}
</body>
</html>`;
}

module.exports = { layout };
