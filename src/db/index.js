const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/checkin.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee', -- 'admin', 'supervisor', 'employee'
    supervisor_id TEXT REFERENCES users(id),
    password_hash TEXT, -- only for supervisors/admins
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'scale', -- 'scale', 'text', 'scale_with_comment'
    order_index INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    week_start TEXT NOT NULL, -- ISO date of Monday of that week
    submitted_at TEXT,
    token TEXT UNIQUE NOT NULL, -- magic link token
    token_expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    checkin_id TEXT NOT NULL REFERENCES checkins(id),
    question_id TEXT NOT NULL REFERENCES questions(id),
    scale_value INTEGER, -- 1-5 for scale questions
    text_value TEXT,     -- for text questions
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed default questions if none exist
const questionCount = db.prepare('SELECT COUNT(*) as c FROM questions').get();
if (questionCount.c === 0) {
  const { v4: uuidv4 } = require('uuid');
  const insertQ = db.prepare('INSERT INTO questions (id, text, type, order_index) VALUES (?, ?, ?, ?)');
  const defaults = [
    ['How are you doing personally this week?', 'scale_with_comment', 0],
    ['How are you doing spiritually this week?', 'scale_with_comment', 1],
    ['Where do you feel stuck in your role?', 'text', 2],
    ['What are your top 3 goals for this week?', 'text', 3],
    ['What do you need from your supervisor this week?', 'text', 4],
    ['Is there anything your supervisor should know?', 'text', 5],
  ];
  defaults.forEach(([text, type, order_index]) => insertQ.run(uuidv4(), text, type, order_index));
}

module.exports = db;
