import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { SignInToEdit } from '../components/SessionControl.jsx';
import TradesTable from '../components/TradesTable.jsx';
import TradeFormDialog from '../components/TradeFormDialog.jsx';
import { Button, Card, CardHeader, ErrorBanner, Input, Select, Spinner } from '../components/ui.jsx';
import { useCanWrite } from '../hooks/useSession.js';
import { dateTime } from '../lib/format.js';

const INITIAL_FILTERS = { q: '', side: '', source: '', from: '', to: '', page: 1, pageSize: 50 };

function toCsv(trades) {
  const header = ['id', 'executedAt', 'side', 'symbol', 'quantity', 'price', 'fees', 'netAmount', 'source', 'note'];
  const rows = trades.map((trade) =>
    header.map((key) => `"${String(trade[key] ?? '').replace(/"/g, '""')}"`).join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

export default function Trades() {
  const { t } = useTranslation();
  const { canWrite, ready } = useCanWrite();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [dialog, setDialog] = useState(null);

  const trades = useQuery({ queryKey: ['trades', filters], queryFn: () => api.trades(filters) });

  const remove = useMutation({
    mutationFn: (id) => api.deleteTrade(id),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value, page: 1 }));

  const exportCsv = () => {
    const csv = toCsv(trades.data?.items ?? []);
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `el-hakeem-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const data = trades.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t('trades.title')}</h1>
          <p className="text-sm text-slate-500">
            {data ? t('trades.summary', { count: data.total }) : t('trades.summaryLoading')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCsv} disabled={!data?.items?.length}>
            <Download className="h-4 w-4" /> {t('trades.csv')}
          </Button>
          {ready && canWrite ? (
            <Button variant="primary" onClick={() => setDialog({})}>
              <Plus className="h-4 w-4" /> {t('trades.add')}
            </Button>
          ) : null}
          {ready && !canWrite ? <SignInToEdit /> : null}
        </div>
      </div>

      <ErrorBanner error={trades.error ?? remove.error} />

      <Card>
        <CardHeader
          title={t('trades.filters')}
          actions={
            <Button variant="ghost" onClick={() => setFilters(INITIAL_FILTERS)}>
              {t('trades.reset')}
            </Button>
          }
        />
        <div className="flex flex-wrap gap-3 px-5 py-4">
          <Input
            placeholder={t('trades.searchPlaceholder')}
            value={filters.q}
            onChange={update('q')}
            className="w-48"
          />
          <Select value={filters.side} onChange={update('side')}>
            <option value="">{t('trades.anySide')}</option>
            <option value="BUY">{t('enums.side.BUY')}</option>
            <option value="SELL">{t('enums.side.SELL')}</option>
          </Select>
          <Select value={filters.source} onChange={update('source')}>
            <option value="">{t('trades.anySource')}</option>
            <option value="NOTIFICATION">{t('enums.source.NOTIFICATION')}</option>
            <option value="MANUAL">{t('enums.source.MANUAL')}</option>
          </Select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {t('trades.from')} <Input type="date" value={filters.from} onChange={update('from')} dir="ltr" />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            {t('trades.to')} <Input type="date" value={filters.to} onChange={update('to')} dir="ltr" />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t('trades.all')}
          subtitle={data ? t('trades.page', { page: data.page, pageCount: data.pageCount }) : undefined}
          actions={
            data && data.pageCount > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                >
                  {t('trades.prev')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={filters.page >= data.pageCount}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                >
                  {t('trades.next')}
                </Button>
              </div>
            ) : null
          }
        />
        {trades.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-slate-400">
            <Spinner /> {t('trades.loading')}
          </div>
        ) : (
          <TradesTable
            trades={data?.items ?? []}
            onEdit={canWrite ? (trade) => setDialog(trade) : undefined}
            onDelete={
              canWrite
                ? (trade) => {
                    const message = t('trades.confirmDelete', {
                      side: t(`enums.side.${trade.side}`),
                      symbol: trade.symbol,
                      when: dateTime(trade.executedAt),
                    });
                    if (window.confirm(message)) remove.mutate(trade.id);
                  }
                : undefined
            }
          />
        )}
      </Card>

      {dialog ? <TradeFormDialog trade={dialog.id ? dialog : null} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
