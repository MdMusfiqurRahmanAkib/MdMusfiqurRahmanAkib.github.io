/* =========================================================
   KrishiBondhu — static data & translations
   ========================================================= */

/* ---------- Crops (icon-based, English + Bangla) ---------- */
const CROPS = [
  { id: 'rice',      en: 'Rice',       bn: 'ধান',       em: '🌾', unit: 'kg' },
  { id: 'wheat',     en: 'Wheat',      bn: 'গম',        em: '🌿', unit: 'kg' },
  { id: 'potato',    en: 'Potato',     bn: 'আলু',       em: '🥔', unit: 'kg' },
  { id: 'tomato',    en: 'Tomato',     bn: 'টমেটো',     em: '🍅', unit: 'kg' },
  { id: 'onion',     en: 'Onion',      bn: 'পেঁয়াজ',    em: '🧅', unit: 'kg' },
  { id: 'jute',      en: 'Jute',       bn: 'পাট',       em: '🪢', unit: 'kg' },
  { id: 'maize',     en: 'Maize',      bn: 'ভুট্টা',     em: '🌽', unit: 'kg' },
  { id: 'chili',     en: 'Chili',      bn: 'মরিচ',      em: '🌶️', unit: 'kg' },
  { id: 'lentil',    en: 'Lentil',     bn: 'ডাল',       em: '🫘', unit: 'kg' },
  { id: 'mango',     en: 'Mango',      bn: 'আম',        em: '🥭', unit: 'kg' },
  { id: 'eggplant',  en: 'Eggplant',   bn: 'বেগুন',     em: '🍆', unit: 'kg' },
  { id: 'sugarcane', en: 'Sugarcane',  bn: 'আখ',        em: '🎋', unit: 'kg' },
];

const cropById = (id) => CROPS.find(c => c.id === id);

/* ---------- Seed markets (Chattogram-focused; distances computed by GPS) ---------- */
const SEED_MARKETS = [
  // Chattogram region
  { id: 'c1', name: 'Reazuddin Bazar',   bn: 'রেয়াজউদ্দিন বাজার', lat: 22.3350, lon: 91.8322 },
  { id: 'c2', name: 'Chawkbazar',        bn: 'চকবাজার',          lat: 22.3607, lon: 91.8290 },
  { id: 'c3', name: 'Kazir Dewri Bazar', bn: 'কাজীর দেউড়ি বাজার', lat: 22.3585, lon: 91.8210 },
  { id: 'c4', name: 'Bahaddarhat Bazar', bn: 'বহদ্দারহাট বাজার',  lat: 22.3700, lon: 91.8470 },
  { id: 'c5', name: 'Pahartali Bazar',   bn: 'পাহাড়তলী বাজার',   lat: 22.3760, lon: 91.7870 },
  { id: 'c6', name: 'Oxygen More Bazar', bn: 'অক্সিজেন মোড় বাজার', lat: 22.3900, lon: 91.8180 },
  { id: 'c7', name: 'Firingi Bazar',     bn: 'ফিরিঙ্গি বাজার',    lat: 22.3300, lon: 91.8380 },
  { id: 'c8', name: 'Steel Mill Bazar',  bn: 'স্টিল মিল বাজার',    lat: 22.2790, lon: 91.7600 },
  // A few Dhaka markets (so users outside Chattogram also see nearby markets)
  { id: 'd1', name: 'Karwan Bazar',      bn: 'কারওয়ান বাজার',   lat: 23.7509, lon: 90.3934 },
  { id: 'd2', name: 'Shyambazar',        bn: 'শ্যামবাজার',       lat: 23.7104, lon: 90.4074 },
  { id: 'd3', name: 'Mohakhali Kacha Bazar', bn: 'মহাখালী কাঁচাবাজার', lat: 23.7783, lon: 90.4053 },
  { id: 'd4', name: 'Mirpur-1 Bazar',    bn: 'মিরপুর-১ বাজার',   lat: 23.7957, lon: 90.3537 },
];

/* Approximate coordinates for major Bangladeshi districts, used to place a user
   sensibly when they type their location manually (no paid geocoding needed). */
const DISTRICTS = {
  chattogram: { lat: 22.3569, lon: 91.7832 }, chittagong: { lat: 22.3569, lon: 91.7832 },
  dhaka: { lat: 23.8103, lon: 90.4125 }, gazipur: { lat: 23.9999, lon: 90.4203 },
  narayanganj: { lat: 23.6238, lon: 90.4990 }, sylhet: { lat: 24.8949, lon: 91.8687 },
  rajshahi: { lat: 24.3745, lon: 88.6042 }, khulna: { lat: 22.8456, lon: 89.5403 },
  barishal: { lat: 22.7010, lon: 90.3535 }, rangpur: { lat: 25.7439, lon: 89.2752 },
  mymensingh: { lat: 24.7471, lon: 90.4203 }, cumilla: { lat: 23.4607, lon: 91.1809 },
  comilla: { lat: 23.4607, lon: 91.1809 }, 'cox': { lat: 21.4272, lon: 92.0058 },
  jashore: { lat: 23.1664, lon: 89.2081 }, bogura: { lat: 24.8465, lon: 89.3773 },
  dinajpur: { lat: 25.6217, lon: 88.6354 }, feni: { lat: 23.0159, lon: 91.3976 },
  noakhali: { lat: 22.8696, lon: 91.0995 }, tangail: { lat: 24.2513, lon: 89.9167 },
};
function lookupDistrict(text) {
  const s = (text || '').toLowerCase();
  for (const key in DISTRICTS) if (s.includes(key)) return DISTRICTS[key];
  return null;
}

/* Baseline reference price per crop (BDT/kg) — used to seed realistic entries */
const BASE_PRICE = {
  rice: 58, wheat: 42, potato: 34, tomato: 60, onion: 95, jute: 78,
  maize: 30, chili: 210, lentil: 120, mango: 90, eggplant: 55, sugarcane: 25,
};

/* ---------- Advisory rule engine ----------
   Maps weather conditions -> plain-language, crop-aware farming action.
   Each rule: { when(day, crop) -> bool, level, key }  (key resolves via i18n) */
const ADVISORY_RULES = [
  {
    id: 'heavy_rain',
    level: 'crit',
    when: (d) => d.rainProb >= 70 || d.rainMm >= 20,
    title: { en: 'Heavy rain expected', bn: 'ভারী বৃষ্টির সম্ভাবনা' },
    text: {
      en: 'Postpone spraying and irrigation. Cover harvested crops and clear drainage channels.',
      bn: 'কীটনাশক স্প্রে ও সেচ পিছিয়ে দিন। কাটা ফসল ঢেকে রাখুন এবং পানি নিষ্কাশনের নালা পরিষ্কার করুন।'
    }
  },
  {
    id: 'storm',
    level: 'crit',
    when: (d) => d.wind >= 45 || d.severe,
    title: { en: 'Storm / high wind warning', bn: 'ঝড় / প্রবল বাতাসের সতর্কতা' },
    text: {
      en: 'Secure young plants and equipment. Avoid field work and harvest ripe crops early if possible.',
      bn: 'কচি গাছ ও যন্ত্রপাতি নিরাপদে রাখুন। মাঠের কাজ এড়িয়ে চলুন এবং সম্ভব হলে পাকা ফসল আগেই কেটে নিন।'
    }
  },
  {
    id: 'light_rain',
    level: 'warn',
    when: (d) => d.rainProb >= 40 && d.rainProb < 70,
    title: { en: 'Light rain likely', bn: 'হালকা বৃষ্টির সম্ভাবনা' },
    text: {
      en: 'Skip irrigation today — rain will water your field. Delay pesticide application.',
      bn: 'আজ সেচ দেওয়ার দরকার নেই — বৃষ্টি মাঠে পানি দেবে। কীটনাশক প্রয়োগ পিছিয়ে দিন।'
    }
  },
  {
    id: 'heat',
    level: 'warn',
    when: (d) => d.tempMax >= 36,
    title: { en: 'High temperature', bn: 'উচ্চ তাপমাত্রা' },
    text: {
      en: 'Irrigate early morning or evening to reduce water loss. Provide shade for seedlings.',
      bn: 'পানির অপচয় কমাতে ভোরে বা সন্ধ্যায় সেচ দিন। চারা গাছের জন্য ছায়ার ব্যবস্থা করুন।'
    }
  },
  {
    id: 'dry_good',
    level: 'calm',
    when: (d) => d.rainProb < 25 && d.tempMax < 36 && d.wind < 35,
    title: { en: 'Good day for field work', bn: 'মাঠের কাজের জন্য ভালো দিন' },
    text: {
      en: 'Clear and dry — ideal for spraying, weeding and harvesting. A good day to work your land.',
      bn: 'পরিষ্কার ও শুকনো — স্প্রে, আগাছা পরিষ্কার ও ফসল কাটার জন্য উপযুক্ত। জমিতে কাজ করার ভালো দিন।'
    }
  },
];

/* Crop-specific note appended to the primary advisory */
const CROP_NOTE = {
  rice:   { en: 'Maintain 2–3 cm standing water in paddy after rain.', bn: 'বৃষ্টির পর ধান ক্ষেতে ২–৩ সেমি পানি ধরে রাখুন।' },
  potato: { en: 'Watch for late blight in wet, cool weather.',        bn: 'ভেজা ও ঠান্ডা আবহাওয়ায় আলুর নাবিধসা রোগে সতর্ক থাকুন।' },
  tomato: { en: 'Stake plants before storms to prevent breakage.',   bn: 'ঝড়ের আগে টমেটো গাছে খুঁটি দিন যাতে ভেঙে না যায়।' },
  onion:  { en: 'Avoid waterlogging — onions rot in standing water.', bn: 'জলাবদ্ধতা এড়ান — জমে থাকা পানিতে পেঁয়াজ পচে যায়।' },
  chili:  { en: 'Rain raises fungal risk — check leaves after showers.', bn: 'বৃষ্টিতে ছত্রাকের ঝুঁকি বাড়ে — বৃষ্টির পর পাতা পরীক্ষা করুন।' },
};

/* Reminder task types */
const TASK_TYPES = [
  { id: 'irrigation', en: 'Irrigation',        bn: 'সেচ',            em: '💧', weatherSensitive: true },
  { id: 'spraying',   en: 'Pesticide spraying', bn: 'কীটনাশক স্প্রে', em: '🧴', weatherSensitive: true },
  { id: 'fertilizer', en: 'Fertilizing',        bn: 'সার প্রয়োগ',    em: '🌱', weatherSensitive: true },
  { id: 'weeding',    en: 'Weeding',            bn: 'আগাছা পরিষ্কার',  em: '🌿', weatherSensitive: false },
  { id: 'harvest',    en: 'Harvesting',         bn: 'ফসল কাটা',      em: '🧺', weatherSensitive: false },
  { id: 'sowing',     en: 'Sowing / planting',  bn: 'বীজ বপন',       em: '🌰', weatherSensitive: true },
];
const taskTypeById = (id) => TASK_TYPES.find(t => t.id === id);

/* ---------- i18n dictionary ---------- */
const I18N = {
  en: {
    // generic
    appName: 'KrishiBondhu', tagline: "Farmer's weather & market friend",
    continue: 'Continue', next: 'Next', back: 'Back', save: 'Save', cancel: 'Cancel',
    done: 'Done', skip: 'Skip', delete: 'Delete', edit: 'Edit', confirm: 'Confirm',
    today: 'Today', km: 'km', optional: 'optional', search: 'Search',
    // auth
    welcome: 'Welcome back', signInSub: 'Sign in to continue to your farm dashboard',
    createAccount: 'Create your account', registerSub: "Let's set up your farming profile",
    fullName: 'Full name', phoneEmail: 'Phone number or email', password: 'Password',
    role: 'I am a', roleFarmer: 'Farmer', roleTrader: 'Trader', roleUser: 'General user',
    login: 'Log in', register: 'Register', logout: 'Log out',
    noAccount: "Don't have an account?", haveAccount: 'Already registered?',
    forgot: 'Forgot password?', rememberMe: 'Keep me logged in', tryDemo: 'Try demo account',
    errName: 'Please enter your name', errCred: 'Enter your phone or email',
    errPass: 'Password must be at least 4 characters', errLogin: 'No account found. Please register first.',
    errWrongPass: 'Incorrect password. Try again.', errDup: 'An account with this phone/email already exists.',
    errCredFormat: 'Enter a valid phone number (01XXXXXXXXX) or email address.',
    // onboarding
    setLocation: 'Set your location', locationSub: 'We use it for weather and nearby markets',
    useGps: 'Use my current location', enterManually: 'Enter location manually',
    locating: 'Getting your location…', locationSet: 'Location set',
    gpsFail: "Couldn't get GPS. Please enter manually.",
    district: 'District / area', pickCrops: 'Pick your crops', cropsSub: 'Select the crops you grow',
    selectAtLeastOne: 'Select at least one crop',
    // tabs
    tabHome: 'Home', tabWeather: 'Weather', tabMarket: 'Market', tabTasks: 'Tasks', tabProfile: 'Profile',
    // home
    hello: 'Hello', todayAdvisory: "Today's advisory", viewAll: 'View all',
    quickActions: 'Quick actions', nearbyMarkets: 'Nearby markets', upcomingTasks: 'Upcoming tasks',
    qWeather: 'Weather', qMarkets: 'Markets', qReport: 'Report price', qReminder: 'Reminder',
    feelsLike: 'Feels like', humidity: 'Humidity', wind: 'Wind', rain: 'Rain',
    noTasks: 'No tasks scheduled', noTasksSub: 'Add a reminder to stay on track',
    // weather
    weatherTitle: 'Weather & advisory', dayForecast: '5-day forecast',
    advisoryFor: 'Advisory for your crops', playAudio: 'Play audio advisory',
    noAction: 'No special action needed today. Continue routine farm work.',
    severeTag: 'Emergency alert', lastUpdated: 'Updated', refresh: 'Refresh',
    // market
    marketTitle: 'Market prices', selectCrop: 'Select crop', within: 'Within',
    sortBy: 'Sort', sortDistance: 'Distance', sortPrice: 'Price', avgPrice: 'Avg price',
    reportPrice: 'Report a price', bestPrice: 'Best price', noRecent: 'No recent price',
    noRecentSub: 'Be the first to report today', distance: 'Distance', latestPrice: 'Latest price',
    reportedBy: 'by', setTarget: 'Set target price', targetSet: 'Target price set',
    targetHint: 'Get alerted when any nearby market reaches this price',
    submitPrice: 'Submit price', priceFor: 'Price for', atMarket: 'at market',
    pricePerKg: 'Price (BDT per kg)', addMarket: 'Add new market', marketName: 'Market name',
    priceSubmitted: 'Price submitted, thank you!', errPrice: 'Enter a valid price',
    impossiblePrice: 'That price looks unusually high. Submit anyway?',
    compare: 'Compare prices', reportedAgo: 'ago', justNow: 'just now',
    // target price
    targetTitle: 'Target price', targetValue: 'Target price (BDT/kg)',
    currentRange: 'Recent price range', updateTarget: 'Update target', removeTarget: 'Remove target',
    errTarget: 'Enter a valid target price', targetRemoved: 'Target removed',
    priceAlert: 'Price alert', priceAlertBody: 'reached your target of',
    // tasks
    tasksTitle: 'Smart reminders', addReminder: 'Add reminder', taskType: 'Task type',
    forCrop: 'For crop', repeat: 'Repeat', repeatNone: 'One time', repeatDaily: 'Every day',
    repeatWeekly: 'Every week', time: 'Time', reminderSaved: 'Reminder saved',
    reminderDeleted: 'Reminder deleted', autoMoved: 'Auto-rescheduled due to weather',
    movedBecause: 'Moved to avoid', deleteReminder: 'Delete this reminder?',
    // profile / settings
    profileTitle: 'Profile', myCrops: 'My crops', myLocation: 'My location',
    editProfile: 'Edit profile', language: 'Language', settings: 'Settings',
    alertsSettings: 'Alerts', weatherAlerts: 'Severe weather alerts', priceAlerts: 'Price alerts',
    weatherApiKey: 'OpenWeatherMap API key', apiKeyHint: 'Optional — add your own key for live weather. Leave blank for demo data.',
    liveMode: 'Live weather', demoMode: 'Demo weather', dataSource: 'Weather source',
    weatherModeHint: 'Demo shows sample conditions so all alerts can be tested. Live fetches real weather from Open-Meteo (free, no key needed).',
    account: 'Account', memberSince: 'Member', changeCrops: 'Change crops',
    savedLoc: 'Saved location', notifPermission: 'Enable notifications',
    aboutApp: 'About', version: 'Version',
    // offline
    offline: 'You are offline — showing saved data', online: 'Back online',
    noCache: 'No saved data yet. Connect to the internet to load.',
    // misc
    profileUpdated: 'Profile updated', savedOffline: 'Saved — will sync when online',
    days: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    condSunny:'Sunny', condCloud:'Cloudy', condRain:'Rain', condStorm:'Storm', condClear:'Clear',
  },
  bn: {
    appName: 'কৃষিবন্ধু', tagline: 'কৃষকের আবহাওয়া ও বাজার বন্ধু',
    continue: 'এগিয়ে যান', next: 'পরবর্তী', back: 'পিছনে', save: 'সংরক্ষণ', cancel: 'বাতিল',
    done: 'সম্পন্ন', skip: 'এড়িয়ে যান', delete: 'মুছুন', edit: 'সম্পাদনা', confirm: 'নিশ্চিত করুন',
    today: 'আজ', km: 'কিমি', optional: 'ঐচ্ছিক', search: 'খুঁজুন',
    welcome: 'আবার স্বাগতম', signInSub: 'আপনার ড্যাশবোর্ডে যেতে লগইন করুন',
    createAccount: 'অ্যাকাউন্ট তৈরি করুন', registerSub: 'আপনার কৃষি প্রোফাইল সেট করি',
    fullName: 'পুরো নাম', phoneEmail: 'ফোন নম্বর বা ইমেইল', password: 'পাসওয়ার্ড',
    role: 'আমি একজন', roleFarmer: 'কৃষক', roleTrader: 'ব্যবসায়ী', roleUser: 'সাধারণ ব্যবহারকারী',
    login: 'লগইন', register: 'নিবন্ধন', logout: 'লগআউট',
    noAccount: 'অ্যাকাউন্ট নেই?', haveAccount: 'ইতিমধ্যে নিবন্ধিত?',
    forgot: 'পাসওয়ার্ড ভুলে গেছেন?', rememberMe: 'লগইন রাখুন', tryDemo: 'ডেমো অ্যাকাউন্ট ব্যবহার করুন',
    errName: 'অনুগ্রহ করে আপনার নাম লিখুন', errCred: 'ফোন বা ইমেইল লিখুন',
    errPass: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে', errLogin: 'কোনো অ্যাকাউন্ট নেই। আগে নিবন্ধন করুন।',
    errWrongPass: 'ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।', errDup: 'এই ফোন/ইমেইল দিয়ে অ্যাকাউন্ট আছে।',
    errCredFormat: 'সঠিক ফোন নম্বর (০১XXXXXXXXX) বা ইমেইল দিন।',
    setLocation: 'আপনার অবস্থান দিন', locationSub: 'আবহাওয়া ও কাছের বাজারের জন্য প্রয়োজন',
    useGps: 'আমার বর্তমান অবস্থান ব্যবহার করুন', enterManually: 'নিজে অবস্থান লিখুন',
    locating: 'অবস্থান খোঁজা হচ্ছে…', locationSet: 'অবস্থান সেট হয়েছে',
    gpsFail: 'জিপিএস পাওয়া যায়নি। নিজে লিখুন।',
    district: 'জেলা / এলাকা', pickCrops: 'আপনার ফসল বাছুন', cropsSub: 'আপনি যে ফসল চাষ করেন তা নির্বাচন করুন',
    selectAtLeastOne: 'কমপক্ষে একটি ফসল নির্বাচন করুন',
    tabHome: 'হোম', tabWeather: 'আবহাওয়া', tabMarket: 'বাজার', tabTasks: 'কাজ', tabProfile: 'প্রোফাইল',
    hello: 'আসসালামু আলাইকুম', todayAdvisory: 'আজকের পরামর্শ', viewAll: 'সব দেখুন',
    quickActions: 'দ্রুত কাজ', nearbyMarkets: 'কাছের বাজার', upcomingTasks: 'আসন্ন কাজ',
    qWeather: 'আবহাওয়া', qMarkets: 'বাজার', qReport: 'দাম দিন', qReminder: 'রিমাইন্ডার',
    feelsLike: 'অনুভূত', humidity: 'আর্দ্রতা', wind: 'বাতাস', rain: 'বৃষ্টি',
    noTasks: 'কোনো কাজ নির্ধারিত নেই', noTasksSub: 'ট্র্যাকে থাকতে রিমাইন্ডার যোগ করুন',
    weatherTitle: 'আবহাওয়া ও পরামর্শ', dayForecast: '৫ দিনের পূর্বাভাস',
    advisoryFor: 'আপনার ফসলের জন্য পরামর্শ', playAudio: 'পরামর্শ শুনুন',
    noAction: 'আজ বিশেষ কিছু করার নেই। স্বাভাবিক কাজ চালিয়ে যান।',
    severeTag: 'জরুরি সতর্কতা', lastUpdated: 'হালনাগাদ', refresh: 'রিফ্রেশ',
    marketTitle: 'বাজার দর', selectCrop: 'ফসল নির্বাচন', within: 'দূরত্ব',
    sortBy: 'সাজান', sortDistance: 'দূরত্ব', sortPrice: 'দাম', avgPrice: 'গড় দাম',
    reportPrice: 'দাম জানান', bestPrice: 'সেরা দাম', noRecent: 'সাম্প্রতিক দাম নেই',
    noRecentSub: 'আজ প্রথম দাম জানান', distance: 'দূরত্ব', latestPrice: 'সর্বশেষ দাম',
    reportedBy: 'জানিয়েছেন', setTarget: 'লক্ষ্য দাম দিন', targetSet: 'লক্ষ্য দাম সেট হয়েছে',
    targetHint: 'কাছের বাজারে এই দাম পৌঁছালে সতর্কতা পাবেন',
    submitPrice: 'দাম জমা দিন', priceFor: 'দাম—', atMarket: 'বাজার',
    pricePerKg: 'দাম (টাকা প্রতি কেজি)', addMarket: 'নতুন বাজার যোগ', marketName: 'বাজারের নাম',
    priceSubmitted: 'দাম জমা হয়েছে, ধন্যবাদ!', errPrice: 'সঠিক দাম লিখুন',
    impossiblePrice: 'দামটি অস্বাভাবিক বেশি মনে হচ্ছে। তবুও জমা দেবেন?',
    compare: 'দাম তুলনা', reportedAgo: 'আগে', justNow: 'এইমাত্র',
    targetTitle: 'লক্ষ্য দাম', targetValue: 'লক্ষ্য দাম (টাকা/কেজি)',
    currentRange: 'সাম্প্রতিক দামের পরিসর', updateTarget: 'লক্ষ্য হালনাগাদ', removeTarget: 'লক্ষ্য সরান',
    errTarget: 'সঠিক লক্ষ্য দাম লিখুন', targetRemoved: 'লক্ষ্য সরানো হয়েছে',
    priceAlert: 'দাম সতর্কতা', priceAlertBody: 'আপনার লক্ষ্য পূরণ করেছে—',
    tasksTitle: 'স্মার্ট রিমাইন্ডার', addReminder: 'রিমাইন্ডার যোগ', taskType: 'কাজের ধরন',
    forCrop: 'ফসল', repeat: 'পুনরাবৃত্তি', repeatNone: 'একবার', repeatDaily: 'প্রতিদিন',
    repeatWeekly: 'প্রতি সপ্তাহে', time: 'সময়', reminderSaved: 'রিমাইন্ডার সংরক্ষিত',
    reminderDeleted: 'রিমাইন্ডার মুছে ফেলা হয়েছে', autoMoved: 'আবহাওয়ার কারণে স্বয়ংক্রিয়ভাবে পিছিয়ে দেওয়া হয়েছে',
    movedBecause: 'এড়াতে সরানো হয়েছে—', deleteReminder: 'এই রিমাইন্ডার মুছবেন?',
    profileTitle: 'প্রোফাইল', myCrops: 'আমার ফসল', myLocation: 'আমার অবস্থান',
    editProfile: 'প্রোফাইল সম্পাদনা', language: 'ভাষা', settings: 'সেটিংস',
    alertsSettings: 'সতর্কতা', weatherAlerts: 'দুর্যোগ সতর্কতা', priceAlerts: 'দাম সতর্কতা',
    weatherApiKey: 'OpenWeatherMap API কী', apiKeyHint: 'ঐচ্ছিক — সরাসরি আবহাওয়ার জন্য নিজের কী দিন। খালি রাখলে ডেমো ডেটা।',
    liveMode: 'লাইভ আবহাওয়া', demoMode: 'ডেমো আবহাওয়া', dataSource: 'আবহাওয়ার উৎস',
    weatherModeHint: 'ডেমো নমুনা আবহাওয়া দেখায় যাতে সব সতর্কতা পরীক্ষা করা যায়। লাইভ Open-Meteo থেকে আসল আবহাওয়া আনে (ফ্রি, কী লাগে না)।',
    account: 'অ্যাকাউন্ট', memberSince: 'সদস্য', changeCrops: 'ফসল পরিবর্তন',
    savedLoc: 'সংরক্ষিত অবস্থান', notifPermission: 'নোটিফিকেশন চালু করুন',
    aboutApp: 'সম্পর্কে', version: 'সংস্করণ',
    offline: 'আপনি অফলাইন — সংরক্ষিত তথ্য দেখানো হচ্ছে', online: 'আবার অনলাইন',
    noCache: 'এখনো কোনো সংরক্ষিত তথ্য নেই। ইন্টারনেটে সংযুক্ত হন।',
    profileUpdated: 'প্রোফাইল হালনাগাদ হয়েছে', savedOffline: 'সংরক্ষিত — অনলাইন হলে সিঙ্ক হবে',
    days: ['রবি','সোম','মঙ্গল','বুধ','বৃহঃ','শুক্র','শনি'],
    condSunny:'রৌদ্রোজ্জ্বল', condCloud:'মেঘলা', condRain:'বৃষ্টি', condStorm:'ঝড়', condClear:'পরিষ্কার',
  }
};

/* Bangla-Indic digit helper */
const BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
function bnNum(n, lang) {
  if (lang !== 'bn') return String(n);
  return String(n).replace(/[0-9]/g, d => BN_DIGITS[+d]);
}
