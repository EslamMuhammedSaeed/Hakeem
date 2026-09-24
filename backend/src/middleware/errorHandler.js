import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }

  if (error?.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  logger.error({ err: error }, 'Unhandled error');
  return res.status(500).json({ error: 'Internal server error' });
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
