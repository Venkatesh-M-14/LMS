import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { en } from './locales/en';
import { ta } from './locales/ta';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ta: { translation: ta },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES.map((locale) => locale.code),
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'academy.locale',
    },
  });

export { i18n };
