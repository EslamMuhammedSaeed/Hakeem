import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, PieChart, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { SignInToEdit } from '../components/SessionControl.jsx';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Input, Spinner } from '../components/ui.jsx';
import { useCanWrite } from '../hooks/useSession.js';
import { dateTime, money, percent, price, quantity } from '../lib/format.js';

function warningText(warning, t) {
  if (warning?.code === 'UNMATCHED_SELL') return t('positions.unmatchedSell', { quantity: warning.quantity });
  return typeof warning === 'string' ? warning : '';
}

function MarkPriceCell({ position, canWrite }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(position.markPrice);

  const mutation = useMutation({
    mutationFn: (markPrice) => api.setMarkPrice(position.symbol, markPrice),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries();
    },
  });

  if (!canWrite) {
    return (
      <span dir="ltr" className="tabular" title={t('auth.signInToEdit')}>
        {price(position.markPrice)}
        {position.markSource === 'lastTrade' ? (
          <span className="ms-1 text-[10px] text-slate-600">{t('positions.lastTradeMark')}</span>
        ) : null}
      </span>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(Number(position.markPrice).toString());
          setEditing(true);
        }}
        className="tabular group inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-slate-800"
        title={t('positions.setMark')}
      >
        <span dir="ltr">{price(position.markPrice)}</span>
        {position.markSource === 'lastTrade' ? (
          <span className="text-[10px] text-slate-600 group-hover:text-slate-400">{t('positions.lastTradeMark')}</span>
        ) : null}
      </button>
    );
  }

  return (
    <form
      className="flex items-center justify-end gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(value);
      }}
    >
      <Input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-24 py-1 text-end"
        dir="ltr"
        inputMode="decimal"
      />
      <button type="submit" className="rounded p-1 text-emerald-400 hover:bg-slate-800" title={t('positions.save')}>
        {mutation.isPending ? <Spinner /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="rounded p-1 text-slate-500 hover:bg-slate-800">
        <X className="h-3.5 w-3.5" />
      </button>
      {mutation.isError ? <ErrorBanner error={mutation.error} /> : null}
    </form>
  );
}

export default function Positions() {
  const { t } = useTranslation();
  const { canWrite, ready } = useCanWrite();
  const [showClosed, setShowClosed] = useState(false);
  const positions = useQuery({
    queryKey: ['positions', showClosed],
    queryFn: () => api.positions({ includeClosed: showClosed ? 'true' : 'false' }),
  });

  if (positions.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Spinner /> {t('positions.loading')}
      </div>
    );
  }
  if (positions.isError) return <ErrorBanner error={positions.error} />;

  const rows = positions.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t('positions.title')}</h1>
          <p className="text-sm text-slate-500">{canWrite ? t('positions.subtitle') : t('positions.subtitleReadOnly')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ready && !canWrite ? <SignInToEdit /> : null}
          <Button variant={showClosed ? 'primary' : 'default'} onClick={() => setShowClosed((current) => !current)}>
            {showClosed ? t('positions.hideClosed') : t('positions.showClosed')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title={t('positions.holdings')} subtitle={t('positions.symbolCount', { count: rows.length })} />
        {rows.length === 0 ? (
          <EmptyState icon={PieChart} title={t('positions.emptyTitle')} description={t('positions.emptyDescription')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-start text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">{t('positions.symbol')}</th>
                  <th className="px-3 py-3 text-end font-medium">{t('positions.qty')}</th>
                  <th className="px-3 py-3 text-end font-medium">{t('positions.avgCost')}</th>
                  <th className="px-3 py-3 text-end font-medium">{t('positions.mark')}</th>
                  <th className="px-3 py-3 text-end font-medium">{t('positions.marketValue')}</th>
                  <th className="px-3 py-3 text-end font-medium">{t('positions.unrealized')}</th>
                  <th className="px-3 py-3 text-end font-medium">{t('positions.realized')}</th>
                  <th className="px-3 py-3 text-end font-medium">{t('positions.fees')}</th>
                  <th className="px-5 py-3 font-medium">{t('positions.lastTrade')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((position) => (
                  <tr key={position.symbol} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span dir="ltr" className="font-medium text-slate-100">
                          {position.symbol}
                        </span>
                        {!position.isOpen ? <Badge>{t('positions.closed')}</Badge> : null}
                        {position.warnings.length > 0 ? (
                          <span title={position.warnings.map((warning) => warningText(warning, t)).join('\n')}>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td dir="ltr" className="tabular px-3 py-3 text-end text-slate-300">
                      {quantity(position.quantity)}
                    </td>
                    <td dir="ltr" className="tabular px-3 py-3 text-end text-slate-300">
                      {price(position.avgCost)}
                    </td>
                    <td className="px-3 py-3 text-end text-slate-300">
                      <MarkPriceCell position={position} canWrite={canWrite} />
                    </td>
                    <td dir="ltr" className="tabular px-3 py-3 text-end text-slate-100">
                      {money(position.marketValue)}
                    </td>
                    <td
                      dir="ltr"
                      className={`tabular px-3 py-3 text-end ${
                        Number(position.unrealizedPnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {money(position.unrealizedPnl, { sign: true })}
                      <span className="ms-1 text-xs opacity-70">{percent(position.unrealizedPct)}</span>
                    </td>
                    <td
                      dir="ltr"
                      className={`tabular px-3 py-3 text-end ${
                        Number(position.realizedPnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {money(position.realizedPnl, { sign: true })}
                    </td>
                    <td dir="ltr" className="tabular px-3 py-3 text-end text-slate-500">
                      {money(position.totalFees)}
                    </td>
                    <td dir="ltr" className="tabular px-5 py-3 text-end whitespace-nowrap text-slate-500">
                      {dateTime(position.lastTradeAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
