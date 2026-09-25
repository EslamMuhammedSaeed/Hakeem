import { Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { dateTime, money, price, quantity } from '../lib/format.js';
import { Badge } from './ui.jsx';

export default function TradesTable({ trades = [], onEdit, onDelete, compact = false }) {
  const { t } = useTranslation();

  if (trades.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-500">{t('trades.empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-start text-xs text-slate-500">
            <th className="px-5 py-3 font-medium">{t('trades.when')}</th>
            <th className="px-3 py-3 font-medium">{t('trades.side')}</th>
            <th className="px-3 py-3 font-medium">{t('trades.symbol')}</th>
            <th className="px-3 py-3 text-end font-medium">{t('trades.qty')}</th>
            <th className="px-3 py-3 text-end font-medium">{t('trades.price')}</th>
            {!compact && <th className="px-3 py-3 text-end font-medium">{t('trades.fees')}</th>}
            <th className="px-3 py-3 text-end font-medium">{t('trades.net')}</th>
            {!compact && <th className="px-3 py-3 font-medium">{t('trades.source')}</th>}
            {onEdit || onDelete ? <th className="px-5 py-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30">
              <td className="tabular px-5 py-2.5 whitespace-nowrap text-slate-400">
                {dateTime(trade.executedAt)}
              </td>
              <td className="px-3 py-2.5">
                <Badge tone={trade.side === 'BUY' ? 'green' : 'red'}>{t(`enums.side.${trade.side}`)}</Badge>
              </td>
              <td dir="ltr" className="px-3 py-2.5 font-medium text-slate-100">
                {trade.symbol}
              </td>
              <td dir="ltr" className="tabular px-3 py-2.5 text-end text-slate-300">
                {quantity(trade.quantity)}
              </td>
              <td dir="ltr" className="tabular px-3 py-2.5 text-end text-slate-300">
                {price(trade.price)}
              </td>
              {!compact && (
                <td dir="ltr" className="tabular px-3 py-2.5 text-end text-slate-500">
                  {money(trade.fees)}
                </td>
              )}
              <td dir="ltr" className="tabular px-3 py-2.5 text-end font-medium text-slate-100">
                {money(trade.netAmount)}
              </td>
              {!compact && (
                <td className="px-3 py-2.5">
                  <Badge tone={trade.source === 'MANUAL' ? 'amber' : 'sky'}>{t(`enums.source.${trade.source}`)}</Badge>
                </td>
              )}
              {onEdit || onDelete ? (
                <td className="px-5 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {onEdit ? (
                      <button
                        type="button"
                        onClick={() => onEdit(trade)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                        title={t('trades.edit')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(trade)}
                        className="rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                        title={t('trades.delete')}
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
