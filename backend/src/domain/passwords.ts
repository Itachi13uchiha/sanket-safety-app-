import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from '../config.js';
import type { UserRow } from '../db/types.js';
import { ROLE_LABELS, ROLE_PERMISSIONS } from './permissions.js';
import { iso } from '../lib/http.js';

export const passwordPolicy = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const hashPassword = (plain: string) => bcrypt.hash(plain, config.BCRYPT_ROUNDS);
export const checkPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/** Used to keep response time flat when the account does not exist. */
export const DUMMY_HASH = bcrypt.hashSync('sanket-timing-equaliser', config.BCRYPT_ROUNDS);

export function staffUser(u: UserRow) {
  return {
    id: u.id,
    officialId: u.official_id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role],
    status: u.status,
    lastLoginAt: iso(u.last_login_at),
    createdAt: iso(u.created_at),
  };
}

export const permissionsFor = (role: UserRow['role']) => [...ROLE_PERMISSIONS[role]];
