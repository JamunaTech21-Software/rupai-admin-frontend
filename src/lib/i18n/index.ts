import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import { bn } from './locales/bn';
import { en } from './locales/en';

/**
 * Localisation (F0.07, Spec P5 §14): react-i18next with English and Bangla, namespaced keys, and no
 * user-facing string written into a component. The resources are bundled, so the first render is already in
 * the right language. The choice is remembered in this browser and set on <html lang>, so screen readers and
 * fonts switch too.
 */
export const LANGUAGES = ['en', 'bn'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'rupai:language';

function storedLanguage(): Language {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources: { en, bn },
  lng: storedLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...LANGUAGES],
  ns: Object.keys(en),
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

function applyToDocument(language: Language) {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}
applyToDocument(i18n.language === 'bn' ? 'bn' : 'en');

export function currentLanguage(): Language {
  return i18n.language === 'bn' ? 'bn' : 'en';
}

/** Switches the language everywhere at once and remembers it in this browser. */
export async function setLanguage(language: Language): Promise<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
  applyToDocument(language);
  await i18n.changeLanguage(language);
}

/** The active language, re-rendering when it changes. */
export function useLanguage(): Language {
  const { i18n: instance } = useTranslation();
  return instance.language === 'bn' ? 'bn' : 'en';
}

/** Translate outside React (lib messages, schemas). Prefer useTranslation() in components. */
export const t = i18n.t.bind(i18n);

export { type TFunction } from 'i18next';
export { useTranslation } from 'react-i18next';
export { type Formatters, makeFormatters, toLocalDigits, useFormat } from './format';
export { en as EN_STRINGS } from './locales/en';
