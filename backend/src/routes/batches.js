const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuthMiddleware } = require('../services/session');

/**
 * GET /api/dashboard/stats
 * Aggregates statistics for the dashboard cards, isolated by user account
 */
router.get('/api/dashboard/stats', optionalAuthMiddleware, (req, res) => {
  try {
    const accountFilter = req.user ? 'AND (account_id = ? OR account_id IS NULL)' : '';
    const accountParam = req.user ? [req.user.id] : [];

    // Total sent today
    const todayResult = db.prepare(`
      SELECT COUNT(*) as count 
      FROM emails 
      WHERE status = 'sent' AND date(sent_at) = date('now') ${accountFilter}
    `).get(...accountParam);

    // Total sent this week (last 7 days)
    const weekResult = db.prepare(`
      SELECT COUNT(*) as count 
      FROM emails 
      WHERE status = 'sent' AND datetime(sent_at) >= datetime('now', '-7 days') ${accountFilter}
    `).get(...accountParam);

    // Total sent this month (last 30 days)
    const monthResult = db.prepare(`
      SELECT COUNT(*) as count 
      FROM emails 
      WHERE status = 'sent' AND datetime(sent_at) >= datetime('now', '-30 days') ${accountFilter}
    `).get(...accountParam);

    // Overall Success rate
    const totalAttempted = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM emails
      WHERE status IN ('sent', 'failed') ${accountFilter}
    `).get(...accountParam);

    const successRate = totalAttempted.total > 0
      ? Math.round(((totalAttempted.sent || 0) / totalAttempted.total) * 100)
      : 100;

    // Failed emails needing attention
    const failedCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM emails 
      WHERE status = 'failed' ${accountFilter}
    `).get(...accountParam);

    // Inbound replies stats
    const replyAccountFilter = req.user ? 'WHERE (account_id = ? OR to_address = ?)' : '';
    const replyParams = req.user ? [req.user.id, req.user.email] : [];
    const unreadReplyFilter = req.user 
      ? 'WHERE is_read = 0 AND (account_id = ? OR to_address = ?)' 
      : 'WHERE is_read = 0';

    const repliesResult = db.prepare(`SELECT COUNT(*) as count FROM replies ${replyAccountFilter}`).get(...replyParams);
    const unreadRepliesResult = db.prepare(`SELECT COUNT(*) as count FROM replies ${unreadReplyFilter}`).get(...replyParams);

    // Recent activity (latest 8 emails) with reply indicators
    const recentActivity = db.prepare(`
      SELECT 
        e.id, 
        e.to_address, 
        e.subject, 
        e.status, 
        e.sent_at, 
        e.error_message,
        e.batch_id,
        coalesce(e.has_reply, 0) as has_reply,
        coalesce(e.reply_count, 0) as reply_count
      FROM emails e
      WHERE 1=1 ${accountFilter}
      ORDER BY coalesce(e.sent_at, datetime('now')) DESC, e.rowid DESC
      LIMIT 8
    `).all(...accountParam);

    res.json({
      today: todayResult ? todayResult.count : 0,
      week: weekResult ? weekResult.count : 0,
      month: monthResult ? monthResult.count : 0,
      successRate,
      failed: failedCount ? failedCount.count : 0,
      replies: repliesResult ? repliesResult.count : 0,
      unreadReplies: unreadRepliesResult ? unreadRepliesResult.count : 0,
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/batches
 * Returns list of batches for the authenticated salesperson
 */
router.get('/api/batches', optionalAuthMiddleware, (req, res) => {
  try {
    const accountFilter = req.user ? 'WHERE (b.account_id = ? OR b.account_id IS NULL)' : '';
    const params = req.user ? [req.user.id] : [];

    const batches = db.prepare(`
      SELECT 
        b.*,
        (SELECT COUNT(*) FROM attachments a WHERE a.batch_id = b.id) as attachment_count,
        (SELECT COUNT(*) FROM emails e WHERE e.batch_id = b.id AND e.status = 'queued') as queued_count
      FROM batches b
      ${accountFilter}
      ORDER BY datetime(b.created_at) DESC
    `).all(...params);

    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/batches/:id
 * Returns single batch details and all its emails
 */
router.get('/api/batches/:id', optionalAuthMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found.' });
    }

    const queuedResult = db.prepare("SELECT COUNT(*) as count FROM emails WHERE batch_id = ? AND status = 'queued'").get(id);

    const emails = db.prepare(`
      SELECT id, to_address, cc, bcc, subject, status, sent_at, attempts, error_message, gmail_message_id
      FROM emails
      WHERE batch_id = ?
      ORDER BY rowid ASC
    `).all(id);

    const attachments = db.prepare('SELECT * FROM attachments WHERE batch_id = ?').all(id);

    res.json({
      ...batch,
      queued_count: queuedResult ? queuedResult.count : 0,
      emails,
      attachments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
