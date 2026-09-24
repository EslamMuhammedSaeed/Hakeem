import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dateOnly, money } from '../lib/format.js';

export default function PnlChart({ series = [] }) {
  const data = series.map((point) => ({ ...point, cumulative: Number(point.cumulative), realized: Number(point.realized) }));

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Realized P&amp;L appears here once you have closed part of a position.
      </div>
    );
  }

  return (
    <div className="h-64 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(value) => dateOnly(value).slice(0, 6)}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={(value) => money(value)}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            labelFormatter={(value) => dateOnly(value)}
            formatter={(value, name) => [`${money(value)} EGP`, name === 'cumulative' ? 'Cumulative' : 'That day']}
          />
          <Area type="monotone" dataKey="cumulative" stroke="#38bdf8" strokeWidth={2} fill="url(#pnlFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
