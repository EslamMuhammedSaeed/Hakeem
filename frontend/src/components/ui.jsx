import { Loader2 } from 'lucide-react';

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Button({ variant = 'default', className = '', children, ...props }) {
  const variants = {
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700',
    primary: 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white border-rose-500',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 border-transparent',
  };
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300 border-slate-700',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    red: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className}`} />;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {Icon ? <Icon className="h-8 w-8 text-slate-600" /> : null}
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description ? <p className="max-w-md text-xs text-slate-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
      {error.message}
    </div>
  );
}
