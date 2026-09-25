import { useState } from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import BrandMark from '../components/BrandMark.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';
import { Button, ErrorBanner, Input, Spinner } from '../components/ui.jsx';
import { useAuthConfig, useSession } from '../hooks/useSession.js';

export default function Login() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const config = useAuthConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: () => api.login({ email, password }),
    onSuccess: (user) => {
      queryClient.setQueryData(['me'], user);
      const from = location.state?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    },
  });

  if (session.data?.email) {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <BrandMark />
          <LanguageSwitcher />
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-5"
        >
          <div>
            <h1 className="text-lg font-semibold text-slate-100">{t('login.title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>
          </div>
          <ErrorBanner error={login.error} />
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">{t('login.email')}</span>
            <Input
              type="email"
              dir="ltr"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">{t('login.password')}</span>
            <Input
              type="password"
              dir="ltr"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full"
            />
          </label>
          <Button type="submit" variant="primary" className="w-full justify-center" disabled={login.isPending}>
            {login.isPending ? <Spinner /> : null}
            {t('login.submit')}
          </Button>
          {config.data && !config.data.requireAuthForReads ? (
            <Link to="/" className="block text-center text-xs text-slate-500 hover:text-slate-300">
              {t('login.back')}
            </Link>
          ) : null}
        </form>
      </div>
    </div>
  );
}
