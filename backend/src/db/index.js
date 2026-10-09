const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, '../../data.db');
const schemaPath = path.resolve(__dirname, 'schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schemaSql);

// Non-destructive migrations
try {
  db.exec("ALTER TABLE accounts ADD COLUMN signature_html TEXT;");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE batches ADD COLUMN skipped_count INTEGER DEFAULT 0;");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE emails ADD COLUMN thread_id TEXT;");
} catch (e) {}

try {
  db.exec("ALTER TABLE emails ADD COLUMN has_reply INTEGER DEFAULT 0;");
} catch (e) {}

try {
  db.exec("ALTER TABLE emails ADD COLUMN reply_count INTEGER DEFAULT 0;");
} catch (e) {}

try {
  db.exec("ALTER TABLE emails ADD COLUMN last_reply_at DATETIME;");
} catch (e) {}

// Multi-user organization migrations: Add account_id to isolate data per salesperson
try {
  db.exec("ALTER TABLE batches ADD COLUMN account_id INTEGER REFERENCES accounts(id);");
} catch (e) {}

try {
  db.exec("ALTER TABLE emails ADD COLUMN account_id INTEGER REFERENCES accounts(id);");
} catch (e) {}

try {
  db.exec("ALTER TABLE templates ADD COLUMN account_id INTEGER REFERENCES accounts(id);");
} catch (e) {}

try {
  db.exec("ALTER TABLE replies ADD COLUMN account_id INTEGER REFERENCES accounts(id);");
} catch (e) {}

// SMTP and IMAP configuration migrations (supports Google App Password & Custom SMTP)
try { db.exec("ALTER TABLE accounts ADD COLUMN provider TEXT DEFAULT 'google';"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN dispatch_mode TEXT DEFAULT 'smtp';"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN smtp_host TEXT DEFAULT 'smtp.gmail.com';"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN smtp_port INTEGER DEFAULT 465;"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN smtp_secure INTEGER DEFAULT 1;"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN smtp_user TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN smtp_pass TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN imap_host TEXT DEFAULT 'imap.gmail.com';"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN imap_port INTEGER DEFAULT 993;"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN imap_user TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE accounts ADD COLUMN imap_pass TEXT;"); } catch (e) {}

// Backfill existing records with primary connected account so existing data is preserved
try {
  const primaryAccount = db.prepare("SELECT id FROM accounts ORDER BY id ASC LIMIT 1").get();
  if (primaryAccount) {
    db.prepare("UPDATE batches SET account_id = ? WHERE account_id IS NULL").run(primaryAccount.id);
    db.prepare("UPDATE emails SET account_id = ? WHERE account_id IS NULL").run(primaryAccount.id);
    db.prepare("UPDATE replies SET account_id = ? WHERE account_id IS NULL").run(primaryAccount.id);
  }
} catch (e) {}

// Ensure replies table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS replies (
    id TEXT PRIMARY KEY,
    email_id TEXT,
    batch_id TEXT,
    thread_id TEXT NOT NULL,
    gmail_message_id TEXT UNIQUE NOT NULL,
    from_address TEXT NOT NULL,
    from_name TEXT,
    to_address TEXT NOT NULL,
    subject TEXT NOT NULL,
    snippet TEXT,
    body_text TEXT,
    body_html TEXT,
    received_at DATETIME NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_replies_received_at ON replies(received_at);
  CREATE INDEX IF NOT EXISTS idx_replies_email_id ON replies(email_id);
  CREATE INDEX IF NOT EXISTS idx_replies_batch_id ON replies(batch_id);
  CREATE INDEX IF NOT EXISTS idx_replies_from_address ON replies(from_address);
`);

// Seed default templates if empty
const countTemplates = db.prepare('SELECT COUNT(*) as count FROM templates').get();
if (countTemplates.count === 0) {
  const seedTemplates = [
    {
      id: crypto.randomUUID(),
      name: 'Professional Client Follow-up',
      subject: 'Quick follow-up regarding our conversation: {{topic}}',
      body_html: `<p>Hi {{name}},</p>
<p>I hope your week is going well!</p>
<p>I wanted to quickly follow up on our previous discussion regarding <strong>{{topic}}</strong> and see if you had any thoughts or questions.</p>
<p>Let me know if you'd like to jump on a quick 10-minute sync this week to align on the next steps.</p>
<p>Best regards,<br>{{sender_name}}</p>`
    },
    {
      id: crypto.randomUUID(),
      name: 'Product Launch & Feature Announcement',
      subject: '🚀 Introducing {{product_name}}: Designed for {{company}}',
      body_html: `<p>Hi {{name}},</p>
<p>We're thrilled to announce the official release of <strong>{{product_name}}</strong>!</p>
<p>We built this specifically to help teams like <strong>{{company}}</strong> automate their daily workflows and achieve measurable results in record time.</p>
<p>Key highlights include:</p>
<ul>
  <li>⚡ 10x faster execution and real-time tracking</li>
  <li>🔒 Bank-grade security with end-to-end encryption</li>
  <li>📊 Instant analytics and detailed reporting</li>
</ul>
<p>Feel free to reply directly to this email to get exclusive early access or schedule a walkthrough.</p>
<p>Warm regards,<br>{{sender_name}}</p>`
    },
    {
      id: crypto.randomUUID(),
      name: 'Meeting Agenda & Preparation',
      subject: 'Agenda for our upcoming sync: {{meeting_title}}',
      body_html: `<p>Hello {{name}},</p>
<p>Looking forward to our upcoming meeting on <strong>{{date}}</strong>.</p>
<p>Here is our proposed agenda:</p>
<ol>
  <li>Review recent progress and milestones</li>
  <li>Address open blockers or feedback</li>
  <li>Plan action items for next sprint</li>
</ol>
<p>Please review any attached materials beforehand so we can make the most of our time.</p>
<p>See you soon,<br>{{sender_name}}</p>`
    }
  ];

  const insertTemplate = db.prepare(`
    INSERT INTO templates (id, name, subject, body_html, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  const insertMany = db.transaction((templates) => {
    for (const t of templates) {
      insertTemplate.run(t.id, t.name, t.subject, t.body_html);
    }
  });

  insertMany(seedTemplates);
}

module.exports = db;
