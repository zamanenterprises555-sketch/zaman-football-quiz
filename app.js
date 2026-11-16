/* Zaman Football Quiz v1 - UI, rooms (Firebase RTDB: footballRooms/, footballChat/), Solo vs computer, calm field + sounds.
 * Match rules are in engine.js, questions in questions.js (same file as the cricket quiz, unchanged). */
(function () {
'use strict';
var firebaseConfig = {
  apiKey: "AIzaSyBKQQRIcz1eEsz-V0r8WYsOCXBjAsR6XNQ",
  authDomain: "zaman-6587f.firebaseapp.com",
  databaseURL: "https://zaman-6587f-default-rtdb.firebaseio.com",
  projectId: "zaman-6587f",
  storageBucket: "zaman-6587f.firebasestorage.app",
  messagingSenderId: "985807833692",
  appId: "1:985807833692:web:4d331bd0b2e8db0fcdb499"
};
var ACADEMY = 'https://zamanenterprises555-sketch.github.io/zaman-smartphone-repair-academy/';
var ROOMS = 'footballRooms/', CHAT = 'footballChat/';
var E = window.Engine, QS = (typeof questionSets !== 'undefined') ? questionSets : {};
var db = null;
try { if (window.firebase) { firebase.initializeApp(firebaseConfig); db = firebase.database(); var emu = null; try { emu = JSON.parse(localStorage.getItem('zfq_emu') || 'null'); } catch (e) {} if (emu && emu.h) db.useEmulator(emu.h, emu.p); } } catch (e) { db = null; } // zfq_emu: local rules testing only

var $ = function (s) { return document.querySelector(s); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
var QP = new URLSearchParams(location.search);
// test-only shorter match: ?test=1&q=4&pen=2 (never shown in the UI)
var DBG = QP.get('test') === '1' ? { dbg: 1, total: +QP.get('q') || 4, penN: +QP.get('pen') || 2 } : null;
var S = { room: null, me: null, solo: false, ref: null, code: null, offset: 0, chat: [], chatUnread: 0, chatOpen: false, panelKey: '', spokenK: null, sndSeq: null, tick: null, tryAt: {}, homeSet: null, bot: {} };
function chatLocked() { var g = S.room && S.room.g; return !!(S.room && S.room.status === 'playing' && g && g.phase === 'q'); }
window.ZFQ = { S: S, E: E, chatLocked: chatLocked, QS: QS };

function deviceId() { var id = LS.get('zfq_pid'); if (!id) { id = 'p' + Math.random().toString(36).slice(2, 10); LS.set('zfq_pid', id); } return id; }
function serverNow() { return Date.now() + (S.solo ? 0 : S.offset); }
function toast(msg, ok) { var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (ok ? ' ok' : ''); t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2800); }
function nm(id) { var p = S.room && S.room.players[id]; return p ? p.name : '—'; }
function tn(t) { return S.room && S.room.teams && S.room.teams[t] ? S.room.teams[t].name : 'ടീം ' + t; }
function voiceOn() { return LS.get('zfq_voice', true); }
function soundOn() { return LS.get('zfq_sound', true); }
function mlVoice() { try { return (speechSynthesis.getVoices() || []).filter(function (x) { return /^ml/i.test(x.lang); })[0] || null; } catch (e) { return null; } }
function speak(text) {
  try {
    if (!voiceOn() || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text); u.lang = 'ml-IN'; u.rate = 0.95;
    var v = mlVoice(); if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function speakQ(q) { if (!q) return; var n = ['ഒന്ന്', 'രണ്ട്', 'മൂന്ന്', 'നാല്', 'അഞ്ച്', 'ആറ്']; speak(q.q + '. ' + (q.o || []).map(function (o, i) { return (n[i] || (i + 1)) + ': ' + o; }).join('. ')); }
function hush() { try { speechSynthesis.cancel(); } catch (e) {} }

// ------------------------------------------------------------ pictures (ball, goal, trophy, field only — no people)
function ballSvg(w) {
  return '<svg class="ball" viewBox="0 0 40 40" width="' + (w || 24) + '" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="#fff" stroke="#1b1b1b" stroke-width="1.6"/>' +
    '<path d="M20 12.5 L27 17.6 L24.4 25.8 H15.6 L13 17.6Z" fill="#1b1b1b"/>' +
    '<path d="M20 12.5 V5 M27 17.6 L34.6 15 M24.4 25.8 L29.2 32.4 M15.6 25.8 L10.8 32.4 M13 17.6 L5.4 15" stroke="#1b1b1b" stroke-width="1.4"/>' +
    '<path d="M16 2.6 L20 5 L24 2.6Z M37.2 13 L34.6 15 L36 19.5Z M31.4 35 L29.2 32.4 L25 34.6Z M8.6 35 L10.8 32.4 L15 34.6Z M2.8 13 L5.4 15 L4 19.5Z" fill="#1b1b1b"/></svg>';
}
function trophySvg(w) {
  return '<svg viewBox="0 0 64 64" width="' + (w || 80) + '" aria-hidden="true"><path d="M18 8 H46 V22 Q46 36 32 38 Q18 36 18 22Z" fill="#f5b301" stroke="#8a6500" stroke-width="1.5"/>' +
    '<path d="M18 12 H8 Q8 26 20 28 M46 12 H56 Q56 26 44 28" fill="none" stroke="#f5b301" stroke-width="4"/>' +
    '<rect x="28" y="38" width="8" height="10" fill="#d79c00"/><rect x="20" y="48" width="24" height="8" rx="2" fill="#8a6500"/><path d="M26 14 L30 14 L28 30Z" fill="#fff6c8" opacity=".6"/></svg>';
}
function goalSvg(w) { return '<svg viewBox="0 0 60 36" width="' + (w || 60) + '" aria-hidden="true"><path d="M4 34 V4 H56 V34" fill="none" stroke="#fff" stroke-width="3"/><path d="M4 10 H56 M4 16 H56 M4 22 H56 M4 28 H56 M12 4 V34 M20 4 V34 M28 4 V34 M36 4 V34 M44 4 V34 M52 4 V34" stroke="rgba(255,255,255,.35)" stroke-width="1"/></svg>'; }
function coinSvg(face, w) {
  return '<svg viewBox="0 0 60 60" width="' + (w || 64) + '" aria-hidden="true"><circle cx="30" cy="30" r="27" fill="#f5b301" stroke="#8a6500" stroke-width="3"/><circle cx="30" cy="30" r="20" fill="none" stroke="#8a6500" stroke-width="1.5" stroke-dasharray="3 3"/>' +
    '<text x="30" y="38" text-anchor="middle" font-size="22" font-weight="800" fill="#5a4200" font-family="sans-serif">' + (face === 'H' ? 'H' : 'T') + '</text></svg>';
}
// calm field: two goals, centre line; the ball is drawn at a fixed spot (no movement animation)
function fieldSvg(room) {
  var g = room.g, x = E.ballPos(room), left = g.h2 ? 'B' : 'A', right = E.other(left);
  var bx = 8 + x * 2.84;
  return '<svg class="field" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">' +
    '<rect x="0" y="0" width="300" height="120" rx="10" fill="#1f7a3f"/>' +
    [0, 1, 2, 3, 4, 5].map(function (i) { return '<rect x="' + (i * 50) + '" y="0" width="25" height="120" fill="#23864a"/>'; }).join('') +
    '<rect x="6" y="6" width="288" height="108" fill="none" stroke="#e8f5e9" stroke-width="2"/><line x1="150" y1="6" x2="150" y2="114" stroke="#e8f5e9" stroke-width="2"/><circle cx="150" cy="60" r="18" fill="none" stroke="#e8f5e9" stroke-width="2"/>' +
    '<rect x="6" y="34" width="26" height="52" fill="none" stroke="#e8f5e9" stroke-width="2"/><rect x="268" y="34" width="26" height="52" fill="none" stroke="#e8f5e9" stroke-width="2"/>' +
    '<rect x="0" y="46" width="6" height="28" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="1.5"/><rect x="294" y="46" width="6" height="28" fill="rgba(255,255,255,.35)" stroke="#fff" stroke-width="1.5"/>' +
    '<text x="14" y="20" font-size="11" font-weight="700" fill="' + (left === 'A' ? '#bfdbfe' : '#fecaca') + '">' + esc(tn(left)) + '</text><text x="286" y="20" font-size="11" font-weight="700" text-anchor="end" fill="' + (right === 'A' ? '#bfdbfe' : '#fecaca') + '">' + esc(tn(right)) + '</text>' +
    '<g transform="translate(' + (bx - 9) + ',51)"><circle cx="9" cy="9" r="9" fill="#fff" stroke="#111" stroke-width="1"/><path d="M9 4.5 L13.2 7.6 L11.6 12.5 H6.4 L4.8 7.6Z" fill="#111"/></g></svg>';
}

// ------------------------------------------------------------ dispatch
function dispatch(a, silent) {
  a.by = a.by || (S.solo ? 'solo' : S.me); a.now = serverNow();
  if (S.solo) {
    var r = E.reduce(S.room, a, QS);
    if (r.error) { if (!silent) toast(r.error); return Promise.resolve(false); }
    S.room = r.room; LS.set('zfq_solo', S.room); render(); return Promise.resolve(true);
  }
  if (!S.ref) return Promise.resolve(false);
  var err = null; S.tx = (S.tx || 0) + 1;
  return S.ref.transaction(function (cur) {
    if (cur === null) return cur;
    a.now = serverNow(); // re-evaluated on every retry
    var r = E.reduce(E.normalize(cur), a, QS);
    if (r.error) { err = r.error; return; }
    err = null; return r.room;
  }).then(function () { S.tx--; if (err) { if (!silent && err !== 'wait') toast(err); return false; } return true; })
    .catch(function (e) { S.tx--; console.warn('tx', e && e.message); if (!silent) toast('ഇന്റർനെറ്റ് പ്രശ്നം. വീണ്ടും ശ്രമിക്കുക'); return false; });
}

// ------------------------------------------------------------ rooms
function genCode() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function myName() { var el = $('#nameIn'); var n = (el ? el.value : LS.get('zfq_name', '')).trim().slice(0, 20); if (n) LS.set('zfq_name', n); return n; }
function randTok() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
function sha(t) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }); }
function baseUrl() { return location.origin + location.pathname; }
function rejoinUrl() { var s = LS.get('zfq_session'); if (!s || !s.tok || S.solo) return ''; return baseUrl() + '?r=' + s.code + '&p=' + s.pid + '&k=' + s.tok; }
function firstPlayable() { var l = E.listSets(QS).filter(function (s) { return s.ok; }); return l.length ? l[0].name : null; }

function createRoom() {
  if (!db) return toast('ഇന്റർനെറ്റ് ഇല്ല. സോളോ കളിക്കാം');
  var name = myName(); if (!name) return toast('ആദ്യം നിങ്ങളുടെ പേര് നൽകുക');
  var code = genCode(), pid = deviceId(), tok = randTok();
  var ref = db.ref(ROOMS + code);
  Promise.all([ref.once('value'), sha(tok)]).then(function (res) {
    if (res[0].exists()) return createRoom();
    var room = E.newRoom({ code: code, pid: pid, name: name, now: serverNow(), th: res[1], set: S.homeSet || firstPlayable() });
    return ref.set(room).then(function () { connect(code, pid, name, tok); });
  }).catch(function (e) { console.warn(e); toast(/permission/i.test(e && e.message) ? 'മൾട്ടിപ്ലെയർ ഇപ്പോൾ തയ്യാറായിട്ടില്ല (Firebase നിയമം ഇടണം). സോളോ കളിക്കാം' : 'റൂം ഉണ്ടാക്കാൻ പറ്റിയില്ല'); });
}
function joinRoom(codeIn, spec) {
  if (!db) return toast('ഇന്റർനെറ്റ് ഇല്ല');
  var code = String(codeIn || ($('#codeIn') ? $('#codeIn').value : '')).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  var name = myName();
  if (!name) return toast('ആദ്യം നിങ്ങളുടെ പേര് നൽകുക');
  if (code.length !== 6) return toast('ശരിയായ 6 അക്ഷര റൂം കോഡ് നൽകുക');
  var pid = deviceId();
  db.ref(ROOMS + code).once('value').then(function (s) {
    if (!s.exists()) return toast('ഈ കോഡിൽ റൂം ഇല്ല');
    var ses = LS.get('zfq_session');
    var tok = (ses && ses.code === code && ses.pid === pid && ses.tok) ? ses.tok : randTok();
    connect(code, pid, name, tok, spec);
  }).catch(function (e) { toast(/permission/i.test(e && e.message) ? 'മൾട്ടിപ്ലെയർ ഇപ്പോൾ തയ്യാറായിട്ടില്ല' : 'ജോയിൻ ചെയ്യാൻ പറ്റിയില്ല'); });
}
function useRejoinLink(code, pid, k) {
  return Promise.all([db.ref(ROOMS + code).once('value'), sha(k)]).then(function (res) {
    var v = res[0].val(), p = v && v.players && v.players[pid];
    if (!p || !p.th || p.th !== res[1]) { toast('ഈ ലിങ്ക് ശരിയല്ല / റൂം ഇല്ല'); render(); return; }
    LS.set('zfq_pid', pid); connect(code, pid, p.name, k);
  }).catch(function () { toast('ലിങ്ക് തുറക്കാൻ പറ്റിയില്ല'); render(); });
}
function connect(code, pid, name, tok, spec) {
  disconnect();
  S.solo = false; S.code = code; S.me = pid; S.spokenK = null; S.sndSeq = null; S.panelKey = ''; S.tryAt = {};
  LS.set('zfq_session', { code: code, pid: pid, name: name, left: false, tok: tok });
  S.ref = db.ref(ROOMS + code);
  var onl = S.ref.child('players/' + pid + '/online'), ref = S.ref, joined = false, th = null, first = false;
  sha(tok).then(function (h) { th = h; tryJoin(); });
  db.ref('.info/serverTimeOffset').on('value', function (s) { S.offset = s.val() || 0; });
  function tryJoin() {
    if (joined || !first || !th || ref !== S.ref) return;
    joined = true;
    dispatch({ type: 'join', pid: pid, name: name, th: th, spec: !!spec });
    db.ref('.info/connected').on('value', function (s) {
      if (s.val() === true && ref === S.ref) { onl.onDisconnect().set(false); dispatch({ type: 'join', pid: pid, name: name, th: th }, true); }
    });
  }
  ref.on('value', function (snap) {
    if (ref !== S.ref) return;
    var v = snap.val();
    if (!v) {
      if (S.tx > 0) return;
      ref.get().then(function (s2) { if (s2.exists() || ref !== S.ref) return; toast('റൂം ഇല്ലാതായി'); LS.del('zfq_session'); disconnect(); S.room = null; render(); }).catch(function () {});
      return;
    }
    if (!first) { first = true; tryJoin(); }
    if (!v.players || !v.players[pid] || !v.players[pid].name) return;
    S.room = E.normalize(v); render();
  }, function (e) { toast('റൂം തുറക്കാൻ പറ്റിയില്ല'); console.warn(e); });
  chatStart(code);
}
function disconnect() {
  if (S.ref) { S.ref.off(); try { S.ref.child('players/' + S.me + '/online').onDisconnect().cancel(); S.ref.child('players/' + S.me + '/online').set(false); } catch (e) {} }
  if (db) { db.ref('.info/connected').off(); db.ref('.info/serverTimeOffset').off(); }
  chatStop(); S.ref = null;
}
function leave() {
  hush();
  if (S.solo) { S.room = null; S.solo = false; LS.del('zfq_solo'); render(); return; }
  var ses = LS.get('zfq_session'); if (ses) { ses.left = true; LS.set('zfq_session', ses); }
  disconnect(); S.room = null; render();
}
// delete football rooms (and their chat) older than 24 hours
function cleanupOld() {
  if (!db) return;
  db.ref('.info/serverTimeOffset').once('value').then(function (s) {
    var cutoff = Date.now() + (s.val() || 0) - 864e5 - 120000;
    return db.ref('footballRooms').orderByChild('createdAt').endAt(cutoff).limitToFirst(25).once('value');
  }).then(function (snap) {
    snap.forEach(function (c) { if (c.key === S.code) return; c.ref.remove().then(function () { return db.ref(CHAT + c.key).remove(); }).catch(function () {}); });
  }).catch(function (e) { console.warn('cleanup', e && e.message); });
}

// ------------------------------------------------------------ chat (free text, locked while a question is live)
function chatStart(code) {
  chatStop();
  S.chat = []; S.chatUnread = 0; S.chatSeen = LS.get('zfq_chatseen_' + code, 0);
  S.chatRef = db.ref(CHAT + code); S.chatQ = S.chatRef.limitToLast(100);
  S.chatQ.on('child_added', function (s) {
    var m = s.val(); if (!m || typeof m.text !== 'string') return;
    m.key = s.key; S.chat.push(m); if (S.chat.length > 100) S.chat.shift();
    if (S.chatOpen) { S.chatSeen = Math.max(S.chatSeen, m.ts || 0); LS.set('zfq_chatseen_' + code, S.chatSeen); }
    else if (m.pid !== S.me && (m.ts || 0) > S.chatSeen) S.chatUnread++;
    renderChat(true);
  }, function () {});
  S.chatQ.on('child_removed', function (s) { S.chat = S.chat.filter(function (m) { return m.key !== s.key; }); renderChat(true); });
}
function chatStop() { if (S.chatQ) S.chatQ.off(); S.chatQ = null; S.chatRef = null; S.chat = []; S.chatUnread = 0; S.chatOpen = false; var b = $('#chat'); if (b) { b.innerHTML = ''; b.hidden = true; } }
function chatSend() {
  var el = $('#chatIn'); if (!el || !S.chatRef || !S.room) return;
  if (chatLocked()) { toast('ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു'); return; }
  var text = el.value.replace(/\s+/g, ' ').trim().slice(0, 300); if (!text) return;
  if (S.chatBusy) return; S.chatBusy = true; setTimeout(function () { S.chatBusy = false; }, 800);
  var p = S.room.players[S.me] || {}, t = E.teamOf(S.room, S.me), tm = t ? tn(t) : 'കാണി';
  el.value = ''; updateChatCount();
  var ref = S.chatRef;
  ref.push({ pid: S.me, name: String(p.name || '').slice(0, 24), tm: String(tm).slice(0, 30), text: text, ts: firebase.database.ServerValue.TIMESTAMP }).then(function () {
    if (S.chat.length >= 100) { var oldest = S.chat[0].key; ref.orderByKey().endAt(oldest).once('value').then(function (s) { s.forEach(function (c) { if (c.key !== oldest) c.ref.remove(); }); }); }
  }).catch(function () { toast(chatLocked() ? 'ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു' : 'മെസേജ് അയക്കാൻ പറ്റിയില്ല'); });
}
function updateChatCount() { var el = $('#chatIn'), c = $('#chatCount'); if (el && c) c.textContent = el.value.length + '/300'; }
function applyChatLock() {
  var locked = chatLocked(), form = document.querySelector('.chatform'), inp = $('#chatIn'), btn = document.querySelector('.chatform [data-act=chatSend]'), note = $('#chatLockNote');
  if (form) form.classList.toggle('locked', locked);
  if (inp) { inp.disabled = locked; inp.placeholder = locked ? 'ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു' : 'മെസേജ് എഴുതുക…'; }
  if (btn) btn.disabled = locked;
  if (note) note.hidden = !locked;
}
function renderChat(fromData) {
  var box = $('#chat'), btn = $('#chatBtn');
  var inRoom = !!(S.room && !S.solo && S.chatRef);
  if (btn) { btn.hidden = !inRoom; var b = $('#chatBadge'); if (b) { b.textContent = S.chatUnread > 9 ? '9+' : String(S.chatUnread); b.hidden = !S.chatUnread || S.chatOpen; } }
  if (!box) return;
  if (!inRoom || !S.chatOpen) { box.hidden = true; return; }
  box.hidden = false;
  var list = $('#chatList');
  if (!list) {
    box.innerHTML = '<div class="chathead"><b>💬 റൂം ചാറ്റ്</b><span class="small">എല്ലാവർക്കും കാണാം</span><button class="btn sec sm" data-act="chatToggle">അടയ്ക്കുക</button></div>' +
      '<div id="chatList" class="chatlist"></div><div class="chatform"><input id="chatIn" maxlength="300" placeholder="മെസേജ് എഴുതുക…" autocomplete="off"><button class="btn sm" data-act="chatSend">അയക്കുക</button></div>' +
      '<div class="chatlock" id="chatLockNote" hidden>🔒 ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കുന്നു</div><div class="small" id="chatCount" style="text-align:right">0/300</div>';
    list = $('#chatList');
  }
  applyChatLock();
  var atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  list.innerHTML = S.chat.length ? S.chat.map(function (m) {
    return '<div class="msg' + (m.pid === S.me ? ' mine' : '') + '"><div class="who">' + esc(m.name) + ' <span>· ' + esc(m.tm || '') + '</span></div><div class="tx">' + esc(m.text) + '</div></div>';
  }).join('') : '<div class="small" style="text-align:center;padding:10px">ഇതുവരെ മെസേജ് ഇല്ല</div>';
  if (atBottom || !fromData) list.scrollTop = list.scrollHeight;
}
function chatToggle() {
  S.chatOpen = !S.chatOpen;
  if (S.chatOpen) { S.chatUnread = 0; S.chat.forEach(function (m) { S.chatSeen = Math.max(S.chatSeen, m.ts || 0); }); LS.set('zfq_chatseen_' + S.code, S.chatSeen); }
  else $('#chat').innerHTML = '';
  renderChat(false);
}

// ------------------------------------------------------------ solo (you + computer teammates vs computer team)
function startSolo() {
  var name = myName() || 'ഞാൻ';
  var k = Math.min(5, Math.max(1, +(($('#soloSize') || {}).value || 3)));
  var set = S.homeSet || firstPlayable();
  if (!E.setPlayable(QS, set)) return toast('കളിക്കാൻ പറ്റുന്ന സെറ്റ് തിരഞ്ഞെടുക്കുക');
  LS.set('zfq_size', k);
  var t = Date.now(), me = deviceId();
  var room = E.newRoom({ code: 'SOLO', pid: me, name: name, now: t, solo: true, set: set });
  room.teams.A.name = 'എന്റെ ടീം'; room.teams.B.name = 'കമ്പ്യൂട്ടർ';
  var names = ['റോക്കറ്റ്', 'തണ്ടർ', 'സ്റ്റാർ', 'ഫ്ലാഷ്', 'സ്റ്റോം', 'ടൈഗർ ക്ലബ്', 'ഈഗിൾ', 'ബുള്ളറ്റ്', 'ലൈറ്റ്നിങ്', 'കോമറ്റ്'];
  for (var i = 1; i < k; i++) room.players['ma' + i] = { name: names[i - 1] + ' (കൂട്ടുകാരൻ)', team: 'A', bot: true, skill: 0.62, online: true, joinedAt: t + i };
  for (var j = 1; j <= k; j++) room.players['cb' + j] = { name: 'CPU ' + j, team: 'B', bot: true, skill: 0.5, online: true, joinedAt: t + 20 + j };
  room.teams.B.captain = 'cb1';
  disconnect(); S.solo = true; S.me = me; S.code = 'SOLO'; S.room = room; S.spokenK = null; S.sndSeq = null; S.panelKey = ''; S.tryAt = {}; S.bot = {};
  dispatch({ type: 'toss', coin: Math.random() });
  var st = { type: 'start', seed: (Math.random() * 4294967295) >>> 0 }; if (DBG) for (var x in DBG) st[x] = DBG[x];
  dispatch(st);
}
function resumeSolo() { var r = LS.get('zfq_solo'); if (!r) return; disconnect(); S.solo = true; S.me = deviceId(); S.code = 'SOLO'; S.room = E.normalize(r); S.panelKey = ''; S.tryAt = {}; S.bot = {}; render(); }
// computer player holding the ball: think 2–6 s, then answer, pass or give up
function botTurn(now) {
  var r = S.room, g = r.g, p = r.players[g.h];
  if (!p || !p.bot || now < g.startAt) return;
  var key = g.k + ':' + g.seq;
  if (!S.bot[key]) {
    var x = E.curQ(r, QS).q, mates = g.order[g.ct].filter(function (id) { return id !== g.h && !g.tried[id]; });
    var knows = Math.random() < (p.skill || 0.55), plan;
    if (E.inPen(g)) plan = { type: 'answer', i: knows ? x.a : (x.a + 1 + Math.floor(Math.random() * 3)) % 4 };
    else if (knows) plan = { type: 'answer', i: x.a };
    else if (mates.length) { var human = mates.filter(function (id) { return !r.players[id].bot; }); plan = { type: 'pass', to: (human.length && Math.random() < 0.6) ? human[0] : mates[Math.floor(Math.random() * mates.length)] }; }
    else plan = Math.random() < 0.5 ? { type: 'giveup' } : { type: 'answer', i: (x.a + 1 + Math.floor(Math.random() * 3)) % 4 };
    var minAt = Math.max(g.startAt, g.dl - E.HOLD_MS);
    S.bot = {}; S.bot[key] = { at: minAt + 1800 + Math.random() * 4000, plan: plan, pid: g.h };
  }
  var b = S.bot[key];
  if (now >= b.at && !b.done) { b.done = 1; b.plan.pid = b.pid; dispatch(b.plan, true); }
}

// ------------------------------------------------------------ playing
function isHolder() { var g = S.room && S.room.g; return !!(g && g.phase === 'q' && g.h === S.me); }
function canAct(now) { var g = S.room.g; if (now < g.startAt) return false; var last = g.ch[g.ch.length - 1]; if (last && last.k === 'sw' && now < g.dl - E.HOLD_MS) return false; return true; }
function answer(i) {
  if (!isHolder() || !canAct(serverNow())) return;
  hush(); S.mySel = { k: S.room.g.k, i: i }; dispatch({ type: 'answer', i: i, pid: S.me });
}
function pass(to) { if (!isHolder() || !canAct(serverNow())) return; hush(); dispatch({ type: 'pass', to: to, pid: S.me }); }
function giveup() { if (!isHolder() || !canAct(serverNow())) return; hush(); dispatch({ type: 'giveup', pid: S.me }); }
// any phone may move the game on when a deadline passes (host first, others a bit later) so a dropped phone never blocks the match
function tryStep(kind, extra) {
  var r = S.room, g = r.g, key = kind + ':' + g.seq + ':' + g.k, t = Date.now();
  var delay = 0;
  if (!S.solo && !E.isAdmin(r, S.me)) { var ids = Object.keys(r.players).sort(), on = ids.indexOf(S.me); delay = 1000 + Math.max(0, on) * 300; }
  if (!S.tryAt[key]) S.tryAt[key] = t + delay;
  if (t < S.tryAt[key]) return;
  S.tryAt[key] = t + 2500;
  var a = { type: kind }; if (extra) for (var k in extra) a[k] = extra[k];
  dispatch(a, true);
}
function tick() {
  var r = S.room; if (!r || r.status !== 'playing' || !r.g) return;
  var g = r.g, now = serverNow();
  if (g.phase === 'kick' || g.phase === 'half') {
    var el = $('#cdN'); if (el) el.textContent = Math.max(0, Math.ceil((g.at - now) / 1000));
    if (now >= g.at) tryStep('go');
  } else if (g.phase === 'q') {
    var reading = now < g.startAt, sw = !canAct(now) && !reading, key = g.seq + ':' + reading + ':' + sw;
    if (key !== S.qKey) { S.qKey = key; renderGame(); return; }
    if (reading) { var rn = $('#readN'); if (rn) rn.textContent = Math.max(1, Math.ceil((g.startAt - now) / 1000)); }
    else {
      var rem = Math.max(0, (g.dl - now) / 1000), n = $('#tnum'); if (n) n.textContent = Math.ceil(rem);
      var arc = $('#tarc'); if (arc) { var f = Math.max(0, Math.min(1, rem / 10)); arc.setAttribute('stroke-dashoffset', String(176 * (1 - f))); arc.setAttribute('stroke', f > 0.5 ? '#19b46b' : f > 0.25 ? '#f5b301' : '#e5484d'); }
      var w = $('#selfWarn'); if (w) w.hidden = !(rem <= 4 && isHolder());
    }
    if (S.solo) botTurn(now);
    if (now >= g.dl + E.GRACE_MS) tryStep('timeout');
  } else if (g.phase === 'rev') {
    var rn2 = $('#nextN'); if (rn2) rn2.textContent = Math.max(0, Math.ceil((g.revEnd - now) / 1000));
    if (now >= g.revEnd) tryStep('next');
  }
}

// ------------------------------------------------------------ sounds (Web Audio, made in code, no files)
var AC = null;
function audio() {
  if (!AC) { try { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } catch (e) { AC = null; } }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
  return AC;
}
function noiseBuf(ac, sec) { var b = ac.createBuffer(1, Math.floor(ac.sampleRate * sec), ac.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function sfx(kind) {
  (window.ZFQ.sfxLog = window.ZFQ.sfxLog || []).push(kind + '@' + (S.room && S.room.g ? S.room.g.phase : '-'));
  if (!soundOn()) return; var ac = audio(); if (!ac) return;
  try {
    var t = ac.currentTime + 0.02, out = ac.createGain(); out.gain.value = 0.3; out.connect(ac.destination);
    if (kind === 'whistle' || kind === 'longWhistle') { // referee whistle: high tone with a fast trill
      var len = kind === 'longWhistle' ? 1.1 : 0.45, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 32; lg.gain.value = 180; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03); g.gain.setValueAtTime(0.5, t + len - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + len + 0.02); lfo.stop(t + len + 0.02);
    } else if (kind === 'goal') { // crowd-like roar + two horn notes
      var n = ac.createBufferSource(), bp = ac.createBiquadFilter(), g2 = ac.createGain(); n.buffer = noiseBuf(ac, 1.6);
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
      g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.6, t + 0.25); g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      n.connect(bp); bp.connect(g2); g2.connect(out); n.start(t); n.stop(t + 1.6);
      [[523, 0], [784, 0.18]].forEach(function (x) { var o2 = ac.createOscillator(), g3 = ac.createGain(); o2.type = 'square'; o2.frequency.value = x[0]; g3.gain.setValueAtTime(0.0001, t + x[1]); g3.gain.exponentialRampToValueAtTime(0.25, t + x[1] + 0.02); g3.gain.exponentialRampToValueAtTime(0.0001, t + x[1] + 0.35); o2.connect(g3); g3.connect(out); o2.start(t + x[1]); o2.stop(t + x[1] + 0.4); });
    } else if (kind === 'low') { // self goal / miss / no goal
      var o3 = ac.createOscillator(), g4 = ac.createGain(); o3.type = 'triangle'; o3.frequency.setValueAtTime(330, t); o3.frequency.exponentialRampToValueAtTime(140, t + 0.6);
      g4.gain.setValueAtTime(0.0001, t); g4.gain.exponentialRampToValueAtTime(0.5, t + 0.03); g4.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o3.connect(g4); g4.connect(out); o3.start(t); o3.stop(t + 0.75);
    } else if (kind === 'ping') { // the ball came to you
      [0, 0.12].forEach(function (d) { var o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 988; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.1); o.connect(g); g.connect(out); o.start(t + d); o.stop(t + d + 0.12); });
    }
  } catch (e) {}
}
function sounds() {
  var g = S.room && S.room.g; if (!g) return;
  var key = g.seq + ':' + g.phase; if (S.sndSeq === key) return;
  var firstSeen = S.sndSeq === null; S.sndSeq = key;
  if (firstSeen) return; // no sounds for the state we found when (re)joining
  if (g.phase === 'q' && g.h === S.me) sfx('ping');
  else if (g.phase === 'q' && !g.ch.length) sfx('whistle');
  else if (g.phase === 'rev' && g.res) sfx(g.res.k === 'goal' || g.res.k === 'pgoal' ? 'goal' : 'low');
  else if (g.phase === 'half' || g.phase === 'done') sfx('longWhistle');
}

// ------------------------------------------------------------ render
function show(id) { ['home', 'lobby', 'game', 'result'].forEach(function (x) { $('#' + x).hidden = x !== id; }); }
function render() {
  document.body.classList.toggle('inroom', !!S.room);
  renderTop();
  var r = S.room;
  if (!r) { show('home'); renderHome(); renderChat(); return; }
  if (r.status === 'lobby') { show('lobby'); renderLobby(); }
  else if (r.status === 'playing') { show('game'); renderGame(); }
  else { show('result'); renderResult(); sounds(); }
  renderChat();
}
function renderTop() {
  var r = S.room, h = '';
  h += '<button class="chip" data-act="sound" title="ശബ്ദം">' + (soundOn() ? '🔊' : '🔇') + '</button><button class="chip' + (voiceOn() ? '' : ' off') + '" data-act="voice" title="ചോദ്യം വായിക്കൽ">📢</button>';
  if (r && !S.solo) h += '<span class="chip gold">' + esc(r.code) + '</span><button class="chip" id="chatBtn" data-act="chatToggle">💬<b id="chatBadge" class="badge" hidden>0</b></button>';
  if (r && S.solo) h += '<span class="chip green">സോളോ</span>';
  $('#topRight').innerHTML = h;
}
function setPicker(selected, canPick, act) {
  return '<div class="sets">' + E.listSets(QS).filter(function (s) { return s.ok; }).map(function (s) {
    var on = s.name === selected;
    return '<button class="setbtn' + (on ? ' sel' : '') + '"' + (canPick ? ' data-act="' + act + '" data-set="' + esc(s.name) + '"' : ' disabled') + '><b>' + (on ? '✓ ' : '') + esc(s.label) + '</b><small>' + s.count + ' ചോദ്യം</small></button>';
  }).join('') + '</div>';
}
function rulesHtml(open) {
  return '<details class="card rules"' + (open ? ' open' : '') + '><summary><b>⚽ കളിക്കുന്ന വിധം</b></summary><ul>' +
    '<li>രണ്ട് ടീം (A, B). ഓരോ ടീമിലും 11 പേർ വരെ. ബാക്കിയുള്ളവർക്ക് കാണിയായി കാണാം.</li>' +
    '<li>ടോസ് ജയിക്കുന്ന ടീം ആദ്യം കിക്ക് ഓഫ് ചെയ്യും. പിന്നെ ഓരോ ചോദ്യത്തിനും രണ്ട് ടീമും മാറി മാറി തുടങ്ങും. ടീമിൽ ഓരോ തവണയും വേറെ ആളായിരിക്കും തുടങ്ങുക.</li>' +
    '<li>ഒരു കളിയിൽ 30 ചോദ്യം (ഓപ്ഷൻ ചോദ്യങ്ങൾ). ചോദ്യങ്ങൾ തനിയെ വരും, ഒരേ ചോദ്യം വീണ്ടും വരില്ല. 15 ചോദ്യം കഴിഞ്ഞാൽ ഹാഫ് ടൈം, സൈഡ് മാറും.</li>' +
    '<li>ചോദ്യം വന്നാൽ 3 സെക്കൻഡ് വായിക്കാൻ. പിന്നെ പന്ത് കയ്യിലുള്ളയാൾക്ക് 10 സെക്കൻഡ്.</li>' +
    '<li>✅ ശരിയുത്തരം = ആ ടീമിന് ഗോൾ.</li>' +
    '<li>➡️ അറിയില്ലെങ്കിൽ 10 സെക്കൻഡിനുള്ളിൽ ടീമിലെ ഒരാൾക്ക് പാസ് ചെയ്യുക. ഈ ചോദ്യം കിട്ടിക്കഴിഞ്ഞവർക്ക് വീണ്ടും പാസ് ചെയ്യാൻ പറ്റില്ല.</li>' +
    '<li>❌ തെറ്റിയാൽ പന്ത് തനിയെ ടീമിലെ അടുത്തയാൾക്ക് പോകും.</li>' +
    '<li>⚠️ 10 സെക്കൻഡ് കഴിഞ്ഞിട്ടും ഉത്തരമോ പാസോ ഇല്ലെങ്കിൽ <b>സെൽഫ് ഗോൾ</b> (എതിർ ടീമിന് ഗോൾ).</li>' +
    '<li>ടീമിലെ ആർക്കും അറിയില്ലെങ്കിൽ പന്ത് എതിർ ടീമിന്. അവർക്കും അറിയില്ലെങ്കിൽ ഗോൾ ഇല്ല.</li>' +
    '<li>ഓരോ ചോദ്യത്തിനു ശേഷവും ശരിയുത്തരം എല്ലാവർക്കും കാണിക്കും.</li>' +
    '<li>30 ചോദ്യം കഴിഞ്ഞ് സമനിലയായാൽ 5 പെനാൽറ്റി (ഓരോ ടീമിനും ഒരാൾ, ഒരു ചോദ്യം, പാസ് ഇല്ല). അതിലും സമനിലയായാൽ സഡൻ ഡെത്ത്.</li>' +
    '<li>💬 ചോദ്യം നടക്കുമ്പോൾ ചാറ്റ് പൂട്ടിയിരിക്കും.</li></ul></details>';
}
function academyAd() {
  return '<div class="card ad"><div class="adh">📱 Zaman Smartphone Repair Academy</div><p>വളാഞ്ചേരി · മൊബൈൽ ഫോൺ റിപ്പയറിങ് പഠിക്കാം. ഇപ്പോൾ തന്നെ ചേരൂ.</p>' +
    '<a class="btn gold academy" href="' + ACADEMY + '" target="_blank" rel="noopener">🎓 അക്കാദമിയെ കുറിച്ച് അറിയുക</a></div>';
}
function pickHomeSet(name) {
  if (!E.setPlayable(QS, name)) return;
  S.homeSet = name; LS.set('zfq_set', name);
  var bs = document.querySelectorAll('#home .setbtn');
  for (var i = 0; i < bs.length; i++) { var on = bs[i].dataset.set === name; bs[i].classList.toggle('sel', on); bs[i].querySelector('b').textContent = (on ? '✓ ' : '') + E.setLabel(bs[i].dataset.set); }
  var n = $('#soloSetNow'); if (n) n.textContent = E.setLabel(name);
  toast('സെറ്റ്: ' + E.setLabel(name), true);
}
function renderHome() {
  var ses = LS.get('zfq_session'), solo = LS.get('zfq_solo'), name = LS.get('zfq_name', '');
  var pre = QP.get('room') || '';
  if (!S.homeSet) S.homeSet = LS.get('zfq_set', null);
  if (!S.homeSet || !E.setPlayable(QS, S.homeSet)) S.homeSet = firstPlayable();
  var sz = LS.get('zfq_size', 3);
  var h = '<div class="hero"><div class="heroArt">' + goalSvg(110) + '<span class="heroBall">' + ballSvg(46) + '</span></div><h1>ZAMAN <span>FOOTBALL QUIZ</span></h1><p>ടീമായി കളിക്കുന്ന ഫുട്ബോൾ ക്വിസ് ⚽ · Zaman Smartphone Repair Academy</p></div>';
  if (ses && ses.code && db) h += '<div class="card rejoin"><b>🔁 നിങ്ങളുടെ റൂം: ' + esc(ses.code) + '</b><button class="btn" data-act="rejoin">തിരികെ കളിയിലേക്ക്</button><button class="btn sec sm" data-act="forget" style="margin-top:8px">മറക്കുക</button></div>';
  if (solo && solo.status === 'playing') h += '<div class="card rejoin"><b>🔁 സോളോ കളി പാതിയിലാണ്</b><button class="btn" data-act="resumeSolo">സോളോ തുടരുക</button></div>';
  h += '<div class="card"><label class="lbl">നിങ്ങളുടെ പേര്</label><input id="nameIn" maxlength="20" placeholder="ഉദാ: അൻവർ" value="' + esc(name) + '">' +
    '<button class="btn" data-act="create">⚽ പുതിയ റൂം ഉണ്ടാക്കുക</button>' +
    '<div class="or">അല്ലെങ്കിൽ</div><label class="lbl">റൂം കോഡ്</label><div class="row"><input id="codeIn" maxlength="6" placeholder="ABC123" value="' + esc(pre) + '" style="text-transform:uppercase"><button class="btn blue" data-act="join" style="margin:0;flex:none;width:auto">ജോയിൻ</button></div>' +
    '<button class="btn sec sm" data-act="joinSpec" style="margin-top:8px">📺 കാണിയായി മാത്രം ജോയിൻ</button></div>';
  h += '<div class="card"><h3>🎮 സോളോ (കമ്പ്യൂട്ടറിനെതിരെ)</h3><p class="mut">നിങ്ങളും കമ്പ്യൂട്ടർ കൂട്ടുകാരും ഒരു ടീം, എതിരെ കമ്പ്യൂട്ടർ ടീം. എല്ലാ നിയമങ്ങളും ഉണ്ട്.</p>' +
    '<label class="lbl">ഓരോ ടീമിലും എത്ര പേർ</label><select id="soloSize">' + [1, 2, 3, 4, 5].map(function (i) { return '<option value="' + i + '"' + (i === sz ? ' selected' : '') + '>' + i + (i === 1 ? ' (ഞാൻ മാത്രം)' : ' (ഞാനും ' + (i - 1) + ' കൂട്ടുകാരും)') + '</option>'; }).join('') + '</select>' +
    '<label class="lbl">ചോദ്യ സെറ്റ് (തൊട്ട് തിരഞ്ഞെടുക്കുക)</label>' + setPicker(S.homeSet, true, 'homeSet') + '<p class="small">തിരഞ്ഞെടുത്ത സെറ്റ്: <b id="soloSetNow">' + esc(E.setLabel(S.homeSet || '')) + '</b></p>' +
    '<button class="btn gold" data-act="solo">സോളോ കളി തുടങ്ങുക</button></div>';
  if (!mlVoice()) h += '<p class="small" id="voiceNote">📢 ഈ ഫോണിൽ മലയാളം ശബ്ദം ഇല്ലെങ്കിൽ ചോദ്യം വായിക്കില്ല (Settings → Text-to-speech-ൽ മലയാളം ചേർക്കാം).</p>';
  h += rulesHtml(false) + academyAd() + '<p class="small foot">© Zaman Enterprises, Valanchery · ചോദ്യങ്ങൾ: Zaman Cricket Quiz</p>';
  $('#home').innerHTML = h;
}
function dot(id) { return '<i class="on ' + (E.online(S.room, id) ? 'y' : 'n') + '"></i>'; }
function teamBox(r, t, admin) {
  var ids = E.teamIds(r, t), mine = E.teamOf(r, S.me) === t, cap = r.teams[t].captain, canCap = E.isCaptain(r, S.me, t);
  var h = '<div class="team ' + t + '"><div class="th"><b>' + esc(tn(t)) + '</b><span class="small">' + ids.length + '/11</span>' + (canCap ? '<button class="btn sec sm" data-act="teamName" data-t="' + t + '">✏️ പേര്</button>' : '') + '</div>';
  h += ids.length ? ids.map(function (id) {
    return '<div class="pl">' + dot(id) + '<span>' + esc(nm(id)) + (id === cap ? ' ⭐' : '') + (id === S.me ? ' (ഞാൻ)' : '') + (id === r.host ? ' <small>ഹോസ്റ്റ്</small>' : '') + '</span>' +
      (canCap && id !== cap ? '<button class="btn sec sm" data-act="mkCap" data-t="' + t + '" data-id="' + esc(id) + '">⭐</button>' : '') +
      (admin && id !== S.me ? '<button class="btn sec sm" data-act="move" data-id="' + esc(id) + '" data-t="' + E.other(t) + '">⇄</button>' : '') + '</div>';
  }).join('') : '<div class="small">ആരും ഇല്ല</div>';
  if (!mine) h += '<button class="btn ' + (t === 'A' ? 'blue' : 'red') + ' sm" style="margin-top:8px;width:100%" data-act="team" data-t="' + t + '"' + (ids.length >= 11 ? ' disabled' : '') + '>' + esc(tn(t)) + '-ൽ ചേരുക</button>';
  return h + '</div>';
}
function renderLobby() {
  var r = S.room, admin = E.isAdmin(r, S.me), link = baseUrl() + '?room=' + r.code;
  var h = '<div class="card codebox"><div class="small">റൂം കോഡ്</div><div class="code">' + esc(r.code) + '</div>' +
    '<div class="row"><button class="btn sec sm" data-act="copyLink">🔗 ലിങ്ക് കോപ്പി</button><a class="btn sm wa" href="https://wa.me/?text=' + encodeURIComponent('Zaman Football Quiz കളിക്കാൻ വരൂ! ⚽ റൂം കോഡ്: ' + r.code + '\n' + link) + '" target="_blank" rel="noopener">WhatsApp-ൽ അയക്കുക</a></div>' +
    '<button class="btn sec sm" data-act="myLink" style="margin-top:8px;width:100%">🔑 എന്റെ റീജോയിൻ ലിങ്ക്</button></div>';
  h += '<div class="teams">' + teamBox(r, 'A', admin) + teamBox(r, 'B', admin) + '</div>';
  var specs = E.specIds(r);
  h += '<div class="card"><div class="th"><b>📺 കാണികൾ (' + specs.length + ')</b>' + (E.teamOf(r, S.me) ? '<button class="btn sec sm" data-act="team" data-t="">കാണിയാകുക</button>' : '') + '</div>' +
    (specs.length ? specs.map(function (id) { return '<div class="pl">' + dot(id) + '<span>' + esc(nm(id)) + (id === S.me ? ' (ഞാൻ)' : '') + '</span></div>'; }).join('') : '<div class="small">ആരും ഇല്ല</div>') + '</div>';
  h += '<div class="card"><h3>ചോദ്യ സെറ്റ്</h3>' + setPicker(r.set, admin, 'roomSet') + (admin ? '' : '<p class="small">ഹോസ്റ്റ് തിരഞ്ഞെടുക്കും</p>') + '</div>';
  var ts = r.toss;
  h += '<div class="card tossbox"><h3>🪙 ടോസ്</h3>';
  if (ts && ts.winner) h += '<div class="tossres">' + coinSvg(ts.face, 64) + '<div><b>' + esc(tn(ts.winner)) + ' ടോസ് ജയിച്ചു!</b><div class="mut">' + esc(tn(ts.winner)) + ' ആദ്യം കിക്ക് ഓഫ് ചെയ്യും</div></div></div>';
  else h += '<p class="mut">രണ്ട് ടീമിലും ആളായാൽ ഹോസ്റ്റ് ടോസ് ഇടും.</p>';
  if (admin && !ts) h += '<button class="btn sec" data-act="toss">🪙 ടോസ് ഇടുക</button>';
  h += '</div>';
  if (admin) h += '<button class="btn gold" data-act="start"' + (ts ? '' : ' disabled') + '>⚽ കളി തുടങ്ങുക</button>' + (ts ? '' : '<p class="small center">ആദ്യം ടോസ് ഇടുക</p>');
  else h += '<div class="card wait">ഹോസ്റ്റ് കളി തുടങ്ങാൻ കാത്തിരിക്കുക…</div>';
  h += rulesHtml(false) + '<button class="btn sec" data-act="leave">റൂമിൽ നിന്ന് പുറത്ത്</button>';
  $('#lobby').innerHTML = h;
}
function scoreboard(g) {
  var stage = E.inPen(g) ? (g.stage === 'sd' ? 'സഡൻ ഡെത്ത്' : 'പെനാൽറ്റി ഷൂട്ടൗട്ട്') : ('ചോദ്യം ' + Math.min(g.total, g.n + 1) + '/' + g.total + ' · ' + (g.h2 ? 'രണ്ടാം പകുതി' : 'ഒന്നാം പകുതി'));
  var left = g.h2 ? 'B' : 'A', right = E.other(left);
  var pen = '';
  if (g.stage !== 'reg') pen = '<div class="pens">' + [left, right].map(function (t) { var a = g.pen[t], cells = []; for (var i = 0; i < Math.max(g.penN, a.length); i++) cells.push(i < a.length ? (a[i] ? '<i class="pg">●</i>' : '<i class="pm">✕</i>') : '<i>○</i>'); return '<span>' + cells.join('') + '</span>'; }).join('<b>പെനാൽറ്റി</b>') + '</div>';
  return '<div class="score"><div class="sc ' + left + '"><span>' + esc(tn(left)) + '</span><b>' + g.score[left] + '</b></div><div class="mid">' + ballSvg(22) + '</div><div class="sc ' + right + '"><b>' + g.score[right] + '</b><span>' + esc(tn(right)) + '</span></div></div><div class="stage">' + stage + '</div>' + pen;
}
function ring(rem) { var f = Math.max(0, Math.min(1, rem / 10)); return '<div class="ring"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="28" fill="none" stroke="#26355a" stroke-width="6"/><circle id="tarc" cx="32" cy="32" r="28" fill="none" stroke="#19b46b" stroke-width="6" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="' + (176 * (1 - f)) + '" transform="rotate(-90 32 32)"/></svg><b id="tnum">' + Math.ceil(rem) + '</b></div>'; }
function chainHtml(g) {
  if (!g.ch.length) return '';
  return '<div class="chain">' + g.ch.map(function (c) {
    if (c.k === 'p') return '<span>' + esc(nm(c.p)) + ' ➡️ ' + esc(nm(c.to)) + '</span>';
    if (c.k === 'w') return '<span class="bad">' + esc(nm(c.p)) + ' ❌</span>';
    if (c.k === 'x') return '<span>' + esc(nm(c.p)) + ': അറിയില്ല</span>';
    if (c.k === 'sw') return '<span class="sw">⚽ പന്ത് ' + esc(tn(c.t)) + '-ന്</span>';
    if (c.k === 'ok') return '<span class="good">' + esc(nm(c.p)) + ' ✅</span>';
    if (c.k === 'to') return '<span class="bad">' + esc(nm(c.p)) + ' ⏰</span>';
    return '';
  }).join('') + '</div>';
}
function optsHtml(q, live, revealA, sel) {
  return '<div class="opts">' + q.o.map(function (o, i) {
    var cls = 'opt'; if (revealA != null && i === revealA) cls += ' good'; else if (revealA != null && sel === i) cls += ' bad';
    return '<button class="' + cls + '" data-act="ans" data-i="' + i + '"' + (live ? '' : ' disabled') + '><span class="ol">' + 'ABCD'[i] + '</span>' + esc(o) + '</button>';
  }).join('') + '</div>';
}
function offlineTools(r, g) {
  // captain/host: replace an offline player of their team
  var out = [];
  ['A', 'B'].forEach(function (t) { if (!E.isCaptain(r, S.me, t)) return; g.order[t].forEach(function (id) { if (!E.online(r, id)) out.push({ id: id, t: t }); }); });
  if (!out.length) return '';
  return '<div class="card warnbox"><b>📴 ഓഫ്‌ലൈൻ ആയവർ</b>' + out.map(function (o) { return '<div class="pl"><i class="on n"></i><span>' + esc(nm(o.id)) + ' · ' + esc(tn(o.t)) + '</span><button class="btn sec sm" data-act="replace" data-id="' + esc(o.id) + '">പകരം ആളെ ഇടുക</button></div>'; }).join('') + '</div>';
}
function teamsStrip(r, g) {
  return '<div class="strip">' + ['A', 'B'].map(function (t) {
    return '<div class="sline ' + t + '"><b>' + esc(tn(t)) + '</b>' + g.order[t].map(function (id) {
      var c = 'tag'; if (g.phase === 'q' && g.h === id) c += ' hold'; else if (g.phase === 'q' && g.tried[id]) c += ' tried'; if (!E.online(r, id)) c += ' off'; if (id === S.me) c += ' me';
      return '<span class="' + c + '">' + (g.phase === 'q' && g.h === id ? '⚽ ' : '') + esc(nm(id)) + ((g.goals[id] || 0) ? ' <small>' + g.goals[id] + '⚽</small>' : '') + '</span>';
    }).join('') + '</div>';
  }).join('') + '</div>';
}
function renderGame() {
  var r = S.room, g = r.g, now = serverNow(), me = S.me, myTeam = E.teamOf(r, me);
  sounds();
  var h = '<div class="card board">' + scoreboard(g) + fieldSvg(r) + '</div>';
  if (g.phase === 'kick') {
    var penIntro = g.stage !== 'reg';
    h += '<div class="card center big">' + (penIntro ? '<h2>സമനില! പെനാൽറ്റി ഷൂട്ടൗട്ട് 🥅</h2><p class="mut">ഓരോ ടീമിൽ നിന്നും ഓരോരുത്തർ മാറി മാറി. ഒരു ചോദ്യം, 10 സെക്കൻഡ്, പാസ് ഇല്ല. ' + g.penN + ' വീതം. പിന്നെയും സമനിലയായാൽ സഡൻ ഡെത്ത്.</p>' :
      '<div class="tossres c">' + coinSvg(r.toss && r.toss.face, 56) + '<div><b>' + esc(tn(g.first)) + ' ടോസ് ജയിച്ചു</b><div class="mut">' + esc(tn(g.first)) + ' കിക്ക് ഓഫ് ചെയ്യുന്നു ⚽</div></div></div>') +
      '<div class="cd" id="cdN">' + Math.max(0, Math.ceil((g.at - now) / 1000)) + '</div></div>';
  } else if (g.phase === 'half') {
    h += '<div class="card center big"><h2>⏸️ ഹാഫ് ടൈം</h2><p class="mut">സൈഡ് മാറുന്നു. രണ്ടാം പകുതി ഉടൻ.</p><div class="cd" id="cdN">' + Math.max(0, Math.ceil((g.at - now) / 1000)) + '</div></div>';
  } else if (g.phase === 'q') {
    var x = E.curQ(r, QS), q = x.q, reading = now < g.startAt, act = canAct(now), mine = g.h === me;
    var hold = '<div class="holder ' + (g.ct || '') + (mine ? ' mine' : '') + '">' + ballSvg(20) + '<span>' + (mine ? '<b>പന്ത് നിങ്ങളുടെ കയ്യിൽ!</b>' : 'പന്ത്: <b>' + esc(nm(g.h)) + '</b> · ' + esc(tn(g.ct))) + '</span></div>';
    if (reading) h += '<div class="card qcard"><div class="qhead"><div class="readbox">വായിക്കൂ… <b id="readN">' + Math.max(1, Math.ceil((g.startAt - now) / 1000)) + '</b></div><button class="btn sec sm" data-act="speakQ">📢 കേൾക്കുക</button></div>' + hold;
    else if (!act) h += '<div class="card qcard"><div class="switch">' + esc(tn(E.other(g.ct))) + '-ന് ഉത്തരം കിട്ടിയില്ല.<br>⚽ പന്ത് ഇപ്പോൾ <b>' + esc(tn(g.ct)) + '</b>-ലേക്ക്</div>' + hold;
    else h += '<div class="card qcard"><div class="qhead">' + ring((g.dl - now) / 1000) + '<div class="qmeta">' + hold + '<button class="btn sec sm" data-act="speakQ">📢 കേൾക്കുക</button></div></div>';
    h += '<div class="qtext">' + esc(q.q) + '</div>' + optsHtml(q, mine && act, null, null);
    if (mine && act) {
      if (E.inPen(g)) h += '<div class="hint">പെനാൽറ്റി: ശരിയുത്തരം = ഗോൾ. പാസ് ഇല്ല.</div>';
      else {
        var mates = g.order[g.ct].filter(function (id) { return id !== me && !g.tried[id]; });
        if (mates.length) h += '<div class="passbox"><div class="small">അറിയില്ലേ? 10 സെക്കൻഡിനുള്ളിൽ പാസ് ചെയ്യൂ:</div><div class="passes">' + mates.map(function (id) { var on = E.online(r, id); return '<button class="btn blue sm" data-act="pass" data-id="' + esc(id) + '"' + (on ? '' : ' disabled') + '>➡️ ' + esc(nm(id)) + (on ? '' : ' (ഓഫ്‌ലൈൻ)') + '</button>'; }).join('') + '</div></div>';
        else h += '<div class="passbox"><div class="small">ടീമിലെ എല്ലാവർക്കും ഈ ചോദ്യം കിട്ടിക്കഴിഞ്ഞു.</div><button class="btn red" data-act="giveup">അറിയില്ല – പന്ത് എതിർ ടീമിന്</button></div>';
      }
      h += '<div class="warn" id="selfWarn" hidden>⚠️ വേഗം! സമയം കഴിഞ്ഞാൽ സെൽഫ് ഗോൾ</div>';
    } else if (myTeam === g.ct && !E.inPen(g)) h += '<div class="hint">' + (g.tried[me] ? 'ഈ ചോദ്യം നിങ്ങൾക്ക് കിട്ടിക്കഴിഞ്ഞു.' : 'നിങ്ങളുടെ ടീമിന്റെ പന്ത്. പാസ് കിട്ടിയാൽ ഉത്തരം നൽകാം.') + '</div>';
    else if (myTeam) h += '<div class="hint">എതിർ ടീമിന്റെ പന്ത്. അവർക്ക് അറിയില്ലെങ്കിൽ പന്ത് നിങ്ങളുടെ ടീമിന് വരും.</div>';
    else h += '<div class="hint">📺 കാണി</div>';
    h += chainHtml(g) + '</div>';
  } else if (g.phase === 'rev') {
    var res = g.res || {}, lx = E.qOf(QS, g.log[g.log.length - 1].ref, g.log[g.log.length - 1].pm), lq = lx.q, cls = 'none', title = '';
    if (res.k === 'goal') { cls = 'goal'; title = '⚽ ഗോൾ! ' + esc(tn(res.t)) + '<div class="sub">' + esc(nm(res.p)) + ' ശരിയുത്തരം പറഞ്ഞു</div>'; }
    else if (res.k === 'self') { cls = 'self'; title = 'സെൽഫ് ഗോൾ! ' + esc(tn(res.t)) + '-ന് ഗോൾ<div class="sub">' + esc(nm(res.p)) + ' 10 സെക്കൻഡ് പന്ത് പിടിച്ചുവെച്ചു</div>'; }
    else if (res.k === 'pgoal') { cls = 'goal'; title = '🥅 പെനാൽറ്റി ഗോൾ! ' + esc(tn(res.t)) + '<div class="sub">' + esc(nm(res.p)) + '</div>'; }
    else if (res.k === 'pmiss') { cls = 'self'; title = 'പെനാൽറ്റി മിസ്സ് · ' + esc(tn(res.t)) + '<div class="sub">' + esc(nm(res.p)) + (res.c === -1 ? ' – സമയം കഴിഞ്ഞു' : ' – തെറ്റി') + '</div>'; }
    else title = 'ഗോൾ ഇല്ല<div class="sub">രണ്ട് ടീമിനും ഉത്തരം കിട്ടിയില്ല</div>';
    h += '<div class="card reveal ' + cls + '"><div class="rtitle">' + title + '</div></div>';
    h += '<div class="card"><div class="qtext">' + esc(lq.q) + '</div><div class="answerline">✅ ശരിയുത്തരം: <b>' + esc(lq.o[lq.a]) + '</b></div>' + chainHtml(g) + '<p class="small center">അടുത്ത ചോദ്യം <b id="nextN">' + Math.max(0, Math.ceil((g.revEnd - now) / 1000)) + '</b> സെക്കൻഡിൽ</p></div>';
  }
  h += teamsStrip(r, g) + offlineTools(r, g);
  h += '<div class="row foot2">' + (S.solo ? '' : '<button class="btn sec sm" data-act="myLink">🔑 റീജോയിൻ ലിങ്ക്</button>') + '<button class="btn sec sm" data-act="leave">പുറത്ത്</button></div>';
  var keep = window.scrollY;
  $('#game').innerHTML = h;
  S.qKey = g.phase === 'q' ? g.seq + ':' + (now < g.startAt) + ':' + (!canAct(now) && now >= g.startAt) : '';
  if (g.phase === 'q' && S.spokenK !== g.stage + g.k) { S.spokenK = g.stage + g.k; try { window.scrollTo(0, 0); } catch (e) {} speakQ(E.curQ(r, QS).q); }
  else try { window.scrollTo(0, keep); } catch (e) {}
}
function renderResult() {
  var r = S.room, g = r.g, admin = E.isAdmin(r, S.me), w = g.win, my = E.teamOf(r, S.me);
  $('#game').innerHTML = '';
  var pa = g.pen.A.filter(Boolean).length, pb = g.pen.B.filter(Boolean).length;
  var h = '<div class="card center final"><div class="trophy">' + trophySvg(90) + '</div><h2>' + (w ? esc(tn(w)) + ' ജയിച്ചു! 🏆' : 'സമനില') + '</h2>' +
    (my && w ? '<p class="mut">' + (my === w ? 'അഭിനന്ദനങ്ങൾ! നിങ്ങളുടെ ടീം ജയിച്ചു.' : 'നല്ല കളി! അടുത്ത തവണ ജയിക്കാം.') + '</p>' : '') +
    '<div class="score fin"><div class="sc A"><span>' + esc(tn('A')) + '</span><b>' + g.score.A + '</b></div><div class="mid">–</div><div class="sc B"><b>' + g.score.B + '</b><span>' + esc(tn('B')) + '</span></div></div>' +
    (g.stage !== 'reg' ? '<p class="mut">പെനാൽറ്റി: ' + pa + ' – ' + pb + '</p>' : '') + '</div>';
  var sc = Object.keys(g.goals).filter(function (id) { return g.goals[id] > 0; }).sort(function (a, b) { return g.goals[b] - g.goals[a]; });
  h += '<div class="card"><h3>⚽ ഗോൾ നേടിയവർ</h3>' + (sc.length ? sc.map(function (id) { return '<div class="pl"><span>' + esc(nm(id)) + ' · ' + esc(tn(E.teamOf(r, id))) + '</span><b>' + g.goals[id] + '</b></div>'; }).join('') : '<p class="mut">ആരും ഗോൾ നേടിയില്ല</p>') +
    '<p class="small">സെൽഫ് ഗോൾ: ' + g.log.filter(function (l) { return l.r === 'self'; }).length + ' · ഗോൾ ഇല്ലാത്ത ചോദ്യം: ' + g.log.filter(function (l) { return l.r === 'none'; }).length + '</p></div>';
  h += reviewHtml(r) + academyAd();
  if (S.solo) h += '<button class="btn" data-act="solo">🔁 വീണ്ടും സോളോ (പുതിയ ചോദ്യങ്ങൾ)</button>';
  else if (admin) h += '<button class="btn" data-act="reset">🔁 വീണ്ടും കളിക്കാം (ലോബിയിലേക്ക്)</button>';
  else h += '<div class="card wait">ഹോസ്റ്റ് പുതിയ കളി തുടങ്ങാൻ കാത്തിരിക്കുക</div>';
  h += '<button class="btn sec" data-act="leave">ഹോമിലേക്ക്</button>';
  $('#result').innerHTML = h;
}
function reviewHtml(r) {
  var g = r.g, list = (g.miss && g.miss[S.me]) || [];
  var mine = '';
  if (E.teamOf(r, S.me)) mine = !list.length ? '<div class="card"><h3>📘 നിങ്ങൾക്ക് തെറ്റിയ ചോദ്യങ്ങൾ</h3><p class="mut">ഒരു ചോദ്യവും തെറ്റിയില്ല. അടിപൊളി!</p></div>' :
    '<div class="card"><h3>📘 നിങ്ങൾക്ക് തെറ്റിയ ചോദ്യങ്ങൾ (' + list.length + ')</h3>' + list.map(function (m) {
      var q = E.qOf(QS, m.ref, m.pm).q || { o: [] };
      return '<div class="rev"><div class="rq">' + esc(q.q) + '</div><div class="ra bad">നിങ്ങൾ: ' + (m.c >= 0 ? esc(q.o[m.c]) : 'സമയം കഴിഞ്ഞു (ഉത്തരം നൽകിയില്ല)') + '</div><div class="ra good">ശരിയുത്തരം: ' + esc(q.o[q.a]) + '</div></div>';
    }).join('') + '</div>';
  var lab = { goal: '⚽ ഗോൾ', self: 'സെൽഫ് ഗോൾ', none: 'ഗോൾ ഇല്ല', pgoal: '🥅 ഗോൾ', pmiss: '🥅 മിസ്സ്' };
  var all = '<details class="card"><summary><b>📋 എല്ലാ ചോദ്യങ്ങളും ഉത്തരങ്ങളും (' + g.log.length + ')</b></summary>' + g.log.map(function (l, i) {
    var q = E.qOf(QS, l.ref, l.pm).q || { o: [] };
    return '<div class="rev"><div class="rq">' + (i + 1) + '. ' + esc(q.q) + '</div><div class="ra good">ശരിയുത്തരം: ' + esc(q.o[q.a]) + '</div><div class="small">' + (lab[l.r] || '') + (l.t ? ' · ' + esc(tn(l.t)) : '') + (l.p && (l.r === 'goal' || l.r === 'pgoal') ? ' · ' + esc(nm(l.p)) : '') + '</div></div>';
  }).join('') + '</details>';
  return mine + all;
}

// ------------------------------------------------------------ replace sheet
function openReplace(out) {
  var r = S.room, specs = E.specIds(r).filter(function (id) { return E.online(r, id); });
  var h = '<div class="sheetbox"><h3>' + esc(nm(out)) + '-ന് പകരം</h3><p class="mut">കാണികളിൽ നിന്ന് ഒരാളെ തിരഞ്ഞെടുക്കുക, അല്ലെങ്കിൽ ടീമിൽ നിന്ന് മാറ്റുക.</p>' +
    (specs.length ? specs.map(function (id) { return '<button class="btn blue" data-act="doReplace" data-out="' + esc(out) + '" data-in="' + esc(id) + '">' + esc(nm(id)) + '</button>'; }).join('') : '<p class="small">ഓൺലൈനിലുള്ള കാണികൾ ഇല്ല</p>') +
    '<button class="btn sec" data-act="doReplace" data-out="' + esc(out) + '" data-in="">ടീമിൽ നിന്ന് മാറ്റുക (പകരം ആളില്ല)</button><button class="btn sec" data-act="sheetClose">അടയ്ക്കുക</button></div>';
  var s = $('#sheet'); s.innerHTML = h; s.hidden = false;
}

// ------------------------------------------------------------ events
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
  var a = b.dataset.act; audio();
  if (a === 'create') createRoom();
  else if (a === 'join') joinRoom();
  else if (a === 'joinSpec') joinRoom(null, true);
  else if (a === 'solo') startSolo();
  else if (a === 'resumeSolo') resumeSolo();
  else if (a === 'rejoin') { var s = LS.get('zfq_session'); if (s) connect(s.code, s.pid, s.name, s.tok); }
  else if (a === 'forget') { LS.del('zfq_session'); render(); }
  else if (a === 'leave') { if (S.room && S.room.status === 'playing' && !confirm('കളിയിൽ നിന്ന് പുറത്തുപോകണോ?')) return; leave(); }
  else if (a === 'homeSet') pickHomeSet(b.dataset.set);
  else if (a === 'roomSet') dispatch({ type: 'setSet', set: b.dataset.set });
  else if (a === 'team') dispatch({ type: 'team', team: b.dataset.t });
  else if (a === 'move') dispatch({ type: 'team', pid: b.dataset.id, team: b.dataset.t });
  else if (a === 'mkCap') dispatch({ type: 'captain', team: b.dataset.t, pid: b.dataset.id });
  else if (a === 'teamName') { var v = prompt('ടീമിന്റെ പേര്', tn(b.dataset.t)); if (v) dispatch({ type: 'teamName', team: b.dataset.t, name: v }); }
  else if (a === 'toss') dispatch({ type: 'toss', coin: Math.random() }).then(function (okk) { if (okk) sfx('whistle'); });
  else if (a === 'start') { var st = { type: 'start', seed: (Math.random() * 4294967295) >>> 0 }; if (DBG) for (var k in DBG) st[k] = DBG[k]; dispatch(st); }
  else if (a === 'reset') dispatch({ type: 'reset' });
  else if (a === 'ans') answer(+b.dataset.i);
  else if (a === 'pass') pass(b.dataset.id);
  else if (a === 'giveup') giveup();
  else if (a === 'replace') openReplace(b.dataset.id);
  else if (a === 'doReplace') { $('#sheet').hidden = true; var o = { type: 'replace', out: b.dataset.out }; if (b.dataset['in']) o['in'] = b.dataset['in']; dispatch(o); }
  else if (a === 'sheetClose') $('#sheet').hidden = true;
  else if (a === 'speakQ') { var x = E.curQ(S.room, QS); var was = voiceOn(); if (!was) LS.set('zfq_voice', true); if (x) speakQ(x.q); if (!was) LS.set('zfq_voice', false); }
  else if (a === 'sound') { LS.set('zfq_sound', !soundOn()); toast(soundOn() ? 'ശബ്ദം ഓൺ' : 'ശബ്ദം ഓഫ്', true); if (soundOn()) sfx('whistle'); renderTop(); renderChat(); }
  else if (a === 'voice') { LS.set('zfq_voice', !voiceOn()); if (!voiceOn()) hush(); toast(voiceOn() ? 'ചോദ്യം ഉറക്കെ വായിക്കും' : 'ചോദ്യം വായിക്കില്ല', true); renderTop(); renderChat(); }
  else if (a === 'chatToggle') chatToggle();
  else if (a === 'chatSend') chatSend();
  else if (a === 'copyLink') copy(baseUrl() + '?room=' + S.room.code);
  else if (a === 'myLink') { var u = rejoinUrl(); if (u) copy(u, 'നിങ്ങളുടെ സ്വന്തം റീജോയിൻ ലിങ്ക് കോപ്പി ചെയ്തു. ആർക്കും അയക്കരുത്'); }
});
document.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target && ev.target.id === 'chatIn') chatSend(); });
document.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'chatIn') updateChatCount(); });
document.getElementById('sheet').addEventListener('click', function (ev) { if (ev.target.id === 'sheet') ev.target.hidden = true; });
document.addEventListener('visibilitychange', function () { if (!document.hidden && S.room) render(); });
function copy(t, msg) {
  var done = function () { toast(msg || 'ലിങ്ക് കോപ്പി ചെയ്തു', true); };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { prompt('കോപ്പി ചെയ്യുക', t); }); else prompt('കോപ്പി ചെയ്യുക', t);
}

// ------------------------------------------------------------ boot
function boot() {
  try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function () { var n = $('#voiceNote'); if (n && mlVoice()) n.remove(); }; } catch (e) {}
  S.tick = setInterval(tick, 200);
  render();
  if (db) {
    var rr = QP.get('r'), pp = QP.get('p'), kk = QP.get('k');
    if (rr && pp && kk) { history.replaceState(null, '', location.pathname); useRejoinLink(rr.toUpperCase(), pp, kk); }
    else { var ses = LS.get('zfq_session'); if (ses && ses.code && !ses.left && !QP.get('room')) connect(ses.code, ses.pid, ses.name, ses.tok); }
    setTimeout(cleanupOld, 4000);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
boot();
})();
