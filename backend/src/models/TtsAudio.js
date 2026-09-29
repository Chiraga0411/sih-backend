// src/models/TtsAudio.js
// Cache of spoken audio produced by Sarvam Text-to-Speech. A given sentence in a
// given language + voice is synthesised once, ever; every later request is served
// straight from MongoDB (no Sarvam call, no cost).

import mongoose from 'mongoose';

const ttsAudioSchema = new mongoose.Schema(
  {
    lang: { type: String, required: true },    // Sarvam code, e.g. "pa-IN"
    source: { type: String, required: true },  // the English source text
    spoken: { type: String },                  // the translated text that was actually spoken
    model: { type: String, required: true },   // e.g. "bulbul:v3"
    speaker: { type: String, required: true }, // e.g. "shubh"
    codec: { type: String, required: true },   // "mp3" | "wav"
    audio: { type: Buffer, required: true },
  },
  { timestamps: true }
);

ttsAudioSchema.index({ lang: 1, source: 1, model: 1, speaker: 1, codec: 1 }, { unique: true });

export const TtsAudio = mongoose.model('TtsAudio', ttsAudioSchema);
export default TtsAudio;
