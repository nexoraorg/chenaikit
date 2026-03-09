import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from '../locales/en.json';
import es from '../locales/es.json';
import zh from '../locales/zh.json';
import ar from '../locales/ar.json';

// Language resources
const resources = {
  en: {
    translation: en
  },
  es: {
    translation: es
  },
  zh: {
    translation: zh
  },
  ar: {
    translation: ar
  }
};

// Supported languages
export const supportedLanguages = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    rtl: false
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    rtl: false
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    rtl: false
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    rtl: true
  }
];

// Default language
export const defaultLanguage = 'en';

// i18n configuration
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Default language
    lng: defaultLanguage,
    
    // Fallback language
    fallbackLng: defaultLanguage,
    
    // Debug mode (disable in production)
    debug: process.env.NODE_ENV === 'development',
    
    // Resources
    resources,
    
    // Detection options
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    
    // Interpolation
    interpolation: {
      escapeValue: false, // React already escapes
      format: (value, format, lng) => {
        if (format === 'currency') {
          return new Intl.NumberFormat(lng, {
            style: 'currency',
            currency: 'USD'
          }).format(value);
        }
        if (format === 'number') {
          return new Intl.NumberFormat(lng).format(value);
        }
        if (format === 'date') {
          return new Intl.DateTimeFormat(lng).format(value);
        }
        if (format === 'datetime') {
          return new Intl.DateTimeFormat(lng, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }).format(value);
        }
        return value;
      }
    },
    
    // React options
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span']
    },
    
    // Backend options (for loading translations from files)
    backend: {
      loadPath: '/locales/{{lng}}.json',
    }
  });

// Export i18n instance
export default i18n;

// Utility functions
export const getCurrentLanguage = (): string => i18n.language;

export const changeLanguage = (language: string): Promise<string> => {
  return i18n.changeLanguage(language);
};

export const isRTL = (language: string): boolean => {
  const lang = supportedLanguages.find(l => l.code === language);
  return lang?.rtl || false;
};

export const getLanguageDirection = (language: string): 'ltr' | 'rtl' => {
  return isRTL(language) ? 'rtl' : 'ltr';
};

// Format utilities
export const formatCurrency = (value: number, currency: string = 'USD', language?: string): string => {
  const lng = language || i18n.language;
  return new Intl.NumberFormat(lng, {
    style: 'currency',
    currency
  }).format(value);
};

export const formatNumber = (value: number, language?: string): string => {
  const lng = language || i18n.language;
  return new Intl.NumberFormat(lng).format(value);
};

export const formatDate = (date: Date | string, language?: string): string => {
  const lng = language || i18n.language;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lng).format(dateObj);
};

export const formatDateTime = (date: Date | string, language?: string): string => {
  const lng = language || i18n.language;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lng, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
};

export const formatRelativeTime = (date: Date | string, language?: string): string => {
  const lng = language || i18n.language;
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });

  if (diffDays > 0) {
    return rtf.format(-diffDays, 'day');
  } else if (diffHours > 0) {
    return rtf.format(-diffHours, 'hour');
  } else if (diffMinutes > 0) {
    return rtf.format(-diffMinutes, 'minute');
  } else {
    return rtf.format(-diffSeconds, 'second');
  }
};

// Pluralization utilities
export const formatPlural = (count: number, key: string, options?: any, language?: string): string => {
  const lng = language || i18n.language;
  return i18n.t(key, { count, ...options, lng });
};

// Language detection and validation
export const detectBrowserLanguage = (): string => {
  const browserLang = navigator.language.split('-')[0];
  return supportedLanguages.find(lang => lang.code === browserLang)?.code || defaultLanguage;
};

export const isValidLanguage = (language: string): boolean => {
  return supportedLanguages.some(lang => lang.code === language);
};

export const getLanguageInfo = (language: string) => {
  return supportedLanguages.find(lang => lang.code === language) || supportedLanguages[0];
};
