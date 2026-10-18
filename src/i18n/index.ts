// UI strings (SPEC §10: i18next, EN now, DE in Phase 2). Numbers and dates use Intl.
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

void i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false }, // React escapes; strings are never injected as HTML
  initAsync: false,
});

export default i18next;
