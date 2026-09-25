import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Coins, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import PnlChart from '../components/PnlChart.jsx';
import TradesTable from '../components/TradesTable.jsx';
import { Card, CardHeader, ErrorBanner, Ltr, Spinner } from '../components/ui.jsx';
import { money, percent, price, quantity } from '../lib/format.js';

export default function Dashboard() {
  const { t } = useTranslation();
  const summary = useQuery({ queryKey: ['summary'], queryFn: api.summary });
  const recent = useQuery({ queryKey: ['trades', 'recent'], queryFn: () => api.trades({ pageSize: 8 }) });

  if (summary.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Spinner /> {t('dashboard.loading')}
      </div>
    );
  }

  if (summary.isError) {
    return (
      <div className="space-y-3">
        <ErrorBanner error={summary.error} />
        <p className="text-sm text-slate-500">{t('dashboard.connectionError')}</p>
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
          <h1 className="text-2xl font-semibold text-slate-100">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-500">
            {t('dashboard.summary', {
              tradeCount: data.tradeCount,
              symbolCount: data.symbolCount,
              currency: t('common.currency'),
            })}
          </p>
        </div>
      </div>

      {failedCount > 0 ? (
        <Link
          to="/inbox"
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/15"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('dashboard.failed', { count: failedCount })}
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={t('dashboard.totalPnl')}
          value={money(data.totalPnl, { sign: true })}
          hint={t('dashboard.totalHint', { percent: percent(totalReturn), cost: money(data.costBasis) })}
          tone={totalPnlTone}
          icon={TrendingUp}
        />
        <StatCard
          label={t('dashboard.realized')}
          value={money(data.realizedPnl, { sign: true })}
          hint={t('dashboard.realizedHint')}
          tone={Number(data.realizedPnl) >= 0 ? 'gain' : 'loss'}
          icon={Coins}
        />
        <StatCard
          label={t('dashboard.unrealized')}
          value={money(data.unrealizedPnl, { sign: true })}
          hint={t('dashboard.unrealizedHint')}
          tone={Number(data.unrealizedPnl) >= 0 ? 'gain' : 'loss'}
          icon={Wallet}
        />
        <StatCard
          label={t('dashboard.marketValue')}
          value={money(data.marketValue)}
          hint={t('dashboard.openPositions', { count: data.openPositionCount })}
        />
        <StatCard
          label={t('dashboard.tradesToday')}
          value={data.tradesToday}
          hint={t('dashboard.feesHint', { fees: money(data.totalFees) })}
          icon={Receipt}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t('dashboard.chartTitle')} subtitle={t('dashboard.chartSubtitle')} />
          <PnlChart series={data.pnlSeries} />
        </Card>

        <Card>
          <CardHeader title={t('dashboard.topPositions')} subtitle={t('dashboard.byMarketValue')} />
          <div className="divide-y divide-slate-800/60">
            {data.topPositions.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">{t('dashboard.noPositions')}</p>
            ) : (
              data.topPositions.map((position) => (
                <div key={position.symbol} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p dir="ltr" className="font-medium text-slate-100">
                      {position.symbol}
                    </p>
                    <p className="tabular text-xs text-slate-500">
                      <Ltr>
                        {quantity(position.quantity)} @ {price(position.avgCost)}
                      </Ltr>
                    </p>
                  </div>
                  <div className="text-end">
                    <p dir="ltr" className="tabular text-sm text-slate-200">
                      {money(position.marketValue)}
                    </p>
                    <p
                      dir="ltr"
                      className={`tabular text-xs ${Number(position.unrealizedPnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
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
          title={t('dashboard.recentTrades')}
          subtitle={t('dashboard.newestFirst')}
          actions={
            <Link to="/trades" className="text-xs text-sky-400 hover:text-sky-300">
              {t('dashboard.viewAll')}
            </Link>
          }
        />
        <TradesTable trades={recent.data?.items ?? []} compact />
      </Card>
    </div>
  );
}
