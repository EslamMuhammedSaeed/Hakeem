import { NavLink, Outlet } from 'react-router-dom';
import { Inbox, LayoutDashboard, PieChart, Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';
import { dateTime } from '../lib/format.js';
import BrandMark from './BrandMark.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';
import SessionControl from './SessionControl.jsx';

const NAV = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/positions', labelKey: 'nav.positions', icon: PieChart },
  { to: '/trades', labelKey: 'nav.trades', icon: Receipt },
  { to: '/inbox', labelKey: 'nav.inbox', icon: Inbox },
];

export default function Layout() {
  const { t } = useTranslation();
  const { connected, lastEventAt } = useLiveUpdates();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-e border-slate-800 bg-slate-950/60 px-4 py-6 md:flex">
        <div className="mb-4 px-2">
          <BrandMark />
          <p className="mt-1 text-xs text-slate-500">{t('brand.tagline')}</p>
        </div>

        <div className="mb-6 px-2">
          <LanguageSwitcher />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, labelKey, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-sky-500/10 text-sky-300' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <SessionControl />
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-slate-400">{connected ? t('stream.connected') : t('stream.polling')}</span>
            </div>
            {lastEventAt ? (
              <p className="mt-1 text-[11px] text-slate-600">{t('stream.lastEvent', { time: dateTime(lastEventAt) })}</p>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 md:hidden">
          <BrandMark compact />
          <nav className="flex gap-3 overflow-x-auto">
            {NAV.map(({ to, labelKey, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `text-sm whitespace-nowrap ${isActive ? 'text-sky-300' : 'text-slate-400'}`}
              >
                {t(labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <SessionControl compact />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
