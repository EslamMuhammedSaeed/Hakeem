import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useSession } from '../hooks/useSession.js';
import { Button } from './ui.jsx';

export function SignInToEdit({ className = '' }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/login"
      className={`inline-flex items-center rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-sky-300 hover:bg-slate-800 ${className}`}
    >
      {t('auth.signInToEdit')}
    </Link>
  );
}

export default function SessionControl({ compact = false }) {
  const { t } = useTranslation();
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      queryClient.setQueryData(['me'], null);
      navigate('/login');
    },
  });

  if (!session.isFetched) return null;

  if (session.data?.email) {
    return (
      <div className={compact ? 'flex items-center' : 'flex flex-col gap-2'}>
        {compact ? null : (
          <p dir="ltr" className="truncate text-[11px] text-slate-500">
            {session.data.email}
          </p>
        )}
        <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('auth.signOut')}
        </Button>
      </div>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-flex items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300 hover:bg-sky-500/15"
    >
      {t('auth.signIn')}
    </Link>
  );
}
