import type { Lang } from '../api/types';
import { langStore } from '../state/app';

type Dict = Record<string, string>;

// UI phrase dictionary. Exact phrases are preferred because they preserve natural grammar.
const PHRASES: Record<Exclude<Lang, 'en'>, Dict> = {
  hi: {
    'Hello, User 👋': 'नमस्ते, उपयोगकर्ता 👋',
    'Together for safer public spaces.': 'सुरक्षित सार्वजनिक स्थानों के लिए साथ मिलकर।',
    'Your Area Status': 'आपके क्षेत्र की स्थिति',
    'Checking…': 'जाँच हो रही है…',
    'Checking your area…': 'आपके क्षेत्र की जाँच हो रही है…',
    'Report a Safety Concern': 'सुरक्षा संबंधी चिंता रिपोर्ट करें',
    'Nearby Alerts': 'आस-पास की चेतावनियाँ',
    'Safety Map': 'सुरक्षा मानचित्र',
    'View hotspot areas': 'हॉटस्पॉट क्षेत्रों को देखें',
    'Quick SOS': 'त्वरित SOS',
    'Call 112 (emergency)': '112 पर कॉल करें (आपातकाल)',
    'My Reports': 'मेरी रिपोर्ट',
    'Track your reports': 'अपनी रिपोर्ट ट्रैक करें',
    'Nearby Safety Map': 'आस-पास का सुरक्षा मानचित्र',
    'View Full →': 'पूरा देखें →',
    'Recent Signals': 'हाल के संकेत',
    'See All': 'सभी देखें',
    'Safety Tip': 'सुरक्षा सुझाव',
    'Notice something uncomfortable?': 'कुछ असहज महसूस हुआ?',
    'Choose your area': 'अपना क्षेत्र चुनें',
    'Allow Location Access': 'लोकेशन की अनुमति दें',
    'My Reports': 'मेरी रिपोर्ट',
    'Report a concern': 'चिंता की रिपोर्ट करें',
    'Safety Map': 'सुरक्षा मानचित्र',
    'Incident Type': 'घटना का प्रकार',
    'View Pattern': 'पैटर्न देखें',
    'Report Similar': 'ऐसी ही रिपोर्ट करें',
    'Nearby Clusters': 'आस-पास के समूह',
    'Notifications': 'सूचनाएँ',
    'Mark all read': 'सभी को पढ़ा हुआ चिह्नित करें',
    'Profile': 'प्रोफ़ाइल',
    'Anonymous User': 'गुमनाम उपयोगकर्ता',
    'No name, phone or e-mail stored': 'नाम, फ़ोन या ई-मेल संग्रहीत नहीं है',
    'Identity Protected': 'पहचान सुरक्षित है',
    'Notification Preferences': 'सूचना प्राथमिकताएँ',
    'Language / भाषा': 'भाषा',
    'Pattern Information': 'पैटर्न की जानकारी',
    'Report Trend (This Week)': 'रिपोर्ट का रुझान (इस सप्ताह)',
    'Independent reporters per day': 'प्रतिदिन स्वतंत्र रिपोर्टर',
    'Anti-Abuse Verification': 'दुरुपयोग-रोधी सत्यापन',
    'Reporting Timeline': 'रिपोर्ट समयरेखा',
    'No signals in the last 7 days.': 'पिछले 7 दिनों में कोई संकेत नहीं।',
    'Privacy & Data': 'गोपनीयता और डेटा',
    'Your Privacy is our Priority': 'आपकी गोपनीयता हमारी प्राथमिकता है',
    'Submitted Anonymously': 'गुमनाम रूप से जमा किया गया',
    'Report Details': 'रिपोर्ट विवरण',
    'How this helps': 'यह कैसे मदद करता है',
    'Small Signals. Safer Places.': 'छोटे संकेत। सुरक्षित स्थान।',
    'Report. Alert. Prevent.': 'रिपोर्ट करें। सतर्क करें। रोकथाम करें।',
    'Activity Level': 'गतिविधि स्तर',
    'All reports are anonymous. They are linked only to this device, never to you.': 'सभी रिपोर्ट गुमनाम हैं। वे केवल इस डिवाइस से जुड़ी हैं, आपसे कभी नहीं।',
    'Your identity is protected': 'आपकी पहचान सुरक्षित है',
    'Report Summary': 'रिपोर्ट सारांश',
    'Add a brief description to help authorities understand the context.': 'अधिकारियों को संदर्भ समझने में मदद करने के लिए संक्षिप्त विवरण जोड़ें।',
    'No name, phone number, or public identity is attached to your report.': 'आपकी रिपोर्ट के साथ नाम, फ़ोन नंबर या सार्वजनिक पहचान नहीं जोड़ी जाती।',
    'No community signals nearby right now. Signals appear once several independent reports are received.': 'अभी आस-पास कोई सामुदायिक संकेत नहीं हैं। कई स्वतंत्र रिपोर्ट मिलने पर संकेत दिखाई देते हैं।',
  },
  mr: {
    'Hello, User 👋': 'नमस्कार, वापरकर्ता 👋',
    'Together for safer public spaces.': 'सुरक्षित सार्वजनिक ठिकाणांसाठी एकत्र येऊया.',
    'Your Area Status': 'तुमच्या परिसराची स्थिती',
    'Checking…': 'तपासणी सुरू आहे…',
    'Checking your area…': 'तुमच्या परिसराची तपासणी सुरू आहे…',
    'Report a Safety Concern': 'सुरक्षेची चिंता नोंदवा',
    'Nearby Alerts': 'जवळच्या सूचना',
    'Safety Map': 'सुरक्षा नकाशा',
    'View hotspot areas': 'हॉटस्पॉट परिसर पहा',
    'Quick SOS': 'त्वरित SOS',
    'Call 112 (emergency)': '112 वर कॉल करा (आणीबाणी)',
    'My Reports': 'माझ्या नोंदी',
    'Track your reports': 'तुमच्या नोंदींचा मागोवा घ्या',
    'Nearby Safety Map': 'जवळचा सुरक्षा नकाशा',
    'View Full →': 'पूर्ण पहा →',
    'Recent Signals': 'अलीकडील संकेत',
    'See All': 'सर्व पहा',
    'Safety Tip': 'सुरक्षा सूचना',
    'Notice something uncomfortable?': 'काही अस्वस्थ करणारे जाणवले?',
    'Choose your area': 'तुमचा परिसर निवडा',
    'Allow Location Access': 'स्थानाची परवानगी द्या',
    'Report a concern': 'चिंता नोंदवा',
    'Incident Type': 'घटनेचा प्रकार',
    'View Pattern': 'नमुना पहा',
    'Report Similar': 'अशीच नोंद करा',
    'Nearby Clusters': 'जवळचे समूह',
    'Notifications': 'सूचना',
    'Mark all read': 'सर्व वाचलेले म्हणून चिन्हांकित करा',
    'Profile': 'प्रोफाइल',
    'Anonymous User': 'अनामिक वापरकर्ता',
    'No name, phone or e-mail stored': 'नाव, फोन किंवा ई-मेल साठवलेले नाही',
    'Identity Protected': 'ओळख सुरक्षित आहे',
    'Notification Preferences': 'सूचना प्राधान्ये',
    'Language / भाषा': 'भाषा',
    'Pattern Information': 'नमुन्याची माहिती',
    'Report Trend (This Week)': 'नोंदींचा कल (या आठवड्यात)',
    'Independent reporters per day': 'दररोज स्वतंत्र नोंद करणारे',
    'Anti-Abuse Verification': 'गैरवापर-विरोधी पडताळणी',
    'Reporting Timeline': 'नोंदींची वेळरेषा',
    'No signals in the last 7 days.': 'गेल्या ७ दिवसांत कोणतेही संकेत नाहीत.',
    'Privacy & Data': 'गोपनीयता आणि डेटा',
    'Your Privacy is our Priority': 'तुमची गोपनीयता आमचे प्राधान्य आहे',
    'Submitted Anonymously': 'अनामिकपणे सादर केले',
    'Report Details': 'नोंदीचा तपशील',
    'How this helps': 'यामुळे कशी मदत होते',
    'Small Signals. Safer Places.': 'छोटे संकेत. सुरक्षित ठिकाणे.',
    'Report. Alert. Prevent.': 'नोंदवा. सावध करा. प्रतिबंध करा.',
    'Activity Level': 'हालचालीची पातळी',
    'All reports are anonymous. They are linked only to this device, never to you.': 'सर्व नोंदी अनामिक आहेत. त्या फक्त या डिव्हाइसशी जोडलेल्या आहेत, तुमच्याशी कधीही नाहीत.',
    'Your identity is protected': 'तुमची ओळख सुरक्षित आहे',
    'Report Summary': 'नोंदीचा सारांश',
    'Add a brief description to help authorities understand the context.': 'अधिकाऱ्यांना संदर्भ समजण्यास मदत करण्यासाठी थोडक्यात वर्णन जोडा.',
    'No name, phone number, or public identity is attached to your report.': 'तुमच्या नोंदीसोबत नाव, फोन नंबर किंवा सार्वजनिक ओळख जोडली जात नाही.',
    'No community signals nearby right now. Signals appear once several independent reports are received.': 'सध्या जवळ कोणतेही समुदाय संकेत नाहीत. अनेक स्वतंत्र नोंदी मिळाल्यावर संकेत दिसतात.',
  },
};

// Word fallback covers dynamic text and labels not present in the phrase table.
const WORDS: Record<Exclude<Lang, 'en'>, Dict> = {
  hi: {
    report:'रिपोर्ट', reports:'रिपोर्ट', safety:'सुरक्षा', concern:'चिंता', area:'क्षेत्र', status:'स्थिति', nearby:'आस-पास', alert:'चेतावनी', alerts:'चेतावनियाँ', map:'मानचित्र', view:'देखें', full:'पूरा', recent:'हाल का', signals:'संकेत', signal:'संकेत', community:'सामुदायिक', user:'उपयोगकर्ता', anonymous:'गुमनाम', identity:'पहचान', protected:'सुरक्षित', privacy:'गोपनीयता', data:'डेटा', language:'भाषा', notifications:'सूचनाएँ', notification:'सूचना', profile:'प्रोफ़ाइल', location:'स्थान', settings:'सेटिंग्स', choose:'चुनें', allow:'अनुमति दें', access:'पहुँच', incident:'घटना', type:'प्रकार', pattern:'पैटर्न', patterns:'पैटर्न', information:'जानकारी', independent:'स्वतंत्र', day:'दिन', days:'दिन', verification:'सत्यापन', timeline:'समयरेखा', submitted:'जमा', details:'विवरण', helps:'मदद करता है', activity:'गतिविधि', level:'स्तर', quick:'त्वरित', call:'कॉल', emergency:'आपातकाल', track:'ट्रैक', your:'आपका', you:'आप', my:'मेरी', all:'सभी', read:'पढ़ा', mark:'चिह्नित', no:'कोई नहीं', now:'अभी', today:'आज', week:'सप्ताह', this:'यह', last:'पिछला', new:'नया', active:'सक्रिय', open:'खुला', closed:'बंद', resolved:'सुलझा', monitoring:'निगरानी', emerging:'उभरता', escalated:'बढ़ाया गया', high:'उच्च', medium:'मध्यम', low:'कम', harassment:'उत्पीड़न', catcalling:'फब्तियाँ कसना', following:'पीछा करना', loitering:'मंडराना', suspicious:'संदिग्ध', intimidation:'धमकाना', 'unsafe':'असुरक्षित', other:'अन्य', submit:'जमा करें', cancel:'रद्द करें', back:'वापस', next:'अगला', close:'बंद करें', save:'सहेजें', delete:'हटाएँ', loading:'लोड हो रहा है', search:'खोजें', name:'नाम', phone:'फ़ोन', email:'ई-मेल', password:'पासवर्ड', officer:'अधिकारी', authority:'प्राधिकरण', dashboard:'डैशबोर्ड', analytics:'विश्लेषण', cases:'मामले', actions:'कार्रवाइयाँ', action:'कार्रवाई', system:'सिस्टम', home:'होम', access:'पहुँच', daily:'दैनिक', summary:'सारांश', preferences:'प्राथमिकताएँ', English:'अंग्रेज़ी', Hindi:'हिंदी', Marathi:'मराठी',
  },
  mr: {
    report:'नोंद', reports:'नोंदी', safety:'सुरक्षा', concern:'चिंता', area:'परिसर', status:'स्थिती', nearby:'जवळचे', alert:'सूचना', alerts:'सूचना', map:'नकाशा', view:'पहा', full:'पूर्ण', recent:'अलीकडील', signals:'संकेत', signal:'संकेत', community:'समुदाय', user:'वापरकर्ता', anonymous:'अनामिक', identity:'ओळख', protected:'सुरक्षित', privacy:'गोपनीयता', data:'डेटा', language:'भाषा', notifications:'सूचना', notification:'सूचना', profile:'प्रोफाइल', location:'स्थान', settings:'सेटिंग्ज', choose:'निवडा', allow:'परवानगी द्या', access:'प्रवेश', incident:'घटना', type:'प्रकार', pattern:'नमुना', patterns:'नमुने', information:'माहिती', independent:'स्वतंत्र', day:'दिवस', days:'दिवस', verification:'पडताळणी', timeline:'वेळरेषा', submitted:'सादर', details:'तपशील', helps:'मदत करते', activity:'हालचाल', level:'पातळी', quick:'त्वरित', call:'कॉल', emergency:'आणीबाणी', track:'मागोवा घ्या', your:'तुमचा', you:'तुम्ही', my:'माझे', all:'सर्व', read:'वाचलेले', mark:'चिन्हांकित', no:'नाही', now:'आत्ता', today:'आज', week:'आठवडा', this:'हा', last:'गेल्या', new:'नवीन', active:'सक्रिय', open:'उघडे', closed:'बंद', resolved:'निराकरण', monitoring:'निरीक्षण', emerging:'उदयोन्मुख', escalated:'वरिष्ठांकडे पाठवले', high:'उच्च', medium:'मध्यम', low:'कमी', harassment:'छळ', catcalling:'शेरेबाजी', following:'पाठलाग', loitering:'घुटमळणे', suspicious:'संशयास्पद', intimidation:'धमकावणे', unsafe:'असुरक्षित', other:'इतर', submit:'सादर करा', cancel:'रद्द करा', back:'मागे', next:'पुढे', close:'बंद करा', save:'जतन करा', delete:'हटवा', loading:'लोड होत आहे', search:'शोधा', name:'नाव', phone:'फोन', email:'ई-मेल', password:'पासवर्ड', officer:'अधिकारी', authority:'प्राधिकरण', dashboard:'डॅशबोर्ड', analytics:'विश्लेषण', cases:'प्रकरणे', actions:'कारवाया', action:'कारवाई', system:'सिस्टम', home:'होम', daily:'दैनिक', summary:'सारांश', preferences:'प्राधान्ये', English:'इंग्रजी', Hindi:'हिंदी', Marathi:'मराठी',
  },
};

const originals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Map<string, string>>();
let observer: MutationObserver | null = null;
let scheduled = false;

function translateString(source: string, lang: Lang): string {
  if (lang === 'en' || !source.trim()) return source;
  const exact = PHRASES[lang][source.trim()];
  if (exact) return source.startsWith(' ') ? ` ${exact}` : exact;

  // Translate known phrases inside longer strings first.
  let out = source;
  for (const [en, translated] of Object.entries(PHRASES[lang]).sort((a, b) => b[0].length - a[0].length)) {
    if (out.includes(en)) out = out.replaceAll(en, translated);
  }
  if (out !== source) return out;

  return out.replace(/\b[A-Za-z][A-Za-z'-]*\b/g, (word) => WORDS[lang][word] ?? WORDS[lang][word.toLowerCase()] ?? word);
}

function translateAttributes(el: Element, lang: Lang) {
  const attrs = ['placeholder', 'title', 'aria-label', 'alt'];
  let map = attrOriginals.get(el);
  if (!map) { map = new Map(); attrOriginals.set(el, map); }
  for (const attr of attrs) {
    const value = el.getAttribute(attr);
    if (value == null) continue;
    if (!map.has(attr)) map.set(attr, value);
    const translated = translateString(map.get(attr)!, lang);
    if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
  }
}

function translateRoot(root: Node, lang: Lang) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null = root;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const parent = text.parentElement;
      if (!parent || ['SCRIPT','STYLE','NOSCRIPT','CODE','PRE'].includes(parent.tagName)) continue;
      if (!originals.has(text)) originals.set(text, text.nodeValue ?? '');
      const translated = translateString(originals.get(text)!, lang);
      if (text.nodeValue !== translated) text.nodeValue = translated;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateAttributes(node as Element, lang);
    }
  }
}

function schedule(lang: Lang) {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; translateRoot(document.body, lang); });
}

export function installTranslator() {
  observer?.disconnect();
  const update = () => schedule(langStore.get());
  schedule(langStore.get());
  observer = new MutationObserver(() => update());
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder','title','aria-label','alt'] });
  return () => observer?.disconnect();
}
