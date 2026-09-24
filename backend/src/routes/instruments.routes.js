import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errorHandler.js';
import { serialize } from '../lib/serialize.js';
import { listInstruments, setMarkPrice } from '../services/instrument.service.js';
import { emitTradeChanged } from '../services/events.js';

export const instrumentsRouter = Router();

const updateSchema = z.object({
  markPrice: z
    .union([z.number(), z.string(), z.null()])
    .refine(
      (value) => value === null || (String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0),
      'markPrice must be a non-negative number, or null to clear it',
    )
    .optional(),
  nameAr: z.string().max(191).nullable().optional(),
  nameEn: z.string().max(191).nullable().optional(),
});

instrumentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(serialize(await listInstruments()));
  }),
);

instrumentsRouter.patch(
  '/:code',
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body ?? {});
    const code = req.params.code.toUpperCase();
    const markPrice =
      input.markPrice === undefined || input.markPrice === null ? input.markPrice : String(input.markPrice);

    const instrument = await setMarkPrice(code, { ...input, markPrice });
    emitTradeChanged({ reason: 'markPrice', symbol: code });
    res.json(serialize(instrument));
  }),
);
