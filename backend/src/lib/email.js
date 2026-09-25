import { z } from 'zod';

/**
 * Zod's built-in email check requires a dotted domain, which rejects the
 * documented local default `owner@localhost`.
 */
export const emailSchema = z
  .string()
  .trim()
  .max(191)
  .toLowerCase()
  .refine((value) => /^[^\s@]+@[^\s@]+$/.test(value), 'Invalid email');
