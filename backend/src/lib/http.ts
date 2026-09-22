import { z, type ZodTypeAny } from 'zod';
import type { Request } from 'express';
import { Errors } from './errors.js';

/** Validate untrusted input against a zod schema and throw a uniform 422 on failure. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw Errors.validation(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function pageMeta(total: number, page: number, pageSize: number) {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const iso = (ms: number | null | undefined): string | null =>
  ms == null ? null : new Date(ms).toISOString();

/** Escape user text for use inside a SQL LIKE ... ESCAPE '\' pattern. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

export const round = (n: number, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
