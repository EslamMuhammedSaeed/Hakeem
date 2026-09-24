import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(50);

export const EVENTS = {
  TRADE_CHANGED: 'trade:changed',
  NOTIFICATION_RECEIVED: 'notification:received',
};

export function emitTradeChanged(payload) {
  bus.emit(EVENTS.TRADE_CHANGED, payload);
}

export function emitNotificationReceived(payload) {
  bus.emit(EVENTS.NOTIFICATION_RECEIVED, payload);
}
