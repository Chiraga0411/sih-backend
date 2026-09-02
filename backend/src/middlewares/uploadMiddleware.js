// src/middlewares/uploadMiddleware.js
// Multer config for the voice-intake endpoint (Step 2 — citizen speaks
// instead of types). Memory storage: audio is small (a few seconds to a
// couple minutes of speech) and is only ever forwarded to the AI service's
// /asr endpoint, never written to disk, so there's nothing to clean up.

import multer from 'multer';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

const ALLOWED_MIME_TYPES = new Set([
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
]);

const storage = multer.memoryStorage();

export const uploadAudio = multer({
  storage,
  limits: { fileSize: env.upload.maxAudioMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(`Unsupported audio type: ${file.mimetype}`, 415));
    }
    return cb(null, true);
  },
}).single('audio');

// Wraps multer's callback-style middleware so multer-specific errors
// (file too large, wrong field name, etc.) flow through the app's normal
// AppError -> errorHandler pipeline instead of an unhandled exception.
export function handleAudioUpload(req, res, next) {
  uploadAudio(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(`Audio file exceeds the ${env.upload.maxAudioMb}MB limit`, 413));
      }
      return next(new AppError(`Upload error: ${err.message}`, 400));
    }
    return next(err);
  });
}

export default { handleAudioUpload };
