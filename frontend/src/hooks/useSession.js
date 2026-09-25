import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';

export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth-config'],
    queryFn: api.authConfig,
    retry: false,
  });
}

export function useSession() {
  return useQuery({
    queryKey: ['me'],
    retry: false,
    queryFn: async () => {
      try {
        return await api.me();
      } catch (error) {
        if (error.code === 'UNAUTHENTICATED' || error.status === 401) return null;
        throw error;
      }
    },
  });
}

export function useCanWrite() {
  const session = useSession();
  return {
    canWrite: Boolean(session.data?.email),
    ready: session.isFetched,
  };
}
