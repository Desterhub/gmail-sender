-- Accounts table: Stores OAuth 2.0 credentials encrypted at rest
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry INTEGER,
  signature_html TEXT,
  connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batches table: Records bulk send job metadata and aggregate counters
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  mode TEXT NOT NULL DEFAULT 'individual', -- 'individual' or 'single'
  total INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'sending', 'completed', 'failed', 'partial'
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Emails table: Comprehensive individual send history and attempt tracking
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  account_id INTEGER,
  batch_id TEXT NOT NULL,
  to_address TEXT NOT NULL,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'sent', 'failed'
  gmail_message_id TEXT,
  thread_id TEXT,
  has_reply INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  last_reply_at DATETIME,
  error_message TEXT,
  sent_at DATETIME,
  attempts INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Attachments table: Metadata and disk paths for attached files
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  mimetype TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
);

-- Templates table: Predefined reusable email templates
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  account_id INTEGER,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Replies table: Tracks incoming replies from campaign recipients
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  account_id INTEGER,
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
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_emails_batch_id ON emails(batch_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_to_address ON emails(to_address);
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at);
CREATE INDEX IF NOT EXISTS idx_attachments_batch_id ON attachments(batch_id);
CREATE INDEX IF NOT EXISTS idx_replies_received_at ON replies(received_at);
CREATE INDEX IF NOT EXISTS idx_replies_email_id ON replies(email_id);
CREATE INDEX IF NOT EXISTS idx_replies_batch_id ON replies(batch_id);
CREATE INDEX IF NOT EXISTS idx_replies_from_address ON replies(from_address);

