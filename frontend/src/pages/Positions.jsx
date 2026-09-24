import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, PieChart, X } from 'lucide-react';
import { api } from '../api/client.js';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Input, Spinner } from '../components/ui.jsx';
import { dateTime, money, percent, price, quantity } from '../lib/format.js';

function MarkPriceCell({ position }) {
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

  if (!editing) {
    return (
      <button
        onClick={() => {
          setValue(Number(position.markPrice).toString());
          setEditing(true);
        }}
        className="tabular group inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-slate-800"
        title="Click to set the current market price"
      >
        {price(position.markPrice)}
        {position.markSource === 'lastTrade' ? (
          <span className="text-[10px] text-slate-600 group-hover:text-slate-400">last</span>
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
        className="w-24 py-1 text-right"
        inputMode="decimal"
      />
      <button type="submit" className="rounded p-1 text-emerald-400 hover:bg-slate-800" title="Save">
        {mutation.isPending ? <Spinner /> : <Check className="h-3.5 w-3.5" />}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="rounded p-1 text-slate-500 hover:bg-slate-800">
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export default function Positions() {
  const [showClosed, setShowClosed] = useState(false);
  const positions = useQuery({
    queryKey: ['positions', showClosed],
    queryFn: () => api.positions({ includeClosed: showClosed ? 'true' : 'false' }),
  });

  if (positions.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Spinner /> Computing positions...
      </div>
    );
  }
  if (positions.isError) return <ErrorBanner error={positions.error} />;

  const rows = positions.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Positions</h1>
          <p className="text-sm text-slate-500">
            FIFO cost basis including commission. Click a mark price to set the current market price.
          </p>
        </div>
        <Button variant={showClosed ? 'primary' : 'default'} onClick={() => setShowClosed((current) => !current)}>
          {showClosed ? 'Hiding nothing' : 'Show closed symbols'}
        </Button>
      </div>

      <Card>
        <CardHeader title="Holdings" subtitle={`${rows.length} symbols`} />
        {rows.length === 0 ? (
          <EmptyState
            icon={PieChart}
            title="No positions yet"
            description="Once a buy notification is parsed, the position appears here with its FIFO cost basis."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-5 py-3 font-medium">Symbol</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Avg cost</th>
                  <th className="px-3 py-3 text-right font-medium">Mark</th>
                  <th className="px-3 py-3 text-right font-medium">Market value</th>
                  <th className="px-3 py-3 text-right font-medium">Unrealized</th>
                  <th className="px-3 py-3 text-right font-medium">Realized</th>
                  <th className="px-3 py-3 text-right font-medium">Fees</th>
                  <th className="px-5 py-3 font-medium">Last trade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((position) => (
                  <tr key={position.symbol} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-100">{position.symbol}</span>
                        {!position.isOpen ? <Badge>closed</Badge> : null}
                        {position.warnings.length > 0 ? (
                          <span title={position.warnings.join('\n')}>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="tabular px-3 py-3 text-right text-slate-300">{quantity(position.quantity)}</td>
                    <td className="tabular px-3 py-3 text-right text-slate-300">{price(position.avgCost)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">
                      <MarkPriceCell position={position} />
                    </td>
                    <td className="tabular px-3 py-3 text-right text-slate-100">{money(position.marketValue)}</td>
                    <td
                      className={`tabular px-3 py-3 text-right ${
                        Number(position.unrealizedPnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {money(position.unrealizedPnl, { sign: true })}
                      <span className="ml-1 text-xs opacity-70">{percent(position.unrealizedPct)}</span>
                    </td>
                    <td
                      className={`tabular px-3 py-3 text-right ${
                        Number(position.realizedPnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {money(position.realizedPnl, { sign: true })}
                    </td>
                    <td className="tabular px-3 py-3 text-right text-slate-500">{money(position.totalFees)}</td>
                    <td className="tabular px-5 py-3 whitespace-nowrap text-slate-500">{dateTime(position.lastTradeAt)}</td>
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
