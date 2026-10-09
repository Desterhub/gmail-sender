const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const queueManager = require('../services/queue');
const { optionalAuthMiddleware } = require('../services/session');

/**
 * GET /api/history
 * Returns paginated email send logs with comprehensive filtering
 */
router.get('/api/history', optionalAuthMiddleware, (req, res) => {
  try {
    const {
      search = '',
      status = 'all',
      batchId = '',
      startDate = '',
      endDate = '',
      page = 1,
      limit = 25
    } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10)));

    let whereClauses = [];
    let params = [];

    if (search.trim()) {
      whereClauses.push('(e.to_address LIKE ? OR e.subject LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (status && status !== 'all') {
      whereClauses.push('e.status = ?');
      params.push(status);
    }

    if (batchId) {
      whereClauses.push('e.batch_id = ?');
      params.push(batchId);
    }

    if (req.user) {
      whereClauses.push('(e.account_id = ? OR e.account_id IS NULL)');
      params.push(req.user.id);
    }

    if (startDate) {
      whereClauses.push('datetime(e.sent_at) >= datetime(?)');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      whereClauses.push('datetime(e.sent_at) <= datetime(?)');
      params.push(`${endDate} 23:59:59`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM emails e
      ${whereSql}
    `;
    const countResult = db.prepare(countQuery).get(...params);
    const totalRecords = countResult ? countResult.total : 0;

    // Items query with attachment count and reply metrics
    const itemsQuery = `
      SELECT 
        e.id,
        e.batch_id,
        e.to_address,
        e.cc,
        e.bcc,
        e.subject,
        e.status,
        e.gmail_message_id,
        e.thread_id,
        coalesce(e.has_reply, 0) as has_reply,
        coalesce(e.reply_count, 0) as reply_count,
        e.last_reply_at,
        e.error_message,
        e.sent_at,
        e.attempts,
        (SELECT COUNT(*) FROM attachments a WHERE a.batch_id = e.batch_id) AS attachment_count
      FROM emails e
      ${whereSql}
      ORDER BY coalesce(e.sent_at, datetime('now')) DESC, e.rowid DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(itemsQuery).all(...params, pageLimit, offset);

    res.json({
      emails: items,
      pagination: {
        total: totalRecords,
        page: parseInt(page, 10),
        limit: pageLimit,
        totalPages: Math.ceil(totalRecords / pageLimit)
      }
    });
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/history/:id
 * Detailed view for drawer
 */
router.get('/api/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const email = db.prepare(`
      SELECT 
        e.*,
        b.mode as batch_mode,
        b.created_at as batch_created_at
      FROM emails e
      LEFT JOIN batches b ON e.batch_id = b.id
      WHERE e.id = ?
    `).get(id);

    if (!email) {
      return res.status(404).json({ error: 'Email record not found.' });
    }

    // Attachments for this batch
    const attachments = db.prepare(`
      SELECT id, filename, mimetype, size
      FROM attachments
      WHERE batch_id = ?
    `).all(email.batch_id);

    // Inbound replies for this email
    const replies = db.prepare(`
      SELECT * FROM replies
      WHERE email_id = ? OR (thread_id IS NOT NULL AND thread_id = ?)
      ORDER BY received_at DESC
    `).all(email.id, email.thread_id || '');

    res.json({
      ...email,
      attachments,
      replies
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/history/:id/resend
 * Resends an individual email
 */
router.post('/api/history/:id/resend', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await queueManager.resendEmail(id);
    res.json({
      success: true,
      message: 'Email resent successfully.',
      gmail_message_id: result.messageId
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to resend email.' });
  }
});

/**
 * GET /api/history/export/csv
 * Exports emails to CSV format
 */
router.get('/api/export/csv', optionalAuthMiddleware, (req, res) => {
  try {
    const { search = '', status = 'all', batchId = '', startDate = '', endDate = '' } = req.query;

    let whereClauses = [];
    let params = [];

    if (req.user) {
      whereClauses.push('(e.account_id = ? OR e.account_id IS NULL)');
      params.push(req.user.id);
    }

    if (search.trim()) {
      whereClauses.push('(e.to_address LIKE ? OR e.subject LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (status && status !== 'all') {
      whereClauses.push('e.status = ?');
      params.push(status);
    }

    if (batchId) {
      whereClauses.push('e.batch_id = ?');
      params.push(batchId);
    }

    if (startDate) {
      whereClauses.push('datetime(e.sent_at) >= datetime(?)');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      whereClauses.push('datetime(e.sent_at) <= datetime(?)');
      params.push(`${endDate} 23:59:59`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        e.id,
        e.sent_at,
        e.to_address,
        e.subject,
        e.status,
        e.attempts,
        coalesce(e.gmail_message_id, '') as gmail_message_id,
        coalesce(e.error_message, '') as error_message,
        e.batch_id
      FROM emails e
      ${whereSql}
      ORDER BY coalesce(e.sent_at, datetime('now')) DESC
    `;

    const records = db.prepare(query).all(...params);

    // Escape CSV string
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = ['ID', 'Sent At', 'Recipient', 'Subject', 'Status', 'Attempts', 'Gmail Message ID', 'Error Message', 'Batch ID'];
    const csvRows = [headers.join(',')];

    for (const r of records) {
      csvRows.push([
        escapeCsv(r.id),
        escapeCsv(r.sent_at),
        escapeCsv(r.to_address),
        escapeCsv(r.subject),
        escapeCsv(r.status),
        r.attempts,
        escapeCsv(r.gmail_message_id),
        escapeCsv(r.error_message),
        escapeCsv(r.batch_id)
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gmail-send-history-${Date.now()}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/attachments/:id/download
 * Downloads an uploaded attachment
 */
router.get('/api/attachments/:id/download', (req, res) => {
  try {
    const { id } = req.params;
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(id);
    if (!attachment || !fs.existsSync(attachment.filepath)) {
      return res.status(404).json({ error: 'Attachment file not found.' });
    }

    res.download(attachment.filepath, attachment.filename);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
