import { Card } from './ui.jsx';

export default function StatCard({ label, value, hint, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'text-slate-100',
    gain: 'text-emerald-400',
    loss: 'text-rose-400',
  };

  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-slate-600" /> : null}
      </div>
      <p className={`tabular mt-2 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}
