import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { money, toLocalInputValue } from '../lib/format.js';
import { Button, ErrorBanner, Input, Ltr, Select, Spinner } from './ui.jsx';

const EMPTY = { side: 'BUY', symbol: '', quantity: '', price: '', fees: '0', note: '' };

export default function TradeFormDialog({ trade, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [executedAt, setExecutedAt] = useState(toLocalInputValue());

  useEffect(() => {
    if (trade) {
      setForm({
        side: trade.side,
        symbol: trade.symbol,
        quantity: String(Number(trade.quantity)),
        price: String(Number(trade.price)),
        fees: String(Number(trade.fees)),
        note: trade.note ?? '',
      });
      setExecutedAt(toLocalInputValue(trade.executedAt));
    }
  }, [trade]);

  const mutation = useMutation({
    mutationFn: (payload) => (trade ? api.updateTrade(trade.id, payload) : api.createTrade(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries();
      onClose();
    },
  });

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({
      side: form.side,
      symbol: form.symbol.trim().toUpperCase(),
      quantity: form.quantity,
      price: form.price,
      fees: form.fees === '' ? '0' : form.fees,
      note: form.note || null,
      executedAt: new Date(executedAt).toISOString(),
    });
  };

  const gross = (Number(form.quantity) || 0) * (Number(form.price) || 0);
  const fees = Number(form.fees) || 0;
  const net = form.side === 'BUY' ? gross + fees : gross - fees;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-100">{trade ? t('trades.editTitle') : t('trades.addTitle')}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-4">
          <ErrorBanner error={mutation.error} />

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-slate-400">{t('trades.side')}</span>
              <Select value={form.side} onChange={update('side')} className="w-full">
                <option value="BUY">{t('enums.side.BUY')}</option>
                <option value="SELL">{t('enums.side.SELL')}</option>
              </Select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">{t('trades.symbol')}</span>
              <Input
                value={form.symbol}
                onChange={update('symbol')}
                placeholder={t('trades.symbolPlaceholder')}
                required
                dir="ltr"
                className="w-full"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">{t('trades.quantity')}</span>
              <Input value={form.quantity} onChange={update('quantity')} inputMode="decimal" required dir="ltr" className="w-full" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">{t('trades.price')}</span>
              <Input value={form.price} onChange={update('price')} inputMode="decimal" required dir="ltr" className="w-full" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">{t('trades.fees')}</span>
              <Input value={form.fees} onChange={update('fees')} inputMode="decimal" dir="ltr" className="w-full" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-400">{t('trades.executedAt')}</span>
              <Input
                type="datetime-local"
                value={executedAt}
                onChange={(event) => setExecutedAt(event.target.value)}
                required
                dir="ltr"
                className="w-full"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-slate-400">{t('trades.note')}</span>
            <Input value={form.note} onChange={update('note')} placeholder={t('trades.notePlaceholder')} className="w-full" />
          </label>

          <p className="tabular rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
            {t('trades.netAmount')}{' '}
            <Ltr className="text-slate-200">
              {money(net)} {t('common.currency')}
            </Ltr>
            <span className="ms-1 text-slate-600">
              {form.side === 'BUY' ? t('trades.grossPlusFees') : t('trades.grossMinusFees')}
            </span>
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('trades.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner /> : null}
              {trade ? t('trades.save') : t('trades.add')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
