/**
 * Internationalization (i18n) Utility
 * Բազամալեզու աջակցության համակարգ
 */

const path = require('path');
const fs = require('fs');

// Լեզուների կեշ
const translationsCache = new Map();

// Լռելյայն լեզու
const DEFAULT_LANGUAGE = 'hy';

// Աջակցվող լեզուներ
const SUPPORTED_LANGUAGES = ['hy', 'en', 'ru', 'fr', 'de', 'es', 'it', 'ar'];

/**
 * Բեռնել թարգմանություններ ֆայլից
 */
const loadTranslations = (lang) => {
  if (translationsCache.has(lang)) {
    return translationsCache.get(lang);
  }

  try {
    const filePath = path.join(__dirname, '../locales', `${lang}.json`);
    if (fs.existsSync(filePath)) {
      const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      translationsCache.set(lang, translations);
      return translations;
    }
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
  }

  // Եթե ֆայլը չկա, վերադարձնել դատարկ օբյեկտ
  return {};
};

/**
 * Թարգմանել տեքստ
 */
const translate = (key, language = DEFAULT_LANGUAGE, interpolations = {}) => {
  // Ստուգել, որ լեզուն աջակցվում է
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    language = DEFAULT_LANGUAGE;
  }

  const translations = loadTranslations(language);
  let text = getNestedValue(translations, key);

  // Եթե չկա թարգմանությունը, փորձել անգլերենով
  if (text === undefined || text === null) {
    const englishTranslations = loadTranslations('en');
    text = getNestedValue(englishTranslations, key);
  }

  // Եթե դեռ չկա, վերադարձնել բանալին
  if (text === undefined || text === null) {
    return key;
  }

  // Միջկալում (interpolation)
  if (typeof text === 'string' && Object.keys(interpolations).length > 0) {
    return replaceInterpolations(text, interpolations);
  }

  return text;
};

/**
 * Ստանալ նեստեդ արժեք օբյեկտից
 */
const getNestedValue = (obj, key) => {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const keys = key.split('.');
  let current = obj;

  for (const k of keys) {
    if (current[k] === undefined) {
      return undefined;
    }
    current = current[k];
  }

  return current;
};

/**
 * Փոխարինել միջկալումները տեքստում
 */
const replaceInterpolations = (text, interpolations) => {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return interpolations[key] !== undefined ? interpolations[key] : match;
  });
};

/**
 * Ստանալ բոլոր աջակցվող լեզուները
 */
const getSupportedLanguages = () => {
  return [...SUPPORTED_LANGUAGES];
};

/**
 * Ստուգել, որ լեզուն աջակցվում է
 */
const isLanguageSupported = (lang) => {
  return SUPPORTED_LANGUAGES.includes(lang);
};

/**
 * Թարմացնել թարգմանությունների կեշը
 */
const refreshCache = () => {
  translationsCache.clear();
  SUPPORTED_LANGUAGES.forEach(lang => {
    loadTranslations(lang);
  });
};

/**
 * Ավելացնել նոր թարգմանություն կեշում
 */
const addTranslation = (lang, key, value) => {
  if (!translationsCache.has(lang)) {
    translationsCache.set(lang, {});
  }
  setNestedValue(translationsCache.get(lang), key, value);
};

/**
 * Տալ նեստեդ արժեք օբյեկտում
 */
const setNestedValue = (obj, key, value) => {
  const keys = key.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (current[k] === undefined) {
      current[k] = {};
    }
    current = current[k];
  }

  current[keys[keys.length - 1]] = value;
};

/**
 * Ստանալ թարգմանությունների օբյեկտ ամբողջությամբ
 */
const getTranslations = (lang) => {
  return loadTranslations(lang);
};

/**
 * Թարգմանել օբյեկտի բոլոր դաշտերը
 */
const translateObject = (obj, language = DEFAULT_LANGUAGE) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = translate(value, language);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => translateObject(item, language));
    } else if (typeof value === 'object') {
      result[key] = translateObject(value, language);
    } else {
      result[key] = value;
    }
  }
  return result;
};

/**
 * Ստանալ լեզվի անվանում
 */
const getLanguageName = (lang) => {
  const languageNames = {
    hy: 'Հայերեն',
    en: 'English',
    ru: 'Русский',
    fr: 'Francais',
    de: 'Deutsch',
    es: 'Espanol',
    it: 'Italiano',
    ar: 'العربية'
  };
  return languageNames[lang] || lang;
};

/**
 * Ստանալ լեզվի կոդը անվանումից
 */
const getLanguageCode = (name) => {
  const languageNames = {
    'Հայերեն': 'hy',
    'Armenian': 'hy',
    'English': 'en',
    'Русский': 'ru',
    'Russian': 'ru',
    'Francais': 'fr',
    'French': 'fr',
    'Deutsch': 'de',
    'German': 'de',
    'Espanol': 'es',
    'Spanish': 'es',
    'Italiano': 'it',
    'Italian': 'it',
    'العربية': 'ar',
    'Arabic': 'ar'
  };
  return languageNames[name] || 'en';
};

module.exports = {
  translate,
  t: translate,
  getSupportedLanguages,
  isLanguageSupported,
  refreshCache,
  addTranslation,
  getTranslations,
  translateObject,
  getLanguageName,
  getLanguageCode,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES
};
