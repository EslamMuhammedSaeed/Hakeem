import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Coins, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { api } from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import PnlChart from '../components/PnlChart.jsx';
import TradesTable from '../components/TradesTable.jsx';
import { Card, CardHeader, ErrorBanner, Spinner } from '../components/ui.jsx';
import { money, percent } from '../lib/format.js';

export default function Dashboard() {
  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const recent = useQuery({ queryKey: ['trades', 'recent'], queryFn: () => api.trades({ pageSize: 8 }) });

  if (summary.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Spinner /> Loading portfolio...
      </div>
    );
  }

  if (summary.isError) {
    return (
      <div className="space-y-3">
        <ErrorBanner error={summary.error} />
        <p className="text-sm text-slate-500">
          Check that the backend is running on the URL in <code className="text-slate-300">VITE_API_URL</code> and that{' '}
          <code className="text-slate-300">VITE_API_KEY</code> matches the backend&apos;s{' '}
          <code className="text-slate-300">WEBHOOK_API_KEY</code>.
        </p>
      </div>
    );
  }

  const data = summary.data;
  const failedCount = data.notificationCounts?.FAILED ?? 0;
  const totalPnlTone = Number(data.totalPnl) > 0 ? 'gain' : Number(data.totalPnl) < 0 ? 'loss' : 'neutral';
  const costBasis = Number(data.costBasis);
  const totalReturn = costBasis > 0 ? (Number(data.totalPnl) / costBasis) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Portfolio</h1>
          <p className="text-sm text-slate-500">
            {data.tradeCount} trades captured across {data.symbolCount} symbols, all amounts in {data.currency}
          </p>
        </div>
      </div>

      {failedCount > 0 ? (
        <Link
          to="/inbox"
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/15"
        >
          <AlertTriangle className="h-4 w-4" />
          {failedCount} notification{failedCount === 1 ? '' : 's'} could not be parsed. Open the inbox to see the text
          and add a rule.
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total P&L"
          value={`${money(data.totalPnl, { sign: true })}`}
          hint={`${percent(totalReturn)} on ${money(data.costBasis)} cost basis`}
          tone={totalPnlTone}
          icon={TrendingUp}
        />
        <StatCard
          label="Realized"
          value={money(data.realizedPnl, { sign: true })}
          hint="Closed with FIFO matching"
          tone={Number(data.realizedPnl) >= 0 ? 'gain' : 'loss'}
          icon={Coins}
        />
        <StatCard
          label="Unrealized"
          value={money(data.unrealizedPnl, { sign: true })}
          hint="Against mark price"
          tone={Number(data.unrealizedPnl) >= 0 ? 'gain' : 'loss'}
          icon={Wallet}
        />
        <StatCard label="Market value" value={money(data.marketValue)} hint={`${data.openPositionCount} open positions`} />
        <StatCard label="Trades today" value={data.tradesToday} hint={`${money(data.totalFees)} fees all time`} icon={Receipt} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Cumulative realized P&L" subtitle="Stamped on the day each sale closed a lot" />
          <PnlChart series={data.pnlSeries} />
        </Card>

        <Card>
          <CardHeader title="Top positions" subtitle="By market value" />
          <div className="divide-y divide-slate-800/60">
            {data.topPositions.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No open positions.</p>
            ) : (
              data.topPositions.map((position) => (
                <div key={position.symbol} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-medium text-slate-100">{position.symbol}</p>
                    <p className="tabular text-xs text-slate-500">
                      {Number(position.quantity)} @ {Number(position.avgCost).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm text-slate-200">{money(position.marketValue)}</p>
                    <p
                      className={`tabular text-xs ${
                        Number(position.unrealizedPnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {money(position.unrealizedPnl, { sign: true })} ({percent(position.unrealizedPct)})
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent trades"
          subtitle="Newest first"
          actions={
            <Link to="/trades" className="text-xs text-sky-400 hover:text-sky-300">
              View all
            </Link>
          }
        />
        <TradesTable trades={recent.data?.items ?? []} compact />
      </Card>
    </div>
  );
}
