// src/controllers/uiTranslateController.js
// POST /api/i18n/translate  { language: "Punjabi", texts: ["Home", "Report an issue"] }
//   -> { success: true, translations: { "Home": "ਹੋਮ", ... } }
// Strings that could not be translated are simply missing from the map, and
// the frontend keeps showing them in English.

import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import {
  translateStrings,
  UI_LANGUAGES,
  MAX_STRINGS_PER_REQUEST,
  MAX_STRING_LENGTH,
} from '../services/uiTranslateService.js';

export const translateUi = asyncHandler(async (req, res) => {
  const { language, texts } = req.body || {};

  if (language === 'English') {
    return res.status(200).json({ success: true, translations: {} });
  }
  if (!UI_LANGUAGES[language]) {
    throw new AppError('language must be one of: English, ' + Object.keys(UI_LANGUAGES).join(', '), 400);
  }
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_STRINGS_PER_REQUEST) {
    throw new AppError(`texts must be an array of 1-${MAX_STRINGS_PER_REQUEST} strings`, 400);
  }
  if (texts.some((t) => typeof t !== 'string' || t.length > MAX_STRING_LENGTH)) {
    throw new AppError(`each text must be a string of at most ${MAX_STRING_LENGTH} characters`, 400);
  }

  const translations = await translateStrings(language, texts);
  res.status(200).json({ success: true, translations });
});

export default { translateUi };
