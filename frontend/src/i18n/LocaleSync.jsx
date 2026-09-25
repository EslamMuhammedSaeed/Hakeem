import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { applyDocumentLocale } from './index.js';

export default function LocaleSync() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const lang = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'ar';
    applyDocumentLocale(lang);
    document.title = t('brand.name');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('brand.description'));
  }, [i18n.language, i18n.resolvedLanguage, t]);

  return null;
}
