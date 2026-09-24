import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from './ui.jsx';
import { dateTime, money, price, quantity } from '../lib/format.js';

export default function TradesTable({ trades = [], onEdit, onDelete, compact = false }) {
  if (trades.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">No trades match these filters yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs tracking-wide text-slate-500 uppercase">
            <th className="px-5 py-3 font-medium">When</th>
            <th className="px-3 py-3 font-medium">Side</th>
            <th className="px-3 py-3 font-medium">Symbol</th>
            <th className="px-3 py-3 text-right font-medium">Qty</th>
            <th className="px-3 py-3 text-right font-medium">Price</th>
            {!compact && <th className="px-3 py-3 text-right font-medium">Fees</th>}
            <th className="px-3 py-3 text-right font-medium">Net</th>
            {!compact && <th className="px-3 py-3 font-medium">Source</th>}
            {onEdit || onDelete ? <th className="px-5 py-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
              <td className="tabular px-5 py-2.5 whitespace-nowrap text-slate-400">{dateTime(trade.executedAt)}</td>
              <td className="px-3 py-2.5">
                <Badge tone={trade.side === 'BUY' ? 'green' : 'red'}>{trade.side}</Badge>
              </td>
              <td className="px-3 py-2.5 font-medium text-slate-100">{trade.symbol}</td>
              <td className="tabular px-3 py-2.5 text-right text-slate-300">{quantity(trade.quantity)}</td>
              <td className="tabular px-3 py-2.5 text-right text-slate-300">{price(trade.price)}</td>
              {!compact && <td className="tabular px-3 py-2.5 text-right text-slate-500">{money(trade.fees)}</td>}
              <td className="tabular px-3 py-2.5 text-right font-medium text-slate-100">{money(trade.netAmount)}</td>
              {!compact && (
                <td className="px-3 py-2.5">
                  <Badge tone={trade.source === 'MANUAL' ? 'amber' : 'sky'}>
                    {trade.source === 'MANUAL' ? 'Manual' : 'Notification'}
                  </Badge>
                </td>
              )}
              {onEdit || onDelete ? (
                <td className="px-5 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit ? (
                      <button
                        onClick={() => onEdit(trade)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                        title="Edit trade"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        onClick={() => onDelete(trade)}
                        className="rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Delete trade"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
