import { useTranslation } from 'react-i18next';

export default function BrandMark({ compact = false }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-base font-semibold text-sky-300">
        ح
      </span>
      {compact ? null : <span className="text-lg font-semibold text-slate-100">{t('brand.name')}</span>}
    </div>
  );
}
