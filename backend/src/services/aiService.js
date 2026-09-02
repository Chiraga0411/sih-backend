// src/services/aiService.js
// Gemini-backed AI integration for complaint classification, entity extraction,
// and translation. No local transformers, PyTorch, or model downloads are used.
// Every Gemini call has a deterministic fallback so the citizen flow remains
// available when the provider is unavailable or returns invalid data.

import axios from 'axios';
import Department from '../models/Department.js';
import env from '../config/env.js';

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent`;
const ALLOWED_DEPARTMENTS = new Set(['WATER', 'SANITATION', 'ROADS', 'ELECTRICITY']);

async function generateGeminiJson(prompt) {
  if (!env.gemini.apiKey) return null;
  const { data } = await axios.post(
    GEMINI_ENDPOINT,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    },
    { params: { key: env.gemini.apiKey }, timeout: env.gemini.timeoutMs }
  );
  const raw = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return cleaned ? JSON.parse(cleaned) : null;
}

async function generateGeminiAudioText(audioBuffer, mimeType, prompt) {
  if (!env.gemini.apiKey) return null;
  let data;
  try {
    ({ data } = await axios.post(
      GEMINI_ENDPOINT,
      {
        contents: [{ role: 'user', parts: [
          { inlineData: { mimeType, data: audioBuffer.toString('base64') } },
          { text: prompt },
        ] }],
        generationConfig: { temperature: 0 },
      },
      { params: { key: env.gemini.apiKey }, timeout: env.gemini.timeoutMs }
    ));
  } catch (err) {
    const providerMessage = err.response?.data?.error?.message;
    throw new Error(providerMessage || err.message);
  }
  const raw = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '';
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return cleaned || null;
}

// Direct Gemini multimodal transcription. No separate ASR proxy or local
// transformer model is required.
export async function transcribeVoice(audioBuffer, filename = 'audio.wav', languageHint = 'hi') {
  if (!env.gemini.apiKey) {
    console.warn('[aiService] GEMINI_API_KEY not set — voice intake is unavailable.');
    return { transcript: '', confidence: 0, language: languageHint, degraded: true };
  }
  try {
    const extension = filename.toLowerCase().split('.').pop();
    const mimeType = ({ wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm', mp4: 'audio/mp4', m4a: 'audio/mp4', mp3: 'audio/mpeg' })[extension] || 'audio/webm';
    const transcript = await generateGeminiAudioText(audioBuffer, mimeType, `Transcribe this citizen voice complaint exactly. The expected language is ${languageHint}. Do not summarize, translate, or invent words. Return only the transcript text, with no JSON, markdown, labels, or explanation.`);
    if (!transcript) throw new Error('Gemini returned no transcript');
    return { transcript, confidence: 0.85, language: languageHint };
  } catch (err) {
    console.error(`[aiService] Gemini voice transcription failed: ${err.message}`);
    return { transcript: '', confidence: 0, language: languageHint, degraded: true, error: err.message };
  }
}

export async function translateText(text, sourceLang, targetLang = 'en') {
  if (sourceLang === targetLang || !text) return text;
  try {
    const result = await generateGeminiJson(`Translate this civic complaint from language code ${sourceLang} to ${targetLang}. Preserve names, places, numbers, and meaning. Return only JSON: {"translated_text":"string"}. Text: ${text}`);
    return typeof result?.translated_text === 'string' && result.translated_text.trim() ? result.translated_text.trim() : text;
  } catch (err) {
    console.error(`[aiService] Gemini translation failed: ${err.message}`);
    return text;
  }
}

const FALLBACK_KEYWORD_MAP = {
  WATER: ['water', 'leak', 'pipeline', 'pipe', 'supply', 'पानी', 'रिसाव'],
  SANITATION: ['garbage', 'trash', 'sewage', 'drain', 'sewer', 'कचरा', 'सीवर'],
  ROADS: ['pothole', 'road', 'street', 'footpath', 'सड़क', 'गड्ढा'],
  ELECTRICITY: ['power', 'electricity', 'streetlight', 'transformer', 'बिजली', 'ट्रांसफार्मर'],
};
const AI_DEPARTMENT_TO_CODE = {
  water: 'WATER', 'water supply': 'WATER', sanitation: 'SANITATION', roads: 'ROADS',
  'roads & infrastructure': 'ROADS', 'roads and infrastructure': 'ROADS', electricity: 'ELECTRICITY',
};
const URGENT_KEYWORDS = ['emergency', 'urgent', 'fire', 'injured', 'collapsed', 'flooding', 'आपातकाल', 'तत्काल'];
const NEGATIVE_SENTIMENT_KEYWORDS = ['angry', 'furious', 'terrible', 'disgusted', 'unacceptable', 'गुस्सा'];

function scoreKeywordHit(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
}

function mapClassification(data, originalText) {
  const raw = String(data?.department || '').trim().toLowerCase();
  const departmentCode = AI_DEPARTMENT_TO_CODE[raw] || (ALLOWED_DEPARTMENTS.has(raw.toUpperCase()) ? raw.toUpperCase() : null);
  const urgency = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(data?.urgency || '').toUpperCase()) ? String(data.urgency).toUpperCase() : 'MEDIUM';
  const sentiment = ['NEGATIVE', 'NEUTRAL', 'POSITIVE'].includes(String(data?.sentiment || '').toUpperCase()) ? String(data.sentiment).toUpperCase() : 'NEUTRAL';
  const confidence = Number(data?.confidence);
  const locationText = typeof data?.locationText === 'string' ? data.locationText.trim() : null;
  const landmark = typeof data?.landmark === 'string' ? data.landmark.trim() : null;
  return {
    departmentCode,
    issueType: typeof data?.category === 'string' ? data.category.toLowerCase().replace(/\s+/g, '_') : null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.75,
    entities: { locationText: locationText || landmark || originalText.match(/\b(?:in|at|near)\s+([A-Z][\w\s]{2,30})/)?.[1]?.trim() || null, landmark: landmark || null },
    sentiment,
    urgencyLevel: urgency,
  };
}

function classifyWithFallback(text) {
  let bestCode = null; let bestScore = 0;
  for (const [code, keywords] of Object.entries(FALLBACK_KEYWORD_MAP)) {
    const score = scoreKeywordHit(text, keywords);
    if (score > bestScore) { bestScore = score; bestCode = code; }
  }
  const urgentHits = scoreKeywordHit(text, URGENT_KEYWORDS);
  const negativeHits = scoreKeywordHit(text, NEGATIVE_SENTIMENT_KEYWORDS);
  const locationMatch = text.match(/\b(?:in|at|near)\s+([A-Z][\w\s]{2,30})/);
  return {
    departmentCode: bestCode,
    issueType: bestCode ? bestCode.toLowerCase() : null,
    confidence: bestScore > 0 ? Math.min(0.5 + bestScore * 0.15, 0.95) : 0.2,
    entities: { locationText: locationMatch?.[1]?.trim() || null, landmark: null },
    sentiment: negativeHits > 0 ? 'NEGATIVE' : 'NEUTRAL',
    urgencyLevel: urgentHits >= 2 ? 'CRITICAL' : urgentHits === 1 ? 'HIGH' : bestScore === 0 ? 'LOW' : 'MEDIUM',
  };
}

export async function classifyComplaint(text) {
  try {
    const result = await generateGeminiJson(`You classify multilingual citizen complaints for a municipal grievance system. Choose exactly one department: Water Supply, Sanitation, Roads & Infrastructure, Electricity. Return only JSON: {"department":"Water Supply|Sanitation|Roads & Infrastructure|Electricity","category":"short category","urgency":"LOW|MEDIUM|HIGH|CRITICAL","confidence":0.0,"sentiment":"NEGATIVE|NEUTRAL|POSITIVE","landmark":"string or null","locationText":"string or null"}. Use HIGH for urgent hazards and CRITICAL only for immediate danger to life or major public safety. Complaint: ${text}`);
    if (result) {
      const mapped = mapClassification(result, text);
      if (mapped.departmentCode) return mapped;
    }
  } catch (err) {
    console.error(`[aiService] Gemini classification failed, using fallback: ${err.message}`);
  }
  return classifyWithFallback(text);
}

export function checkMissingFields(classification, hasLocation) {
  if (!classification.departmentCode) return { missingField: 'issueType', templateKey: 'CLARIFY_ISSUE_TYPE' };
  if (!hasLocation && !classification.entities?.locationText) return { missingField: 'location', templateKey: 'CLARIFY_LOCATION' };
  return null;
}

export async function resolveDepartment(departmentCode) {
  if (departmentCode) {
    const dept = await Department.findOne({ code: departmentCode, isActive: true });
    if (dept) return dept;
  }
  return Department.findOne({ code: 'GENERAL', isActive: true });
}

export default { transcribeVoice, translateText, classifyComplaint, checkMissingFields, resolveDepartment };
