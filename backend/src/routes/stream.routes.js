import { Router } from 'express';
import { bus, EVENTS } from '../services/events.js';

export const streamRouter = Router();

/**
 * Server-sent events so a fill shows up on the dashboard the moment the webhook
 * stores it. The dashboard authenticates with the session cookie
 * (`EventSource` `withCredentials`). Non-browser clients may still pass `?apiKey=`.
 */
streamRouter.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

  const send = (event) => (payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload ?? {})}\n\n`);
  };

  const onTrade = send('trade');
  const onNotification = send('notification');
  bus.on(EVENTS.TRADE_CHANGED, onTrade);
  bus.on(EVENTS.NOTIFICATION_RECEIVED, onNotification);

  // Proxies and phones drop idle connections; a comment frame keeps it warm
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off(EVENTS.TRADE_CHANGED, onTrade);
    bus.off(EVENTS.NOTIFICATION_RECEIVED, onNotification);
    res.end();
  });
});
