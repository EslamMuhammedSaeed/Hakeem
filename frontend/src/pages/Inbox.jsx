import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Inbox as InboxIcon, RefreshCw, Trash2, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { SignInToEdit } from '../components/SessionControl.jsx';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorBanner, Input, Ltr, Spinner } from '../components/ui.jsx';
import { useCanWrite } from '../hooks/useSession.js';
import { dateTime, money, price, quantity } from '../lib/format.js';

const STATUS_TONES = { PARSED: 'green', FAILED: 'red', IGNORED: 'slate', PENDING: 'amber' };
const TABS = ['ALL', 'FAILED', 'PARSED', 'IGNORED'];

function ParserPlayground() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const preview = useMutation({ mutationFn: (body) => api.previewParse(body) });
  const rules = useQuery({ queryKey: ['rules'], queryFn: api.rules });
  const result = preview.data;

  return (
    <Card>
      <CardHeader title={t('inbox.playgroundTitle')} subtitle={t('inbox.playgroundSubtitle')} />
      <div className="space-y-4 px-5 py-4">
        <textarea
          dir="auto"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('inbox.placeholder')}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-500"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={!text.trim() || preview.isPending}
            onClick={() => preview.mutate({ body: text })}
          >
            {preview.isPending ? <Spinner /> : <FlaskConical className="h-4 w-4" />} {t('inbox.testParse')}
          </Button>
          {result ? <Badge tone={STATUS_TONES[result.status]}>{t(`enums.status.${result.status}`)}</Badge> : null}
          {result?.ruleId ? <span className="text-xs text-slate-500">{t('inbox.matched', { rule: result.ruleId })}</span> : null}
        </div>

        <ErrorBanner error={preview.error} />

        {result ? (
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm">
            {result.trade ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ['trades.side', t(`enums.side.${result.trade.side}`)],
                  ['trades.symbol', result.trade.symbol],
                  ['trades.quantity', quantity(result.trade.quantity)],
                  ['trades.price', price(result.trade.price)],
                  ['trades.fees', money(result.trade.fees)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] text-slate-500">{t(label)}</p>
                    <p dir="ltr" className="tabular text-slate-100">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400">{result.error ?? t('inbox.nonTrade')}</p>
            )}
            <div className="border-t border-slate-800 pt-2 text-xs text-slate-500">
              <p dir="auto">
                <span className="text-slate-600">{t('inbox.normalized')} </span>
                {result.normalized}
              </p>
            </div>
          </div>
        ) : null}

        {rules.data ? (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer text-slate-400">{t('inbox.activeRules', { count: rules.data.length })}</summary>
            <ul className="mt-2 space-y-2">
              {rules.data.map((rule) => (
                <li key={rule.id} className="rounded border border-slate-800 px-3 py-2">
                  <p className="text-slate-300">{rule.id}</p>
                  <p dir="auto" className="text-slate-500">
                    {rule.description}
                  </p>
                  <code dir="ltr" className="mt-1 block break-all text-[11px] text-slate-600">
                    {rule.pattern}
                  </code>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Card>
  );
}

export default function InboxPage() {
  const { t } = useTranslation();
  const { canWrite, ready } = useCanWrite();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const notifications = useQuery({
    queryKey: ['notifications', status, search],
    queryFn: () => api.notifications({ status: status === 'ALL' ? undefined : status, q: search, pageSize: 100 }),
  });

  const reparseOne = useMutation({
    mutationFn: (id) => api.reparse(id),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const reparseFailed = useMutation({
    mutationFn: () => api.reparseFailed(),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const remove = useMutation({
    mutationFn: (id) => api.deleteNotification(id),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const data = notifications.data;
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{t('inbox.title')}</h1>
          <p className="text-sm text-slate-500">
            {t('inbox.subtitle')} <span className="text-slate-400">{t('inbox.rulesFile')}</span>
          </p>
        </div>
        {ready && canWrite ? (
          <Button variant="primary" onClick={() => reparseFailed.mutate()} disabled={reparseFailed.isPending}>
            {reparseFailed.isPending ? <Spinner /> : <Wand2 className="h-4 w-4" />} {t('inbox.reparseFailed')}
          </Button>
        ) : null}
        {ready && !canWrite ? <SignInToEdit /> : null}
      </div>

      {reparseFailed.data ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">
          {t('inbox.reparseResult', reparseFailed.data)}
        </div>
      ) : null}

      <ErrorBanner error={notifications.error ?? reparseOne.error ?? remove.error} />

      <ParserPlayground />

      <Card>
        <CardHeader
          title={t('inbox.received')}
          subtitle={data ? t('inbox.stored', { count: data.total }) : undefined}
          actions={
            <Input placeholder={t('inbox.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
          }
        />

        <div className="flex flex-wrap gap-2 border-b border-slate-800 px-5 py-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatus(tab)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                status === tab ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {t(`enums.status.${tab}`)}
              {tab !== 'ALL' && counts[tab] !== undefined ? (
                <span dir="ltr" className="ms-1.5 text-slate-500">
                  {counts[tab]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {notifications.isLoading ? (
          <div className="flex items-center gap-2 px-5 py-10 text-sm text-slate-400">
            <Spinner /> {t('inbox.loading')}
          </div>
        ) : (data?.items ?? []).length === 0 ? (
          <EmptyState icon={InboxIcon} title={t('inbox.emptyTitle')} description={t('inbox.emptyDescription')} />
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {data.items.map((item) => (
              <li key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONES[item.status]}>{t(`enums.status.${item.status}`)}</Badge>
                      {item.matchedRule ? <span className="text-[11px] text-slate-500">{item.matchedRule}</span> : null}
                      <span dir="ltr" className="text-[11px] text-slate-600">
                        {dateTime(item.postedAt ?? item.receivedAt)}
                      </span>
                      {item.appPackage ? <span className="text-[11px] text-slate-600">{item.appPackage}</span> : null}
                    </div>
                    {item.title ? (
                      <p dir="auto" className="text-xs text-slate-500">
                        {item.title}
                      </p>
                    ) : null}
                    <p dir="auto" className="text-sm text-slate-200">
                      {item.body}
                    </p>

                    {item.trade ? (
                      <p className="tabular mt-1.5 text-xs text-emerald-400/90">
                        {t(`enums.side.${item.trade.side}`)}{' '}
                        <Ltr>
                          {quantity(item.trade.quantity)} {item.trade.symbol} @ {price(item.trade.price)} ={' '}
                          {money(item.trade.netAmount)} {t('common.currency')}
                        </Ltr>
                      </p>
                    ) : null}
                    {item.parseError ? <p className="mt-1.5 text-xs text-amber-400/80">{item.parseError}</p> : null}
                  </div>

                  {canWrite ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => reparseOne.mutate(item.id)}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-sky-300"
                        title={t('inbox.reparse')}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(t('inbox.confirmDelete'))) remove.mutate(item.id);
                        }}
                        className="rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                        title={t('inbox.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
