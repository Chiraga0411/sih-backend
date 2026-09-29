// src/controllers/speechController.js
// GET /api/i18n/speak?language=Punjabi&text=<one of the allowed sentences>
//   -> audio bytes (audio/mpeg by default)
// GET so the browser can also keep the audio in its own HTTP cache.

import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { speak, contentTypeFor, TTS_LANGUAGES } from '../services/ttsService.js';

export const speakText = asyncHandler(async (req, res) => {
  const { language, text } = req.query || {};

  if (typeof language !== 'string' || !TTS_LANGUAGES[language]) {
    throw new AppError('language must be one of: ' + Object.keys(TTS_LANGUAGES).join(', '), 400);
  }
  if (typeof text !== 'string' || !text || text.length > 400) {
    throw new AppError('text must be a string of at most 400 characters', 400);
  }

  const { audio, codec } = await speak(language, text);

  res.set({
    'Content-Type': contentTypeFor(codec),
    'Content-Length': String(audio.length),
    // no-cache = the browser may keep a copy but must re-check with us first (a quick 304
    // when unchanged), so a changed voice/pace is heard immediately, never a stale copy.
    'Cache-Control': 'no-cache',
  });
  res.status(200).send(audio);
});

export default { speakText };
