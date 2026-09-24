import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { streamUrl } from '../api/client.js';

/**
 * Subscribes to the backend event stream and invalidates every query whenever a trade
 * or notification lands, so a fill on the phone shows up here without a refresh.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState(null);

  useEffect(() => {
    const source = new EventSource(streamUrl);

    const invalidate = () => {
      setLastEventAt(new Date());
      queryClient.invalidateQueries();
    };

    source.addEventListener('connected', () => setConnected(true));
    source.addEventListener('trade', invalidate);
    source.addEventListener('notification', invalidate);
    source.onerror = () => setConnected(false);
    source.onopen = () => setConnected(true);

    return () => source.close();
  }, [queryClient]);

  return { connected, lastEventAt };
}
