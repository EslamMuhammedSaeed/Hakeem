import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { parseNotification } from './parser/index.js';
import { emitNotificationReceived, emitTradeChanged } from './events.js';
import { upsertInstrument } from './instrument.service.js';

/**
 * Forwarder apps disagree about field names, so every common alias is accepted.
 * Unknown extra keys are kept verbatim in `payload`.
 */
export const webhookPayloadSchema = z
  .object({
    appPackage: z.string().optional(),
    package: z.string().optional(),
    packageName: z.string().optional(),
    app: z.string().optional(),
    title: z.string().optional(),
    notificationTitle: z.string().optional(),
    subject: z.string().optional(),
    text: z.string().optional(),
    body: z.string().optional(),
    message: z.string().optional(),
    content: z.string().optional(),
    notificationText: z.string().optional(),
    postedAt: z.union([z.string(), z.number()]).optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    time: z.union([z.string(), z.number()]).optional(),
    deviceId: z.string().optional(),
    device: z.string().optional(),
    notificationId: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function parseTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const num = Number(value);
    // Heuristic: 10-digit values are seconds, 13-digit values are milliseconds
    const ms = num > 1e12 ? num : num > 1e9 ? num * 1000 : null;
    if (ms === null) return null;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizePayload(raw) {
  const body = firstString(raw.text, raw.body, raw.message, raw.content, raw.notificationText);
  const title = firstString(raw.title, raw.notificationTitle, raw.subject);
  const appPackage = firstString(raw.appPackage, raw.package, raw.packageName, raw.app);
  const postedAt = parseTimestamp(raw.postedAt ?? raw.timestamp ?? raw.time);
  const deviceId = firstString(raw.deviceId, raw.device);
  const notificationId = raw.notificationId !== undefined ? String(raw.notificationId) : null;

  return { body: body ?? title ?? '', title, appPackage, postedAt, deviceId, notificationId };
}

/**
 * Forwarder apps retry on flaky mobile connections, so the same notification can
 * arrive several times. When the payload carries no id or timestamp we fall back to a
 * one-minute bucket, which collapses retries without merging trades minutes apart.
 */
export function buildDedupeHash({ appPackage, title, body, postedAt, notificationId }, receivedAt) {
  const marker =
    notificationId ??
    (postedAt ? postedAt.toISOString() : new Date(Math.floor(receivedAt.getTime() / 60000) * 60000).toISOString());
  const material = [appPackage ?? '', title ?? '', body ?? '', marker].join('|');
  return crypto.createHash('sha256').update(material).digest('hex');
}

export function isPackageAllowed(appPackage) {
  if (env.allowedPackages.length === 0) return true;
  if (!appPackage) return true;
  return env.allowedPackages.some((allowed) => appPackage.toLowerCase().includes(allowed.toLowerCase()));
}

async function persistTradeFor(notificationId, parsed, tx = prisma) {
  const trade = await tx.trade.create({
    data: {
      rawNotificationId: notificationId,
      source: 'NOTIFICATION',
      side: parsed.trade.side,
      symbol: parsed.trade.symbol,
      quantity: parsed.trade.quantity,
      price: parsed.trade.price,
      fees: parsed.trade.fees,
      netAmount: parsed.trade.netAmount,
      executedAt: parsed.trade.executedAt,
    },
  });
  await upsertInstrument(parsed.trade.symbol, tx);
  return trade;
}

/**
 * The webhook entry point. Storing the raw payload happens first and unconditionally;
 * parsing is a second step whose failure never costs the notification.
 */
export async function ingestNotification(rawPayload) {
  const receivedAt = new Date();
  const normalized = normalizePayload(rawPayload);

  if (!normalized.body) {
    return { status: 'REJECTED', reason: 'Payload contained no notification text' };
  }

  if (!isPackageAllowed(normalized.appPackage)) {
    return { status: 'IGNORED_PACKAGE', reason: `Package ${normalized.appPackage} is not in ALLOWED_PACKAGES` };
  }

  const dedupeHash = buildDedupeHash({ ...normalized, receivedAt }, receivedAt);

  const existing = await prisma.rawNotification.findUnique({
    where: { dedupeHash },
    include: { trade: true },
  });
  if (existing) {
    return { status: 'DUPLICATE', notification: existing, trade: existing.trade };
  }

  const parsed = parseNotification({
    title: normalized.title ?? '',
    body: normalized.body,
    executedAt: normalized.postedAt ?? receivedAt,
  });

  const result = await prisma.$transaction(async (tx) => {
    const notification = await tx.rawNotification.create({
      data: {
        receivedAt,
        postedAt: normalized.postedAt,
        appPackage: normalized.appPackage,
        title: normalized.title,
        body: normalized.body,
        deviceId: normalized.deviceId,
        payload: rawPayload,
        dedupeHash,
        status: parsed.status,
        matchedRule: parsed.ruleId,
        parseError: parsed.error,
      },
    });

    const trade = parsed.status === 'PARSED' ? await persistTradeFor(notification.id, parsed, tx) : null;
    return { notification, trade };
  });

  emitNotificationReceived({ id: result.notification.id, status: parsed.status });
  if (result.trade) emitTradeChanged({ reason: 'ingest', tradeId: result.trade.id });

  logger.info(
    { id: result.notification.id, status: parsed.status, rule: parsed.ruleId, symbol: result.trade?.symbol },
    'Notification ingested',
  );

  return { status: parsed.status, notification: result.notification, trade: result.trade };
}

/**
 * Re-runs the current rule table over an already stored notification. This is what
 * makes a wrong regex harmless: fix `rules.js`, reparse, and the trade appears.
 */
export async function reparseNotification(id) {
  const notification = await prisma.rawNotification.findUnique({ where: { id }, include: { trade: true } });
  if (!notification) return null;

  const parsed = parseNotification({
    title: notification.title ?? '',
    body: notification.body,
    executedAt: notification.postedAt ?? notification.receivedAt,
  });

  const result = await prisma.$transaction(async (tx) => {
    if (notification.trade) {
      await tx.trade.delete({ where: { id: notification.trade.id } });
    }

    const updated = await tx.rawNotification.update({
      where: { id },
      data: { status: parsed.status, matchedRule: parsed.ruleId, parseError: parsed.error },
    });

    const trade = parsed.status === 'PARSED' ? await persistTradeFor(id, parsed, tx) : null;
    return { notification: updated, trade };
  });

  emitTradeChanged({ reason: 'reparse', notificationId: id });
  return { status: parsed.status, notification: result.notification, trade: result.trade };
}

export async function reparseAll({ statuses = ['FAILED', 'PENDING'] } = {}) {
  const candidates = await prisma.rawNotification.findMany({
    where: { status: { in: statuses } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const summary = { total: candidates.length, parsed: 0, failed: 0, ignored: 0 };
  for (const { id } of candidates) {
    const outcome = await reparseNotification(id);
    if (outcome?.status === 'PARSED') summary.parsed += 1;
    else if (outcome?.status === 'IGNORED') summary.ignored += 1;
    else summary.failed += 1;
  }
  return summary;
}
