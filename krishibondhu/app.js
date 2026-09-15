/* =========================================================
   KrishiBondhu — application logic
   Vanilla JS single-page app. No build step required.
   ========================================================= */

'use strict';

/* ------------------------------------------------------------------ *
 * 1. Persistent store
 * ------------------------------------------------------------------ */
const STORE_KEY = 'krishibondhu_v1';
const SESSION_KEY = 'kb_session';

const DEFAULT_STATE = {
  lang: 'en',
  users: [],            // each user carries its own { targets, reminders }
  markets: SEED_MARKETS.map(m => ({ ...m })),
  prices: [],
  settings: { weatherAlerts: true, priceAlerts: true, weatherMode: 'demo' },
  cache: { weather: null, weatherTs: 0, weatherLoc: '', weatherMode: '' },
  alertedPrice: {},     // { "cropId:yyyy-mm-dd": true }
  alertedSevere: {},    // { "yyyy-mm-dd": true }
  seeded: false,
};

/* fields shared across every tab/user (persisted to localStorage & synced live) */
const SHARED_KEYS = ['lang', 'users', 'markets', 'prices', 'settings', 'cache', 'alertedPrice', 'alertedSevere', 'seeded'];

let state = loadState();

function loadState() {
  const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
  } catch (e) { /* ignore corrupt store */ }
  try { base.session = sessionStorage.getItem(SESSION_KEY) || null; } catch (e) { base.session = null; }
  return base;
}
let myPing = '';
function persistShared() {
  myPing = Date.now() + '.' + Math.random().toString(36).slice(2);
  const obj = {}; SHARED_KEYS.forEach(k => obj[k] = state[k]);
  obj._ping = myPing;   // change marker other tabs poll for
  try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) {}
}
function saveState() { persistShared(); broadcastSync(); }

/* the logged-in user is per browser tab, so two users can be demoed side by side */
function setSession(id) {
  state.session = id || null;
  try { id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}

/* per-user personal data lives on the user record (kept isolated per account) */
function userTargets() { const u = currentUser(); if (!u) return {}; u.targets = u.targets || {}; return u.targets; }
function userReminders() { const u = currentUser(); if (!u) return []; u.reminders = u.reminders || []; return u.reminders; }

/* ---- same-computer live sync (across tabs/windows) ---- */
const syncChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('krishibondhu_sync') : null;
let lastSyncAt = 0;
function broadcastSync() { try { syncChannel && syncChannel.postMessage(Date.now()); } catch (e) {} }
function onExternalChange() {
  const now = Date.now();
  if (now - lastSyncAt < 200) return;   // collapse duplicate notifications
  lastSyncAt = now;
  const sess = state.session;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const shared = JSON.parse(raw); SHARED_KEYS.forEach(k => { if (k in shared) state[k] = shared[k]; }); }
  } catch (e) {}
  state.session = sess;                  // keep this tab's own login
  // refresh the visible screen so another user's changes appear live here
  if (state.session && currentUser() && !$('#sheetRoot').classList.contains('open')) showApp(activeTab);
}
if (syncChannel) syncChannel.onmessage = onExternalChange;
window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) onExternalChange(); });
/* polling fallback — guarantees cross-tab sync even where storage/BroadcastChannel
   events don't propagate (some in-app/embedded browsers) */
let lastProcessedPing = '';
setInterval(() => {
  try {
    const raw = localStorage.getItem(STORE_KEY); if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj._ping && obj._ping !== myPing && obj._ping !== lastProcessedPing) {
      lastProcessedPing = obj._ping;
      onExternalChange();
    }
  } catch (e) {}
}, 1500);

/* seed some realistic market prices the first time the app runs */
function seedPrices() {
  if (state.seeded) return;
  const contributors = [
    { n: 'Rahim Uddin', r: 'trader' }, { n: 'Karim Mia', r: 'farmer' },
    { n: 'Amena Begum', r: 'user' }, { n: 'Jashim Arat', r: 'trader' },
    { n: 'Mehedi Vat ghor', r: 'trader' }, { n: 'Rosni Akter', r: 'user' },
  ];
  const now = Date.now();
  const list = [];
  let idc = 1;
  state.markets.forEach((m, mi) => {
    CROPS.forEach((c, ci) => {
      // ~55% chance a market has a recent price for a crop
      if ((mi * 7 + ci * 3) % 9 < 5) {
        const base = BASE_PRICE[c.id] || 50;
        const jitter = ((mi * 13 + ci * 5) % 17) - 8;           // -8..+8
        const price = Math.max(5, Math.round(base + jitter));
        const ageHrs = ((mi * 5 + ci * 11) % 60);               // 0..60h old
        const who = contributors[(mi + ci) % contributors.length];
        list.push({
          id: 'p' + (idc++), cropId: c.id, marketId: m.id,
          price, by: who.n, role: who.r, ts: now - ageHrs * 3600 * 1000,
        });
      }
    });
  });
  state.prices = list;
  state.seeded = true;
  saveState();
}

/* Three pre-seeded demo accounts in Chattogram (Farmer / Trader / General user)
   so every role can be demonstrated. They all share the same crowd-sourced market
   data, so a price submitted by one is instantly visible to the others.
     Farmer  -> akib   / 1234     Trader -> trader / 1234     User -> user / 1234 */
function seedDemoData() {
  if (state.users.some(u => u.cred.toLowerCase() === 'akib')) return;
  const CTG = { lat: 22.3569, lon: 91.7832, label: 'Chattogram' };
  const now = Date.now(), D = 24 * 3600 * 1000;

  const farmer = {
    id: 'u_akib', name: 'Mr. Akib', cred: 'akib', pass: '1234', role: 'farmer',
    location: { ...CTG }, crops: ['rice', 'potato', 'tomato', 'onion', 'chili'],
    createdAt: now - 26 * D,
    targets: { rice: 55, chili: 215 },   // set just below fresh highs so alerts fire on login
    reminders: [
      { id: 'r_d1', type: 'irrigation', cropId: 'rice',   repeat: 'daily',  time: '06:00', enabled: true },
      { id: 'r_d2', type: 'spraying',   cropId: 'potato', repeat: 'weekly', time: '16:00', enabled: true },
      { id: 'r_d3', type: 'harvest',    cropId: 'rice',   repeat: 'none',   time: '07:00', enabled: true },
    ],
  };
  const trader = {
    id: 'u_trader', name: 'Mehedi Vat ghor', cred: 'trader', pass: '1234', role: 'trader',
    location: { ...CTG }, crops: ['rice', 'onion', 'chili', 'potato'],
    createdAt: now - 40 * D, targets: {}, reminders: [],
  };
  const general = {
    id: 'u_user', name: 'Rosni Akter', cred: 'user', pass: '1234', role: 'user',
    location: { ...CTG }, crops: ['tomato', 'onion'],
    createdAt: now - 15 * D, targets: {}, reminders: [],
  };
  state.users.push(farmer, trader, general);

  // Guaranteed fresh Chattogram prices — some meet the farmer's targets, a few are his own.
  const H = 3600 * 1000;
  const demoPrices = [
    { cropId: 'rice',   marketId: 'c2', price: 58,  by: 'Jamal Trader',  role: 'trader', ts: now - 0.5 * H }, // > rice target
    { cropId: 'rice',   marketId: 'c1', price: 54,  by: 'Rahim Uddin',   role: 'farmer', ts: now - 3 * H },
    { cropId: 'rice',   marketId: 'c4', price: 51,  by: 'Rosni Akter',    role: 'user',   ts: now - 8 * H },
    { cropId: 'chili',  marketId: 'c3', price: 225, by: 'Mehedi Vat ghor', role: 'trader', ts: now - 1 * H }, // > chili target
    { cropId: 'chili',  marketId: 'c5', price: 205, by: 'Amena Begum',   role: 'user',   ts: now - 20 * H },
    { cropId: 'potato', marketId: 'c1', price: 36,  by: 'Mr. Akib',  role: 'farmer', ts: now - 2 * H }, // own
    { cropId: 'potato', marketId: 'c2', price: 33,  by: 'Jashim Arat',   role: 'trader', ts: now - 6 * H },
    { cropId: 'tomato', marketId: 'c3', price: 62,  by: 'Mr. Akib',  role: 'farmer', ts: now - 5 * H }, // own
    { cropId: 'tomato', marketId: 'c6', price: 58,  by: 'Karim Mia',     role: 'farmer', ts: now - 12 * H },
    { cropId: 'onion',  marketId: 'c1', price: 92,  by: 'Rahim Uddin',   role: 'farmer', ts: now - 4 * H },
    { cropId: 'onion',  marketId: 'c4', price: 97,  by: 'Mehedi Vat ghor', role: 'trader', ts: now - 9 * H },
  ];
  let idc = state.prices.length + 1;
  demoPrices.forEach(p => state.prices.push(Object.assign({ id: 'pd' + (idc++) }, p)));

  saveState();
}

/* ------------------------------------------------------------------ *
 * 2. Small helpers
 * ------------------------------------------------------------------ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const screenEl = () => $('#screen');
const t  = (k) => (I18N[state.lang] && I18N[state.lang][k] != null) ? I18N[state.lang][k] : (I18N.en[k] ?? k);
const L  = (o) => (o && (o[state.lang] ?? o.en)) || '';
const num = (n) => bnNum(n, state.lang);
const currentUser = () => state.users.find(u => u.id === state.session) || null;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function haversine(a, b) {
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function timeAgo(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 2) return t('justNow');
  if (mins < 60) return `${num(mins)} min ${t('reportedAgo')}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${num(hrs)} h ${t('reportedAgo')}`;
  const d = Math.round(hrs / 24);
  return `${num(d)} d ${t('reportedAgo')}`;
}
function isFresh(ts) { return (Date.now() - ts) < 3 * 24 * 3600 * 1000; } // < 3 days
function todayKey(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * 3. Weather engine  (mock by default, live if API key present)
 * ------------------------------------------------------------------ */
const WX = {
  clear:  { em: '☀️', sem: '<span class="spin-slow">☀️</span>', k: 'condClear' },
  sunny:  { em: '🌤️', sem: '🌤️', k: 'condSunny' },
  cloud:  { em: '☁️', sem: '<span class="sway">☁️</span>', k: 'condCloud' },
  rain:   { em: '🌧️', sem: '🌧️', k: 'condRain' },
  storm:  { em: '⛈️', sem: '⛈️', k: 'condStorm' },
};

/* A stable-but-varied 5-day mock forecast. Always contains a rain day and a
   storm day so weather-driven features (alerts, auto-reschedule) are visible. */
function mockForecast(loc) {
  const jig = Math.round(((loc?.lat || 23.8) * 10) % 3);       // tiny location variance
  const base = [
    { cond: 'rain',  tMax: 29, tMin: 25, rainProb: 85, rainMm: 24, wind: 28, hum: 88, severe: false }, // today: heavy rain
    { cond: 'storm', tMax: 28, tMin: 24, rainProb: 92, rainMm: 42, wind: 56, hum: 91, severe: true  }, // tomorrow: storm
    { cond: 'cloud', tMax: 31, tMin: 25, rainProb: 30, rainMm: 2,  wind: 18, hum: 72, severe: false },
    { cond: 'clear', tMax: 33, tMin: 26, rainProb: 12, rainMm: 0,  wind: 13, hum: 60, severe: false }, // good field-work day
    { cond: 'sunny', tMax: 34, tMin: 26, rainProb: 8,  rainMm: 0,  wind: 11, hum: 56, severe: false },
  ];
  const start = new Date();
  return base.map((b, i) => {
    const date = new Date(start); date.setDate(start.getDate() + i);
    return {
      date: date.toISOString().slice(0, 10),
      dow: date.getDay(),
      cond: b.cond,
      tempMax: b.tMax + jig, tempMin: b.tMin + jig,
      rainProb: b.rainProb, rainMm: b.rainMm, wind: b.wind, hum: b.hum,
      severe: b.severe,
    };
  });
}

/* Map a WMO weather code (Open-Meteo) to our internal condition */
function omCond(code, wind) {
  if ([95, 96, 99].includes(code)) return 'storm';
  if ([51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86].includes(code)) return 'rain';
  if ([3, 45, 48].includes(code)) return 'cloud';
  if ([1, 2].includes(code)) return 'sunny';
  if (code === 0) return 'clear';
  return wind >= 45 ? 'storm' : 'sunny';
}

/* Fetch the forecast. Demo mode -> crafted sample (guarantees alerts fire for testing);
   Live mode -> real forecast from Open-Meteo (free, no API key required). */
async function fetchWeather(force = false) {
  const u = currentUser();
  const loc = u?.location || { lat: 22.3569, lon: 91.7832, label: 'Chattogram' };
  const mode = state.settings.weatherMode || 'demo';

  // serve cache if fresh (< 1h), same mode & location, and not forced
  if (!force && state.cache.weather && (Date.now() - state.cache.weatherTs < 3600000)
      && state.cache.weatherMode === mode && state.cache.weatherLoc === (loc.label || '')) {
    return state.cache.weather;
  }
  if (mode === 'demo') return commitWeather(mockForecast(loc), loc, mode);
  if (!navigator.onLine) return state.cache.weather || mockForecast(loc);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
      + `&timezone=auto&forecast_days=5`
      + `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('api');
    const data = await res.json();
    return commitWeather(parseOpenMeteo(data), loc, mode);
  } catch (e) {
    return state.cache.weather || mockForecast(loc);   // graceful fallback
  }
}

function commitWeather(days, loc, mode) {
  state.cache.weather = days;
  state.cache.weatherTs = Date.now();
  state.cache.weatherLoc = loc.label || '';
  state.cache.weatherMode = mode;
  saveState();
  return days;
}

/* Convert Open-Meteo daily arrays into our forecast shape */
function parseOpenMeteo(data) {
  const d = data.daily || {}, cur = data.current || {};
  const out = [];
  const n = Math.min((d.time || []).length, 5);
  for (let i = 0; i < n; i++) {
    const wind = Math.round(d.wind_speed_10m_max[i]);
    const rainMm = Math.round(d.precipitation_sum?.[i] ?? 0);
    const rainProb = Math.round(d.precipitation_probability_max?.[i] ?? 0);
    const cond = omCond(d.weather_code[i], wind);
    const date = new Date(d.time[i]);
    out.push({
      date: d.time[i], dow: date.getDay(), cond,
      tempMax: Math.round(d.temperature_2m_max[i]), tempMin: Math.round(d.temperature_2m_min[i]),
      rainProb, rainMm, wind,
      hum: i === 0 ? Math.round(cur.relative_humidity_2m ?? 70) : 70,
      severe: cond === 'storm' || wind >= 45 || rainMm >= 30,
    });
  }
  if (out[0] && cur.temperature_2m != null) out[0].tempMax = Math.max(out[0].tempMax, Math.round(cur.temperature_2m));
  return out.length ? out : mockForecast({});
}

/* Rule-based advisory for one day (+ optional crop note) */
function advisoryForDay(day, cropId) {
  const rule = ADVISORY_RULES.find(r => r.when(day)) || ADVISORY_RULES[ADVISORY_RULES.length - 1];
  let text = L(rule.text);
  if (cropId && CROP_NOTE[cropId] && rule.level !== 'calm') text += ' ' + L(CROP_NOTE[cropId]);
  return { level: rule.level, title: L(rule.title), text, ruleId: rule.id };
}

/* ------------------------------------------------------------------ *
 * 4. Auto-reschedule reminders by weather (use case 2.13)
 * ------------------------------------------------------------------ */
function badWeatherDay(day) { return day.severe || day.rainProb >= 60; }

function applyWeatherReschedule(forecast) {
  if (!forecast || !forecast.length) return;
  let changed = false;
  userReminders().forEach(rem => {
    const tt = taskTypeById(rem.type);
    if (!tt || !tt.weatherSensitive || rem.enabled === false) return;
    // "scheduled" day = today for daily, else its stored date; simplified to next forecast day
    const idx = 0; // check today's slot against forecast
    if (forecast[idx] && badWeatherDay(forecast[idx])) {
      const next = forecast.findIndex((d, i) => i > idx && !badWeatherDay(d));
      if (next > 0 && rem.movedToDate !== forecast[next].date) {
        rem.movedFromDate = forecast[idx].date;
        rem.movedToDate = forecast[next].date;
        rem.movedReason = forecast[idx].severe ? 'storm' : 'rain';
        changed = true;
      }
    } else if (rem.movedToDate) {
      // conditions cleared — restore
      rem.movedFromDate = null; rem.movedToDate = null; rem.movedReason = null;
      changed = true;
    }
  });
  if (changed) saveState();
}

/* ------------------------------------------------------------------ *
 * 5. UI helpers: toast, sheet, notifications
 * ------------------------------------------------------------------ */
function toast(msg, type = '') {
  const wrap = $('#toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

function openSheet(html) {
  const root = $('#sheetRoot');
  root.innerHTML = `<div class="sheet-scrim" data-act="closeSheet"></div>
    <div class="sheet"><div class="sheet-grip"></div>${html}</div>`;
  root.classList.add('open');
}
function closeSheet() {
  const root = $('#sheetRoot');
  root.classList.remove('open');
  setTimeout(() => { root.innerHTML = ''; }, 260);
}

function pushNotify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: 'assets/icon.svg', badge: 'assets/icon.svg' });
    }
  } catch (e) { /* file:// or unsupported — in-app toast still shows */ }
}
function requestNotify() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch (e) {}
}

/* ------------------------------------------------------------------ *
 * 6. Router
 * ------------------------------------------------------------------ */
let activeTab = 'home';

function go(route, data) {
  window.scrollTo(0, 0);
  screenEl().scrollTop = 0;
  routes[route] ? routes[route](data) : routes.home();
}

const routes = {
  splash: renderSplash,
  login: () => renderAuth('login'),
  register: () => renderAuth('register'),
  onboarding: renderOnboarding,
  home: () => showApp('home'),
  weather: () => showApp('weather'),
  market: () => showApp('market'),
  tasks: () => showApp('tasks'),
  profile: () => showApp('profile'),
};

/* ------------------------------------------------------------------ *
 * 7. Splash
 * ------------------------------------------------------------------ */
function renderSplash() {
  $('#tabbar').hidden = true;
  setStatusBar('#12532f');
  screenEl().innerHTML = `
    <div class="splash" id="splash">
      <div class="s-mark">🌾</div>
      <div>
        <div class="s-name center">${t('appName')}</div>
        <div class="s-tag center">${t('tagline')}</div>
      </div>
      <div class="loader"></div>
    </div>`;
  setTimeout(() => {
    const sp = $('#splash'); if (sp) sp.classList.add('fade-out');
    setTimeout(() => {
      if (currentUser()) go('home'); else go('login');
      showIntroModal();
    }, 480);
  }, 1500);
}

/* One-time "under construction" notice shown each time the app opens (bilingual) */
function showIntroModal() {
  if ($('.intro-overlay')) return;
  const cont = state.lang === 'bn' ? 'এগিয়ে যান' : 'Continue';
  const overlay = document.createElement('div');
  overlay.className = 'intro-overlay';
  overlay.innerHTML = `
    <div class="intro-card">
      <div class="uc-badge">🚧</div>
      <div class="uc-pill">🚧 Under Construction</div>
      <div class="intro-title">${t('appName')}</div>
      <div class="intro-en">This is a <b>Mobile Web App</b> and is currently <b>under construction</b>.</div>
      <div class="intro-bn">এটি একটি <b>মোবাইল ওয়েব অ্যাপ</b>, বর্তমানে <b>নির্মাণাধীন</b> অবস্থায় আছে।</div>
      <div class="intro-note"><span class="n-em">🎬</span><span>To test the app, please log in with a <b>demo account</b>.<br>টেস্ট করার জন্য একটি <b>ডেমো অ্যাকাউন্ট</b> দিয়ে লগইন করুন।</span></div>
      <button class="btn btn-primary" data-act="closeIntro">${cont} →</button>
    </div>`;
  $('#device').appendChild(overlay);
}

/* ------------------------------------------------------------------ *
 * 8. Auth (login / register wizard)
 * ------------------------------------------------------------------ */
let regDraft = null;

function renderAuth(mode) {
  $('#tabbar').hidden = true;
  setStatusBar('#12532f');
  const isLogin = mode === 'login';
  screenEl().innerHTML = `
    <div class="auth">
      <div class="auth-hero">
        <div class="brand-lockup">
          <div class="brand-mark">🌾</div>
          <div>
            <div class="brand-name">${t('appName')}</div>
            <div class="brand-tag">${t('tagline')}</div>
          </div>
        </div>
      </div>
      <div class="auth-illus"><div class="big-emoji">${isLogin ? '🧑‍🌾' : '🌱'}</div></div>
      <div class="auth-sheet">
        <div class="lang-mini mb16" style="display:flex;justify-content:flex-end">
          <div class="seg" style="width:150px">
            <button data-act="lang" data-l="en" class="${state.lang==='en'?'on':''}">EN</button>
            <button data-act="lang" data-l="bn" class="${state.lang==='bn'?'on':''}">বাংলা</button>
          </div>
        </div>
        <h2 class="h-lg mb8">${isLogin ? t('welcome') : t('createAccount')}</h2>
        <p class="sub mb16">${isLogin ? t('signInSub') : t('registerSub')}</p>
        ${isLogin ? loginForm() : regStep1Form()}
        <div class="link-line">
          ${isLogin
            ? `${t('noAccount')} <a data-act="goRegister">${t('register')}</a>`
            : `${t('haveAccount')} <a data-act="goLogin">${t('login')}</a>`}
        </div>
      </div>
    </div>`;
}

function loginForm() {
  return `
    <div id="authErr" class="err" style="margin-bottom:10px"></div>
    <div class="field">
      <label>${t('phoneEmail')}</label>
      <div class="input-icon"><span class="ic">📱</span>
        <input id="li_cred" class="input" placeholder="01XXXXXXXXX" autocomplete="username" /></div>
    </div>
    <div class="field">
      <label>${t('password')}</label>
      <div class="input-icon"><span class="ic">🔒</span>
        <input id="li_pass" class="input" type="password" placeholder="••••••" autocomplete="current-password" /></div>
    </div>
    <div class="flex between aic mb16">
      <label class="flex aic gap8" style="font-size:13px;font-weight:600;color:var(--ink-700)">
        <input type="checkbox" id="li_remember" checked style="width:18px;height:18px;accent-color:var(--green-600)"/> ${t('rememberMe')}
      </label>
      <a class="link" data-act="forgot" style="font-size:13px;color:var(--green-700);font-weight:700">${t('forgot')}</a>
    </div>
    <button class="btn btn-primary" data-act="doLogin">${t('login')} →</button>
    <div class="hint center mt16" style="margin-bottom:8px">🎬 ${t('tryDemo')}</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost btn-sm" style="flex:1" data-act="demoLogin" data-cred="akib">🧑‍🌾 ${t('roleFarmer')}</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" data-act="demoLogin" data-cred="trader">🛒 ${t('roleTrader')}</button>
      <button class="btn btn-ghost btn-sm" style="flex:1" data-act="demoLogin" data-cred="user">👤 ${t('roleUser')}</button>
    </div>`;
}

function regStep1Form() {
  const d = regDraft || {};
  return `
    <div class="steps"><div class="dot on"></div><div class="dot"></div><div class="dot"></div></div>
    <div id="authErr" class="err" style="margin-bottom:10px"></div>
    <div class="field">
      <label>${t('fullName')}</label>
      <div class="input-icon"><span class="ic">🧑</span>
        <input id="r_name" class="input" value="${escapeHtml(d.name||'')}" placeholder="${t('fullName')}" /></div>
    </div>
    <div class="field">
      <label>${t('phoneEmail')}</label>
      <div class="input-icon"><span class="ic">📱</span>
        <input id="r_cred" class="input" value="${escapeHtml(d.cred||'')}" placeholder="01XXXXXXXXX" /></div>
    </div>
    <div class="field">
      <label>${t('password')}</label>
      <div class="input-icon"><span class="ic">🔒</span>
        <input id="r_pass" class="input" type="password" value="${escapeHtml(d.pass||'')}" placeholder="••••••" /></div>
    </div>
    <div class="field">
      <label>${t('role')}</label>
      <div class="chips" id="r_role">
        ${[['farmer',t('roleFarmer'),'🧑‍🌾'],['trader',t('roleTrader'),'🛒'],['user',t('roleUser'),'👤']]
          .map(([v,lab,em]) => `<div class="chip ${ (d.role||'farmer')===v ? 'on':''}" data-act="pickRole" data-v="${v}"><span class="em">${em}</span>${lab}</div>`).join('')}
      </div>
    </div>
    <button class="btn btn-primary" data-act="regNext">${t('next')} →</button>`;
}

/* ------------------------------------------------------------------ *
 * 9. Onboarding — location + crops (steps 2 & 3 of registration)
 * ------------------------------------------------------------------ */
function renderOnboarding(step) {
  $('#tabbar').hidden = true;
  setStatusBar('#12532f');
  step = step || 'location';
  const d = regDraft || {};
  if (step === 'location') {
    screenEl().innerHTML = wrapOnboard(2, `
      <h2 class="h-lg mb8">${t('setLocation')}</h2>
      <p class="sub mb16">${t('locationSub')}</p>
      <div class="auth-illus" style="min-height:120px"><div class="big-emoji">📍</div></div>
      <div id="locStatus" class="note green mb16" ${d.location ? '' : 'hidden'}>
        <span class="n-em">✅</span><span>${t('locationSet')}: <b>${escapeHtml(d.location?.label||'')}</b></span>
      </div>
      <button class="btn btn-primary mb12" data-act="useGps">📡 ${t('useGps')}</button>
      <div class="field">
        <label>${t('enterManually')}</label>
        <input id="ob_loc" class="input" value="${escapeHtml(d.location?.label||'')}" placeholder="${t('district')}" />
      </div>
      <button class="btn btn-outline" data-act="obLocNext">${t('continue')} →</button>
    `);
  } else {
    const sel = new Set(d.crops || []);
    screenEl().innerHTML = wrapOnboard(3, `
      <h2 class="h-lg mb8">${t('pickCrops')}</h2>
      <p class="sub mb16">${t('cropsSub')}</p>
      <div id="cropErr" class="err mb12"></div>
      <div class="chips" id="ob_crops">
        ${CROPS.map(c => `<div class="chip ${sel.has(c.id)?'on':''}" data-act="toggleCrop" data-v="${c.id}"><span class="em">${c.em}</span>${L(c)}</div>`).join('')}
      </div>
      <div class="mt20"></div>
      <button class="btn btn-primary" data-act="finishReg">${t('done')} ✓</button>
    `);
  }
}
function wrapOnboard(step, inner) {
  const dots = [1,2,3].map(i => `<div class="dot ${i<=step?'on':''}"></div>`).join('');
  return `<div class="auth"><div class="auth-hero"><div class="brand-lockup">
      <div class="brand-mark">🌾</div><div><div class="brand-name">${t('appName')}</div></div></div></div>
    <div class="auth-sheet"><div class="steps">${dots}</div>${inner}</div></div>`;
}

/* ------------------------------------------------------------------ *
 * 10. App shell (tab bar + screens)
 * ------------------------------------------------------------------ */
const TABS = [
  { id: 'home',    em: '🏠', l: 'tabHome' },
  { id: 'weather', em: '⛅', l: 'tabWeather' },
  { id: 'market',  em: '🛒', l: 'tabMarket' },
  { id: 'tasks',   em: '⏰', l: 'tabTasks' },
  { id: 'profile', em: '👤', l: 'tabProfile' },
];

function renderTabbar() {
  const bar = $('#tabbar');
  bar.hidden = false;
  bar.innerHTML = TABS.map(tb => `
    <button class="tab ${activeTab===tb.id?'on':''}" data-act="tab" data-v="${tb.id}">
      <span class="t-ic">${tb.em}</span><span class="t-l">${t(tb.l)}</span>
    </button>`).join('');
}

async function showApp(tab) {
  activeTab = tab;
  renderTabbar();
  updateOfflineBar();
  if (tab === 'home') await renderHome();
  else if (tab === 'weather') await renderWeather();
  else if (tab === 'market') renderMarket();
  else if (tab === 'tasks') renderTasks();
  else if (tab === 'profile') renderProfile();
}

/* ------------------------------------------------------------------ *
 * 11. HOME
 * ------------------------------------------------------------------ */
async function renderHome() {
  const u = currentUser();
  setStatusBar('', true);
  screenEl().innerHTML = homeSkeleton(u);

  const fc = await fetchWeather();
  applyWeatherReschedule(fc);
  checkSevere(fc);
  checkPriceAlerts();

  const today = fc[0];
  const wx = WX[today.cond];
  const adv = advisoryForDay(today, (u.crops || [])[0]);
  const severeDay = fc.find(d => d.severe);

  const userMarkets = marketsWithPrice((u.crops||[])[0], 50).slice(0, 3);
  const upcoming = userReminders().filter(r => r.enabled !== false).slice(0, 2);

  screenEl().innerHTML = `
    <div class="app-head">
      <div class="head-row">
        <div>
          <div class="head-hello">${t('hello')},</div>
          <div class="head-name">${escapeHtml(firstName(u.name))} 👋</div>
          <div class="head-loc">📍 ${escapeHtml(u.location?.label || 'Chattogram')}</div>
        </div>
        <div class="avatar" data-act="tab" data-v="profile">${initials(u.name)}</div>
      </div>
      <div class="weather-hero">
        <div>
          <div class="wx-temp">${num(today.tempMax)}°</div>
          <div class="wx-desc">${t(wx.k)}</div>
          <div class="wx-meta">
            <span>💧 ${num(today.hum)}%</span>
            <span>🌬️ ${num(today.wind)} km/h</span>
            <span>🌧️ ${num(today.rainProb)}%</span>
          </div>
        </div>
        <div class="wx-emoji">${wx.sem}</div>
      </div>
    </div>

    <div class="screen-pad stagger">
      ${severeDay ? severeBanner(severeDay) : ''}

      <div class="section-title"><h3>${t('todayAdvisory')}</h3>
        <span class="link" data-act="tab" data-v="weather">${t('viewAll')} →</span></div>
      ${advisoryCard(adv, (u.crops||[])[0], true)}

      <div class="section-title"><h3>${t('quickActions')}</h3></div>
      <div class="quick-grid">
        <div class="quick" data-act="tab" data-v="weather"><div class="q-em">⛅</div><div class="q-l">${t('qWeather')}</div></div>
        <div class="quick" data-act="tab" data-v="market"><div class="q-em">🛒</div><div class="q-l">${t('qMarkets')}</div></div>
        <div class="quick" data-act="reportPriceQuick"><div class="q-em">🏷️</div><div class="q-l">${t('qReport')}</div></div>
        <div class="quick" data-act="addReminderQuick"><div class="q-em">⏰</div><div class="q-l">${t('qReminder')}</div></div>
      </div>

      <div class="section-title"><h3>${t('nearbyMarkets')}</h3>
        <span class="link" data-act="tab" data-v="market">${t('viewAll')} →</span></div>
      <div class="list">
        ${userMarkets.length ? userMarkets.map(m => marketRow(m, (u.crops||[])[0])).join('')
          : emptyState('🛒', t('noRecent'), t('noRecentSub'))}
      </div>

      <div class="section-title"><h3>${t('upcomingTasks')}</h3>
        <span class="link" data-act="tab" data-v="tasks">${t('viewAll')} →</span></div>
      <div class="list">
        ${upcoming.length ? upcoming.map(reminderCard).join('')
          : emptyState('⏰', t('noTasks'), t('noTasksSub'))}
      </div>
    </div>`;
}

function homeSkeleton(u) {
  return `<div class="app-head"><div class="head-row">
      <div><div class="head-hello">${t('hello')},</div><div class="head-name">${escapeHtml(firstName(u?.name||''))}</div></div>
      <div class="avatar">${initials(u?.name||'')}</div></div>
      <div class="weather-hero"><div><div class="skel" style="width:90px;height:44px"></div>
      <div class="skel" style="width:120px;height:14px;margin-top:10px"></div></div><div class="wx-emoji skel" style="width:76px;height:76px;border-radius:50%"></div></div></div>
    <div class="screen-pad"><div class="skel" style="height:90px;border-radius:18px"></div>
      <div class="skel mt16" style="height:70px;border-radius:18px"></div>
      <div class="skel mt16" style="height:70px;border-radius:18px"></div></div>`;
}

function severeBanner(day) {
  const dayName = t('days')[day.dow];
  const msg = state.lang === 'bn'
    ? `${dayName}বার ঝড় ও ভারী বৃষ্টির প্রবল সম্ভাবনা। ফসল, গবাদি পশু ও যন্ত্রপাতি নিরাপদে রাখুন।`
    : `Storm and heavy rain highly likely on ${dayName}. Protect crops, livestock and equipment in advance.`;
  return `<div class="severe-banner">
      <span class="s-tag"><span class="pulse-dot"></span> ${t('severeTag')}</span>
      <div class="s-title">⚠️ ${state.lang==='bn'?'দুর্যোগ সতর্কতা':'Severe weather warning'}</div>
      <div class="s-text">${msg}</div>
    </div>`;
}

function advisoryCard(adv, cropId, withAudio) {
  const crop = cropById(cropId);
  const emoji = { crit: '⛈️', warn: '🌦️', calm: '🌱' }[adv.level] || '🌱';
  return `<div class="advisory ${adv.level}">
      <div class="a-em">${emoji}</div>
      <div class="grow">
        <div class="a-title">${escapeHtml(adv.title)}</div>
        <div class="a-text">${escapeHtml(adv.text)}</div>
        ${crop ? `<span class="a-crop">${crop.em} ${L(crop)}</span>` : ''}
      </div>
      ${withAudio ? `<button class="a-audio" data-act="speak" data-text="${escapeHtml(adv.title + '. ' + adv.text)}">🔊</button>` : ''}
    </div>`;
}

/* ------------------------------------------------------------------ *
 * 12. WEATHER
 * ------------------------------------------------------------------ */
async function renderWeather() {
  const u = currentUser();
  setStatusBar('', true);
  screenEl().innerHTML = `<div class="app-head sky"><div class="head-row"><div class="page-title">${t('weatherTitle')}</div>
    <button class="icon-btn" data-act="refreshWeather">🔄</button></div></div>
    <div class="screen-pad"><div class="skel" style="height:120px;border-radius:18px"></div></div>`;

  const fc = await fetchWeather();
  applyWeatherReschedule(fc);
  const today = fc[0], wx = WX[today.cond];
  const crops = u.crops || [];
  const updated = new Date(state.cache.weatherTs);
  const src = (state.settings.weatherMode === 'live') ? '🛰️ ' + t('liveMode') : '🎬 ' + t('demoMode');

  screenEl().innerHTML = `
    <div class="app-head sky">
      <div class="head-row">
        <div class="page-title">${t('weatherTitle')}</div>
        <button class="icon-btn" data-act="refreshWeather">🔄</button>
      </div>
      <div class="head-loc" style="margin-top:6px">📍 ${escapeHtml(u.location?.label||'Chattogram')} · ${src}</div>
      <div class="weather-hero">
        <div>
          <div class="wx-temp">${num(today.tempMax)}°<span style="font-size:22px;opacity:.7">/${num(today.tempMin)}°</span></div>
          <div class="wx-desc">${t(wx.k)}</div>
          <div class="wx-meta"><span>💧 ${num(today.hum)}%</span><span>🌬️ ${num(today.wind)} km/h</span><span>🌧️ ${num(today.rainProb)}%</span></div>
        </div>
        <div class="wx-emoji">${wx.sem}</div>
      </div>
      <div class="forecast-strip mt16">
        ${fc.map((d,i) => `<div class="fc-cell">
          <div class="d">${i===0 ? t('today') : t('days')[d.dow]}</div>
          <div class="e">${WX[d.cond].em}</div>
          <div class="t">${num(d.tempMax)}°</div>
          <div class="r">💧${num(d.rainProb)}%</div>
        </div>`).join('')}
      </div>
    </div>

    <div class="screen-pad stagger">
      <div class="note"><span class="n-em">🕒</span><span>${t('lastUpdated')}: ${updated.toLocaleString(state.lang==='bn'?'bn-BD':'en-US',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</span></div>

      <div class="section-title"><h3>${t('advisoryFor')}</h3></div>
      ${crops.length ? crops.map(cid => {
          const adv = advisoryForDay(fc.find(badWeatherDay) || today, cid);
          return advisoryCard(adv, cid, true);
        }).join('') : advisoryCard(advisoryForDay(today), null, true)}

      <div class="section-title"><h3>${t('dayForecast')}</h3></div>
      <div class="list">
        ${fc.map((d,i) => dayForecastRow(d, i)).join('')}
      </div>
    </div>`;
}

function dayForecastRow(d, i) {
  const adv = advisoryForDay(d);
  const badge = d.severe ? `<span class="badge badge-warn">⚠️ ${t('condStorm')}</span>` : '';
  return `<div class="row-card">
      <div class="row-ic" style="background:${d.severe?'#fee2e2':'#e0f2fe'}">${WX[d.cond].em}</div>
      <div class="row-main">
        <div class="row-title">${i===0 ? t('today') : t('days')[d.dow]} ${badge}</div>
        <div class="row-sub">🌡️ ${num(d.tempMax)}°/${num(d.tempMin)}° · 🌬️ ${num(d.wind)}km/h · 💧 ${num(d.rainProb)}%</div>
        <div class="a-text" style="margin-top:6px;font-size:12.5px">${escapeHtml(adv.text)}</div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * 13. MARKET
 * ------------------------------------------------------------------ */
let marketCrop = null, marketRadius = 30, marketSort = 'distance';

function marketsWithPrice(cropId, radius) {
  const u = currentUser();
  const loc = u?.location || { lat: 22.3569, lon: 91.7832 };
  return state.markets.map(m => {
    const dist = haversine(loc, m);
    const entries = state.prices
      .filter(p => p.marketId === m.id && p.cropId === cropId)
      .sort((a, b) => b.ts - a.ts);
    const latest = entries[0] || null;
    const fresh = latest && isFresh(latest.ts);
    return { ...m, dist, latest, fresh, entryCount: entries.length };
  }).filter(m => m.dist <= radius);
}

function renderMarket() {
  const u = currentUser();
  setStatusBar('#12532f');
  if (!marketCrop) marketCrop = (u.crops || [])[0] || CROPS[0].id;

  let list = marketsWithPrice(marketCrop, marketRadius);
  // sort
  if (marketSort === 'price') list.sort((a,b) => (b.latest?.price||-1) - (a.latest?.price||-1));
  else list.sort((a,b) => a.dist - b.dist);

  const priced = list.filter(m => m.latest && m.fresh);
  const prices = priced.map(m => m.latest.price);
  const avg = prices.length ? Math.round(prices.reduce((s,x)=>s+x,0)/prices.length) : null;
  const best = prices.length ? Math.max(...prices) : null;
  const crop = cropById(marketCrop);
  const target = userTargets()[marketCrop];

  screenEl().innerHTML = `
    <div class="app-head plain">
      <div class="head-row"><div class="page-title">${t('marketTitle')}</div>
        <button class="icon-btn" data-act="setTargetSheet">🎯</button></div>
    </div>
    <div class="screen-pad stagger">
      <div class="section-title" style="margin-top:6px"><h3>${t('selectCrop')}</h3></div>
      <div class="pill-row">
        ${(u.crops&&u.crops.length?u.crops:CROPS.map(c=>c.id)).map(cid => {
          const c = cropById(cid);
          return `<div class="pill ${cid===marketCrop?'on':''}" data-act="pickMarketCrop" data-v="${cid}">${c.em} ${L(c)}</div>`;
        }).join('')}
      </div>

      <div class="stat-row mt16">
        <div class="stat"><div class="s-v">${avg!=null?'৳'+num(avg):'—'}</div><div class="s-l">${t('avgPrice')}</div></div>
        <div class="stat"><div class="s-v">${best!=null?'৳'+num(best):'—'}</div><div class="s-l">${t('bestPrice')}</div></div>
        <div class="stat"><div class="s-v">${target?'৳'+num(target):'—'}</div><div class="s-l">${t('targetTitle')}</div></div>
      </div>

      <div class="flex between aic mt20 mb12" style="padding:0 2px">
        <div class="seg" style="width:170px">
          <button class="${marketSort==='distance'?'on':''}" data-act="marketSort" data-v="distance">${t('sortDistance')}</button>
          <button class="${marketSort==='price'?'on':''}" data-act="marketSort" data-v="price">${t('sortPrice')}</button>
        </div>
        <select class="select" style="width:auto;padding:9px 12px" data-act="marketRadius" id="radiusSel">
          ${[10,30,50,100].map(r => `<option value="${r}" ${r===marketRadius?'selected':''}>${t('within')} ${num(r)} ${t('km')}</option>`).join('')}
        </select>
      </div>

      <div class="list">
        ${list.length ? list.map(m => marketRow(m, marketCrop, best)).join('')
          : emptyState('📍', t('noRecent'), t('noRecentSub'))}
      </div>
      <button class="btn btn-primary mt20" data-act="reportPriceQuick" data-crop="${marketCrop}">🏷️ ${t('reportPrice')}</button>
    </div>
    <button class="fab" data-act="reportPriceQuick" data-crop="${marketCrop}">+</button>`;
}

function marketRow(m, cropId, best) {
  const crop = cropById(cropId);
  let priceHtml, sub, badge = '';
  if (m.latest && m.fresh) {
    priceHtml = `<div class="row-price">৳${num(m.latest.price)}<span style="font-size:11px;color:var(--ink-500);font-weight:600">/${crop?crop.unit:'kg'}</span></div>`;
    sub = `👤 ${escapeHtml(m.latest.by)} · ${timeAgo(m.latest.ts)}`;
    if (best != null && m.latest.price === best) badge = `<span class="badge badge-best">${t('bestPrice')}</span>`;
    const tgt = userTargets()[cropId];
    if (tgt && m.latest.price >= tgt) badge = `<span class="badge badge-target">🎯 ${t('targetSet').split(' ')[0]}</span>`;
  } else {
    priceHtml = `<div class="row-dist" style="font-weight:700">${t('noRecent')}</div>`;
    sub = t('noRecentSub');
    badge = `<span class="badge badge-stale">—</span>`;
  }
  return `<div class="row-card" data-act="marketDetail" data-v="${m.id}">
      <div class="row-ic">🏪</div>
      <div class="row-main">
        <div class="row-title">${escapeHtml(L(m))} ${badge}</div>
        <div class="row-sub">${sub}</div>
      </div>
      <div class="row-end">
        ${priceHtml}
        <div class="row-dist">📍 ${num(m.dist.toFixed(1))} ${t('km')}</div>
      </div>
    </div>`;
}

/* market detail sheet — compare recent submissions */
function marketDetailSheet(marketId) {
  const m = state.markets.find(x => x.id === marketId);
  const entries = state.prices.filter(p => p.marketId === marketId && p.cropId === marketCrop)
    .sort((a,b) => b.ts - a.ts).slice(0, 8);
  const crop = cropById(marketCrop);
  openSheet(`
    <h3>${escapeHtml(L(m))}</h3>
    <p class="sheet-sub">${crop.em} ${L(crop)} · ${t('latestPrice')}</p>
    ${entries.length ? `<div class="list">${entries.map(e => `
      <div class="row-card">
        <div class="row-ic">${e.role==='trader'?'🛒':e.role==='farmer'?'🧑‍🌾':'👤'}</div>
        <div class="row-main"><div class="row-title">${escapeHtml(e.by)}</div>
          <div class="row-sub">${timeAgo(e.ts)}${isFresh(e.ts)?'':' · <span style="color:var(--ink-300)">old</span>'}</div></div>
        <div class="row-end"><div class="row-price">৳${num(e.price)}</div></div>
      </div>`).join('')}</div>`
      : emptyState('🏷️', t('noRecent'), t('noRecentSub'))}
    <button class="btn btn-primary mt16" data-act="reportPriceQuick" data-crop="${marketCrop}" data-market="${marketId}">🏷️ ${t('reportPrice')}</button>
  `);
}

/* submit price sheet */
function submitPriceSheet(cropId, marketId) {
  const u = currentUser();
  cropId = cropId || marketCrop || (u.crops||[])[0] || CROPS[0].id;
  const crop = cropById(cropId);
  openSheet(`
    <h3>${t('submitPrice')}</h3>
    <p class="sheet-sub">${t('priceFor')} ${crop.em} ${L(crop)}</p>
    <div id="spErr" class="err mb12"></div>
    <div class="field"><label>${t('selectCrop')}</label>
      <select id="sp_crop" class="select">
        ${CROPS.map(c => `<option value="${c.id}" ${c.id===cropId?'selected':''}>${c.em} ${L(c)}</option>`).join('')}
      </select></div>
    <div class="field"><label>${t('atMarket')}</label>
      <select id="sp_market" class="select">
        ${state.markets.map(m => `<option value="${m.id}" ${m.id===marketId?'selected':''}>${escapeHtml(L(m))}</option>`).join('')}
        <option value="__new">➕ ${t('addMarket')}</option>
      </select></div>
    <div class="field" id="sp_newwrap" hidden><label>${t('marketName')}</label>
      <input id="sp_newname" class="input" placeholder="${t('marketName')}"/></div>
    <div class="field"><label>${t('pricePerKg')}</label>
      <div class="input-icon"><span class="ic">৳</span><input id="sp_price" class="input" type="number" inputmode="numeric" placeholder="0"/></div>
      <div class="hint">🕒 ${t('reportedBy')} ${escapeHtml(firstName(u.name))} · ${t('today')}</div>
    </div>
    <button class="btn btn-primary" data-act="doSubmitPrice">${t('submitPrice')} ✓</button>
  `);
  // toggle new-market field
  const sel = $('#sp_market');
  sel.addEventListener('change', () => { $('#sp_newwrap').hidden = sel.value !== '__new'; });
}

/* set target price sheet */
function setTargetSheet(cropId) {
  cropId = cropId || marketCrop;
  const crop = cropById(cropId);
  const list = marketsWithPrice(cropId, 100).filter(m => m.latest && m.fresh).map(m => m.latest.price);
  const range = list.length ? `৳${num(Math.min(...list))} – ৳${num(Math.max(...list))}` : '—';
  const cur = userTargets()[cropId];
  openSheet(`
    <h3>${t('setTarget')}</h3>
    <p class="sheet-sub">${crop.em} ${L(crop)}</p>
    <div class="note green mb16"><span class="n-em">📈</span><span>${t('currentRange')}: <b>${range}</b></span></div>
    <div id="tgErr" class="err mb12"></div>
    <div class="field"><label>${t('targetValue')}</label>
      <div class="input-icon"><span class="ic">🎯</span><input id="tg_val" class="input" type="number" inputmode="numeric" value="${cur||''}" placeholder="0"/></div>
      <div class="hint">${t('targetHint')}</div>
    </div>
    <button class="btn btn-primary mb8" data-act="doSetTarget" data-crop="${cropId}">${cur?t('updateTarget'):t('setTarget')} ✓</button>
    ${cur ? `<button class="btn btn-outline" data-act="removeTarget" data-crop="${cropId}">${t('removeTarget')}</button>` : ''}
  `);
}

/* ------------------------------------------------------------------ *
 * 14. TASKS / reminders
 * ------------------------------------------------------------------ */
function renderTasks() {
  setStatusBar('#12532f');
  const rems = userReminders();
  screenEl().innerHTML = `
    <div class="app-head plain"><div class="head-row"><div class="page-title">${t('tasksTitle')}</div>
      <button class="icon-btn" data-act="addReminderQuick">➕</button></div></div>
    <div class="screen-pad stagger">
      ${rems.length ? `<div class="list">${rems.map(reminderCard).join('')}</div>`
        : emptyState('⏰', t('noTasks'), t('noTasksSub'))}
      <button class="btn btn-primary mt20" data-act="addReminderQuick">➕ ${t('addReminder')}</button>
    </div>
    <button class="fab" data-act="addReminderQuick">+</button>`;
}

function reminderCard(r) {
  const tt = taskTypeById(r.type);
  const crop = cropById(r.cropId);
  const repeat = { none: t('repeatNone'), daily: t('repeatDaily'), weekly: t('repeatWeekly') }[r.repeat] || t('repeatNone');
  const moved = r.movedToDate ? ` moved` : '';
  const movedNote = r.movedToDate ? `<div class="rem-moved-note">🌦️ ${t('autoMoved')} → ${new Date(r.movedToDate).toLocaleDateString(state.lang==='bn'?'bn-BD':'en-US',{weekday:'short',day:'numeric',month:'short'})}</div>` : '';
  return `<div class="rem-card${moved}">
      <div class="rem-top">
        <div class="row-ic">${tt?tt.em:'⏰'}</div>
        <div class="grow">
          <div class="row-title">${tt?L(tt):''} ${crop?`· ${crop.em} ${L(crop)}`:''}</div>
          <div class="rem-when">🔁 ${repeat} · 🕒 ${escapeHtml(r.time||'06:00')}</div>
        </div>
        <label class="switch"><input type="checkbox" ${r.enabled!==false?'checked':''} data-act="toggleReminder" data-v="${r.id}"/><span class="track"></span></label>
      </div>
      ${movedNote}
      <div class="flex gap8 mt12">
        <button class="btn btn-outline btn-sm" data-act="editReminder" data-v="${r.id}">✏️ ${t('edit')}</button>
        <button class="btn btn-outline btn-sm" data-act="deleteReminder" data-v="${r.id}" style="color:var(--danger)">🗑️ ${t('delete')}</button>
      </div>
    </div>`;
}

function reminderSheet(existing) {
  const u = currentUser();
  const r = existing || { type: 'irrigation', cropId: (u.crops||[])[0]||CROPS[0].id, repeat: 'daily', time: '06:00', enabled: true };
  openSheet(`
    <h3>${existing ? t('edit') : t('addReminder')}</h3>
    <p class="sheet-sub">${t('tasksTitle')}</p>
    <div class="field"><label>${t('taskType')}</label>
      <div class="chips" id="rm_type">
        ${TASK_TYPES.map(tp => `<div class="chip ${tp.id===r.type?'on':''}" data-act="pickTaskType" data-v="${tp.id}"><span class="em">${tp.em}</span>${L(tp)}</div>`).join('')}
      </div></div>
    <div class="field"><label>${t('forCrop')}</label>
      <select id="rm_crop" class="select">
        ${CROPS.map(c => `<option value="${c.id}" ${c.id===r.cropId?'selected':''}>${c.em} ${L(c)}</option>`).join('')}
      </select></div>
    <div class="field"><label>${t('repeat')}</label>
      <div class="seg" id="rm_repeat">
        ${[['none',t('repeatNone')],['daily',t('repeatDaily')],['weekly',t('repeatWeekly')]].map(([v,lab]) =>
          `<button class="${v===r.repeat?'on':''}" data-act="pickRepeat" data-v="${v}">${lab}</button>`).join('')}
      </div></div>
    <div class="field"><label>${t('time')}</label>
      <input id="rm_time" class="input" type="time" value="${r.time||'06:00'}"/></div>
    <div class="note mb16"><span class="n-em">🌦️</span><span>${state.lang==='bn'?'আবহাওয়া খারাপ হলে এই কাজ স্বয়ংক্রিয়ভাবে পিছিয়ে যাবে।':'This task will auto-reschedule if the weather turns bad on its day.'}</span></div>
    <button class="btn btn-primary" data-act="saveReminder" data-id="${existing?existing.id:''}">${t('save')} ✓</button>
  `);
  // stash working copy
  sheetState = { type: r.type, repeat: r.repeat };
}
let sheetState = {};

/* ------------------------------------------------------------------ *
 * 15. PROFILE / settings
 * ------------------------------------------------------------------ */
function renderProfile() {
  const u = currentUser();
  setStatusBar('#12532f');
  const roleLabel = { farmer: t('roleFarmer'), trader: t('roleTrader'), user: t('roleUser') }[u.role] || '';
  const wxMode = state.settings.weatherMode || 'demo';
  screenEl().innerHTML = `
    <div class="app-head">
      <div class="head-row"><div class="page-title">${t('profileTitle')}</div></div>
      <div class="flex aic gap12 mt16" style="position:relative;z-index:1">
        <div class="avatar" style="width:64px;height:64px;font-size:26px;border-radius:20px">${initials(u.name)}</div>
        <div>
          <div class="head-name">${escapeHtml(u.name)}</div>
          <div class="head-loc">${roleLabel} · 📍 ${escapeHtml(u.location?.label||'')}</div>
        </div>
      </div>
    </div>
    <div class="screen-pad stagger">
      <div class="card card-pad">
        <div class="flex between aic"><b>${t('myCrops')}</b><a class="link" style="color:var(--green-700);font-weight:700" data-act="editCrops">${t('changeCrops')}</a></div>
        <div class="chips mt12">
          ${(u.crops||[]).map(cid => { const c=cropById(cid); return `<span class="tag-soft" style="font-size:13px">${c.em} ${L(c)}</span>`; }).join('') || `<span class="muted">—</span>`}
        </div>
      </div>

      <div class="section-title"><h3>${t('settings')}</h3></div>
      <div class="card">
        ${settingRow('🌐', t('language'), `<div class="seg" style="width:150px"><button class="${state.lang==='en'?'on':''}" data-act="lang" data-l="en">EN</button><button class="${state.lang==='bn'?'on':''}" data-act="lang" data-l="bn">বাংলা</button></div>`)}
        <div class="divider" style="margin:0"></div>
        ${settingRow('🌩️', t('weatherAlerts'), toggle('setWeatherAlerts', state.settings.weatherAlerts))}
        <div class="divider" style="margin:0"></div>
        ${settingRow('🎯', t('priceAlerts'), toggle('setPriceAlerts', state.settings.priceAlerts))}
        <div class="divider" style="margin:0"></div>
        ${settingRow('🔔', t('notifPermission'), `<button class="btn btn-outline btn-sm" data-act="enableNotif">${t('confirm')}</button>`)}
      </div>

      <div class="section-title"><h3>${t('dataSource')}</h3></div>
      <div class="card card-pad">
        <div class="seg" id="wxMode">
          <button class="${wxMode==='demo'?'on':''}" data-act="setWxMode" data-v="demo">🎬 ${t('demoMode')}</button>
          <button class="${wxMode==='live'?'on':''}" data-act="setWxMode" data-v="live">🛰️ ${t('liveMode')}</button>
        </div>
        <div class="hint mt12">${t('weatherModeHint')}</div>
      </div>

      <div class="section-title"><h3>${t('account')}</h3></div>
      <div class="card">
        ${settingRow('📍', t('savedLoc'), `<span class="muted">${escapeHtml(u.location?.label||'')}</span>`)}
        <div class="divider" style="margin:0"></div>
        ${settingRow('ℹ️', t('version'), `<span class="muted">1.0.0</span>`)}
      </div>

      <button class="btn btn-outline mt20" data-act="logout" style="color:var(--danger)">🚪 ${t('logout')}</button>
      <p class="center muted mt16" style="font-size:12px">${t('appName')} · ${t('tagline')}</p>
    </div>`;
}
function settingRow(em, label, right) {
  return `<div class="flex between aic" style="padding:15px 16px"><div class="flex aic gap12"><span style="font-size:19px">${em}</span><b style="font-size:14.5px">${label}</b></div>${right}</div>`;
}
function toggle(act, on) {
  return `<label class="switch"><input type="checkbox" ${on?'checked':''} data-act="${act}"/><span class="track"></span></label>`;
}

/* crop editor sheet */
function editCropsSheet() {
  const u = currentUser();
  const sel = new Set(u.crops || []);
  openSheet(`
    <h3>${t('myCrops')}</h3>
    <p class="sheet-sub">${t('cropsSub')}</p>
    <div class="chips" id="ec_crops">
      ${CROPS.map(c => `<div class="chip ${sel.has(c.id)?'on':''}" data-act="ecToggle" data-v="${c.id}"><span class="em">${c.em}</span>${L(c)}</div>`).join('')}
    </div>
    <button class="btn btn-primary mt20" data-act="saveCrops">${t('save')} ✓</button>
  `);
  ecDraft = new Set(sel);
}
let ecDraft = new Set();

/* ------------------------------------------------------------------ *
 * 16. Shared render helpers
 * ------------------------------------------------------------------ */
function emptyState(em, title, sub) {
  return `<div class="empty"><div class="e-em">${em}</div><div class="e-t">${title}</div><div class="e-s">${sub}</div></div>`;
}
const HONORIFIC = /^(mr|mrs|ms|md|dr|mst|mr\.|mrs\.|ms\.|md\.|dr\.)$/i;
function nameParts(n) { return (n || '').trim().split(/\s+/).filter(x => x && !HONORIFIC.test(x)); }
function firstName(n) { const p = nameParts(n); return p[0] || 'Farmer'; }
function initials(n) {
  const p = nameParts(n);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '🌾';
}

function setStatusBar(color, dark) {
  const sb = $('#statusBar');
  if (dark) { sb.classList.add('dark-text'); sb.style.background = 'transparent'; }
  else { sb.classList.remove('dark-text'); sb.style.background = color || '#12532f'; }
}

/* ------------------------------------------------------------------ *
 * 17. Alerts: severe weather + price
 * ------------------------------------------------------------------ */
function checkSevere(fc) {
  if (!state.settings.weatherAlerts || !fc) return;
  const severe = fc.find(d => d.severe);
  if (!severe) return;
  const key = severe.date;
  if (state.alertedSevere[key]) return;
  state.alertedSevere[key] = true; saveState();
  const dayName = t('days')[severe.dow];
  const body = state.lang==='bn'
    ? `${dayName}বার ঝড়/ভারী বৃষ্টির সতর্কতা। ফসল রক্ষা করুন।`
    : `Storm/heavy rain warning for ${dayName}. Protect your crops.`;
  setTimeout(() => { toast('⚠️ ' + t('severeTag') + ': ' + body, 'warn'); pushNotify('⚠️ ' + t('appName'), body); }, 900);
}

function checkPriceAlerts() {
  if (!state.settings.priceAlerts) return;
  const targets = userTargets();
  Object.keys(targets).forEach(cropId => {
    const target = targets[cropId];
    const matches = marketsWithPrice(cropId, 100).filter(m => m.latest && m.fresh && m.latest.price >= target);
    if (!matches.length) return;
    const key = cropId + ':' + todayKey();
    if (state.alertedPrice[key]) return;
    state.alertedPrice[key] = true; saveState();
    const best = matches.sort((a,b)=>b.latest.price-a.latest.price)[0];
    const crop = cropById(cropId);
    const body = `${L(crop)} ৳${num(best.latest.price)} ${t('priceAlertBody')} ৳${num(target)} · ${L(best)}`;
    setTimeout(() => { toast('🎯 ' + body, 'ok'); pushNotify('🎯 ' + t('priceAlert'), body); }, 1400);
  });
}

/* ------------------------------------------------------------------ *
 * 18. Offline handling
 * ------------------------------------------------------------------ */
function updateOfflineBar() {
  const bar = $('#offlineBar');
  const net = $('#sbNet');
  if (navigator.onLine) { bar.hidden = true; net.classList.remove('off'); }
  else {
    bar.hidden = false;
    $('#offlineText').textContent = t('offline');
    net.classList.add('off');
  }
}
window.addEventListener('online', () => { updateOfflineBar(); toast('🟢 ' + t('online'), 'ok'); if (currentUser()) showApp(activeTab); });
window.addEventListener('offline', () => { updateOfflineBar(); toast('⚠️ ' + t('offline'), 'warn'); });

/* ------------------------------------------------------------------ *
 * 19. Speech (audio advisory)
 * ------------------------------------------------------------------ */
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) { toast('🔇 Audio not supported', 'warn'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = state.lang === 'bn' ? 'bn-BD' : 'en-US';
    u.rate = 0.95;
    speechSynthesis.speak(u);
    toast('🔊 ' + t('playAudio'), 'ok');
  } catch (e) {}
}

/* ------------------------------------------------------------------ *
 * 20. Central action handler (event delegation)
 * ------------------------------------------------------------------ */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  // ripple on buttons
  const rippleTarget = e.target.closest('.btn');
  if (rippleTarget) addRipple(rippleTarget, e);
  if (!btn) return;
  const act = btn.dataset.act;
  const v = btn.dataset.v;
  handleAction(act, v, btn, e);
});

function addRipple(el, e) {
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.width = r.style.height = size + 'px';
  r.style.left = (e.clientX - rect.left - size/2) + 'px';
  r.style.top = (e.clientY - rect.top - size/2) + 'px';
  el.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

function handleAction(act, v, btn, e) {
  const u = currentUser();
  switch (act) {
    /* ---- language ---- */
    case 'lang':
      state.lang = btn.dataset.l; document.documentElement.lang = state.lang; saveState();
      if (currentUser()) showApp(activeTab);
      else { const inReg = !!screenEl().querySelector('.steps'); renderAuth(inReg ? 'register' : 'login'); }
      break;

    /* ---- auth nav ---- */
    case 'goRegister': regDraft = regDraft || {}; renderAuth('register'); break;
    case 'goLogin': renderAuth('login'); break;
    case 'forgot': toast('📩 ' + (state.lang==='bn'?'রিসেট লিংক পাঠানো হয়েছে (ডেমো)':'Reset link sent (demo)'), 'ok'); break;

    case 'pickRole':
      regDraft = regDraft || {}; regDraft.role = v;
      $$('#r_role .chip').forEach(c => c.classList.toggle('on', c.dataset.v === v));
      break;

    case 'doLogin': doLogin(); break;
    case 'demoLogin': demoLogin(btn.dataset.cred); break;
    case 'regNext': regNext(); break;

    /* ---- onboarding ---- */
    case 'useGps': doGps(); break;
    case 'obLocNext': obLocNext(); break;
    case 'toggleCrop':
      regDraft.crops = regDraft.crops || [];
      toggleInArray(regDraft.crops, v);
      btn.classList.toggle('on');
      break;
    case 'finishReg': finishReg(); break;

    /* ---- tabs ---- */
    case 'tab': showApp(v); break;

    /* ---- weather ---- */
    case 'refreshWeather': (async () => { toast('🔄 ...', ''); await fetchWeather(true); showApp('weather'); })(); break;
    case 'speak': speak(btn.dataset.text); break;

    /* ---- market ---- */
    case 'pickMarketCrop': marketCrop = v; renderMarket(); break;
    case 'marketSort': marketSort = v; renderMarket(); break;
    case 'marketRadius': break; // handled via change below
    case 'marketDetail': marketDetailSheet(v); break;
    case 'reportPriceQuick': submitPriceSheet(btn.dataset.crop, btn.dataset.market); break;
    case 'doSubmitPrice': doSubmitPrice(); break;
    case 'setTargetSheet': setTargetSheet(); break;
    case 'doSetTarget': doSetTarget(btn.dataset.crop); break;
    case 'removeTarget':
      delete userTargets()[btn.dataset.crop]; saveState(); closeSheet();
      toast('🗑️ ' + t('targetRemoved'), ''); renderMarket(); break;

    /* ---- tasks ---- */
    case 'addReminderQuick': reminderSheet(null); break;
    case 'pickTaskType':
      sheetState.type = v; $$('#rm_type .chip').forEach(c => c.classList.toggle('on', c.dataset.v === v)); break;
    case 'pickRepeat':
      sheetState.repeat = v; $$('#rm_repeat button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); break;
    case 'saveReminder': saveReminder(btn.dataset.id); break;
    case 'toggleReminder': toggleReminder(v); break;
    case 'editReminder': reminderSheet(userReminders().find(r => r.id === v)); break;
    case 'deleteReminder': deleteReminder(v); break;

    /* ---- profile ---- */
    case 'editCrops': editCropsSheet(); break;
    case 'ecToggle': toggleInArray([...ecDraft].includes(v)?(ecDraft.delete(v),[...ecDraft]):(ecDraft.add(v),[...ecDraft]), v); btn.classList.toggle('on'); break;
    case 'saveCrops':
      u.crops = [...ecDraft]; saveState(); closeSheet(); toast('✅ ' + t('profileUpdated'), 'ok'); renderProfile(); break;
    case 'setWeatherAlerts': state.settings.weatherAlerts = btn.checked; saveState(); break;
    case 'setPriceAlerts': state.settings.priceAlerts = btn.checked; saveState(); break;
    case 'enableNotif': requestNotify(); toast('🔔 ' + t('confirm'), 'ok'); break;
    case 'setWxMode':
      state.settings.weatherMode = v; state.cache.weatherTs = 0; persistShared();
      toast((v === 'live' ? '🛰️ ' : '🎬 ') + t('save'), 'ok'); renderProfile(); break;
    case 'logout':
      setSession(null); go('login'); break;

    /* ---- sheet / intro ---- */
    case 'closeSheet': closeSheet(); break;
    case 'closeIntro': {
      const o = $('.intro-overlay');
      if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 280); }
      break;
    }
  }
}

/* change events for selects / toggles */
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'marketRadius') { marketRadius = +el.value; renderMarket(); }
  else if (act === 'setWeatherAlerts') { state.settings.weatherAlerts = el.checked; saveState(); }
  else if (act === 'setPriceAlerts') { state.settings.priceAlerts = el.checked; saveState(); }
  else if (act === 'toggleReminder') toggleReminder(el.dataset.v);
});

function toggleInArray(arr, v) {
  const i = arr.indexOf(v);
  if (i >= 0) arr.splice(i, 1); else arr.push(v);
  return arr;
}

/* ------------------------------------------------------------------ *
 * 21. Action implementations
 * ------------------------------------------------------------------ */
function doLogin() {
  const cred = $('#li_cred').value.trim();
  const pass = $('#li_pass').value;
  const err = $('#authErr');
  if (!cred) return err.textContent = t('errCred');
  if (!pass) return err.textContent = t('errPass');
  const user = state.users.find(x => x.cred.toLowerCase() === cred.toLowerCase());
  if (!user) return err.textContent = t('errLogin');
  if (user.pass !== pass) return err.textContent = t('errWrongPass');
  setSession(user.id);
  go('home');
}

function demoLogin(cred) {
  seedDemoData();
  const user = state.users.find(u => u.cred.toLowerCase() === (cred || 'akib'));
  if (!user) return;
  setSession(user.id);
  toast('🎬 ' + user.name, 'ok');
  go('home');
}

/* A phone (Bangladeshi) or an email is accepted as the login identifier */
function isValidPhone(v) { return /^(?:\+?880|0)?1[3-9]\d{8}$/.test((v || '').replace(/[\s-]/g, '')); }
function isValidEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim()); }

function regNext() {
  const name = $('#r_name').value.trim();
  const cred = $('#r_cred').value.trim();
  const pass = $('#r_pass').value;
  const err = $('#authErr');
  if (!name) return err.textContent = t('errName');
  if (!cred) return err.textContent = t('errCred');
  if (!isValidPhone(cred) && !isValidEmail(cred)) return err.textContent = t('errCredFormat');
  if (pass.length < 4) return err.textContent = t('errPass');
  if (state.users.some(x => x.cred.toLowerCase() === cred.toLowerCase()))
    return err.textContent = t('errDup');
  regDraft = Object.assign(regDraft || {}, { name, cred, pass, role: (regDraft&&regDraft.role) || 'farmer' });
  renderOnboarding('location');
}

function doGps() {
  const status = $('#locStatus');
  toast('📡 ' + t('locating'), '');
  if (!navigator.geolocation) return toast('⚠️ ' + t('gpsFail'), 'warn');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      regDraft = regDraft || {};
      regDraft.location = { lat: +pos.coords.latitude.toFixed(4), lon: +pos.coords.longitude.toFixed(4), label: t('locationSet') + ' (GPS)' };
      if ($('#ob_loc')) $('#ob_loc').value = regDraft.location.label;
      if (status) { status.hidden = false; status.querySelector('b').textContent = regDraft.location.label; }
      toast('✅ ' + t('locationSet'), 'ok');
    },
    () => toast('⚠️ ' + t('gpsFail'), 'warn'),
    { timeout: 8000 }
  );
}

function obLocNext() {
  regDraft = regDraft || {};
  const manual = $('#ob_loc').value.trim();
  if (manual && (!regDraft.location || !/GPS/.test(regDraft.location.label))) {
    const hit = lookupDistrict(manual) || { lat: 22.3569, lon: 91.7832 }; // match district or default Chattogram
    regDraft.location = { lat: hit.lat, lon: hit.lon, label: manual };
  } else if (manual && regDraft.location) {
    regDraft.location.label = manual;
  }
  if (!regDraft.location) regDraft.location = { lat: 22.3569, lon: 91.7832, label: 'Chattogram' };
  renderOnboarding('crops');
}

function finishReg() {
  regDraft.crops = regDraft.crops || [];
  if (!regDraft.crops.length) { $('#cropErr').textContent = t('selectAtLeastOne'); return; }
  const user = {
    id: 'u' + Date.now(),
    name: regDraft.name, cred: regDraft.cred, pass: regDraft.pass,
    role: regDraft.role || 'farmer',
    location: regDraft.location, crops: regDraft.crops,
    createdAt: Date.now(),
    targets: {}, reminders: [],
  };
  state.users.push(user);
  saveState();
  setSession(user.id);
  regDraft = null;
  toast('🎉 ' + t('appName'), 'ok');
  go('home');
}

function doSubmitPrice() {
  const cropId = $('#sp_crop').value;
  let marketId = $('#sp_market').value;
  const price = parseFloat($('#sp_price').value);
  const err = $('#spErr');
  if (!price || price <= 0) return err.textContent = t('errPrice');
  if (marketId === '__new') {
    const name = $('#sp_newname').value.trim();
    if (!name) return err.textContent = t('marketName');
    const u = currentUser();
    marketId = 'm' + Date.now();
    state.markets.push({ id: marketId, name, bn: name, lat: (u.location?.lat||23.81), lon: (u.location?.lon||90.41) });
  }
  const base = BASE_PRICE[cropId] || 50;
  if (price > base * 3) {
    // validate "impossible" price -> confirm
    if (!confirm(t('impossiblePrice'))) return;
  }
  const u = currentUser();
  state.prices.push({
    id: 'p' + Date.now(), cropId, marketId, price: Math.round(price),
    by: u.name, role: u.role, ts: Date.now(),
  });
  // reset the daily alert flag so a fresh matching price can re-alert
  delete state.alertedPrice[cropId + ':' + todayKey()];
  saveState();
  closeSheet();
  toast('✅ ' + t('priceSubmitted'), 'ok');
  marketCrop = cropId;
  checkPriceAlerts();
  if (activeTab === 'market') renderMarket();
  else if (activeTab === 'home') renderHome();
}

function doSetTarget(cropId) {
  const val = parseFloat($('#tg_val').value);
  const err = $('#tgErr');
  if (!val || val <= 0) return err.textContent = t('errTarget');
  userTargets()[cropId] = Math.round(val);
  delete state.alertedPrice[cropId + ':' + todayKey()];
  saveState();
  closeSheet();
  toast('🎯 ' + t('targetSet'), 'ok');
  checkPriceAlerts();
  if (activeTab === 'market') renderMarket();
}

function saveReminder(id) {
  const type = sheetState.type || 'irrigation';
  const cropId = $('#rm_crop').value;
  const repeat = sheetState.repeat || 'daily';
  const time = $('#rm_time').value || '06:00';
  const rems = userReminders();
  if (id) {
    const r = rems.find(x => x.id === id);
    if (r) Object.assign(r, { type, cropId, repeat, time });
  } else {
    rems.push({ id: 'r' + Date.now(), type, cropId, repeat, time, enabled: true });
  }
  saveState();
  closeSheet();
  toast('✅ ' + t('reminderSaved'), 'ok');
  // re-evaluate weather reschedule immediately
  if (state.cache.weather) applyWeatherReschedule(state.cache.weather);
  showApp(activeTab === 'home' ? 'home' : 'tasks');
}

function toggleReminder(id) {
  const r = userReminders().find(x => x.id === id);
  if (!r) return;
  r.enabled = !(r.enabled !== false);
  saveState();
}

function deleteReminder(id) {
  if (!confirm(t('deleteReminder'))) return;
  const u = currentUser();
  u.reminders = userReminders().filter(r => r.id !== id);
  saveState();
  toast('🗑️ ' + t('reminderDeleted'), '');
  renderTasks();
}

/* ------------------------------------------------------------------ *
 * 22. Live clock in status bar + init
 * ------------------------------------------------------------------ */
function tickClock() {
  const d = new Date();
  const el = $('#sbTime');
  if (el) el.textContent = d.toLocaleTimeString(state.lang==='bn'?'bn-BD':'en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function init() {
  document.documentElement.lang = state.lang;
  seedPrices();
  seedDemoData();
  updateOfflineBar();
  tickClock(); setInterval(tickClock, 20000);
  // register service worker only when served over http(s)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  go('splash');
}

document.addEventListener('DOMContentLoaded', init);
