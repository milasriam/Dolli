import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const LOCALE_STORAGE_KEY = 'dolli-locale';
export const SUPPORTED_LOCALES = ['en', 'ru'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function readStoredLocale(): SupportedLocale | null {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === 'en' || v === 'ru') return v;
  } catch {
    /* ignore */
  }
  return null;
}

function detectLocale(): SupportedLocale {
  const stored = readStoredLocale();
  if (stored) return stored;
  if (typeof navigator !== 'undefined') {
    const lang = (navigator.language || '').toLowerCase();
    if (lang.startsWith('ru')) return 'ru';
  }
  return 'en';
}

const initial = detectLocale();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function applyDocumentLang(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng === 'ru' ? 'ru' : 'en';
  }
}

applyDocumentLang(initial);

i18n.on('languageChanged', (lng) => {
  try {
    if (lng === 'en' || lng === 'ru') {
      localStorage.setItem(LOCALE_STORAGE_KEY, lng);
    }
  } catch {
    /* ignore */
  }
  applyDocumentLang(lng);
});

export default i18n;
