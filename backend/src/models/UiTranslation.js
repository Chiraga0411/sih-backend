// src/models/UiTranslation.js
// Cache of interface translations (English -> Indian language) produced by
// Sarvam Translate. Each unique string is translated once, ever, so the
// Sarvam bill stays tiny and the UI loads instantly on later visits.

import mongoose from 'mongoose';

const uiTranslationSchema = new mongoose.Schema(
  {
    lang: { type: String, required: true },   // Sarvam code, e.g. "pa-IN"
    source: { type: String, required: true }, // the English text
    text: { type: String, required: true },   // the translated text
    model: { type: String },
  },
  { timestamps: true }
);

uiTranslationSchema.index({ lang: 1, source: 1 }, { unique: true });

export const UiTranslation = mongoose.model('UiTranslation', uiTranslationSchema);
export default UiTranslation;
