import type { LanguageCode } from "./languages";

/**
 * UI strings for the chat, per language.
 * DRAFT translations: have a native Hindi and Marathi speaker review them.
 */
export type ChatStrings = {
  pageTitle: string;
  welcomeTitle: string;
  welcomeBody: string;
  starters: [string, string, string, string, string, string];
  startersLabel: string;
  systemNotice: string;
  placeholder: string;
  inputLabel: string;
  send: string;
  stop: string;
  newChat: string;
  language: string;
  emergency: string;
  emergencyCall: (n: string) => string;
  helperBefore: string;
  helperAfter: string;
  charCount: (n: number, max: number) => string;
  you: string;
  assistant: string;
  thinkingLabel: string;
  thinkingStages: [string, string, string];
  thinkingSlow: string;
  cancel: string;
  stopped: string;
  copy: string;
  copied: string;
  helpful: string;
  notHelpful: string;
  followUpsLabel: string;
  choicesLabel: string;
  jumpToLatest: string;
  retry: string;
  errors: {
    offline: string;
    network: string;
    timeout: string;
    rate_limited: string;
    server: string;
  };
  fallbackHelplines: string;
  offlineNotice: string;
  banner: {
    title: string;
    body: string;
    dismiss: string;
    verify: string;
  };
  voice: {
    start: string;
    stop: string;
    requesting: string;
    listening: string;
    listeningHint: string;
    stopped: string;
    unsupported: string;
    privacy: string;
    gotIt: string;
    errors: {
      permission: string;
      "no-speech": string;
      "no-mic": string;
      network: string;
      language: string;
      unknown: string;
    };
  };
  theme: { dark: string };
};

const en: ChatStrings = {
  pageTitle: "RailSaathi assistant",
  welcomeTitle: "Ask about safety, helplines or a situation",
  welcomeBody: "Calm, step-by-step guidance for Mumbai local trains, based on railway safety information.",
  starters: [
    "Someone stole my phone",
    "Emergency helpline numbers",
    "Safety tips for late-night travel",
    "Harassment on the train",
    "Monsoon disruptions",
    "Lost belongings",
  ],
  startersLabel: "Suggested questions",
  systemNotice: "Answers are based on official railway safety information.",
  placeholder: "Ask about safety, helplines or a situation...",
  inputLabel: "Message RailSaathi",
  send: "Send message",
  stop: "Stop generating",
  newChat: "New chat",
  language: "Language",
  emergency: "Emergency",
  emergencyCall: (n) => `Emergency, call ${n}`,
  helperBefore: "RailSaathi gives guidance, not emergency services. In danger call",
  helperAfter: ".",
  charCount: (n, max) => `${n} of ${max} characters`,
  you: "You",
  assistant: "RailSaathi",
  thinkingLabel: "RailSaathi is thinking",
  thinkingStages: ["Understanding your question...", "Checking safety guidance...", "Preparing your answer..."],
  thinkingSlow: "This is taking longer than usual.",
  cancel: "Cancel",
  stopped: "Response stopped.",
  copy: "Copy answer",
  copied: "Copied",
  helpful: "Helpful",
  notHelpful: "Not helpful",
  followUpsLabel: "Suggested follow-up questions",
  choicesLabel: "Choose an option",
  jumpToLatest: "Jump to latest",
  retry: "Retry",
  errors: {
    offline: "You seem to be offline, so I couldn't get an answer.",
    network: "The connection dropped before the answer finished.",
    timeout: "The answer took too long to arrive.",
    rate_limited: "Lots of questions in a short time. Please wait a moment and try again.",
    server: "Something went wrong on our side.",
  },
  fallbackHelplines: "These numbers work without RailSaathi:",
  offlineNotice: "You're offline. Emergency calls still work.",
  banner: {
    title: "If anyone is in danger, call now",
    body: "Tap a number to call. You can keep chatting after.",
    dismiss: "Dismiss emergency numbers",
    verify: "Numbers to be verified",
  },
  voice: {
    start: "Start voice input",
    stop: "Stop voice input",
    requesting: "Waiting for microphone permission...",
    listening: "Listening...",
    listeningHint: "Tap the mic to stop.",
    stopped: "Stopped listening",
    unsupported: "Voice input isn't supported in this browser. You can type instead.",
    privacy: "Voice recognition may be processed by your browser vendor.",
    gotIt: "Got it",
    errors: {
      permission: "Microphone access is blocked. Allow it from the icon in the address bar, then try again.",
      "no-speech": "I didn't catch that. Tap the mic and try again.",
      "no-mic": "No microphone found. Check that one is connected.",
      network: "Voice input needs an internet connection. You can type instead.",
      language: "Voice isn't available for this language in your browser. You can type instead.",
      unknown: "Voice input stopped unexpectedly. Please try again.",
    },
  },
  theme: { dark: "Dark mode" },
};

const hi: ChatStrings = {
  pageTitle: "RailSaathi सहायक",
  welcomeTitle: "सुरक्षा, हेल्पलाइन या किसी स्थिति के बारे में पूछें",
  welcomeBody: "मुंबई लोकल ट्रेन के लिए शांत, चरण-दर-चरण मार्गदर्शन, रेलवे सुरक्षा जानकारी पर आधारित।",
  starters: [
    "किसी ने मेरा फोन चुरा लिया",
    "आपातकालीन हेल्पलाइन नंबर",
    "देर रात यात्रा के लिए सुरक्षा टिप्स",
    "ट्रेन में छेड़छाड़",
    "मानसून में ट्रेन रुकावट",
    "खोया हुआ सामान",
  ],
  startersLabel: "सुझाए गए सवाल",
  systemNotice: "उत्तर आधिकारिक रेलवे सुरक्षा जानकारी पर आधारित हैं।",
  placeholder: "सुरक्षा, हेल्पलाइन या किसी स्थिति के बारे में पूछें...",
  inputLabel: "RailSaathi को संदेश लिखें",
  send: "संदेश भेजें",
  stop: "जवाब रोकें",
  newChat: "नई बातचीत",
  language: "भाषा",
  emergency: "आपातकाल",
  emergencyCall: (n) => `आपातकाल, ${n} पर कॉल करें`,
  helperBefore: "RailSaathi मार्गदर्शन देता है, आपातकालीन सेवा नहीं। खतरे में हों तो कॉल करें",
  helperAfter: "।",
  charCount: (n, max) => `${max} में से ${n} अक्षर`,
  you: "आप",
  assistant: "RailSaathi",
  thinkingLabel: "RailSaathi सोच रहा है",
  thinkingStages: ["आपका सवाल समझ रहे हैं...", "सुरक्षा जानकारी देख रहे हैं...", "जवाब तैयार कर रहे हैं..."],
  thinkingSlow: "इसमें सामान्य से ज़्यादा समय लग रहा है।",
  cancel: "रद्द करें",
  stopped: "जवाब रोक दिया गया।",
  copy: "जवाब कॉपी करें",
  copied: "कॉपी हो गया",
  helpful: "मददगार",
  notHelpful: "मददगार नहीं",
  followUpsLabel: "आगे के सुझाए गए सवाल",
  choicesLabel: "एक विकल्प चुनें",
  jumpToLatest: "नए संदेश पर जाएँ",
  retry: "फिर कोशिश करें",
  errors: {
    offline: "आप ऑफ़लाइन लग रहे हैं, इसलिए जवाब नहीं मिल सका।",
    network: "जवाब पूरा होने से पहले कनेक्शन टूट गया।",
    timeout: "जवाब आने में बहुत समय लग गया।",
    rate_limited: "कम समय में बहुत सारे सवाल आए। थोड़ा रुककर फिर कोशिश करें।",
    server: "हमारी तरफ़ से कुछ गड़बड़ हो गई।",
  },
  fallbackHelplines: "ये नंबर RailSaathi के बिना भी काम करते हैं:",
  offlineNotice: "आप ऑफ़लाइन हैं। आपातकालीन कॉल अब भी काम करती हैं।",
  banner: {
    title: "अगर कोई खतरे में है, तो अभी कॉल करें",
    body: "कॉल करने के लिए नंबर पर टैप करें। बाद में बातचीत जारी रख सकते हैं।",
    dismiss: "आपातकालीन नंबर छिपाएँ",
    verify: "नंबरों की पुष्टि बाकी है",
  },
  voice: {
    start: "बोलकर लिखना शुरू करें",
    stop: "बोलकर लिखना बंद करें",
    requesting: "माइक्रोफ़ोन अनुमति का इंतज़ार...",
    listening: "सुन रहे हैं...",
    listeningHint: "रोकने के लिए माइक पर टैप करें।",
    stopped: "सुनना बंद",
    unsupported: "इस ब्राउज़र में बोलकर लिखना उपलब्ध नहीं है। आप टाइप कर सकते हैं।",
    privacy: "आवाज़ की पहचान आपके ब्राउज़र कंपनी के सर्वर पर हो सकती है।",
    gotIt: "ठीक है",
    errors: {
      permission: "माइक्रोफ़ोन की अनुमति बंद है। एड्रेस बार के आइकन से अनुमति दें, फिर दोबारा कोशिश करें।",
      "no-speech": "कुछ सुनाई नहीं दिया। माइक पर टैप करके फिर बोलें।",
      "no-mic": "कोई माइक्रोफ़ोन नहीं मिला। जाँचें कि वह जुड़ा है।",
      network: "बोलकर लिखने के लिए इंटरनेट चाहिए। आप टाइप कर सकते हैं।",
      language: "आपके ब्राउज़र में इस भाषा के लिए आवाज़ उपलब्ध नहीं है। आप टाइप कर सकते हैं।",
      unknown: "बोलकर लिखना अचानक रुक गया। फिर कोशिश करें।",
    },
  },
  theme: { dark: "डार्क मोड" },
};

const mr: ChatStrings = {
  pageTitle: "RailSaathi सहाय्यक",
  welcomeTitle: "सुरक्षा, हेल्पलाईन किंवा एखाद्या परिस्थितीबद्दल विचारा",
  welcomeBody: "मुंबई लोकलसाठी शांत, टप्प्याटप्प्याने मार्गदर्शन, रेल्वे सुरक्षा माहितीवर आधारित.",
  starters: [
    "कोणीतरी माझा फोन चोरला",
    "आपत्कालीन हेल्पलाईन क्रमांक",
    "रात्री उशिराच्या प्रवासासाठी सुरक्षा टिप्स",
    "ट्रेनमध्ये छेडछाड",
    "पावसाळ्यात गाड्या विस्कळीत",
    "हरवलेल्या वस्तू",
  ],
  startersLabel: "सुचवलेले प्रश्न",
  systemNotice: "उत्तरे अधिकृत रेल्वे सुरक्षा माहितीवर आधारित आहेत.",
  placeholder: "सुरक्षा, हेल्पलाईन किंवा परिस्थितीबद्दल विचारा...",
  inputLabel: "RailSaathi ला संदेश लिहा",
  send: "संदेश पाठवा",
  stop: "उत्तर थांबवा",
  newChat: "नवीन संवाद",
  language: "भाषा",
  emergency: "आपत्कालीन",
  emergencyCall: (n) => `आपत्कालीन, ${n} वर कॉल करा`,
  helperBefore: "RailSaathi मार्गदर्शन देते, आपत्कालीन सेवा नाही. धोक्यात असल्यास कॉल करा",
  helperAfter: ".",
  charCount: (n, max) => `${max} पैकी ${n} अक्षरे`,
  you: "तुम्ही",
  assistant: "RailSaathi",
  thinkingLabel: "RailSaathi विचार करत आहे",
  thinkingStages: ["तुमचा प्रश्न समजून घेत आहे...", "सुरक्षा माहिती तपासत आहे...", "उत्तर तयार करत आहे..."],
  thinkingSlow: "याला नेहमीपेक्षा जास्त वेळ लागत आहे.",
  cancel: "रद्द करा",
  stopped: "उत्तर थांबवले.",
  copy: "उत्तर कॉपी करा",
  copied: "कॉपी झाले",
  helpful: "उपयुक्त",
  notHelpful: "उपयुक्त नाही",
  followUpsLabel: "पुढील सुचवलेले प्रश्न",
  choicesLabel: "एक पर्याय निवडा",
  jumpToLatest: "नवीन संदेशाकडे जा",
  retry: "पुन्हा प्रयत्न करा",
  errors: {
    offline: "तुम्ही ऑफलाइन आहात असे दिसते, त्यामुळे उत्तर मिळाले नाही.",
    network: "उत्तर पूर्ण होण्याआधी कनेक्शन तुटले.",
    timeout: "उत्तर यायला खूप वेळ लागला.",
    rate_limited: "थोड्या वेळात खूप प्रश्न आले. थोडे थांबून पुन्हा प्रयत्न करा.",
    server: "आमच्याकडून काहीतरी चूक झाली.",
  },
  fallbackHelplines: "हे क्रमांक RailSaathi शिवायही चालतात:",
  offlineNotice: "तुम्ही ऑफलाइन आहात. आपत्कालीन कॉल अजूनही चालतात.",
  banner: {
    title: "कोणी धोक्यात असल्यास आत्ताच कॉल करा",
    body: "कॉल करण्यासाठी क्रमांकावर टॅप करा. नंतर संवाद सुरू ठेवू शकता.",
    dismiss: "आपत्कालीन क्रमांक लपवा",
    verify: "क्रमांकांची पडताळणी बाकी आहे",
  },
  voice: {
    start: "बोलून लिहिणे सुरू करा",
    stop: "बोलून लिहिणे थांबवा",
    requesting: "मायक्रोफोन परवानगीची वाट पाहत आहे...",
    listening: "ऐकत आहे...",
    listeningHint: "थांबवण्यासाठी माइकवर टॅप करा.",
    stopped: "ऐकणे थांबले",
    unsupported: "या ब्राउझरमध्ये बोलून लिहिणे उपलब्ध नाही. तुम्ही टाइप करू शकता.",
    privacy: "आवाज ओळख तुमच्या ब्राउझर कंपनीच्या सर्व्हरवर होऊ शकते.",
    gotIt: "ठीक आहे",
    errors: {
      permission: "मायक्रोफोनची परवानगी बंद आहे. ॲड्रेस बारमधील आयकॉनवरून परवानगी द्या आणि पुन्हा प्रयत्न करा.",
      "no-speech": "काही ऐकू आले नाही. माइकवर टॅप करून पुन्हा बोला.",
      "no-mic": "मायक्रोफोन सापडला नाही. तो जोडलेला आहे का ते तपासा.",
      network: "बोलून लिहिण्यासाठी इंटरनेट हवे. तुम्ही टाइप करू शकता.",
      language: "तुमच्या ब्राउझरमध्ये या भाषेसाठी आवाज उपलब्ध नाही. तुम्ही टाइप करू शकता.",
      unknown: "बोलून लिहिणे अचानक थांबले. पुन्हा प्रयत्न करा.",
    },
  },
  theme: { dark: "डार्क मोड" },
};

export const CHAT_STRINGS: Readonly<Record<LanguageCode, ChatStrings>> = { en, hi, mr };
