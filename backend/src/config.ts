import fs from 'node:fs';
import { z } from 'zod';

// Load .env from the project root if present (real environment variables always win).
if (fs.existsSync('.env')) process.loadEnvFile('.env');

const flag = (def: 'true' | 'false') =>
  z.enum(['true', 'false']).default(def).transform((v) => v === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/sanket.db'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
  PEPPER: z.string().min(32, 'PEPPER must be at least 32 characters').optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8443'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  TIMEZONE_OFFSET_MINUTES: z.coerce.number().int().min(-720).max(840).default(330),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  STAFF_SESSION_MINUTES: z.coerce.number().int().min(5).max(1440).default(120),
  ANON_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(90),
  JOBS_ENABLED: flag('true'),
  DEV_EXPOSE_OTP: flag('false'),
  FRONTEND_DIST: z.string().default('../frontend/dist'),
  SEED_ADMIN_EMAIL: z.string().default('admin@sanket.local'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe-Now-2026'),
});

// Treat `KEY=` (empty) in .env like an unset variable so defaults and dev fallbacks apply.
const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = EnvSchema.safeParse(rawEnv);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
const env = parsed.data;
const isProd = env.NODE_ENV === 'production';

if (isProd) {
  const missing = (['JWT_SECRET', 'PEPPER'] as const).filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Refusing to start in production without: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (env.DEV_EXPOSE_OTP) {
    console.error('Refusing to start in production with DEV_EXPOSE_OTP=true');
    process.exit(1);
  }
}

// Development fallbacks are deliberately obvious so they are never mistaken for real secrets.
const DEV_SECRET = 'dev-only-insecure-secret-do-not-use-in-production-0000';

export const config = {
  ...env,
  isProd,
  isTest: env.NODE_ENV === 'test',
  JWT_SECRET: env.JWT_SECRET ?? DEV_SECRET,
  PEPPER: env.PEPPER ?? `${DEV_SECRET}-pepper`,
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
} as const;
