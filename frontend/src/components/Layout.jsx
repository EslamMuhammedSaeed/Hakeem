import { NavLink } from 'react-router-dom';
import { Activity, Inbox, LayoutDashboard, PieChart, Receipt } from 'lucide-react';
import { useLiveUpdates } from '../hooks/useLiveUpdates.js';
import { dateTime } from '../lib/format.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/positions', label: 'Positions', icon: PieChart },
  { to: '/trades', label: 'Trades', icon: Receipt },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
];

export default function Layout({ children }) {
  const { connected, lastEventAt } = useLiveUpdates();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950/60 px-4 py-6 md:flex">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-400" />
            <span className="text-lg font-semibold text-slate-100">EGX Tracker</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Thndr notification pipeline</p>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-slate-400">{connected ? 'Live stream connected' : 'Polling every 15s'}</span>
          </div>
          {lastEventAt ? <p className="mt-1 text-[11px] text-slate-600">Last event {dateTime(lastEventAt)}</p> : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-slate-800 px-4 py-3 md:hidden">
          <Activity className="h-5 w-5 text-sky-400" />
          <nav className="flex gap-3 overflow-x-auto">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `text-sm whitespace-nowrap ${isActive ? 'text-sky-300' : 'text-slate-400'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
