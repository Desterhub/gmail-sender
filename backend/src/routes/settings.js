const express = require('express');
const router = express.Router();
const db = require('../db');
const { encrypt, decrypt } = require('../services/encryption');
const { verifySmtpCredentials, getSmtpConfig } = require('../services/smtp');
const { syncRepliesViaImap } = require('../services/imap');
const { authMiddleware, optionalAuthMiddleware } = require('../services/session');

/**
 * GET /api/settings/smtp
 * Fetches current SMTP and dispatch configuration for the authenticated user
 */
router.get('/api/settings/smtp', optionalAuthMiddleware, (req, res) => {
  try {
    const accountId = req.user ? req.user.id : null;
    let account = null;

    if (accountId) {
      account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    } else {
      account = db.prepare('SELECT * FROM accounts ORDER BY id ASC LIMIT 1').get();
    }

    const envUser = process.env.SMTP_USER || '';
    const envPass = process.env.SMTP_PASS || '';

    const hasStoredPass = !!(account && account.smtp_pass);
    const hasEnvPass = !!(envUser && envPass);

    res.json({
      success: true,
      provider: account ? (account.provider || 'smtp') : 'smtp',
      dispatch_mode: account ? (account.dispatch_mode || 'smtp') : 'smtp',
      smtp_host: (account && account.smtp_host) || process.env.SMTP_HOST || 'smtp.gmail.com',
      smtp_port: (account && account.smtp_port) || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465),
      smtp_secure: account ? (account.smtp_secure !== 0) : true,
      smtp_user: (account && account.smtp_user) || envUser || (account ? account.email : ''),
      has_password: hasStoredPass || hasEnvPass,
      is_env_configured: hasEnvPass,
      imap_host: (account && account.imap_host) || 'imap.gmail.com',
      imap_port: (account && account.imap_port) || 993,
      connected_email: account ? account.email : (envUser || 'Not connected')
    });
  } catch (err) {
    console.error('Error fetching SMTP settings:', err.message);
    res.status(500).json({ error: 'Failed to retrieve SMTP settings' });
  }
});

/**
 * POST /api/settings/smtp
 * Saves SMTP configuration, encrypting passwords with AES-256-GCM before database write
 */
router.post('/api/settings/smtp', optionalAuthMiddleware, (req, res) => {
  try {
    const {
      dispatch_mode = 'smtp',
      smtp_host = 'smtp.gmail.com',
      smtp_port = 465,
      smtp_secure = true,
      smtp_user = '',
      smtp_pass = '',
      imap_host = 'imap.gmail.com',
      imap_port = 993
    } = req.body;

    const accountId = req.user ? req.user.id : null;
    let account = null;

    if (accountId) {
      account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    } else {
      account = db.prepare('SELECT * FROM accounts ORDER BY id ASC LIMIT 1').get();
    }

    // Clean App Password (strip user-entered spaces like "abcd efgh ijkl mnop")
    const cleanSmtpPass = smtp_pass ? smtp_pass.replace(/\s+/g, '').trim() : '';
    const cleanUser = smtp_user ? smtp_user.trim().toLowerCase() : (account ? account.email : '');

    if (account) {
      let finalEncryptedPass = account.smtp_pass;
      if (cleanSmtpPass) {
        finalEncryptedPass = encrypt(cleanSmtpPass);
      }

      db.prepare(`
        UPDATE accounts 
        SET dispatch_mode = ?,
            smtp_host = ?,
            smtp_port = ?,
            smtp_secure = ?,
            smtp_user = ?,
            smtp_pass = ?,
            imap_host = ?,
            imap_port = ?,
            imap_user = ?,
            imap_pass = coalesce(?, imap_pass)
        WHERE id = ?
      `).run(
        dispatch_mode,
        smtp_host,
        parseInt(smtp_port, 10) || 465,
        smtp_secure ? 1 : 0,
        cleanUser,
        finalEncryptedPass,
        imap_host,
        parseInt(imap_port, 10) || 993,
        cleanUser,
        cleanSmtpPass ? encrypt(cleanSmtpPass) : null,
        account.id
      );
    } else if (cleanUser) {
      // Create new account record if none existed
      const encryptedPass = cleanSmtpPass ? encrypt(cleanSmtpPass) : '';
      db.prepare(`
        INSERT INTO accounts (
          email, access_token, refresh_token, provider, dispatch_mode,
          smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass,
          imap_host, imap_port, imap_user, imap_pass, connected_at
        ) VALUES (?, '', '', 'smtp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        cleanUser,
        dispatch_mode,
        smtp_host,
        parseInt(smtp_port, 10) || 465,
        smtp_secure ? 1 : 0,
        cleanUser,
        encryptedPass,
        imap_host,
        parseInt(imap_port, 10) || 993,
        cleanUser,
        encryptedPass
      );
    }

    res.json({
      success: true,
      message: 'SMTP settings saved and encrypted with AES-256-GCM successfully.'
    });
  } catch (err) {
    console.error('Error saving SMTP settings:', err.message);
    res.status(500).json({ error: 'Failed to save SMTP settings: ' + err.message });
  }
});

/**
 * POST /api/settings/smtp/test
 * Validates connection and credentials against smtp.gmail.com
 */
router.post('/api/settings/smtp/test', optionalAuthMiddleware, async (req, res) => {
  try {
    const {
      smtp_host = 'smtp.gmail.com',
      smtp_port = 465,
      smtp_secure = true,
      smtp_user = '',
      smtp_pass = ''
    } = req.body;

    const accountId = req.user ? req.user.id : null;
    let user = smtp_user;
    let pass = smtp_pass;

    // If password not provided in request body, retrieve stored encrypted password
    if (!pass) {
      const config = getSmtpConfig(accountId);
      if (config) {
        user = user || config.user;
        pass = config.pass;
      }
    }

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your Google Workspace email address and 16-character App Password to test.'
      });
    }

    const testResult = await verifySmtpCredentials({
      host: smtp_host,
      port: parseInt(smtp_port, 10) || 465,
      secure: smtp_secure !== false,
      user,
      pass
    });

    res.json(testResult);
  } catch (err) {
    console.error('SMTP test verification error:', err.message);
    let friendlyMessage = err.message;
    if (friendlyMessage.includes('Invalid login') || friendlyMessage.includes('Username and Password not accepted')) {
      friendlyMessage = 'Invalid credentials. Please verify your email address and ensure you generated a 16-character Google App Password (not your regular account password).';
    }
    res.status(400).json({
      success: false,
      error: friendlyMessage
    });
  }
});

/**
 * POST /api/settings/smtp/sync-replies
 * Triggers an immediate reply synchronization via IMAP
 */
router.post('/api/settings/smtp/sync-replies', optionalAuthMiddleware, async (req, res) => {
  try {
    const accountId = req.user ? req.user.id : null;
    const result = await syncRepliesViaImap(accountId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
