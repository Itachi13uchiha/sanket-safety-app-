import crypto from 'node:crypto';
import { config } from '../config.js';

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Keyed hash: outputs cannot be recomputed or linked to inputs without the server-side pepper. */
export const hmac = (s: string) => crypto.createHmac('sha256', config.PEPPER).update(s).digest('hex');

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// 32 symbols (no 0/O/1/I): 256 is divisible by 32, so `byte % 32` is unbiased.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function newId(prefix: string, length = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return `${prefix}-${out}`;
}

export const randomInt = (min: number, max: number) => crypto.randomInt(min, max);

/**
 * Reports are meant to describe a situation, never identify a person. Strip contact details,
 * ID numbers and vehicle plates that reporters sometimes type by habit.
 */
const PII_PATTERNS: RegExp[] = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/g, // e-mail
  /\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}\b/gi, // Indian vehicle plate
  /(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)/g, // 12-digit ID numbers
  /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g, // mobile numbers
];

export function sanitizeNote(raw: string | undefined | null): { text: string | null; hash: string | null } {
  if (!raw) return { text: null, hash: null };
  let text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const re of PII_PATTERNS) text = text.replace(re, '[removed]');
  text = text.slice(0, 200).trim();
  if (!text) return { text: null, hash: null };
  const normalised = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  // Only long-enough notes are fingerprinted for copy-paste detection.
  return { text, hash: normalised.length >= 12 ? sha256(normalised) : null };
}
