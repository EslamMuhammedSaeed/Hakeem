import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n/index.js';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ar';

  return (
    <div className="inline-flex rounded-lg border border-slate-700 p-0.5" role="group" aria-label={t('lang.switch')}>
      {[
        ['ar', 'ع'],
        ['en', 'EN'],
      ].map(([lang, label]) => (
        <button
          key={lang}
          type="button"
          aria-pressed={current === lang}
          onClick={() => changeLanguage(lang)}
          className={`rounded-md px-2 py-1 text-xs font-medium ${
            current === lang ? 'bg-sky-500/15 text-sky-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
