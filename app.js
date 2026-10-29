/* ===== HIER DEINE FIREBASE-DATEN EINTRAGEN (Anleitung Schritt 4) ===== */
const FIREBASE_CONFIG={apiKey:"AIzaSyBj4SAeWRIGt2H4xXRVqhyfmDU37Vc1rPA",authDomain:"fasnacht-bestellungen.firebaseapp.com",projectId:"fasnacht-bestellungen",appId:"1:489525283948:web:19ef3b6d791d84de881c49"};
/* Die zwei Login-Konten (Anleitung Schritt 3) – nur ändern, wenn du sie anders angelegt hast */
const MAIL={kueche:"kueche@verein.app",admin:"admin@verein.app",admin:info@lh-videografie.de};
/* ===================================================================== */
if(typeof firebase==='undefined'){document.body.insertAdjacentHTML('afterbegin','<p style="padding:14px"><b>Firebase konnte nicht geladen werden.</b> Internet pruefen, Adblocker ausschalten.</p>');throw new Error('Firebase fehlt')}
firebase.initializeApp(FIREBASE_CONFIG);
const fs=firebase.firestore(),auth=firebase.auth();
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur=n=>(n||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const ST=['Eingegangen','In Bearbeitung','Fertig','Kassiert','Abgeschlossen'];
const orderTotal=o=>o.items.reduce((s,i)=>s+i.q*i.price,0);
function fail(e){const d=document.createElement('div');d.className='card';d.style.borderColor='#b3261e';
  d.innerHTML='<b>Verbindungsfehler</b><br>'+(JSON.stringify(FIREBASE_CONFIG).includes('HIER_EINTRAGEN')?'In app.js stehen noch die Platzhalter HIER_EINTRAGEN.<br>':'')+esc(e.code||'')+' '+esc(e.message||e);
  const a=document.getElementById('app');if(a&&!a.querySelector('.card[data-err]')){d.dataset.err=1;a.prepend(d)}}
let S={club:'Fastnachtsverein',logo:''},menu=[],orders=[],PAGE='';
function head(){
  $('#hd').innerHTML=(S.logo?`<img src="${S.logo}" alt="Logo">`:`<div class="ph">Logo</div>`)+`<h1>${esc(S.club)}${PAGE?' – '+PAGE:''}</h1>`;
  document.title=S.club;
}
fs.doc('config/settings').onSnapshot(s=>{if(s.exists)S={...S,...s.data()};head()},fail);
function onMenu(cb){fs.doc('config/menu').onSnapshot(s=>{menu=s.exists?s.data().items:[];cb()},fail)}
function onOrders(cb){return fs.collection('orders').orderBy('nr').onSnapshot(s=>{orders=s.docs.map(d=>({id:d.id,...d.data()}));cb(s)},fail)}
/* Passwortschutz: role = 'kueche' oder 'admin' */
function guard(role,start){
  let started=false;
  auth.onAuthStateChanged(u=>{
    const ok=u&&(u.email==MAIL.admin||(role=='kueche'&&u.email==MAIL.kueche));
    if(ok){if(!started){started=true;start()}}
    else{started=false;$('#app').innerHTML=`<div class="card"><label for="pw">Passwort</label><input id="pw" type="password" onkeydown="if(event.key=='Enter')doLogin('${role}')"><p id="er" class="mut"></p><button class="pri" onclick="doLogin('${role}')">Anmelden</button></div>`}
  });
}
function doLogin(role){auth.signInWithEmailAndPassword(MAIL[role],$('#pw').value).catch(()=>$('#er').textContent='Falsches Passwort.')}
const logout=()=>auth.signOut();
head();
