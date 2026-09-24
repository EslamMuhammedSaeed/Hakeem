import { Prisma } from '@prisma/client';

/**
 * Prisma returns Decimal instances that JSON.stringify would render as objects.
 * Money crosses the wire as a string and is formatted in the UI, never as a float.
 */
export function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}
