import type { Request } from 'express';

export const LANGS = ['en', 'hi', 'mr'] as const;
export type Lang = (typeof LANGS)[number];

type L10n = Record<Lang, string>;

export const CATEGORIES = [
  'harassment',
  'catcalling',
  'following',
  'loitering',
  'suspicious',
  'intimidation',
  'unsafe-area',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, L10n> = {
  harassment: { en: 'Harassment', hi: 'उत्पीड़न', mr: 'छळ' },
  catcalling: { en: 'Catcalling', hi: 'फब्तियाँ कसना', mr: 'शेरेबाजी' },
  following: { en: 'Following', hi: 'पीछा करना', mr: 'पाठलाग करणे' },
  loitering: { en: 'Loitering', hi: 'बेवजह मंडराना', mr: 'विनाकारण घुटमळणे' },
  suspicious: { en: 'Suspicious Activity', hi: 'संदिग्ध गतिविधि', mr: 'संशयास्पद हालचाल' },
  intimidation: { en: 'Intimidation', hi: 'धमकाना', mr: 'धमकावणे' },
  'unsafe-area': { en: 'Unsafe Area', hi: 'असुरक्षित क्षेत्र', mr: 'असुरक्षित परिसर' },
  other: { en: 'Other', hi: 'अन्य', mr: 'इतर' },
};

export const TIME_BUCKETS = ['now', 'hour', 'today'] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

const TIME_LABELS: Record<TimeBucket, L10n> = {
  now: { en: 'Just Now', hi: 'अभी-अभी', mr: 'आत्ताच' },
  hour: { en: 'Within the Last Hour', hi: 'पिछले एक घंटे में', mr: 'गेल्या तासाभरात' },
  today: { en: 'Earlier Today', hi: 'आज पहले', mr: 'आज लवकर' },
};

export const PATTERN_STATUSES = ['monitoring', 'emerging', 'escalated', 'resolved'] as const;
export type PatternStatus = (typeof PATTERN_STATUSES)[number];

const STATUS_LABELS: Record<PatternStatus, L10n> = {
  monitoring: { en: 'Monitoring', hi: 'निगरानी', mr: 'निरीक्षण' },
  emerging: { en: 'Emerging', hi: 'उभरता हुआ', mr: 'उदयोन्मुख' },
  escalated: { en: 'Escalated', hi: 'बढ़ाया गया', mr: 'वरिष्ठांकडे पाठवले' },
  resolved: { en: 'Resolved', hi: 'सुलझा', mr: 'निराकरण झाले' },
};

export const AREA_LEVELS = ['calm', 'moderate', 'elevated'] as const;
export type AreaLevel = (typeof AREA_LEVELS)[number];

const AREA_LEVEL_LABELS: Record<AreaLevel, L10n> = {
  calm: { en: 'Calm', hi: 'शांत', mr: 'शांत' },
  moderate: { en: 'Some Activity', hi: 'कुछ गतिविधि', mr: 'काही हालचाल' },
  elevated: { en: 'Increased Activity', hi: 'बढ़ी हुई गतिविधि', mr: 'वाढलेली हालचाल' },
};

const SIGNAL_TERMS = {
  repeated_reports: { en: 'Repeated Reports', hi: 'बार-बार रिपोर्ट', mr: 'वारंवार नोंदी' },
  increased_activity: { en: 'Increased Activity', hi: 'बढ़ी हुई गतिविधि', mr: 'वाढलेली हालचाल' },
  emerging_pattern: { en: 'Emerging Pattern', hi: 'उभरता पैटर्न', mr: 'उदयोन्मुख नमुना' },
  monitoring: { en: 'Monitoring', hi: 'निगरानी', mr: 'निरीक्षण' },
} satisfies Record<string, L10n>;
export type SignalTerm = keyof typeof SIGNAL_TERMS;

export const TIPS: L10n[] = [
  {
    en: 'Stay in well-lit, busy areas when travelling at night.',
    hi: 'रात में यात्रा करते समय रोशनी वाली और भीड़-भाड़ वाली जगहों पर रहें।',
    mr: 'रात्री प्रवास करताना प्रकाशमान आणि वर्दळीच्या ठिकाणी राहा.',
  },
  {
    en: 'Share your live location with someone you trust on longer trips.',
    hi: 'लंबी यात्रा में अपनी लाइव लोकेशन किसी भरोसेमंद व्यक्ति से साझा करें।',
    mr: 'लांबच्या प्रवासात तुमचे लाइव्ह लोकेशन विश्वासू व्यक्तीशी शेअर करा.',
  },
  {
    en: 'Small signals matter: reporting early helps areas get attention before issues grow.',
    hi: 'छोटे संकेत मायने रखते हैं: जल्दी रिपोर्ट करने से समस्या बढ़ने से पहले ध्यान मिलता है।',
    mr: 'लहान संकेतही महत्त्वाचे: लवकर नोंद केल्यास समस्या वाढण्यापूर्वी लक्ष दिले जाते.',
  },
  {
    en: 'In an emergency, call 112 first. Sanket is for early signals, not emergency response.',
    hi: 'आपात स्थिति में पहले 112 पर कॉल करें। संकेत शुरुआती संकेतों के लिए है, आपातकालीन सेवा के लिए नहीं।',
    mr: 'आणीबाणीत आधी 112 वर कॉल करा. संकेत हे सुरुवातीच्या संकेतांसाठी आहे, आपत्कालीन सेवेसाठी नाही.',
  },
];

const pick = (l: L10n, lang: Lang) => l[lang] ?? l.en;

export const categoryLabel = (c: string, lang: Lang) =>
  CATEGORY_LABELS[c as Category] ? pick(CATEGORY_LABELS[c as Category], lang) : c;
export const timeLabel = (t: string, lang: Lang) =>
  TIME_LABELS[t as TimeBucket] ? pick(TIME_LABELS[t as TimeBucket], lang) : t;
export const statusLabel = (s: string, lang: Lang) =>
  STATUS_LABELS[s as PatternStatus] ? pick(STATUS_LABELS[s as PatternStatus], lang) : s;
export const areaLevelLabel = (a: AreaLevel, lang: Lang) => pick(AREA_LEVEL_LABELS[a], lang);
export const signalTermLabel = (t: SignalTerm, lang: Lang) => pick(SIGNAL_TERMS[t], lang);
export const tipText = (i: number, lang: Lang) => pick(TIPS[i % TIPS.length]!, lang);

export const allCategoryLabels = (lang: Lang) =>
  CATEGORIES.map((id) => ({ id, label: CATEGORY_LABELS[id][lang] }));
export const allTimeLabels = (lang: Lang) =>
  TIME_BUCKETS.map((id) => ({ id, label: TIME_LABELS[id][lang] }));
export const allStatusLabels = (lang: Lang) =>
  PATTERN_STATUSES.map((id) => ({ id, label: STATUS_LABELS[id][lang] }));

/** `?lang=hi` wins, then the first supported tag in Accept-Language, then English. */
export function getLang(req: Request): Lang {
  const q = typeof req.query.lang === 'string' ? req.query.lang.toLowerCase() : '';
  if ((LANGS as readonly string[]).includes(q)) return q as Lang;
  const header = req.header('accept-language') ?? '';
  for (const part of header.split(',')) {
    const tag = part.trim().split(';')[0]?.toLowerCase().split('-')[0] ?? '';
    if ((LANGS as readonly string[]).includes(tag)) return tag as Lang;
  }
  return 'en';
}
