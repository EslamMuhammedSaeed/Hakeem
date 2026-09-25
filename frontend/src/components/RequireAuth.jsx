import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthConfig, useSession } from '../hooks/useSession.js';
import { ErrorBanner, Spinner } from './ui.jsx';

export default function RequireAuth() {
  const { t } = useTranslation();
  const location = useLocation();
  const config = useAuthConfig();
  const session = useSession();

  if (config.isLoading || session.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-400">
        <Spinner /> {t('common.loading')}
      </div>
    );
  }

  if (config.isError) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-8">
        <ErrorBanner error={config.error} />
        <p className="text-sm text-slate-500">{t('dashboard.connectionError')}</p>
      </div>
    );
  }

  if (config.data?.requireAuthForReads && !session.data?.email) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
