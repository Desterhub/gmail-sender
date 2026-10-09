const crypto = require('crypto');

// Algorithm: AES-256-GCM (Authenticated Encryption)
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES-GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte cryptographic key from the ENCRYPTION_KEY env var
 */
function getKey() {
  const envKey = process.env.ENCRYPTION_KEY || 'default-fallback-insecure-key-change-in-env';
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }
  // Otherwise derive a 32-byte key via SHA-256
  return crypto.createHash('sha256').update(String(envKey)).digest();
}

/**
 * Encrypt plaintext string into hex representation: iv:authTag:encrypted
 * @param {string} text Plaintext to encrypt
 * @returns {string} Encrypted string in format iv:authTag:cipherHex
 */
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an encrypted string in format iv:authTag:cipherHex back to plaintext
 * @param {string} encryptedText Encrypted string
 * @returns {string} Decrypted plaintext string
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:authTag:ciphertext');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const cipherHex = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
