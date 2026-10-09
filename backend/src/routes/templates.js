const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { optionalAuthMiddleware } = require('../services/session');

/**
 * GET /api/templates
 * List all saved templates (shared + salesperson-specific)
 */
router.get('/api/templates', optionalAuthMiddleware, (req, res) => {
  try {
    const accountFilter = req.user ? 'WHERE account_id = ? OR account_id IS NULL' : '';
    const params = req.user ? [req.user.id] : [];
    const templates = db.prepare(`SELECT * FROM templates ${accountFilter} ORDER BY datetime(created_at) DESC`).all(...params);
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/templates/:id
 */
router.get('/api/templates/:id', optionalAuthMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/templates
 * Create new template
 */
router.post('/api/templates', optionalAuthMiddleware, (req, res) => {
  try {
    const { name, subject, bodyHtml } = req.body;
    if (!name || !subject || !bodyHtml) {
      return res.status(400).json({ error: 'Name, subject, and body are required.' });
    }

    const id = crypto.randomUUID();
    const accountId = req.user ? req.user.id : null;

    db.prepare(`
      INSERT INTO templates (id, account_id, name, subject, body_html, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, accountId, name.trim(), subject.trim(), bodyHtml.trim());

    const created = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/templates/:id
 * Update template
 */
router.put('/api/templates/:id', optionalAuthMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, bodyHtml } = req.body;

    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.prepare(`
      UPDATE templates 
      SET name = coalesce(?, name), subject = coalesce(?, subject), body_html = coalesce(?, body_html)
      WHERE id = ?
    `).run(name ? name.trim() : null, subject ? subject.trim() : null, bodyHtml ? bodyHtml.trim() : null, id);

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/templates/:id
 */
router.delete('/api/templates/:id', optionalAuthMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true, message: 'Template deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
