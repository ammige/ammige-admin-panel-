'use strict';

/**
 * Customer password hashing — Node built-in crypto.scrypt only.
 * Format: scrypt$<saltHex>$<hashHex>$<N>
 * 16-byte random salt, N=16384, 64-byte derived key, constant-time verify.
 */
const crypto = require('crypto');

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALTLEN = 16;

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALTLEN);
    crypto.scrypt(password, salt, KEYLEN, { N, r: R, p: P }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}$${N}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    try {
      if (typeof stored !== 'string') return resolve(false);
      const parts = stored.split('$');
      if (parts.length !== 4 || parts[0] !== 'scrypt') return resolve(false);
      const salt = Buffer.from(parts[1], 'hex');
      const expected = Buffer.from(parts[2], 'hex');
      const n = parseInt(parts[3], 10);
      if (!salt.length || expected.length !== KEYLEN || !Number.isInteger(n) || n <= 0) {
        return resolve(false);
      }
      crypto.scrypt(password, salt, KEYLEN, { N: n, r: R, p: P }, (err, key) => {
        if (err) return resolve(false);
        try {
          resolve(crypto.timingSafeEqual(key, expected));
        } catch {
          resolve(false);
        }
      });
    } catch {
      resolve(false);
    }
  });
}

module.exports = { hashPassword, verifyPassword };
