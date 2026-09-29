// src/templates/messageCatalog.js
// Notes section: "Since there is no generative model, all citizen-facing
// message text (clarifying questions, status updates) must exist as a
// pre-written, human-verified template per language and per scenario ...
// build this template set early, as it is on the critical path."
//
// This is that template set's source of truth / seed data. Two languages
// (English, Hindi) are filled in as a working reference implementation —
// extend this object (and scripts/seed.js, which loads it into the
// Template collection) with more languages before adding new locales to
// production. `{{placeholder}}` tokens are filled in by
// notificationService.renderTemplate().
//
// Lookup order at send time (see services/notificationService.js):
//   1. Template collection in MongoDB (admin-editable, human-verified)
//   2. This static catalog (guaranteed fallback so sends never hard-fail)

export const messageCatalog = {
  en: {
    // Step 4 — one templated clarifying question per missing field type.
    CLARIFY_LOCATION:
      'Thanks for reporting this. Could you share the location (area/landmark) where this is happening?',
    CLARIFY_ISSUE_TYPE:
      "We couldn't quite identify the issue type from your message. Could you describe the problem in a few words (e.g. 'broken streetlight', 'water leakage')?",
    CLARIFY_GENERIC:
      'One more detail is needed before we can log your complaint: {{missingField}}. Could you share that?',

    // Step 7 — instant complaint ID confirmation.
    COMPLAINT_LODGED:
      'Your complaint has been registered. Tracking ID: {{complaintId}}. Expected resolution by {{slaTarget}}.',
    DUPLICATE_MERGED:
      'This matches an existing complaint in your area (ID: {{complaintId}}). We have linked your report to it to speed up resolution.',

    // Step 12 — one template per status transition.
    STATUS_ASSIGNED:
      'Update on {{complaintId}}: your complaint has been assigned to the {{department}} department.',
    STATUS_IN_PROGRESS: 'Update on {{complaintId}}: work has started on your complaint.',
    STATUS_RESOLVED:
      'Update on {{complaintId}}: your complaint has been marked resolved. Reply to confirm or let us know if the issue persists.',
    STATUS_ESCALATED:
      'Update on {{complaintId}}: this complaint has been escalated to ensure timely resolution.',

    // Step 14
    FEEDBACK_REQUEST: 'Was your complaint {{complaintId}} resolved to your satisfaction? Please rate 1-5.',
  },

  hi: {
    CLARIFY_LOCATION: 'शिकायत दर्ज करने हेतु धन्यवाद। कृपया वह स्थान (क्षेत्र/लैंडमार्क) बताएं जहाँ यह समस्या हो रही है।',
    CLARIFY_ISSUE_TYPE:
      'हम आपकी समस्या का प्रकार ठीक से पहचान नहीं पाए। कृपया कुछ शब्दों में समस्या बताएं (जैसे "टूटी स्ट्रीटलाइट", "पानी का रिसाव")।',
    CLARIFY_GENERIC: 'शिकायत दर्ज करने से पहले एक और जानकारी चाहिए: {{missingField}}। कृपया बताएं।',

    COMPLAINT_LODGED:
      'आपकी शिकायत दर्ज कर ली गई है। ट्रैकिंग आईडी: {{complaintId}}। अपेक्षित समाधान समय: {{slaTarget}}।',
    DUPLICATE_MERGED:
      'यह आपके क्षेत्र की एक मौजूदा शिकायत (आईडी: {{complaintId}}) से मेल खाती है। समाधान में तेज़ी के लिए हमने आपकी रिपोर्ट उससे जोड़ दी है।',

    STATUS_ASSIGNED: '{{complaintId}} पर अपडेट: आपकी शिकायत {{department}} विभाग को सौंपी गई है।',
    STATUS_IN_PROGRESS: '{{complaintId}} पर अपडेट: आपकी शिकायत पर कार्य शुरू हो गया है।',
    STATUS_RESOLVED:
      '{{complaintId}} पर अपडेट: आपकी शिकायत का समाधान कर दिया गया है। कृपया पुष्टि करें या समस्या बने रहने पर हमें बताएं।',
    STATUS_ESCALATED: '{{complaintId}} पर अपडेट: समय पर समाधान सुनिश्चित करने हेतु इस शिकायत को आगे बढ़ाया गया है।',

    FEEDBACK_REQUEST: 'क्या आपकी शिकायत {{complaintId}} संतोषजनक ढंग से हल हुई? कृपया 1-5 में रेटिंग दें।',
  },
};

/**
 * Static fallback lookup — used by notificationService when no
 * human-verified override exists in the Template collection yet.
 */
export function getCatalogTemplate(key, language = 'en') {
  const lang = messageCatalog[language] ? language : 'en'; // fall back to English, never silently send nothing
  return messageCatalog[lang]?.[key] || null;
}

export default messageCatalog;
