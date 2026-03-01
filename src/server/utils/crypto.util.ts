import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Get encryption key from environment or generate a warning
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.warn('WARNING: ENCRYPTION_KEY not set. Using fallback key. Set ENCRYPTION_KEY in production!');
    // Fallback key for development only - 32 bytes hex = 64 chars
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');
  }
  // Key should be 64 hex characters (32 bytes)
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate random token
 */
export function generateRandomToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';

  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return token;
}

/**
 * Encrypt a string using AES-256-CBC
 * Returns format: iv:encryptedData (both hex encoded)
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Return iv:encrypted format
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with encryptSecret
 * Expects format: iv:encryptedData (both hex encoded)
 */
export function decryptSecret(encryptedText: string): string {
  if (!encryptedText) return '';

  // Check if it's in encrypted format (contains colon separator)
  if (!encryptedText.includes(':')) {
    // Not encrypted - return as-is (backwards compatibility)
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const [ivHex, encrypted] = encryptedText.split(':');

    if (!ivHex || !encrypted) {
      // Invalid format - return as-is
      return encryptedText;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    // If decryption fails, it might be plaintext (legacy data)
    return encryptedText;
  }
}

/**
 * Check if a string appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;

  // Encrypted format: 32 hex chars (IV) + : + encrypted hex data
  const parts = text.split(':');
  if (parts.length !== 2) return false;

  const [iv, data] = parts;
  // IV should be 32 hex chars (16 bytes)
  if (iv.length !== 32) return false;
  // Both parts should be valid hex
  return /^[0-9a-fA-F]+$/.test(iv) && /^[0-9a-fA-F]+$/.test(data);
}
