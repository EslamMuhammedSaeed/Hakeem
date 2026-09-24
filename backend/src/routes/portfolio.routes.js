import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { serialize } from '../lib/serialize.js';
import { getPositions, getSummary } from '../services/portfolio.js';

export const portfolioRouter = Router();

portfolioRouter.get(
  '/positions',
  asyncHandler(async (req, res) => {
    const includeClosed = req.query.includeClosed !== 'false';
    res.json(serialize(await getPositions({ includeClosed })));
  }),
);

portfolioRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(serialize(await getSummary()));
  }),
);
