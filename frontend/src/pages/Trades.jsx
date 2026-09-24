import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { api } from '../api/client.js';
import TradesTable from '../components/TradesTable.jsx';
import TradeFormDialog from '../components/TradeFormDialog.jsx';
import { Button, Card, CardHeader, ErrorBanner, Input, Select, Spinner } from '../components/ui.jsx';
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
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [dialog, setDialog] = useState(null);

  const trades = useQuery({ queryKey: ['trades', filters], queryFn: () => api.trades(filters) });

  const remove = useMutation({
    mutationFn: (id) => api.deleteTrade(id),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const update = (key) => (event) =>
    setFilters((current) => ({ ...current, [key]: event.target.value, page: 1 }));

  const exportCsv = () => {
    const csv = toCsv(trades.data?.items ?? []);
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `egx-trades-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const data = trades.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Trades</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.total} trades` : 'Loading'} - parsed from notifications or added by hand
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCsv} disabled={!data?.items?.length}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="primary" onClick={() => setDialog({})}>
            <Plus className="h-4 w-4" /> Add trade
          </Button>
        </div>
      </div>

      <ErrorBanner error={trades.error ?? remove.error} />

      <Card>
        <CardHeader
          title="Filters"
          actions={
            <Button variant="ghost" onClick={() => setFilters(INITIAL_FILTERS)}>
              Reset
            </Button>
          }
        />
        <div className="flex flex-wrap gap-3 px-5 py-4">
          <Input placeholder="Symbol or note" value={filters.q} onChange={update('q')} className="w-48" />
          <Select value={filters.side} onChange={update('side')}>
            <option value="">Any side</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </Select>
          <Select value={filters.source} onChange={update('source')}>
            <option value="">Any source</option>
            <option value="NOTIFICATION">Notification</option>
            <option value="MANUAL">Manual</option>
          </Select>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            From <Input type="date" value={filters.from} onChange={update('from')} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            To <Input type="date" value={filters.to} onChange={update('to')} />
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="All trades"
          subtitle={data ? `Page ${data.page} of ${data.pageCount}` : undefined}
          actions={
            data && data.pageCount > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  disabled={filters.page >= data.pageCount}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            ) : null
          }
        />
        {trades.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-slate-400">
            <Spinner /> Loading trades...
          </div>
        ) : (
          <TradesTable
            trades={data?.items ?? []}
            onEdit={(trade) => setDialog(trade)}
            onDelete={(trade) => {
              if (window.confirm(`Delete the ${trade.side} of ${trade.symbol} on ${dateTime(trade.executedAt)}?`)) {
                remove.mutate(trade.id);
              }
            }}
          />
        )}
      </Card>

      {dialog ? <TradeFormDialog trade={dialog.id ? dialog : null} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
