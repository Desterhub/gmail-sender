const crypto = require('crypto');
const db = require('../db');

const SECRET = process.env.ENCRYPTION_KEY || 'jolly-clamps-secure-session-key-2026';

/**
 * Creates a cryptographically signed session token (HMAC-SHA256)
 * @param {Object} payload { id, email }
 * @returns {string} base64urlData.signature
 */
function createSessionToken(payload) {
  const data = {
    id: payload.id,
    email: payload.email.toLowerCase().trim(),
    iat: Date.now()
  };

  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(encodedData).digest('base64url');
  return `${encodedData}.${signature}`;
}

/**
 * Verifies and decodes a session token
 * @param {string} token
 * @returns {Object|null}
 */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [encodedData, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', SECRET).update(encodedData).digest('base64url');

  // Constant-time buffer comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(encodedData, 'base64url').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    // Enforce 30-day session expiry to protect against stale tokens
    const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
    if (parsed.iat && (Date.now() - parsed.iat > MAX_SESSION_AGE_MS)) {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to authenticate the user and attach req.user
 */
function authMiddleware(req, res, next) {
  // Extract token from Authorization header, query, or custom header
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    const decoded = verifySessionToken(token);
    if (decoded && decoded.id) {
      const account = db.prepare('SELECT id, email, token_expiry, connected_at, signature_html FROM accounts WHERE id = ?').get(decoded.id);
      if (account) {
        req.user = account;
        return next();
      }
    }
  }

  return res.status(401).json({
    error: 'Unauthorized: Please sign in with your authorized account',
    needAuth: true
  });
}

/**
 * Optional middleware: attaches user if present, but does not block if not
 */
function optionalAuthMiddleware(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    const decoded = verifySessionToken(token);
    if (decoded && decoded.id) {
      const account = db.prepare('SELECT id, email, token_expiry, connected_at, signature_html FROM accounts WHERE id = ?').get(decoded.id);
      if (account) {
        req.user = account;
      }
    }
  }

  next();
}

module.exports = {
  createSessionToken,
  verifySessionToken,
  authMiddleware,
  optionalAuthMiddleware
};
