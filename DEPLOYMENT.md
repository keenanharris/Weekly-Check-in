# Weekly Check-In — Deployment Guide

This guide walks you through getting your app live on the internet in about 30–45 minutes. You'll need:
- A free **GitHub** account (github.com)
- A free **Railway** account (railway.app)
- A free **Resend** account (resend.com) for sending emails

No technical experience required — just follow each step.

---

## Step 1 — Get the code onto GitHub

GitHub is where your code lives. Railway will pull from it to run your app.

1. Go to **github.com** and sign in (or create a free account).
2. Click the **+** icon in the top right → **New repository**.
3. Name it `weekly-checkin`. Leave everything else as default. Click **Create repository**.
4. On your computer, open the `weekly-checkin` folder I gave you.
5. Open **Terminal** (Mac) or **Command Prompt** (Windows) in that folder.
6. Run these commands one at a time:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/weekly-checkin.git
git push -u origin main
```

(Replace `YOUR_USERNAME` with your actual GitHub username — you can find it on your GitHub profile.)

---

## Step 2 — Set up email sending (Resend)

Resend is the service that sends emails on your behalf. It's free for up to 3,000 emails/month — more than enough for 50 staff.

1. Go to **resend.com** and create a free account.
2. You'll need to **verify your domain** (the email domain you want to send from — e.g. `yourdomain.com`). Resend walks you through this — it involves adding a couple of DNS records to your domain. Your website host (GoDaddy, Squarespace, etc.) is where you'd do this. It takes about 10 minutes.
3. Once your domain is verified, go to **API Keys** in the Resend dashboard.
4. Click **Create API Key**. Give it a name like "Weekly Check-In". Copy the key — you'll need it in Step 3.

> **No custom domain?** You can use Resend's shared domain to get started (`onboarding@resend.dev`) — just update `EMAIL_FROM` in your environment variables below.

---

## Step 3 — Deploy to Railway

Railway hosts your app and keeps it running 24/7.

1. Go to **railway.app** and sign in with your GitHub account.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `weekly-checkin` repository.
4. Railway will start building the app. Wait for it to finish (about 2 minutes).
5. Once deployed, click on your project → **Variables** tab.
6. Add the following environment variables (click **+ New Variable** for each):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | Your Resend API key from Step 2 |
| `EMAIL_FROM` | `checkins@yourdomain.com` (your verified domain) |
| `JWT_SECRET` | Any long random string (e.g. `xK9mQ2pL7vR4nW1aE6sY3cF8`) |
| `TZ` | Your timezone (e.g. `America/Chicago`) |
| `CHECKIN_CRON` | `0 16 * * 5` (Friday 4pm — change the 16 for different hour) |

7. Click **Deploy** to restart the app with your new variables.
8. Go to **Settings** → **Domains** → click **Generate Domain**. This gives you a URL like `weekly-checkin-production.up.railway.app`.
9. Add one more variable: `APP_URL` = your Railway URL (e.g. `https://weekly-checkin-production.up.railway.app`)
10. Deploy again.

---

## Step 4 — First-time setup

1. Open your Railway URL in a browser.
2. You'll be redirected to `/setup`. Fill in your name, email, and a password. This creates your admin account.
3. You're in! 

---

## Step 5 — Add your staff

1. Go to **Staff** in the navigation.
2. First, add your supervisors:
   - Click **Add staff member**
   - Set their role to **Supervisor**
   - Give them a password (they'll use this to log in and see their team's responses)
3. Then add employees:
   - Set role to **Employee**
   - Assign their supervisor from the dropdown
   - Employees don't need a password — they access everything via the magic link in their email

---

## Step 6 — Test it

1. Go to **Staff** → click **Send check-ins now (manual)**.
2. This sends real emails to all employees immediately.
3. Check your own inbox (if you added yourself as an employee) and make sure the email arrives and the link works.

From now on, emails go out automatically every **Friday at 4pm** (your local time). You don't need to do anything.

---

## Managing the app going forward

| Task | Where |
|---|---|
| Add/remove staff | Staff page |
| Change questions | Questions page |
| See this week's responses | Dashboard |
| View an employee's history | Dashboard → click their name |
| Send check-ins early | Staff → "Send check-ins now" |
| Change send time | Railway → Variables → change `CHECKIN_CRON` |

---

## Cron time reference

The `CHECKIN_CRON` variable uses standard cron format: `minute hour * * day`

| Time | Cron value |
|---|---|
| Friday 4pm | `0 16 * * 5` |
| Friday 3pm | `0 15 * * 5` |
| Saturday 6pm | `0 18 * * 6` |
| Sunday 7pm | `0 19 * * 0` |

---

## Costs

| Service | Cost |
|---|---|
| Railway | ~$5/month (Hobby plan) |
| Resend | Free up to 3,000 emails/month |
| GitHub | Free |
| **Total** | **~$5/month** |

That's it. If you run into any trouble, the error messages in Railway's logs (Deployments → View Logs) are usually very descriptive.
