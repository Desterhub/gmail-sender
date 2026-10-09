const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const csv = require('csv-parser');
const db = require('../db');
const queueManager = require('../services/queue');
const { authMiddleware, optionalAuthMiddleware } = require('../services/session');
const { google } = require('googleapis');
const { getAuthenticatedClient } = require('../services/gmail');

// Multer storage setup
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB per file max
  }
});

// Rate limiter for /api/send: max 60 batch requests per 15 minutes
const sendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many batch requests. Please wait a few minutes before trying again.' }
});

/**
 * Helper to parse email recipients string (comma, newline, semicolon separated)
 */
function parseRecipientString(str) {
  if (!str) return [];
  return str
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Validates email format with basic RFC regex
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Parses uploaded CSV file to extract recipients and rows metadata
 */
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => rows.push(data))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

/**
 * POST /api/recipients/check-history
 * Checks duplicate send history for a list of emails against the emails table
 */
router.post('/api/recipients/check-history', (req, res) => {
  try {
    const { emails = [] } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.json({ results: [] });
    }

    // Deduplicate and normalize input
    const normalizedMap = new Map();
    emails.forEach((raw) => {
      if (raw && typeof raw === 'string') {
        const trimmed = raw.trim().toLowerCase();
        if (trimmed) normalizedMap.set(trimmed, raw);
      }
    });

    const uniqueNormalized = Array.from(normalizedMap.keys());
    const CHUNK_SIZE = 500;
    const historyMap = new Map(); // email -> { lastSentDate, count }

    for (let i = 0; i < uniqueNormalized.length; i += CHUNK_SIZE) {
      const chunk = uniqueNormalized.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT 
          LOWER(TRIM(to_address)) as email,
          MAX(sent_at) as last_sent,
          COUNT(*) as send_count
        FROM emails
        WHERE status = 'sent' AND LOWER(TRIM(to_address)) IN (${placeholders})
        GROUP BY LOWER(TRIM(to_address))
      `).all(...chunk);

      for (const r of rows) {
        historyMap.set(r.email, {
          lastSentDate: r.last_sent,
          sendCount: r.send_count
        });
      }
    }

    const now = Date.now();
    const results = emails.map((raw) => {
      const norm = (raw || '').trim().toLowerCase();
      const match = historyMap.get(norm);
      let daysAgo = null;
      if (match && match.lastSentDate) {
        const str = String(match.lastSentDate).trim();
        const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(str) && !str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)
          ? str.replace(' ', 'T') + 'Z'
          : str;
        const sentTime = new Date(iso).getTime();
        if (!isNaN(sentTime)) {
          daysAgo = Math.max(0, Math.floor((now - sentTime) / (1000 * 60 * 60 * 24)));
        }
      }

      return {
        email: raw,
        normalized: norm,
        hasBeenEmailed: !!match,
        lastSentDate: match ? match.lastSentDate : null,
        sendCount: match ? match.sendCount : 0,
        daysAgo
      };
    });

    res.json({ results });
  } catch (err) {
    console.error('Error checking recipient history:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/recipients/suggest
 * Provides rapid autofill suggestions for recipient emails based on:
 * 1. Past sent emails in SQLite
 * 2. Inbound replies in SQLite (with names)
 * 3. Recent Gmail interactions
 */
router.get('/api/recipients/suggest', optionalAuthMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const accountId = req.user ? req.user.id : null;
    const lowerQ = `%${q.toLowerCase()}%`;
    const suggestionMap = new Map(); // normalized email -> object

    // Helper to calculate relative time
    const formatRelativeTime = (dateStr) => {
      if (!dateStr) return '';
      try {
        const clean = String(dateStr).trim().replace(' ', 'T');
        const iso = clean.endsWith('Z') ? clean : clean + 'Z';
        const date = new Date(iso);
        const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 30) return `${diffDays}d ago`;
        return `${Math.floor(diffDays / 30)}mo ago`;
      } catch (e) {
        return '';
      }
    };

    // 1. Search past sent emails
    const sentRows = db.prepare(`
      SELECT 
        LOWER(TRIM(to_address)) as email,
        MAX(sent_at) as last_contacted,
        COUNT(*) as send_count
      FROM emails
      WHERE status = 'sent' 
        AND LOWER(to_address) LIKE ?
        ${accountId ? 'AND (account_id = ? OR account_id IS NULL)' : ''}
      GROUP BY LOWER(TRIM(to_address))
      ORDER BY last_contacted DESC
      LIMIT 10
    `).all(...(accountId ? [lowerQ, accountId] : [lowerQ]));

    for (const r of sentRows) {
      const relTime = formatRelativeTime(r.last_contacted);
      suggestionMap.set(r.email, {
        email: r.email,
        name: '',
        source: 'sent',
        lastContacted: r.last_contacted,
        sendCount: r.send_count,
        label: relTime ? `Sent ${relTime}` : 'Sent previously'
      });
    }

    // 2. Search replies (includes customer sender names)
    const replyRows = db.prepare(`
      SELECT 
        LOWER(TRIM(from_address)) as email,
        from_name,
        MAX(received_at) as last_received,
        COUNT(*) as reply_count
      FROM replies
      WHERE (LOWER(from_address) LIKE ? OR LOWER(from_name) LIKE ?)
        ${accountId ? 'AND (account_id = ? OR account_id IS NULL)' : ''}
      GROUP BY LOWER(TRIM(from_address))
      ORDER BY last_received DESC
      LIMIT 10
    `).all(...(accountId ? [lowerQ, lowerQ, accountId] : [lowerQ, lowerQ]));

    for (const r of replyRows) {
      const relTime = formatRelativeTime(r.last_received);
      const existing = suggestionMap.get(r.email);
      if (existing) {
        if (!existing.name && r.from_name) existing.name = r.from_name;
        existing.source = 'both';
        existing.label = `${existing.name ? existing.name + ' · ' : ''}Sent & Replied`;
      } else {
        suggestionMap.set(r.email, {
          email: r.email,
          name: r.from_name || '',
          source: 'reply',
          lastContacted: r.last_received,
          replyCount: r.reply_count,
          label: r.from_name ? `${r.from_name} · Replied` : (relTime ? `Replied ${relTime}` : 'Replied')
        });
      }
    }

    // 3. Optional live Gmail search if client is active
    if (accountId) {
      try {
        const auth = await getAuthenticatedClient(accountId);
        if (auth) {
          const gmail = google.gmail({ version: 'v1', auth });
          const gRes = await gmail.users.messages.list({
            userId: 'me',
            q: `${q}*`,
            maxResults: 5
          });

          if (gRes.data.messages && gRes.data.messages.length > 0) {
            const headerPromises = gRes.data.messages.slice(0, 5).map(m =>
              gmail.users.messages.get({
                userId: 'me',
                id: m.id,
                format: 'metadata',
                metadataHeaders: ['To', 'From']
              }).catch(() => null)
            );
            const msgDetails = await Promise.all(headerPromises);
            for (const detail of msgDetails) {
              if (!detail || !detail.data || !detail.data.payload) continue;
              const headers = detail.data.payload.headers || [];
              const toH = headers.find(h => h.name.toLowerCase() === 'to')?.value || '';
              const fromH = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
              
              [toH, fromH].forEach(rawH => {
                if (!rawH) return;
                const match = rawH.match(/(?:"?([^"]*)"?\s)?(?:<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?)/);
                if (match) {
                  const name = (match[1] || '').trim();
                  const email = (match[2] || '').trim().toLowerCase();
                  if (email && email.includes(q.toLowerCase()) && !suggestionMap.has(email)) {
                    suggestionMap.set(email, {
                      email,
                      name,
                      source: 'gmail',
                      lastContacted: null,
                      label: name ? `${name} · Gmail contact` : 'Gmail contact'
                    });
                  }
                }
              });
            }
          }
        }
      } catch (gErr) {
        // Non-blocking fallback
      }
    }

    // Sort: exact match, then prefix matches, then recent interactions
    const queryNorm = q.toLowerCase();
    const suggestions = Array.from(suggestionMap.values()).sort((a, b) => {
      const aStarts = a.email.startsWith(queryNorm);
      const bStarts = b.email.startsWith(queryNorm);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return (b.sendCount || 0) - (a.sendCount || 0);
    }).slice(0, 8);

    res.json({ suggestions });
  } catch (err) {
    console.error('Suggest recipient error:', err);
    res.status(500).json({ error: err.message, suggestions: [] });
  }
});

/**
 * POST /api/send
 * Initiates a bulk sending batch
 */
router.post(
  '/api/send',
  optionalAuthMiddleware,
  sendLimiter,
  upload.fields([
    { name: 'attachments', maxCount: 20 },
    { name: 'csvFile', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        subject,
        bodyHtml,
        bodyText,
        recipients: rawRecipients,
        cc: rawCc,
        bcc: rawBcc,
        mode = 'individual', // 'individual' or 'single'
        throttle = 20, // emails per minute
        appendSignature = true,
        skippedCount = 0
      } = req.body;

      if (!subject || !subject.trim()) {
        return res.status(400).json({ error: 'Subject is required.' });
      }

      if (!bodyHtml || !bodyHtml.trim()) {
        return res.status(400).json({ error: 'Email body is required.' });
      }

      const uploadedAttachments = req.files && req.files.attachments ? req.files.attachments : [];
      const uploadedCsv = req.files && req.files.csvFile && req.files.csvFile[0] ? req.files.csvFile[0] : null;

      // Calculate total attachment size
      const totalAttachmentSize = uploadedAttachments.reduce((sum, f) => sum + f.size, 0);
      if (totalAttachmentSize > 25 * 1024 * 1024) {
        return res.status(400).json({ error: 'Total attachment size exceeds the 25MB Gmail limit.' });
      }

      // Handle Signature Append
      const shouldAppendSignature = appendSignature === true || appendSignature === 'true';
      let effectiveBodyHtml = bodyHtml;
      
      if (shouldAppendSignature) {
        const account = req.user || db.prepare('SELECT signature_html FROM accounts ORDER BY connected_at DESC LIMIT 1').get();
        if (account && account.signature_html && account.signature_html.trim()) {
          effectiveBodyHtml = `${bodyHtml}<br><br><div style="border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 12px;">${account.signature_html}</div>`;
        }
      }

      // Build recipients list
      let recipientList = []; // array of { email, vars: {} }

      if (uploadedCsv) {
        // Parse CSV
        const rows = await parseCsvFile(uploadedCsv.path);
        for (const row of rows) {
          // Detect email key (case-insensitive "email" or fallback)
          const keys = Object.keys(row);
          const emailKey = keys.find((k) => k.toLowerCase().trim() === 'email') ||
                           keys.find((k) => /email|e-mail|recipient|to/i.test(k)) || 
                           keys[0];
          const emailValue = row[emailKey] ? String(row[emailKey]).trim() : '';

          if (emailValue && isValidEmail(emailValue)) {
            recipientList.push({
              email: emailValue,
              vars: row
            });
          }
        }
      }

      // Merge with any manual/structured raw recipients
      if (rawRecipients) {
        let parsed = [];
        try {
          const maybeJson = JSON.parse(rawRecipients);
          if (Array.isArray(maybeJson)) {
            parsed = maybeJson.map((item) => {
              if (typeof item === 'string') {
                return { email: item.trim(), vars: {} };
              }
              return { 
                email: (item.email || '').trim(), 
                vars: item.vars || {} 
              };
            });
          }
        } catch (e) {
          // Comma / newline / semicolon separated
          const strList = parseRecipientString(rawRecipients);
          parsed = strList.map((em) => ({ email: em, vars: {} }));
        }

        for (const p of parsed) {
          if (p.email && isValidEmail(p.email)) {
            const existingIdx = recipientList.findIndex((r) => r.email.toLowerCase() === p.email.toLowerCase());
            if (existingIdx >= 0) {
              // Merge vars if already present
              recipientList[existingIdx].vars = { ...recipientList[existingIdx].vars, ...p.vars };
            } else {
              recipientList.push(p);
            }
          }
        }
      }

      if (recipientList.length === 0) {
        return res.status(400).json({ error: 'No valid recipient email addresses provided.' });
      }

      const batchId = crypto.randomUUID();
      const safeThrottle = parseInt(throttle, 10) || 20;
      const safeSkipped = parseInt(skippedCount, 10) || 0;

      // Start DB transaction
      const createBatch = db.transaction(() => {
        // Insert Batch
        const total = mode === 'single' ? 1 : recipientList.length;

        const accountId = req.user ? req.user.id : null;

        db.prepare(`
          INSERT INTO batches (id, account_id, subject, body_html, body_text, mode, total, sent_count, failed_count, skipped_count, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'queued', datetime('now'))
        `).run(batchId, accountId, subject, effectiveBodyHtml, bodyText || '', mode, total, safeSkipped);

        // Save attachments
        const insertAttachment = db.prepare(`
          INSERT INTO attachments (id, batch_id, filename, filepath, mimetype, size)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const file of uploadedAttachments) {
          insertAttachment.run(
            crypto.randomUUID(),
            batchId,
            file.originalname,
            file.path,
            file.mimetype,
            file.size
          );
        }

        // Insert Emails
        const insertEmail = db.prepare(`
          INSERT INTO emails (id, account_id, batch_id, to_address, cc, bcc, subject, body_html, status, attempts)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0)
        `);

        if (mode === 'single') {
          // One email with all recipients combined in To
          const allTo = recipientList.map((r) => r.email).join(', ');
          insertEmail.run(
            crypto.randomUUID(),
            accountId,
            batchId,
            allTo,
            rawCc || null,
            rawBcc || null,
            subject,
            effectiveBodyHtml
          );
        } else {
          // Individual sends with variable substitution
          for (const recipient of recipientList) {
            const personalizedSubject = queueManager.interpolate(subject, recipient.vars, recipient.email);
            const personalizedBody = queueManager.interpolate(effectiveBodyHtml, recipient.vars, recipient.email);

            insertEmail.run(
              crypto.randomUUID(),
              accountId,
              batchId,
              recipient.email,
              rawCc || null,
              rawBcc || null,
              personalizedSubject,
              personalizedBody
            );
          }
        }
      });

      createBatch();

      // Trigger background sending queue
      setImmediate(() => {
        queueManager.processBatch(batchId, safeThrottle);
      });

      res.status(201).json({
        success: true,
        batch_id: batchId,
        total: mode === 'single' ? 1 : recipientList.length,
        status: 'queued',
        message: 'Batch queued successfully for background dispatch.'
      });
    } catch (err) {
      console.error('Error queuing batch:', err);
      res.status(500).json({ error: err.message || 'Internal server error while creating batch.' });
    }
  }
);

/**
 * GET /api/batch/:id/stream
 * Server-Sent Events (SSE) live progress stream
 */
router.get('/api/batch/:id/stream', (req, res) => {
  const { id: batchId } = req.params;

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  queueManager.addSSEConnection(batchId, res);
});

/**
 * POST /api/batch/:id/retry
 * Resumes and retries all pending (queued or failed) emails in a given batch
 */
router.post('/api/batch/:id/retry', async (req, res) => {
  const { id: batchId } = req.params;
  const { throttle = 20 } = req.body;

  try {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Find all emails that have not yet been sent successfully
    const pendingEmails = db.prepare(`
      SELECT id, to_address, status FROM emails 
      WHERE batch_id = ? AND status != 'sent'
    `).all(batchId);

    if (pendingEmails.length === 0) {
      return res.status(400).json({ message: 'All emails in this batch have already been sent successfully.' });
    }

    // Reset non-sent emails to queued, clear error_message, reset attempts to 0
    db.prepare(`
      UPDATE emails 
      SET status = 'queued', error_message = NULL, attempts = 0
      WHERE batch_id = ? AND status != 'sent'
    `).run(batchId);

    // Update batch status and reset failed_count for accurate progress tracking
    db.prepare(`
      UPDATE batches 
      SET failed_count = 0, status = 'sending' 
      WHERE id = ?
    `).run(batchId);

    // Clear any stale active worker flag to allow immediate dispatch
    queueManager.activeWorkers.delete(batchId);

    setImmediate(() => {
      queueManager.processBatch(batchId, throttle);
    });

    res.json({
      success: true,
      message: `Resuming dispatch for ${pendingEmails.length} pending email(s).`,
      batch_id: batchId,
      resumed_count: pendingEmails.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
