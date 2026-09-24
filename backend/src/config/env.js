import 'dotenv/config';
import { z } from 'zod';

const csv = (value) =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const schema = z.object({
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
