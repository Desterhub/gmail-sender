const express = require('express');
const router = express.Router();
const db = require('../db');
const { syncReplies } = require('../services/replies');
const { optionalAuthMiddleware } = require('../services/session');

/**
 * GET /api/replies
 * Returns paginated list of inbound replies with unread count and filters, isolated by salesperson
 */
router.get('/api/replies', optionalAuthMiddleware, (req, res) => {
  try {
    const {
      status = 'all', // 'all', 'unread', 'read'
      type = 'all',   // 'all', 'human', 'auto', 'bounce'
      search = '',
      page = 1,
      limit = 25
    } = req.query;

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit, 10)));

    let whereClauses = [];
    let params = [];

    if (req.user) {
      whereClauses.push('(r.account_id = ? OR r.to_address = ? OR r.account_id IS NULL)');
      params.push(req.user.id, req.user.email);
    }

    if (status === 'unread') {
      whereClauses.push('r.is_read = 0');
    } else if (status === 'read') {
      whereClauses.push('r.is_read = 1');
    }

    if (type === 'auto') {
      whereClauses.push("(lower(r.subject) LIKE '%automatic reply%' OR lower(r.subject) LIKE '%auto:%' OR lower(r.subject) LIKE '%out of office%')");
    } else if (type === 'bounce') {
      whereClauses.push("(lower(r.subject) LIKE '%undeliverable%' OR lower(r.subject) LIKE '%delivery status%' OR lower(r.subject) LIKE '%failure%')");
    } else if (type === 'human') {
      whereClauses.push("(lower(r.subject) NOT LIKE '%automatic reply%' AND lower(r.subject) NOT LIKE '%auto:%' AND lower(r.subject) NOT LIKE '%out of office%' AND lower(r.subject) NOT LIKE '%undeliverable%' AND lower(r.subject) NOT LIKE '%delivery status%' AND lower(r.subject) NOT LIKE '%failure%')");
    }

    if (search && search.trim()) {
      whereClauses.push('(r.from_address LIKE ? OR r.from_name LIKE ? OR r.subject LIKE ? OR r.snippet LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total matching
    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM replies r
      ${whereSql}
    `).get(...params);
    const totalRecords = countResult ? countResult.total : 0;

    // Total unread overall for this user
    let unreadCount = 0;
    let totalOverall = 0;
    if (req.user) {
      const uRes = db.prepare('SELECT COUNT(*) as count FROM replies WHERE is_read = 0 AND (account_id = ? OR to_address = ? OR account_id IS NULL)').get(req.user.id, req.user.email);
      unreadCount = uRes ? uRes.count : 0;
      const tRes = db.prepare('SELECT COUNT(*) as count FROM replies WHERE (account_id = ? OR to_address = ? OR account_id IS NULL)').get(req.user.id, req.user.email);
      totalOverall = tRes ? tRes.count : 0;
    } else {
      const uRes = db.prepare('SELECT COUNT(*) as count FROM replies WHERE is_read = 0').get();
      unreadCount = uRes ? uRes.count : 0;
      const tRes = db.prepare('SELECT COUNT(*) as count FROM replies').get();
      totalOverall = tRes ? tRes.count : 0;
    }

    // Replies list with joined sent email context
    const itemsQuery = `
      SELECT 
        r.id,
        r.account_id,
        r.email_id,
        r.batch_id,
        r.thread_id,
        r.gmail_message_id,
        r.from_address,
        r.from_name,
        r.to_address,
        r.subject,
        r.snippet,
        r.received_at,
        r.is_read,
        r.created_at,
        e.sent_at as original_sent_at,
        e.subject as original_subject,
        e.to_address as original_to_address
      FROM replies r
      LEFT JOIN emails e ON r.email_id = e.id
      ${whereSql}
      ORDER BY r.received_at DESC, r.rowid DESC
      LIMIT ? OFFSET ?
    `;

    const items = db.prepare(itemsQuery).all(...params, pageLimit, offset);

    res.json({
      replies: items,
      unreadCount,
      totalOverall,
      pagination: {
        total: totalRecords,
        page: parseInt(page, 10),
        limit: pageLimit,
        totalPages: Math.ceil(totalRecords / pageLimit)
      }
    });
  } catch (err) {
    console.error('Error fetching replies:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/replies/sync
 * Manually triggers inbox and sent thread sync from Gmail for authenticated salesperson
 */
router.post('/api/replies/sync', optionalAuthMiddleware, async (req, res) => {
  try {
    const accountId = req.user ? req.user.id : null;
    const result = await syncReplies(accountId);
    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/replies/:id
 * Fetches a single reply detail along with the original sent email body and thread context
 */
router.get('/api/replies/:id', optionalAuthMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const reply = db.prepare(`
      SELECT 
        r.*,
        e.subject as original_subject,
        e.body_html as original_body_html,
        e.sent_at as original_sent_at,
        e.to_address as original_to_address,
        b.subject as batch_subject
      FROM replies r
      LEFT JOIN emails e ON r.email_id = e.id
      LEFT JOIN batches b ON r.batch_id = b.id
      WHERE r.id = ?
    `).get(id);

    if (!reply) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    res.json(reply);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/replies/:id/read
 * Marks a reply as read or unread
 */
router.patch('/api/replies/:id/read', optionalAuthMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { isRead = true } = req.body;
    const isReadInt = isRead ? 1 : 0;

    const result = db.prepare('UPDATE replies SET is_read = ? WHERE id = ?').run(isReadInt, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    let unreadCount = 0;
    if (req.user) {
      const uRes = db.prepare('SELECT COUNT(*) as count FROM replies WHERE is_read = 0 AND (account_id = ? OR to_address = ?)').get(req.user.id, req.user.email);
      unreadCount = uRes ? uRes.count : 0;
    } else {
      const uRes = db.prepare('SELECT COUNT(*) as count FROM replies WHERE is_read = 0').get();
      unreadCount = uRes ? uRes.count : 0;
    }

    res.json({
      success: true,
      id,
      is_read: isReadInt,
      unreadCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
