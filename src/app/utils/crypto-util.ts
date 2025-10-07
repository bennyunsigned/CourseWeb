import * as CryptoJS from 'crypto-js';

const encryptionKey = 'abcd@1234'; // Replace with a secure key

/**
 * Encrypts the given data using AES encryption.
 * @param data The data to encrypt.
 * @returns The encrypted string.
 */
export function encryptData(data: string): string {
  if (!data || data.trim() === '') {
    console.warn('Data to encrypt is empty or invalid.');
    return ''; // Return an empty string if data is invalid
  }
  return CryptoJS.AES.encrypt(data, encryptionKey).toString();
}

/**
 * Decrypts the given encrypted data using AES decryption.
 * @param data The encrypted data to decrypt.
 * @returns The decrypted string.
 */
export function decryptData(data: string): string {
  if (!data || typeof data !== 'string' || data.trim() === '') {
    // Not a string or empty — nothing to decrypt
    return '';
  }
  try {
    const bytes = CryptoJS.AES.decrypt(data, encryptionKey);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    // If decryption yields empty string, treat as failure without noisy stack
    if (!decryptedData) {
      // Common cause: data wasn't actually encrypted with this key or is malformed
      return '';
    }
    return decryptedData;
  } catch (_err) {
    // Quietly return empty on malformed input (e.g. not proper ciphertext)
    return '';
  }
}