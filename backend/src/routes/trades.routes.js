import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { serialize } from '../lib/serialize.js';
import {
  createTrade,
  deleteTrade,
  listTrades,
  tradeInputSchema,
  tradeQuerySchema,
  tradeUpdateSchema,
  updateTrade,
} from '../services/trade.service.js';

export const tradesRouter = Router();

tradesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = tradeQuerySchema.parse(req.query);
    res.json(serialize(await listTrades(filters)));
  }),
);

tradesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = tradeInputSchema.parse(req.body);
    res.status(201).json(serialize(await createTrade(input)));
  }),
);

tradesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const input = tradeUpdateSchema.parse(req.body);
    const trade = await updateTrade(id, input);
    if (!trade) throw new HttpError(404, `Trade ${id} not found`);
    res.json(serialize(trade));
  }),
);

tradesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteTrade(Number(req.params.id));
    res.status(204).end();
  }),
);
