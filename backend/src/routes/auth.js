const express = require('express');
const router = express.Router();
const db = require('../db');
const { 
  getAuthUrl, 
  handleOAuthCallback, 
  getConnectedAccount, 
  getAllAccounts, 
  disconnectAccount 
} = require('../services/gmail');
const { authMiddleware, optionalAuthMiddleware } = require('../services/session');

/**
 * Initiates Google OAuth 2.0 flow
 */
router.get('/auth/google', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (err) {
    console.error('Error generating OAuth URL:', err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * OAuth 2.0 callback endpoint
 */
router.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    return res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}/?auth_error=missing_code`);
  }

  try {
    const { account, token } = await handleOAuthCallback(code);
    res.redirect(`${frontendUrl}/?auth_token=${token}&email=${encodeURIComponent(account.email)}`);
  } catch (err) {
    console.error('OAuth callback failed:', err.message);
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

/**
 * Returns current authenticated user and profile
 */
router.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      connectedAt: req.user.connected_at,
      signatureHtml: req.user.signature_html || ''
    }
  });
});

/**
 * Returns connection status and details of the connected Gmail account
 */
router.get('/api/auth/status', optionalAuthMiddleware, (req, res) => {
  try {
    if (req.user) {
      return res.json({
        connected: true,
        authenticated: true,
        account: {
          id: req.user.id,
          email: req.user.email,
          connectedAt: req.user.connected_at
        }
      });
    }

    res.json({ connected: false, authenticated: false, account: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Returns list of all connected accounts in the organization
 */
router.get('/api/accounts', (req, res) => {
  try {
    const accounts = getAllAccounts();
    res.json({ accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Disconnects and revokes access to the user's Gmail account
 */
router.post('/api/auth/disconnect', authMiddleware, async (req, res) => {
  try {
    await disconnectAccount(req.user.id);
    res.json({ success: true, message: 'Gmail account disconnected successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/signature
 * Returns the saved HTML signature of the authenticated salesperson
 */
router.get('/api/signature', authMiddleware, (req, res) => {
  try {
    res.json({ signatureHtml: req.user.signature_html || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/signature
 * Updates the HTML signature for the authenticated salesperson
 */
router.put('/api/signature', authMiddleware, (req, res) => {
  try {
    const { signatureHtml } = req.body;
    db.prepare('UPDATE accounts SET signature_html = ? WHERE id = ?').run(signatureHtml || '', req.user.id);
    res.json({ success: true, signatureHtml: signatureHtml || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
