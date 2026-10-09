const { google } = require('googleapis');
const MailComposer = require('nodemailer/lib/mail-composer');
const db = require('../db');
const { encrypt, decrypt } = require('./encryption');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Creates and configures a Google OAuth2 client
 */
function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth Client ID and Secret must be configured in .env');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generates the Google OAuth authorization URL
 */
function getAuthUrl() {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Demands refresh_token
    prompt: 'consent',     // Forces consent dialog to ensure refresh_token is returned
    scope: SCOPES
  });
}

/**
 * Handles OAuth callback, exchanges auth code for tokens, retrieves user email,
 * encrypts credentials, and saves or updates the account in SQLite
 */
async function handleOAuthCallback(code) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Retrieve user's email address
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const email = userInfo.data.email;

  if (!email) {
    throw new Error('Unable to retrieve user email from Google OAuth profile');
  }

  const encryptedAccessToken = encrypt(tokens.access_token || '');
  const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
  const expiryDate = tokens.expiry_date || null;

  // Insert or update the account
  let account;
  const existing = db.prepare('SELECT * FROM accounts WHERE email = ?').get(email);
  if (existing) {
    // If Google didn't return a new refresh_token on re-auth, preserve existing encrypted refresh token
    const finalRefreshToken = encryptedRefreshToken || existing.refresh_token;
    db.prepare(`
      UPDATE accounts 
      SET access_token = ?, refresh_token = ?, token_expiry = ?, connected_at = datetime('now')
      WHERE email = ?
    `).run(encryptedAccessToken, finalRefreshToken, expiryDate, email);
    account = db.prepare('SELECT id, email, connected_at FROM accounts WHERE email = ?').get(email);
  } else {
    if (!encryptedRefreshToken) {
      throw new Error('No refresh token received. Please remove app permissions in your Google account security settings and reconnect.');
    }
    const info = db.prepare(`
      INSERT INTO accounts (email, access_token, refresh_token, token_expiry, connected_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(email, encryptedAccessToken, encryptedRefreshToken, expiryDate);
    account = { id: info.lastInsertRowid, email, connected_at: new Date().toISOString() };
  }

  const { createSessionToken } = require('./session');
  const token = createSessionToken(account);

  return { account, token };
}

/**
 * Returns current connected account info or null
 */
/**
 * Returns account info by ID, or latest connected account, or null
 */
function getConnectedAccount(accountId = null) {
  let account;
  if (accountId) {
    account = db.prepare('SELECT id, email, token_expiry, connected_at FROM accounts WHERE id = ?').get(accountId);
  } else {
    account = db.prepare('SELECT id, email, token_expiry, connected_at FROM accounts ORDER BY connected_at DESC LIMIT 1').get();
  }
  return account || null;
}

/**
 * Returns all connected accounts
 */
function getAllAccounts() {
  return db.prepare('SELECT id, email, connected_at FROM accounts ORDER BY connected_at DESC').all();
}

/**
 * Disconnects the specified Google account
 */
async function disconnectAccount(accountId = null) {
  let account;
  if (accountId) {
    account = db.prepare('SELECT id, access_token FROM accounts WHERE id = ?').get(accountId);
  } else {
    account = db.prepare('SELECT id, access_token FROM accounts ORDER BY connected_at DESC LIMIT 1').get();
  }

  if (account) {
    try {
      const accessToken = decrypt(account.access_token);
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken });
      await oauth2Client.revokeCredentials();
    } catch (e) {
      // Ignore revocation errors if token is already expired
    }
    db.prepare('DELETE FROM accounts WHERE id = ?').run(account.id);
  }
  return { success: true };
}

/**
 * Instantiates an authenticated Google OAuth2 client with auto-refresh mechanism
 */
async function getAuthenticatedClient(accountId = null) {
  let account;
  if (accountId) {
    account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  } else {
    account = db.prepare('SELECT * FROM accounts ORDER BY connected_at DESC LIMIT 1').get();
  }

  if (!account) {
    throw new Error('No Gmail account is connected. Please connect your Gmail account first.');
  }

  const oauth2Client = createOAuth2Client();
  const accessToken = decrypt(account.access_token);
  const refreshToken = decrypt(account.refresh_token);

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.token_expiry
  });

  // Listen for automatic token refreshes by googleapis and save newly encrypted tokens
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      const newEncryptedAccess = encrypt(tokens.access_token);
      const newExpiry = tokens.expiry_date || null;
      if (tokens.refresh_token) {
        const newEncryptedRefresh = encrypt(tokens.refresh_token);
        db.prepare('UPDATE accounts SET access_token = ?, refresh_token = ?, token_expiry = ? WHERE id = ?')
          .run(newEncryptedAccess, newEncryptedRefresh, newExpiry, account.id);
      } else {
        db.prepare('UPDATE accounts SET access_token = ?, token_expiry = ? WHERE id = ?')
          .run(newEncryptedAccess, newExpiry, account.id);
      }
    }
  });

  // Force token refresh if within 2 minutes of expiry
  const now = Date.now();
  if (account.token_expiry && (account.token_expiry - now < 120000)) {
    try {
      const refreshed = await oauth2Client.refreshAccessToken();
      const newCredentials = refreshed.credentials;
      const newEncryptedAccess = encrypt(newCredentials.access_token);
      db.prepare('UPDATE accounts SET access_token = ?, token_expiry = ? WHERE id = ?')
        .run(newEncryptedAccess, newCredentials.expiry_date, account.id);
    } catch (err) {
      console.error('Failed to auto-refresh Google access token:', err.message);
      throw new Error(`Failed to refresh Gmail credentials: ${err.message}. Please reconnect your account.`);
    }
  }

  return { oauth2Client, email: account.email };
}

/**
 * Converts a MIME message into base64url format for the Gmail API
 */
function encodeBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Builds RFC 2822 MIME message and sends via Gmail API (users.messages.send)
 * @param {Object} emailData { to, cc, bcc, subject, bodyHtml, bodyText, attachments }
 * @returns {Promise<{ messageId: string }>}
 */
async function sendGmailMessage({ accountId = null, to, cc, bcc, subject, bodyHtml, bodyText, attachments = [] }) {
  const { oauth2Client, email: senderEmail } = await getAuthenticatedClient(accountId);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Format attachments for nodemailer MailComposer
  const formattedAttachments = attachments.map((att) => ({
    filename: att.filename,
    path: att.filepath,
    contentType: att.mimetype
  }));

  const mail = new MailComposer({
    from: senderEmail,
    to: to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject: subject,
    text: bodyText || undefined,
    html: bodyHtml || undefined,
    attachments: formattedAttachments
  });

  const mimeBuffer = await mail.compile().build();
  const rawMessage = encodeBase64Url(mimeBuffer);

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: rawMessage
    }
  });

  return {
    messageId: response.data.id,
    threadId: response.data.threadId
  };
}

module.exports = {
  createOAuth2Client,
  getAuthUrl,
  handleOAuthCallback,
  getConnectedAccount,
  getAllAccounts,
  disconnectAccount,
  getAuthenticatedClient,
  sendGmailMessage
};
