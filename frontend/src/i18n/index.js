import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

export const LANG_KEY = 'el-hakeem.lang';
export const SUPPORTED_LANGS = ['ar', 'en'];

export function readStoredLanguage() {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return SUPPORTED_LANGS.includes(value) ? value : 'ar';
  } catch {
    return 'ar';
  }
}

export function applyDocumentLocale(lang) {
  const next = SUPPORTED_LANGS.includes(lang) ? lang : 'ar';
  document.documentElement.lang = next;
  document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  return next;
}

export function changeLanguage(lang) {
  const next = applyDocumentLocale(lang);
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // Private mode can reject storage; the document locale still updates.
  }
  return i18n.changeLanguage(next);
}

const initial = readStoredLanguage();

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: initial,
  fallbackLng: 'ar',
  supportedLngs: SUPPORTED_LANGS,
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});

applyDocumentLocale(initial);

export default i18n;
