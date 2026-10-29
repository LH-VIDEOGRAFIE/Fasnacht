const FIREBASE_CONFIG={apiKey:""AIzaSyBj4SAeWRIGt2H4xXRVqhyfmDU37Vc1rP",authDomain:"fasnacht-bestellungen.firebaseapp.com",projectId:"fasnacht-bestellungen",appId:"1:489525283948:web:19ef3b6d791d84de881c49"};
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBj4SAeWRIGt2H4xXRVqhyfmDU37Vc1rPA",
  authDomain: "fasnacht-bestellungen.firebaseapp.com",
  projectId: "fasnacht-bestellungen",
  storageBucket: "fasnacht-bestellungen.firebasestorage.app",
  messagingSenderId: "489525283948",
  appId: "1:489525283948:web:19ef3b6d791d84de881c49"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
import { firebaseConfig, STAFF_EMAIL } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, addDoc,
  onSnapshot, runTransaction, serverTimestamp, writeBatch, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

/* ============================================================
   Hilfsfunktionen
   ============================================================ */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const euro = (n) => fmt.format(n || 0);
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const parsePreis = (s) => {
  const n = parseFloat(String(s ?? '').replace(/[\s€+]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : r2(n);
};
const preisInput = (n) => (n || 0).toFixed(2).replace('.', ',');
const toDate = (ts) => (ts && ts.toDate ? ts.toDate() : null);
const uhr = (d) => (d ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '');

const STATUS = [
  { k: 'neu', l: 'Auftrag erhalten' },
  { k: 'bearbeitung', l: 'In Bearbeitung' },
  { k: 'abgegeben', l: 'Abgegeben' },
  { k: 'kassiert', l: 'Kassiert' },
  { k: 'abgeschlossen', l: 'Abgeschlossen' },
];
const statusLabel = (k) => (k === 'storniert' ? 'Storniert' : (STATUS.find((s) => s.k === k) || { l: k }).l);
const BEZAHLT = ['kassiert', 'abgeschlossen'];
const ARCHIV = ['abgeschlossen', 'storniert'];

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
    localStorage.setItem(key, JSON.stringify(val));
  } catch { return null; }
}

/* ============================================================
   Start / Firebase
   ============================================================ */
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('HIER')) {
  app.innerHTML = `<div class="wrap"><div class="card" style="margin-top:3rem">
    <h2>Fast geschafft 🎭</h2>
    <p>Die App ist noch nicht mit der Datenbank verbunden. Trage deine Firebase-Daten in
    <b>firebase-config.js</b> ein – Schritt für Schritt steht das in <b>ANLEITUNG.md</b>.</p></div></div>`;
  throw new Error('Firebase nicht konfiguriert');
}

const fb = initializeApp(firebaseConfig);
const db = getFirestore(fb);
const auth = getAuth(fb);

let mode = null;           // 'guest' | 'staff'
let settings = null;
let settingsLoaded = false;
let items = [];
let user = null;
let authReady = false;

const DEFAULT_SETTINGS = {
  vereinName: 'Unser Fastnachtsverein',
  begruessung: 'Helau! Bestell bequem von deinem Tisch aus.',
  bestellungenOffen: true,
  kategorien: ['Getränke', 'Essen'],
};

onSnapshot(doc(db, 'settings', 'main'), (s) => {
  settings = s.exists() ? s.data() : null;
  settingsLoaded = true;
  document.title = settings?.vereinName ? `${settings.vereinName} – Bestellung` : 'Bestellung';
  if (!settings && user) setDoc(doc(db, 'settings', 'main'), DEFAULT_SETTINGS);
  onData('settings');
});

onSnapshot(collection(db, 'items'), (qs) => {
  items = qs.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || a.name.localeCompare(b.name, 'de'));
  onData('items');
});

onAuthStateChanged(auth, (u) => {
  user = u;
  authReady = true;
  if (u && settingsLoaded && !settings) setDoc(doc(db, 'settings', 'main'), DEFAULT_SETTINGS);
  if (!u) stopOrders();
  if (mode === 'staff') showStaff();
});

function onData(what) {
  if (mode === 'guest') {
    renderGuestHeader();
    if (G.view === 'menu') renderGuest();
  } else if (mode === 'staff' && user) {
    const t = $('#s-title');
    if (t) t.textContent = settings?.vereinName || 'Verein';
    if (S.tab === 'items' && what === 'items') renderStaffMain();
  }
}

function alleKategorien() {
  const list = [...(settings?.kategorien || [])];
  items.forEach((i) => { if (i.kategorie && !list.includes(i.kategorie)) list.push(i.kategorie); });
  return list;
}

function route() {
  if (location.hash.startsWith('#personal')) showStaff();
  else showGuest();
}
window.addEventListener('hashchange', route);

/* ============================================================
   GAST-ANSICHT
   ============================================================ */
const urlTisch = new URLSearchParams(location.search).get('tisch') || '';
const G = { tisch: urlTisch, cart: [], notiz: '', view: 'menu', kat: null, trackId: null, unsubTrack: null };

function showGuest() {
  mode = 'guest';
  stopOrders();
  app.innerHTML = `
    <header class="hero"><div class="hero-inner">
      <h1 id="g-title"></h1><p id="g-sub"></p><div id="g-tisch"></div>
    </div></header>
    <main class="wrap" id="g-main"></main>
    <div id="g-bar"></div>`;
  renderGuestHeader();
  renderGuest();
}

function renderGuestHeader() {
  if (mode !== 'guest' || !$('#g-title')) return;
  $('#g-title').textContent = settings?.vereinName || 'Bestellung';
  $('#g-sub').textContent = settings?.begruessung || '';
  $('#g-tisch').innerHTML = G.tisch ? `<span class="tischbadge">Tisch ${esc(G.tisch)}</span>` : '';
}

function renderGuest() {
  const main = $('#g-main');
  if (mode !== 'guest' || !main) return;
  if (G.view === 'done') return renderTrack(main);
  if (G.view === 'cart') return renderCart(main);
  renderMenu(main);
}

const einzel = (c) => r2(c.preis + c.optionen.reduce((a, o) => a + (o.aufpreis || 0), 0));
const cartSum = () => r2(G.cart.reduce((a, c) => a + einzel(c) * c.menge, 0));
const cartCount = () => G.cart.reduce((a, c) => a + c.menge, 0);

function meineBestellungen() {
  const grenze = Date.now() - 12 * 3600 * 1000;
  return (store('meineBestellungen') || []).filter((b) => b.t > grenze);
}

function renderMenu(main) {
  if (!settingsLoaded) { main.innerHTML = '<div class="loading">Lädt …</div>'; return renderBar(); }
  if (!settings) { main.innerHTML = '<div class="empty big">Die Speisekarte wird gerade vorbereitet.</div>'; return renderBar(); }
  if (settings.bestellungenOffen === false) {
    main.innerHTML = '<div class="empty big">🎭 Gerade sind keine Bestellungen möglich.<br>Schau gleich nochmal rein.</div>';
    return renderBar();
  }
  const kats = alleKategorien().filter((k) => items.some((i) => i.kategorie === k));
  if (!kats.length) { main.innerHTML = '<div class="empty big">Die Speisekarte ist noch leer.</div>'; return renderBar(); }
  if (!kats.includes(G.kat)) G.kat = kats[0];

  const mine = meineBestellungen();
  main.innerHTML = `
    ${mine.length ? `<div class="mine"><span class="muted">Deine Bestellungen:</span>
      ${mine.map((b) => `<button data-track="${esc(b.id)}">#${b.nr}</button>`).join('')}</div>` : ''}
    <nav class="tabs">${kats.map((k) =>
      `<button class="tab ${k === G.kat ? 'on' : ''}" data-kat="${esc(k)}">${esc(k)}</button>`).join('')}</nav>
    <div class="items">${items.filter((i) => i.kategorie === G.kat).map(itemCard).join('')}</div>`;

  $$('[data-kat]', main).forEach((b) => b.onclick = () => { G.kat = b.dataset.kat; renderGuest(); });
  $$('[data-track]', main).forEach((b) => b.onclick = () => { G.trackId = b.dataset.track; G.view = 'done'; renderGuest(); });
  $$('[data-add]', main).forEach((b) => b.onclick = () => {
    const it = items.find((i) => i.id === b.dataset.add);
    if (!it) return;
    if (it.optionen?.length) openOptions(it);
    else addToCart(it, [], 1);
  });
  renderBar();
}

function itemCard(i) {
  const imKorb = G.cart.filter((c) => c.itemId === i.id).reduce((a, c) => a + c.menge, 0);
  const aus = i.verfuegbar === false;
  return `<div class="item ${aus ? 'off' : ''}">
    <div class="item-txt">
      <div class="item-name">${esc(i.name)}</div>
      ${i.beschreibung ? `<div class="item-desc">${esc(i.beschreibung)}</div>` : ''}
      <div class="item-price">${euro(i.preis)}</div>
    </div>
    ${aus ? '<span class="soldout">Ausverkauft</span>'
      : `<button class="add" data-add="${i.id}" aria-label="${esc(i.name)} hinzufügen">${imKorb ? `<span class="cnt">${imKorb}</span>` : '+'}</button>`}
  </div>`;
}

function addToCart(it, optionen, menge) {
  const key = it.id + '|' + optionen.map((o) => o.name).sort().join(',');
  const vorhanden = G.cart.find((c) => c.key === key);
  if (vorhanden) vorhanden.menge += menge;
  else G.cart.push({ key, itemId: it.id, name: it.name, kategorie: it.kategorie || '', preis: it.preis || 0, optionen, menge });
  toast(`${menge}× ${it.name} im Warenkorb`);
  renderGuest();
}

function openOptions(it) {
  let menge = 1;
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
    <h2>${esc(it.name)}</h2><p class="muted">${euro(it.preis)}</p>
    <div>${it.optionen.map((o, idx) => `<label class="opt"><input type="checkbox" value="${idx}">
      <span>${esc(o.name)}</span>${o.aufpreis ? `<em>+ ${euro(o.aufpreis)}</em>` : ''}</label>`).join('')}</div>
    <div class="qty"><button data-q="-1" aria-label="weniger">−</button><span id="mq">1</span><button data-q="1" aria-label="mehr">+</button></div>
    <div class="row"><button class="btn ghost" data-close>Abbrechen</button><button class="btn grow" data-ok>In den Warenkorb</button></div>
  </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.onclick = (e) => { if (e.target === m) close(); };
  $('[data-close]', m).onclick = close;
  $$('[data-q]', m).forEach((b) => b.onclick = () => {
    menge = Math.max(1, Math.min(50, menge + Number(b.dataset.q)));
    $('#mq', m).textContent = menge;
  });
  $('[data-ok]', m).onclick = () => {
    const gew = $$('input:checked', m).map((x) => it.optionen[Number(x.value)]);
    close();
    addToCart(it, gew.map((o) => ({ name: o.name, aufpreis: o.aufpreis || 0 })), menge);
  };
}

function renderBar() {
  const bar = $('#g-bar');
  if (!bar) return;
  const n = cartCount();
  if (G.view !== 'menu' || !n) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<button class="cartbar" id="toCart"><span class="badge">${n}</span> Bestellung ansehen <strong>${euro(cartSum())}</strong></button>`;
  $('#toCart').onclick = () => { G.view = 'cart'; renderGuest(); window.scrollTo(0, 0); };
}

function renderCart(main) {
  renderBar();
  if (!G.cart.length) { G.view = 'menu'; return renderGuest(); }
  main.innerHTML = `
    <button class="back" id="back">← Weiter auswählen</button>
    <h2 style="margin:.5rem 0 .8rem">Deine Bestellung</h2>
    <div class="card">
      ${G.cart.map((c, idx) => `<div class="line">
        <div><strong>${esc(c.name)}</strong>
          ${c.optionen.length ? `<div class="muted small">${c.optionen.map((o) => esc(o.name)).join(', ')}</div>` : ''}
          <div class="muted small">${euro(einzel(c))} pro Stück</div></div>
        <div class="qty sm"><button data-i="${idx}" data-d="-1" aria-label="weniger">−</button><span>${c.menge}</span><button data-i="${idx}" data-d="1" aria-label="mehr">+</button></div>
      </div>`).join('')}
      <div class="total"><span>Summe</span><strong>${euro(cartSum())}</strong></div>
    </div>
    <label class="field"><span>Tischnummer</span>
      <input id="tisch" type="number" inputmode="numeric" min="1" max="999" value="${esc(G.tisch)}" placeholder="z. B. 12"></label>
    <label class="field"><span>Anmerkung (optional)</span>
      <textarea id="notiz" rows="2" maxlength="300" placeholder="z. B. alles zusammen bringen">${esc(G.notiz)}</textarea></label>
    <button class="btn big" id="send">Jetzt bestellen · ${euro(cartSum())}</button>
    <p class="muted small center">Bezahlt wird beim Personal.</p>`;

  $('#back').onclick = () => { G.view = 'menu'; renderGuest(); };
  $('#tisch').oninput = (e) => { G.tisch = e.target.value; };
  $('#notiz').oninput = (e) => { G.notiz = e.target.value; };
  $$('[data-d]', main).forEach((b) => b.onclick = () => {
    const c = G.cart[Number(b.dataset.i)];
    c.menge += Number(b.dataset.d);
    if (c.menge <= 0) G.cart.splice(Number(b.dataset.i), 1);
    renderGuest();
  });
  $('#send').onclick = sendOrder;
}

async function sendOrder() {
  const btn = $('#send');
  const tisch = parseInt($('#tisch').value, 10);
  if (!tisch || tisch < 1 || tisch > 999) {
    toast('Bitte deine Tischnummer eintragen');
    $('#tisch').focus();
    return;
  }
  if (settings?.bestellungenOffen === false) { toast('Gerade sind keine Bestellungen möglich'); return; }
  btn.disabled = true;
  btn.textContent = 'Wird gesendet …';

  const positionen = G.cart.map((c) => ({
    itemId: c.itemId, name: c.name, kategorie: c.kategorie, preis: c.preis,
    optionen: c.optionen, menge: c.menge, einzelpreis: einzel(c),
  }));
  const order = {
    tisch, positionen, notiz: (G.notiz || '').trim().slice(0, 300),
    summe: cartSum(), status: 'neu', erstellt: serverTimestamp(), aktualisiert: serverTimestamp(),
  };

  try {
    const res = await runTransaction(db, async (tx) => {
      const cRef = doc(db, 'counters', 'orders');
      const snap = await tx.get(cRef);
      const nr = (snap.exists() ? snap.data().value : 0) + 1;
      if (snap.exists()) tx.update(cRef, { value: nr });
      else tx.set(cRef, { value: nr });
      const oRef = doc(collection(db, 'orders'));
      tx.set(oRef, { ...order, nr });
      return { id: oRef.id, nr };
    });
    const mine = meineBestellungen();
    mine.push({ id: res.id, nr: res.nr, t: Date.now() });
    store('meineBestellungen', mine.slice(-6));
    G.cart = []; G.notiz = ''; G.tisch = String(tisch);
    G.trackId = res.id; G.view = 'done';
    renderGuestHeader();
    renderGuest();
    window.scrollTo(0, 0);
  } catch (e) {
    console.error(e);
    toast('Senden hat nicht geklappt – bitte nochmal tippen');
    btn.disabled = false;
    btn.textContent = `Jetzt bestellen · ${euro(cartSum())}`;
  }
}

function renderTrack(main) {
  main.innerHTML = `
    <div class="card done center">
      <div class="muted">Deine Bestellnummer</div>
      <div class="bignr" id="t-nr">…</div>
      <div id="t-info" class="muted" style="margin-top:.4rem"></div>
      <div class="steps" id="t-steps"></div>
    </div>
    <button class="btn big" id="more">Noch etwas bestellen</button>`;
  if (G.unsubTrack) G.unsubTrack();
  G.unsubTrack = onSnapshot(doc(db, 'orders', G.trackId), (s) => {
    if (!$('#t-nr')) return;
    if (!s.exists()) {
      $('#t-nr').textContent = '–';
      $('#t-info').textContent = 'Diese Bestellung ist nicht mehr im System.';
      $('#t-steps').innerHTML = '';
      return;
    }
    const o = s.data();
    $('#t-nr').textContent = '#' + o.nr;
    $('#t-info').textContent = `Tisch ${o.tisch} · ${euro(o.summe)}`;
    if (o.status === 'storniert') {
      $('#t-steps').innerHTML = '<p><b>Diese Bestellung wurde storniert.</b> Bitte wende dich ans Personal.</p>';
      return;
    }
    const reihenfolge = ['neu', 'bearbeitung', 'abgegeben', 'kassiert'];
    const pos = o.status === 'abgeschlossen' ? 3 : reihenfolge.indexOf(o.status);
    const texte = ['Bestellung angekommen', 'Wird zubereitet', 'An deinen Tisch gebracht', 'Bezahlt'];
    $('#t-steps').innerHTML = texte.map((t, i) =>
      `<div class="step ${i <= pos ? 'on' : ''}"><i>${i <= pos ? '✓' : ''}</i>${t}</div>`).join('');
  }, () => { $('#t-info') && ($('#t-info').textContent = 'Status kann gerade nicht geladen werden.'); });
  $('#more').onclick = () => {
    if (G.unsubTrack) G.unsubTrack();
    G.unsubTrack = null; G.view = 'menu';
    renderGuest();
  };
}

/* ============================================================
   PERSONAL-BEREICH
   ============================================================ */
const S = { tab: 'orders', orders: [], showArchiv: false, filterTisch: '', unsub: null, known: null, sound: false };
let actx = null;
let wakeLock = null;

function stopOrders() {
  if (S.unsub) S.unsub();
  S.unsub = null; S.known = null; S.orders = [];
}

function startOrders() {
  if (S.unsub) return;
  S.unsub = onSnapshot(collection(db, 'orders'), (qs) => {
    const list = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (S.known) {
      const neu = list.filter((o) => !S.known.has(o.id));
      if (neu.length) { beep(); toast(`Neue Bestellung: Tisch ${neu.map((o) => o.tisch).join(', ')}`); }
    }
    S.known = new Set(list.map((o) => o.id));
    S.orders = list.sort((a, b) => (a.nr || 0) - (b.nr || 0));
    updatePills();
    if (S.tab === 'orders' || S.tab === 'stats') renderStaffMain();
  }, (err) => {
    console.error(err);
    toast('Kein Zugriff auf Bestellungen – stimmt die E-Mail in den Firestore-Regeln?');
  });
}

function beep() {
  navigator.vibrate?.(250);
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((delay, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = i ? 1175 : 880;
      o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t); o.stop(t + 0.4);
    });
  } catch { /* kein Ton möglich */ }
}

async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* egal */ }
}
document.addEventListener('visibilitychange', () => {
  if (mode === 'staff' && user && document.visibilityState === 'visible') keepAwake();
});

function showStaff() {
  mode = 'staff';
  if (G.unsubTrack) { G.unsubTrack(); G.unsubTrack = null; }
  if (!authReady) { app.innerHTML = '<div class="loading">Lädt …</div>'; return; }
  if (!user) return renderLogin();
  startOrders();
  keepAwake();
  const tabs = [['orders', 'Bestellungen'], ['items', 'Artikel & Preise'], ['stats', 'Umsatz'], ['settings', 'Einstellungen']];
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">🎭 <span id="s-title">${esc(settings?.vereinName || 'Verein')}</span></div>
      <button class="btn ghost sm" id="snd">${S.sound ? '🔔 Ton an' : '🔕 Ton aus'}</button>
      <a class="btn ghost sm" href="./" target="_blank" rel="noopener" style="text-decoration:none">Gästeansicht</a>
      <button class="btn ghost sm" id="logout">Abmelden</button>
    </header>
    <nav class="stabs">${tabs.map(([k, l]) =>
      `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${l}<span class="pill" id="pill-${k}"></span></button>`).join('')}</nav>
    <main class="wrap wide" id="s-main"></main>`;
  $$('[data-tab]').forEach((b) => b.onclick = () => {
    S.tab = b.dataset.tab;
    $$('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
    renderStaffMain();
  });
  $('#snd').onclick = (e) => {
    S.sound = !S.sound;
    e.target.textContent = S.sound ? '🔔 Ton an' : '🔕 Ton aus';
    if (S.sound) { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); beep(); }
  };
  $('#logout').onclick = async () => { stopOrders(); await signOut(auth); };
  updatePills();
  renderStaffMain();
}

function renderLogin() {
  app.innerHTML = `
    <div class="wrap"><div class="card login">
      <h2>🔒 Personalbereich</h2>
      <p class="muted" style="margin:0">Passwort eingeben, um Bestellungen und Verwaltung zu öffnen.</p>
      <input type="password" id="pw" placeholder="Passwort" autocomplete="current-password">
      <button class="btn big" id="go" style="margin-top:0">Anmelden</button>
      <a href="./" class="small muted">Zur Speisekarte</a>
    </div></div>`;
  const go = async () => {
    const pw = $('#pw').value;
    if (!pw) return;
    // Ton direkt beim Anmelden freischalten (Browser erlauben Ton nur nach einem Tipp)
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); S.sound = true; } catch { /* egal */ }
    $('#go').disabled = true;
    try {
      await signInWithEmailAndPassword(auth, STAFF_EMAIL, pw);
    } catch (e) {
      console.error(e);
      toast(e.code === 'auth/too-many-requests' ? 'Zu viele Versuche – kurz warten' : 'Passwort stimmt nicht');
      $('#go').disabled = false;
      $('#pw').select();
    }
  };
  $('#go').onclick = go;
  $('#pw').onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('#pw').focus();
}

function updatePills() {
  const p = $('#pill-orders');
  if (!p) return;
  const n = S.orders.filter((o) => o.status === 'neu').length;
  p.textContent = n ? n : '';
}

function renderStaffMain() {
  const main = $('#s-main');
  if (!main) return;
  if (S.tab === 'orders') return renderOrders(main);
  if (S.tab === 'items') return renderItems(main);
  if (S.tab === 'stats') return renderStats(main);
  if (S.tab === 'settings') return renderSettings(main);
}

/* ---------- Bestellungen ---------- */
function renderOrders(main) {
  const aktiv = S.orders.filter((o) => !ARCHIV.includes(o.status));
  let list = S.showArchiv ? S.orders.filter((o) => ARCHIV.includes(o.status)).reverse() : aktiv;
  if (S.filterTisch) list = list.filter((o) => String(o.tisch) === S.filterTisch);
  const tischOffen = S.filterTisch
    ? r2(aktiv.filter((o) => String(o.tisch) === S.filterTisch && !BEZAHLT.includes(o.status)).reduce((a, o) => a + o.summe, 0))
    : 0;

  main.innerHTML = `
    <div class="toolbar">
      <div class="counts">${['neu', 'bearbeitung', 'abgegeben', 'kassiert'].map((k) =>
        `<span class="st st-${k}">${statusLabel(k)}: ${aktiv.filter((o) => o.status === k).length}</span>`).join('')}</div>
      <input class="inp" id="ft" type="number" inputmode="numeric" placeholder="Tisch filtern" value="${esc(S.filterTisch)}">
      <button class="btn ghost sm" id="arch">${S.showArchiv ? 'Offene anzeigen' : 'Abgeschlossene anzeigen'}</button>
    </div>
    ${S.filterTisch ? `<p><b>Tisch ${esc(S.filterTisch)}</b> – noch nicht kassiert: <b>${euro(tischOffen)}</b>
      <button class="link" id="clearf">Filter löschen</button></p>` : ''}
    <div class="grid">${list.map(orderCard).join('') ||
      `<div class="empty">${S.showArchiv ? 'Noch nichts abgeschlossen.' : 'Keine offenen Bestellungen. Neue erscheinen hier automatisch.'}</div>`}</div>`;

  const ft = $('#ft');
  ft.onchange = () => { S.filterTisch = ft.value.trim(); renderStaffMain(); };
  ft.onkeydown = (e) => { if (e.key === 'Enter') ft.blur(); };
  $('#clearf') && ($('#clearf').onclick = () => { S.filterTisch = ''; renderStaffMain(); });
  $('#arch').onclick = () => { S.showArchiv = !S.showArchiv; renderStaffMain(); };

  $$('[data-st]', main).forEach((b) => b.onclick = async () => {
    const o = S.orders.find((x) => x.id === b.dataset.id);
    const st = b.dataset.st;
    if (!o || o.status === st) return;
    try {
      await updateDoc(doc(db, 'orders', o.id), { status: st, aktualisiert: serverTimestamp(), ['zeit_' + st]: serverTimestamp() });
      if (st === 'abgeschlossen') toast(`Bestellung #${o.nr} abgeschlossen`);
    } catch (e) { console.error(e); toast('Status konnte nicht gespeichert werden'); }
  });
  $$('[data-storno]', main).forEach((b) => b.onclick = async () => {
    const o = S.orders.find((x) => x.id === b.dataset.storno);
    if (!o || !confirm(`Bestellung #${o.nr} (Tisch ${o.tisch}) wirklich stornieren?`)) return;
    await updateDoc(doc(db, 'orders', o.id), { status: 'storniert', aktualisiert: serverTimestamp() });
    toast(`Bestellung #${o.nr} storniert`);
  });
  $$('[data-reopen]', main).forEach((b) => b.onclick = async () => {
    await updateDoc(doc(db, 'orders', b.dataset.reopen), { status: 'abgegeben', aktualisiert: serverTimestamp() });
    toast('Bestellung wieder geöffnet');
  });
}

function orderCard(o) {
  const t = toDate(o.erstellt);
  const min = t ? Math.floor((Date.now() - t) / 60000) : 0;
  const archiv = ARCHIV.includes(o.status);
  return `<article class="order s-${o.status}">
    <header>
      <span class="onr">#${o.nr}</span>
      <span class="otisch">Tisch ${esc(o.tisch)}</span>
      <span class="otime">${uhr(t)}${!archiv && min >= 1 ? ` · seit ${min} Min.` : ''}</span>
    </header>
    <ul>${(o.positionen || []).map((p) => `<li><b>${p.menge}×</b> ${esc(p.name)}
      ${p.optionen?.length ? `<div class="opts-l">${p.optionen.map((x) => esc(x.name)).join(', ')}</div>` : ''}</li>`).join('')}</ul>
    ${o.notiz ? `<div class="note">📝 ${esc(o.notiz)}</div>` : ''}
    <div class="osum">${euro(o.summe)}</div>
    ${archiv
      ? `<p class="muted small">${statusLabel(o.status)}</p><button class="btn ghost sm" data-reopen="${o.id}">Wieder öffnen</button>`
      : `<div class="stbtns">${STATUS.map((s) =>
          `<button data-st="${s.k}" data-id="${o.id}" class="b-${s.k} ${o.status === s.k ? 'on' : ''}">${o.status === s.k ? '✓ ' : ''}${s.l}</button>`).join('')}</div>
         <button class="link danger" data-storno="${o.id}">Stornieren</button>`}
  </article>`;
}

// Minutenanzeige aktuell halten
setInterval(() => { if (mode === 'staff' && S.tab === 'orders' && document.activeElement?.id !== 'ft') renderStaffMain(); }, 30000);

/* ---------- Artikel & Preise ---------- */
function renderItems(main) {
  const kats = alleKategorien();
  main.innerHTML = `
    <div class="toolbar"><h2>Artikel & Preise</h2><button class="btn" id="newItem">+ Neuer Artikel</button></div>
    <p class="muted small" style="margin-top:-.4rem">Mit dem Schalter markierst du einen Artikel als ausverkauft – Gäste sehen ihn dann ausgegraut.</p>
    ${!items.length ? `<div class="card empty">Noch keine Artikel angelegt.<br><br>
      <button class="btn" id="demo">Beispiel-Speisekarte anlegen</button>
      <p class="small">Danach kannst du alles ändern oder löschen.</p></div>` : ''}
    ${kats.map((k) => {
      const its = items.filter((i) => i.kategorie === k);
      if (!its.length) return '';
      return `<h3 class="kh">${esc(k)}</h3><div class="card list">${its.map((i) => `
        <div class="arow ${i.verfuegbar === false ? 'off' : ''}">
          <div class="grow"><strong>${esc(i.name)}</strong>
            ${i.optionen?.length ? `<div class="muted small">${i.optionen.map((o) => esc(o.name) + (o.aufpreis ? ` (+${euro(o.aufpreis)})` : '')).join(', ')}</div>` : ''}</div>
          <div class="price">${euro(i.preis)}</div>
          <label class="switch" title="verfügbar"><input type="checkbox" data-av="${i.id}" ${i.verfuegbar !== false ? 'checked' : ''} aria-label="${esc(i.name)} verfügbar"><span></span></label>
          <button class="btn ghost sm" data-edit="${i.id}">Bearbeiten</button>
        </div>`).join('')}</div>`;
    }).join('')}`;

  $('#newItem').onclick = () => editItem(null);
  $('#demo') && ($('#demo').onclick = demoMenue);
  $$('[data-edit]', main).forEach((b) => b.onclick = () => editItem(items.find((i) => i.id === b.dataset.edit)));
  $$('[data-av]', main).forEach((c) => c.onchange = () =>
    updateDoc(doc(db, 'items', c.dataset.av), { verfuegbar: c.checked })
      .then(() => toast(c.checked ? 'Wieder verfügbar' : 'Als ausverkauft markiert')));
}

function editItem(it) {
  const kats = alleKategorien();
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
    <h2>${it ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2>
    <label class="field"><span>Name</span><input id="e-name" value="${esc(it?.name)}" placeholder="z. B. Bratwurst im Brötchen"></label>
    <label class="field"><span>Kategorie</span><input id="e-kat" list="katlist" value="${esc(it?.kategorie || kats[0] || '')}" placeholder="z. B. Essen">
      <datalist id="katlist">${kats.map((k) => `<option value="${esc(k)}">`).join('')}</datalist></label>
    <label class="field"><span>Preis in €</span><input id="e-preis" inputmode="decimal" value="${it ? preisInput(it.preis) : ''}" placeholder="3,50"></label>
    <label class="field"><span>Beschreibung (optional)</span><input id="e-desc" value="${esc(it?.beschreibung)}" placeholder="z. B. 0,3 l"></label>
    <label class="field"><span>Auswahl-Extras (optional, eins pro Zeile)</span>
      <textarea id="e-opt" rows="4" placeholder="Senf&#10;Ketchup&#10;mit Zwiebeln | 0,50">${esc((it?.optionen || []).map((o) => o.name + (o.aufpreis ? ' | ' + preisInput(o.aufpreis) : '')).join('\n'))}</textarea>
      <span class="muted small">Aufpreis mit senkrechtem Strich: <b>Extra Käse | 0,80</b></span></label>
    <label class="field"><span>Reihenfolge (kleine Zahl = weiter oben)</span><input id="e-sort" type="number" value="${it?.sort ?? 10}"></label>
    <label class="swrow"><span class="switch"><input type="checkbox" id="e-av" ${it?.verfuegbar !== false ? 'checked' : ''}><span></span></span>Verfügbar</label>
    <div class="row">
      ${it ? '<button class="btn danger" data-del>Löschen</button>' : ''}
      <span class="grow"></span>
      <button class="btn ghost" data-close>Abbrechen</button>
      <button class="btn" data-save>Speichern</button>
    </div>
  </div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  $('[data-close]', m).onclick = close;
  $('#e-name', m).focus();

  $('[data-save]', m).onclick = async () => {
    const name = $('#e-name', m).value.trim();
    const kategorie = $('#e-kat', m).value.trim();
    if (!name) return toast('Bitte einen Namen eingeben');
    if (!kategorie) return toast('Bitte eine Kategorie eingeben');
    const data = {
      name, kategorie,
      preis: parsePreis($('#e-preis', m).value),
      beschreibung: $('#e-desc', m).value.trim(),
      optionen: $('#e-opt', m).value.split('\n').map((l) => {
        const [n, p] = l.split('|');
        return { name: (n || '').trim(), aufpreis: p ? parsePreis(p) : 0 };
      }).filter((o) => o.name),
      sort: Number($('#e-sort', m).value) || 0,
      verfuegbar: $('#e-av', m).checked,
    };
    try {
      if (it) await setDoc(doc(db, 'items', it.id), data);
      else await addDoc(collection(db, 'items'), data);
      if (!(settings?.kategorien || []).includes(kategorie)) {
        await updateDoc(doc(db, 'settings', 'main'), { kategorien: [...(settings?.kategorien || []), kategorie] });
      }
      close();
      toast('Gespeichert');
    } catch (e) { console.error(e); toast('Speichern hat nicht geklappt'); }
  };
  $('[data-del]', m) && ($('[data-del]', m).onclick = async () => {
    if (!confirm(`„${it.name}“ wirklich löschen?`)) return;
    await deleteDoc(doc(db, 'items', it.id));
    close();
    toast('Gelöscht');
  });
}

async function demoMenue() {
  const demo = [
    ['Getränke', 'Bier', 3.0, '0,3 l', []],
    ['Getränke', 'Weinschorle', 3.5, '0,25 l', ['süß', 'sauer']],
    ['Getränke', 'Cola', 2.5, '0,3 l', ['mit Eis']],
    ['Getränke', 'Wasser', 2.0, '0,3 l', ['still', 'sprudelnd']],
    ['Getränke', 'Sekt', 4.0, '0,1 l', []],
    ['Getränke', 'Kaffee', 2.0, '', ['mit Milch', 'mit Zucker']],
    ['Essen', 'Bratwurst im Brötchen', 3.5, '', ['Senf', 'Ketchup', 'mit Zwiebeln | 0,50']],
    ['Essen', 'Pommes', 3.0, '', ['Ketchup', 'Mayo', 'Rot-Weiß | 0,30']],
    ['Essen', 'Fleischkäsebrötchen', 3.5, '', ['Senf', 'süßer Senf']],
    ['Essen', 'Kreppel', 1.5, 'frisch gebacken', []],
  ];
  const batch = writeBatch(db);
  demo.forEach(([kategorie, name, preis, beschreibung, opts], idx) => {
    batch.set(doc(collection(db, 'items')), {
      kategorie, name, preis, beschreibung, sort: idx, verfuegbar: true,
      optionen: opts.map((o) => { const [n, p] = o.split('|'); return { name: n.trim(), aufpreis: p ? parsePreis(p) : 0 }; }),
    });
  });
  if (!settings) batch.set(doc(db, 'settings', 'main'), DEFAULT_SETTINGS);
  await batch.commit();
  toast('Beispiel-Speisekarte angelegt');
}

/* ---------- Umsatz ---------- */
function renderStats(main) {
  const gueltig = S.orders.filter((o) => o.status !== 'storniert');
  const bezahlt = gueltig.filter((o) => BEZAHLT.includes(o.status));
  const offen = gueltig.filter((o) => !BEZAHLT.includes(o.status));
  const sum = (l) => r2(l.reduce((a, o) => a + (o.summe || 0), 0));
  const storno = S.orders.length - gueltig.length;

  const proArtikel = {}, proKat = {}, proStunde = {};
  gueltig.forEach((o) => {
    (o.positionen || []).forEach((p) => {
      const betrag = r2((p.einzelpreis ?? p.preis) * p.menge);
      const a = (proArtikel[p.name] ||= { menge: 0, betrag: 0 });
      a.menge += p.menge; a.betrag = r2(a.betrag + betrag);
      const k = p.kategorie || 'Ohne Kategorie';
      proKat[k] = r2((proKat[k] || 0) + betrag);
    });
    const d = toDate(o.erstellt);
    if (d) {
      const h = `${String(d.getHours()).padStart(2, '0')}:00`;
      proStunde[h] = r2((proStunde[h] || 0) + (o.summe || 0));
    }
  });
  const artikel = Object.entries(proArtikel).sort((a, b) => b[1].betrag - a[1].betrag);
  const stunden = Object.entries(proStunde).sort();
  const maxH = Math.max(1, ...stunden.map(([, v]) => v));

  main.innerHTML = `
    <div class="toolbar"><h2>Umsatz</h2><button class="btn ghost sm" id="csv">Als Excel-Datei (CSV) herunterladen</button></div>
    <div class="kpis">
      <div class="kpi main">Kassiert<b>${euro(sum(bezahlt))}</b></div>
      <div class="kpi">Noch offen<b>${euro(sum(offen))}</b></div>
      <div class="kpi">Gesamt (kassiert + offen)<b>${euro(sum(gueltig))}</b></div>
      <div class="kpi">Bestellungen<b>${gueltig.length}</b><span class="muted small">${storno ? `${storno} storniert` : ''}</span></div>
      <div class="kpi">Ø pro Bestellung<b>${euro(gueltig.length ? sum(gueltig) / gueltig.length : 0)}</b></div>
    </div>
    <div class="two">
      <div class="sec card"><h3>Nach Artikel</h3>
        ${artikel.length ? `<table><thead><tr><th>Artikel</th><th class="r">Menge</th><th class="r">Betrag</th></tr></thead><tbody>
          ${artikel.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="r">${v.menge}</td><td class="r">${euro(v.betrag)}</td></tr>`).join('')}
        </tbody></table>` : '<p class="muted">Noch keine Bestellungen.</p>'}
      </div>
      <div>
        <div class="sec card"><h3>Nach Kategorie</h3>
          <table><tbody>${Object.entries(proKat).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${euro(v)}</td></tr>`).join('') || '<tr><td class="muted">–</td></tr>'}</tbody></table>
        </div>
        <div class="sec card"><h3>Nach Uhrzeit</h3>
          <table><tbody>${stunden.map(([h, v]) => `<tr><td style="width:4rem">${h}</td>
            <td><div class="bar" style="width:${Math.round((v / maxH) * 100)}%"></div></td><td class="r">${euro(v)}</td></tr>`).join('') || '<tr><td class="muted">–</td></tr>'}</tbody></table>
        </div>
      </div>
    </div>
    <p class="muted small">„Kassiert“ zählt alle Bestellungen mit Status Kassiert oder Abgeschlossen. Stornierte zählen nicht.</p>`;
  $('#csv').onclick = exportCsv;
}

function exportCsv() {
  const rows = [['Nr', 'Tisch', 'Datum', 'Uhrzeit', 'Status', 'Kategorie', 'Artikel', 'Extras', 'Menge', 'Einzelpreis', 'Betrag', 'Anmerkung']];
  S.orders.forEach((o) => {
    const d = toDate(o.erstellt);
    (o.positionen || []).forEach((p) => {
      const ep = p.einzelpreis ?? p.preis;
      rows.push([o.nr, o.tisch, d ? d.toLocaleDateString('de-DE') : '', uhr(d), statusLabel(o.status), p.kategorie || '',
        p.name, (p.optionen || []).map((x) => x.name).join(', '), p.menge, preisInput(ep), preisInput(r2(ep * p.menge)), o.notiz || '']);
    });
  });
  const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `Bestellungen_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- Einstellungen ---------- */
function renderSettings(main) {
  const s = settings || DEFAULT_SETTINGS;
  const basis = location.origin + location.pathname;
  main.innerHTML = `
    <div class="two">
      <div class="card">
        <h3>Allgemein</h3>
        <label class="field"><span>Vereinsname</span><input id="s-name" value="${esc(s.vereinName)}"></label>
        <label class="field"><span>Begrüßung für Gäste</span><input id="s-greet" value="${esc(s.begruessung)}"></label>
        <label class="field"><span>Kategorien (eine pro Zeile, in dieser Reihenfolge)</span>
          <textarea id="s-kat" rows="4">${esc((s.kategorien || []).join('\n'))}</textarea></label>
        <label class="swrow"><span class="switch"><input type="checkbox" id="s-open" ${s.bestellungenOffen !== false ? 'checked' : ''}><span></span></span>
          Gäste können bestellen</label>
        <button class="btn big" id="s-save">Einstellungen speichern</button>
      </div>

      <div class="card">
        <h3>QR-Codes für die Tische</h3>
        <p class="muted small">Ein QR-Code pro Tisch trägt die Tischnummer schon ein (Gäste können sie trotzdem ändern).
          Oder du nimmst einen QR-Code für alle Tische.</p>
        <div class="row" style="justify-content:flex-start">
          <label>Tisch von <input class="inp" id="q-von" type="number" value="1" style="width:5rem"></label>
          <label>bis <input class="inp" id="q-bis" type="number" value="20" style="width:5rem"></label>
        </div>
        <div class="row" style="justify-content:flex-start">
          <button class="btn" id="q-tische">Tisch-QR-Codes erzeugen</button>
          <button class="btn ghost" id="q-allg">Ein QR-Code für alle</button>
          <button class="btn ghost" id="q-print" disabled>Drucken</button>
        </div>
        <p class="small muted">Link zur Speisekarte: <a href="${esc(basis)}" target="_blank" rel="noopener">${esc(basis)}</a><br>
          Personalbereich: ${esc(basis)}#personal</p>
        <div class="qrgrid" id="qr"></div>
      </div>

      <div class="card">
        <h3>Passwort ändern</h3>
        <label class="field"><span>Neues Passwort (mind. 6 Zeichen)</span><input id="p-new" type="password" autocomplete="new-password"></label>
        <button class="btn" id="p-save" style="margin-top:.8rem">Passwort ändern</button>
        <p class="muted small">Danach müssen sich alle Geräte mit dem neuen Passwort anmelden.</p>
      </div>

      <div class="card">
        <h3>Veranstaltung beenden</h3>
        <p class="muted small">Löscht alle Bestellungen und setzt die Bestellnummer wieder auf 1. Lade vorher unter
          „Umsatz“ die Excel-Datei herunter – danach ist der Umsatz weg. Artikel und Preise bleiben erhalten.</p>
        <button class="btn danger" id="reset">Alle Bestellungen löschen</button>
      </div>
    </div>`;

  $('#s-save').onclick = async () => {
    const data = {
      vereinName: $('#s-name').value.trim() || DEFAULT_SETTINGS.vereinName,
      begruessung: $('#s-greet').value.trim(),
      kategorien: $('#s-kat').value.split('\n').map((x) => x.trim()).filter(Boolean),
      bestellungenOffen: $('#s-open').checked,
    };
    try { await setDoc(doc(db, 'settings', 'main'), data, { merge: true }); toast('Einstellungen gespeichert'); }
    catch (e) { console.error(e); toast('Speichern hat nicht geklappt'); }
  };

  const zeigeQr = (liste) => {
    const box = $('#qr'), pa = $('#print-area');
    box.innerHTML = ''; pa.innerHTML = '';
    if (typeof QRCode === 'undefined') { toast('QR-Bibliothek nicht geladen – Internet prüfen'); return; }
    liste.forEach(({ text, label }) => {
      [box, pa].forEach((ziel) => {
        const el = document.createElement('div');
        el.className = 'qrbox';
        const q = document.createElement('div');
        el.appendChild(q);
        new QRCode(q, { text, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
        el.insertAdjacentHTML('beforeend', `<b>${esc(label)}</b><small>Scannen & bestellen</small>`);
        ziel.appendChild(el);
      });
    });
    $('#q-print').disabled = false;
  };
  $('#q-tische').onclick = () => {
    const von = Math.max(1, parseInt($('#q-von').value, 10) || 1);
    const bis = Math.min(999, Math.max(von, parseInt($('#q-bis').value, 10) || von));
    if (bis - von > 150) return toast('Bitte höchstens 150 Tische auf einmal');
    const l = [];
    for (let t = von; t <= bis; t++) l.push({ text: `${basis}?tisch=${t}`, label: `Tisch ${t}` });
    zeigeQr(l);
  };
  $('#q-allg').onclick = () => zeigeQr([{ text: basis, label: settings?.vereinName || 'Bestellung' }]);
  $('#q-print').onclick = () => window.print();

  $('#p-save').onclick = async () => {
    const pw = $('#p-new').value;
    if (pw.length < 6) return toast('Mindestens 6 Zeichen');
    try { await updatePassword(auth.currentUser, pw); $('#p-new').value = ''; toast('Passwort geändert'); }
    catch (e) {
      console.error(e);
      toast(e.code === 'auth/requires-recent-login' ? 'Bitte ab- und wieder anmelden, dann nochmal versuchen' : 'Ändern hat nicht geklappt');
    }
  };

  $('#reset').onclick = async () => {
    const eingabe = prompt('Wirklich ALLE Bestellungen löschen? Zum Bestätigen LÖSCHEN eintippen:');
    if (eingabe !== 'LÖSCHEN') return;
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const b = writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      await setDoc(doc(db, 'counters', 'orders'), { value: 0 });
      toast(`${docs.length} Bestellungen gelöscht – Nummern starten wieder bei 1`);
    } catch (e) { console.error(e); toast('Löschen hat nicht geklappt'); }
  };
}

/* ============================================================
   Los geht's
   ============================================================ */
route();
