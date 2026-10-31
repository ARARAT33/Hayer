/**
 * i18n Middleware
 * Բազամալեզու միջանկյալ ծրագիր
 */

const i18n = require('../utils/i18n');

/**
 * Լեզվի ընտրող միջանկյալ ծրագիր
 * Ստուգում է request-ում լեզուն և ավելացնում req.t և req.language
 */
const i18nMiddleware = (options = {}) => {
  const {
    defaultLanguage = i18n.DEFAULT_LANGUAGE,
    languageHeader = 'accept-language',
    languageQuery = 'lang',
    languageCookie = 'language'
  } = options;

  return (req, res, next) => {
    // Ստանալ լեզուն տարբեր աղբյուրներից
    let language = null;

    // 1. Query parameter
    if (req.query[languageQuery]) {
      language = req.query[languageQuery];
    }

    // 2. Cookie
    if (!language && req.cookies && req.cookies[languageCookie]) {
      language = req.cookies[languageCookie];
    }

    // 3. User preference (եթե մուտք է գործած)
    if (!language && req.user && req.user.language) {
      language = req.user.language;
    }

    // 4. Accept-Language header
    if (!language && req.headers[languageHeader]) {
      const acceptLanguage = req.headers[languageHeader];
      const languages = acceptLanguage.split(',').map(lang => {
        const [langCode] = lang.trim().split(';');
        return langCode;
      });

      // Գտնել առաջին աջակցվող լեզուն
      for (const lang of languages) {
        if (i18n.isLanguageSupported(lang)) {
          language = lang;
          break;
        }
      }
    }

    // 5. Default language
    if (!language) {
      language = defaultLanguage;
    }

    // Ստուգել, որ լեզուն աջակցվում է
    if (!i18n.isLanguageSupported(language)) {
      language = defaultLanguage;
    }

    // Ավելացնել request-ում
    req.language = language;
    req.t = (key, interpolations = {}) => {
      return i18n.translate(key, language, interpolations);
    };

    // Ավելացնել response-ում
    res.t = req.t;
    res.setLanguage = (lang) => {
      if (i18n.isLanguageSupported(lang)) {
        req.language = lang;
        res.cookie(languageCookie, lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });
      }
    };

    next();
  };
};

/**
 * Լեզուներ վերադառնալ
 */
const getLanguages = (req, res) => {
  res.json({
    success: true,
    defaultLanguage: i18n.DEFAULT_LANGUAGE,
    supportedLanguages: i18n.getSupportedLanguages().map(lang => ({
      code: lang,
      name: i18n.getLanguageName(lang)
    }))
  });
};

/**
 * Լեզու ընտրել
 */
const setLanguage = (req, res) => {
  const { language } = req.body;
  const { userId } = req.user || {};

  if (!language) {
    return res.status(400).json({
      success: false,
      error: 'LANGUAGE_REQUIRED',
      message: 'Language is required'
    });
  }

  if (!i18n.isLanguageSupported(language)) {
    return res.status(400).json({
      success: false,
      error: 'LANGUAGE_NOT_SUPPORTED',
      message: 'Language is not supported'
    });
  }

  // Պահպանել լեզուն cookie-ում
  res.cookie('language', language, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true });

  // Եթե օգտատերը մուտք է գործած, թարմացնել տվյալները
  if (userId) {
    const { User } = require('../models');
    User.update({ language }, { where: { id: userId } });
  }

  res.json({
    success: true,
    language,
    message: 'Language updated successfully'
  });
};

/**
 * Թարգմանել տեքստ
 */
const translateText = (req, res) => {
  const { text, language } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'TEXT_REQUIRED',
      message: 'Text is required'
    });
  }

  const lang = language || req.language || i18n.DEFAULT_LANGUAGE;
  const translation = i18n.translate(text, lang);

  res.json({
    success: true,
    text,
    translation,
    language: lang
  });
};

/**
 * Թարգմանել օբյեկտ
 */
const translateObject = (req, res) => {
  const { data, language } = req.body;

  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'DATA_REQUIRED',
      message: 'Data is required'
    });
  }

  const lang = language || req.language || i18n.DEFAULT_LANGUAGE;
  const translation = i18n.translateObject(data, lang);

  res.json({
    success: true,
    data,
    translation,
    language: lang
  });
};

module.exports = {
  i18nMiddleware,
  getLanguages,
  setLanguage,
  translateText,
  translateObject
};
