import 'dotenv/config';
import { z } from 'zod';
import { emailSchema } from '../lib/email.js';

const csv = (value) =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const DEV_JWT_SECRET = 'dev-only-change-this-secret-key-32b';
const DEV_SEED_PASSWORD = 'el-hakeem-dev';

const cookieSecureMode = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return 'auto';
  return String(value).trim().toLowerCase();
}, z.enum(['auto', 'true', 'false']));

const booleanFromEnv = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;
  return value;
}, z.boolean());

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    WEBHOOK_API_KEY: z
      .string()
      .min(16, 'WEBHOOK_API_KEY must be at least 16 characters')
      .refine((value) => value !== 'change-me', 'WEBHOOK_API_KEY still holds the placeholder value'),
    PORT: z.coerce.number().int().positive().default(4000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    ALLOWED_PACKAGES: z.string().optional().default(''),
    DEFAULT_TIMEZONE: z.string().default('Africa/Cairo'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default(DEV_JWT_SECRET),
    SEED_USER_EMAIL: emailSchema.default('owner@localhost'),
    SEED_USER_PASSWORD: z.string().min(8, 'SEED_USER_PASSWORD must be at least 8 characters').default(DEV_SEED_PASSWORD),
    REQUIRE_AUTH_FOR_READS: booleanFromEnv,
    COOKIE_SECURE: cookieSecureMode,
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    if (value.JWT_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'Replace the development JWT_SECRET in production' });
    }
    if (value.SEED_USER_PASSWORD === DEV_SEED_PASSWORD || value.SEED_USER_PASSWORD.length < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SEED_USER_PASSWORD'],
        message: 'Production seed password must be at least 12 characters and not the documented default',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  console.error(`Invalid environment configuration:\n${details.join('\n')}\n\nCopy .env.example to .env and fill it in.`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: csv(parsed.data.CORS_ORIGINS),
  allowedPackages: csv(parsed.data.ALLOWED_PACKAGES),
  isProduction: parsed.data.NODE_ENV === 'production',
};
