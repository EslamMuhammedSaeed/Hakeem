import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { serialize } from '../lib/serialize.js';
import { prisma } from '../lib/prisma.js';
import { reparseAll, reparseNotification } from '../services/notification.service.js';
import { previewParse } from '../services/parser/index.js';
import { rules } from '../services/parser/rules.js';

export const notificationsRouter = Router();

const querySchema = z.object({
  status: z.enum(['PENDING', 'PARSED', 'FAILED', 'IGNORED']).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = querySchema.parse(req.query);
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.q) where.OR = [{ body: { contains: filters.q } }, { title: { contains: filters.q } }];

    const [items, total, counts] = await Promise.all([
      prisma.rawNotification.findMany({
        where,
        include: { trade: true },
        orderBy: { receivedAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.rawNotification.count({ where }),
      prisma.rawNotification.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    res.json(
      serialize({
        items,
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
        counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
      }),
    );
  }),
);

notificationsRouter.post(
  '/reparse-failed',
  asyncHandler(async (req, res) => {
    res.json(await reparseAll({ statuses: ['FAILED', 'PENDING'] }));
  }),
);

notificationsRouter.post(
  '/reparse-all',
  asyncHandler(async (req, res) => {
    res.json(await reparseAll({ statuses: ['FAILED', 'PENDING', 'PARSED', 'IGNORED'] }));
  }),
);

notificationsRouter.post(
  '/:id/reparse',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const result = await reparseNotification(id);
    if (!result) throw new HttpError(404, `Notification ${id} not found`);
    res.json(serialize(result));
  }),
);

notificationsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await prisma.$transaction([
      prisma.trade.deleteMany({ where: { rawNotificationId: id } }),
      prisma.rawNotification.delete({ where: { id } }),
    ]);
    res.status(204).end();
  }),
);

export const parseRouter = Router();

parseRouter.post(
  '/preview',
  asyncHandler(async (req, res) => {
    const input = z.object({ title: z.string().optional(), body: z.string().optional() }).parse(req.body ?? {});
    res.json(serialize(previewParse(input)));
  }),
);

parseRouter.get('/rules', (req, res) => {
  res.json(
    rules.map((rule) => ({ id: rule.id, description: rule.description, pattern: rule.pattern.toString() })),
  );
});
