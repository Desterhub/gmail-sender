const nodemailer = require('nodemailer');
const db = require('../db');
const { encrypt, decrypt } = require('./encryption');

/**
 * Resolves SMTP configuration for a given account or system defaults
 * @param {number|null} accountId
 * @returns {Object|null}
 */
function getSmtpConfig(accountId = null) {
  let account = null;
  if (accountId) {
    account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
  } else {
    account = db.prepare('SELECT * FROM accounts WHERE smtp_user IS NOT NULL AND smtp_pass IS NOT NULL ORDER BY id ASC LIMIT 1').get()
      || db.prepare('SELECT * FROM accounts ORDER BY id ASC LIMIT 1').get();
  }

  // 1. Account-specific SMTP credentials (with AES-256-GCM decrypted password)
  if (account && account.smtp_user && account.smtp_pass) {
    let decryptedPass = '';
    try {
      decryptedPass = decrypt(account.smtp_pass);
    } catch (err) {
      console.error('[SMTP] Failed to decrypt stored SMTP password:', err.message);
      decryptedPass = account.smtp_pass;
    }

    return {
      host: account.smtp_host || 'smtp.gmail.com',
      port: account.smtp_port ? parseInt(account.smtp_port, 10) : 465,
      secure: account.smtp_secure !== 0,
      user: account.smtp_user,
      pass: decryptedPass,
      fromEmail: account.email || account.smtp_user,
      signatureHtml: account.signature_html || ''
    };
  }

  // 2. Fallback to .env configuration if present
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465,
      secure: process.env.SMTP_SECURE !== 'false',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS.replace(/\s+/g, ''), // Strip spaces from Google App Passwords
      fromEmail: process.env.SMTP_USER,
      signatureHtml: account ? account.signature_html : ''
    };
  }

  return null;
}

/**
 * Creates and returns a Nodemailer transporter instance
 * @param {Object} config
 */
function createTransporter(config) {
  if (!config || !config.user || !config.pass) {
    throw new Error('SMTP credentials are missing or incomplete.');
  }

  return nodemailer.createTransport({
    host: config.host || 'smtp.gmail.com',
    port: config.port || 465,
    secure: config.secure !== false, // true for port 465, false for port 587
    auth: {
      user: config.user.trim(),
      pass: config.pass.replace(/\s+/g, '').trim()
    },
    tls: {
      rejectUnauthorized: true
    }
  });
}

/**
 * Tests connection to the SMTP server and verifies user authentication
 * @param {Object} params { host, port, secure, user, pass }
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function verifySmtpCredentials({ host, port, secure, user, pass }) {
  if (!user || !pass) {
    throw new Error('Username and Password (or Google App Password) are required.');
  }

  const cleanPass = String(pass).replace(/\s+/g, '').trim();
  const transporter = nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: port ? parseInt(port, 10) : 465,
    secure: secure !== false,
    auth: {
      user: user.trim(),
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: true
    }
  });

  await transporter.verify();
  return {
    success: true,
    message: 'SMTP authentication verified successfully with ' + (host || 'smtp.gmail.com')
  };
}

/**
 * Dispatches an email via high-speed SMTP protocol with attachment support
 * @param {Object} params { accountId, to, cc, bcc, subject, bodyHtml, bodyText, attachments }
 * @returns {Promise<{ messageId: string, threadId: string }>}
 */
async function sendSmtpMessage({
  accountId = null,
  to,
  cc,
  bcc,
  subject,
  bodyHtml,
  bodyText,
  attachments = []
}) {
  const config = getSmtpConfig(accountId);
  if (!config) {
    throw new Error('No SMTP configuration found. Please set your Google App Password in Settings.');
  }

  const transporter = createTransporter(config);

  // Format attachments for Nodemailer
  const formattedAttachments = (attachments || []).map((att) => ({
    filename: att.filename,
    path: att.filepath,
    contentType: att.mimetype
  }));

  const mailOptions = {
    from: `"${config.fromEmail}" <${config.fromEmail}>`,
    to: to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject: subject,
    text: bodyText || undefined,
    html: bodyHtml,
    attachments: formattedAttachments.length > 0 ? formattedAttachments : undefined,
    headers: {
      'X-Mailer': 'JollyClamps-BulkSender/2.0'
    }
  };

  const info = await transporter.sendMail(mailOptions);
  const cleanId = (info.messageId || '').replace(/[<>]/g, '');

  return {
    messageId: cleanId,
    threadId: cleanId
  };
}

module.exports = {
  getSmtpConfig,
  createTransporter,
  verifySmtpCredentials,
  sendSmtpMessage
};
