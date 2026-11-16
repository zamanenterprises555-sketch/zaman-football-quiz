/* Zaman Football Quiz - match engine (v1)
 * Pure rules shared by Solo and Multiplayer. Solo applies actions to a local copy;
 * multiplayer applies the SAME actions inside a Firebase transaction, so only one
 * phone can move the game forward at a time (answer, pass, self goal, next question).
 * Questions come from questions.js (the same file as Zaman Cricket Quiz, unchanged).
 */
(function (root) {
  'use strict';
  var TOTAL = 30, PEN = 5, MAX_TEAM = 11, MAX_PLAYERS = 40;
  var READ_MS = 3000, HOLD_MS = 10000, SWITCH_MS = 1500, GRACE_MS = 700, REVEAL_MS = 5000, KICK_MS = 4000, HALF_MS = 7000;
  var ALL = '*';
  var TEAMS = ['A', 'B'];

  function other(t) { return t === 'A' ? 'B' : 'A'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rnd(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function isMcq(q) { return !!q && Array.isArray(q.o) && q.o.length > 1 && typeof q.a === 'number' && q.a >= 0 && q.a < q.o.length; }
  function setNumber(name) { var m = String(name).match(/(\d+)\s*$/); return m ? +m[1] : 0; }
  // Only the 4-option sets ("OPTIONAL QUESTIONS n") are used: answers are tapped in 10 seconds.
  function optionalSets(qs) {
    return Object.keys(qs || {}).filter(function (k) { return /^OPTIONAL/i.test(String(k).trim()) && (qs[k] || []).some(isMcq); })
      .sort(function (a, b) { return setNumber(a) - setNumber(b); });
  }
  function refsOf(qs, name) { return (qs[name] || []).map(function (q, i) { return isMcq(q) ? name + '|' + i : null; }).filter(Boolean); }
  function setRefs(qs, set) { if (set === ALL) { var r = []; optionalSets(qs).forEach(function (k) { r = r.concat(refsOf(qs, k)); }); return r; } return refsOf(qs, set); }
  function setPlayable(qs, set, total) { return (set === ALL ? optionalSets(qs).length > 0 : optionalSets(qs).indexOf(set) >= 0) && setRefs(qs, set).length >= (total || TOTAL); }
  function listSets(qs) {
    var l = optionalSets(qs).map(function (k) { return { name: k, label: k, count: refsOf(qs, k).length, ok: setPlayable(qs, k) }; });
    if (l.length > 1) l.push({ name: ALL, label: 'എല്ലാ സെറ്റും കലർത്തി', count: setRefs(qs, ALL).length, ok: setPlayable(qs, ALL) });
    return l;
  }
  function setLabel(set) { return set === ALL ? 'എല്ലാ സെറ്റും കലർത്തി' : String(set || ''); }
  // option order for one question, e.g. "2031" (display index -> original index)
  function permute(q, pm) {
    if (!q || !pm || !isMcq(q)) return q;
    var idx = String(pm).split('').map(Number);
    if (idx.length !== q.o.length) return q;
    return { q: q.q, o: idx.map(function (k) { return q.o[k]; }), a: idx.indexOf(q.a), type: q.type };
  }
  function qOf(qs, ref, pm) { var p = String(ref).split('|'); var a = qs[p[0]] || []; return { s: p[0], i: +p[1], q: permute(a[+p[1]], pm), pm: pm || '', ref: ref }; }
  function curQ(room, qs) { var g = room.g; if (!g || !g.qs || !g.qs.length) return null; var k = g.k % g.qs.length; return qOf(qs, g.qs[k], (g.qp || [])[k]); }

  // ------------------------------------------------------------ room / players
  function newRoom(o) {
    var r = { v: 1, code: o.code, host: o.pid, createdAt: o.now || 0, solo: !!o.solo, status: 'lobby', set: o.set || 'OPTIONAL QUESTIONS 1',
      teams: { A: { name: 'ടീം A', captain: o.pid }, B: { name: 'ടീം B', captain: '' } }, toss: null, players: {} };
    r.players[o.pid] = { name: o.name, team: 'A', online: true, joinedAt: o.now || 0 };
    if (o.th) r.players[o.pid].th = o.th;
    return r;
  }
  function normalize(room) {
    if (!room) return room;
    room.players = room.players || {};
    room.teams = room.teams || { A: { name: 'ടീം A', captain: '' }, B: { name: 'ടീം B', captain: '' } };
    TEAMS.forEach(function (t) { room.teams[t] = room.teams[t] || { name: 'ടീം ' + t, captain: '' }; if (room.teams[t].captain == null) room.teams[t].captain = ''; if (!room.teams[t].name) room.teams[t].name = 'ടീം ' + t; });
    Object.keys(room.players).forEach(function (id) { var p = room.players[id]; if (p.team !== 'A' && p.team !== 'B') p.team = ''; });
    var g = room.g;
    if (g) {
      g.order = g.order || {}; TEAMS.forEach(function (t) { g.order[t] = g.order[t] || []; });
      g.kc = g.kc || { A: 0, B: 0 }; g.score = g.score || { A: 0, B: 0 }; TEAMS.forEach(function (t) { g.kc[t] = g.kc[t] || 0; g.score[t] = g.score[t] || 0; });
      g.pen = g.pen || {}; TEAMS.forEach(function (t) { g.pen[t] = g.pen[t] || []; });
      g.tried = g.tried || {}; g.ch = g.ch || []; g.log = g.log || []; g.miss = g.miss || {}; g.goals = g.goals || {}; g.qs = g.qs || []; g.qp = g.qp || [];
      if (g.td == null) g.td = 0; if (g.h == null) g.h = ''; if (g.res === undefined) g.res = null;
    }
    return room;
  }
  function teamIds(room, t) {
    return Object.keys(room.players || {}).filter(function (id) { return room.players[id].team === t; })
      .sort(function (a, b) { return (room.players[a].joinedAt || 0) - (room.players[b].joinedAt || 0) || (a < b ? -1 : 1); });
  }
  function specIds(room) { return Object.keys(room.players || {}).filter(function (id) { return !room.players[id].team; }); }
  function online(room, id) { var p = room.players[id]; return !!(p && (p.online || p.bot)); }
  function playerIds(room) { var g = room.g; return g ? g.order.A.concat(g.order.B) : teamIds(room, 'A').concat(teamIds(room, 'B')); }
  function isAdmin(room, by) {
    if (by === 'solo' || by === room.host) return true;
    if (online(room, room.host)) return false;
    var on = playerIds(room).filter(function (id) { return online(room, id) && !room.players[id].bot; });
    if (!on.length) on = Object.keys(room.players).filter(function (id) { return online(room, id); }).sort();
    return on[0] === by;
  }
  function isCaptain(room, by, t) { return isAdmin(room, by) || (room.teams[t] && room.teams[t].captain === by); }
  function teamOf(room, id) { var g = room.g; if (g) { if (g.order.A.indexOf(id) >= 0) return 'A'; if (g.order.B.indexOf(id) >= 0) return 'B'; return ''; } var p = room.players[id]; return p ? p.team : ''; }
  function fixCaptains(room) {
    TEAMS.forEach(function (t) {
      var ids = room.g ? room.g.order[t] : teamIds(room, t), c = room.teams[t].captain;
      if (!c || ids.indexOf(c) < 0) room.teams[t].captain = ids.filter(function (id) { return online(room, id); })[0] || ids[0] || '';
    });
  }

  // ------------------------------------------------------------ match helpers
  function untried(room, t) { var g = room.g; return g.order[t].filter(function (id) { return !g.tried[id]; }); }
  // next player of team t after `after` in team order, skipping players who already had this question; online first
  function pickNext(room, t, after) {
    var g = room.g, ids = g.order[t], n = ids.length; if (!n) return '';
    var start = after ? ids.indexOf(after) + 1 : 0, cands = [];
    for (var k = 0; k < n; k++) { var id = ids[(start + k + n) % n]; if (!g.tried[id] && id !== after) cands.push(id); }
    return cands.filter(function (id) { return online(room, id); })[0] || '';
  }
  // rotating starter of team t (a different player each time the team starts)
  function starter(room, t) {
    var g = room.g, ids = g.order[t], n = ids.length; if (!n) return '';
    for (var k = 0; k < n; k++) {
      var id = ids[(g.kc[t] + k) % n];
      if (g.tried[id]) continue;
      if (online(room, id)) { g.kc[t] = (g.kc[t] + k + 1) % n; return id; }
    }
    g.kc[t] = (g.kc[t] + 1) % n;
    return ''; // nobody online in this team
  }
  function penKickTeam(g) { return g.n % 2 === 0 ? g.first : other(g.first); }
  function regTeam(g) { return g.n % 2 === 0 ? g.first : other(g.first); }
  function inPen(g) { return g.stage === 'pen' || g.stage === 'sd'; }
  function beginQuestion(room, base) {
    var g = room.g;
    g.tried = {}; g.td = 0; g.ch = []; g.res = null;
    g.ft = inPen(g) ? penKickTeam(g) : regTeam(g); g.ct = g.ft;
    g.h = starter(room, g.ct);
    g.qAt = base; g.startAt = base + READ_MS; g.dl = g.startAt + HOLD_MS; g.phase = 'q'; g.seq++;
    if (!g.h) { // nobody of the kicking team is online
      if (inPen(g)) { g.pen[g.ct].push(0); endQ(room, { k: 'pmiss', t: g.ct, p: '', c: -1 }, base); return; }
      g.td = 1; g.ct = other(g.ct); g.ch.push({ k: 'sw', t: g.ct }); g.h = starter(room, g.ct);
      if (!g.h) endQ(room, { k: 'none', t: '' }, base);
    }
  }
  function addMiss(g, id, c) { var q = g.qs[g.k % g.qs.length]; (g.miss[id] = g.miss[id] || []).push({ ref: q, pm: (g.qp || [])[g.k % g.qs.length] || '', c: c }); }
  function endQ(room, res, nowT) {
    var g = room.g; g.res = res; g.phase = 'rev'; g.revEnd = nowT + REVEAL_MS; g.h = ''; g.seq++;
    if (res.k === 'goal') g.goals[res.p] = (g.goals[res.p] || 0) + 1;
    var kk = g.k % g.qs.length;
    g.log.push({ k: g.k, ref: g.qs[kk], pm: (g.qp || [])[kk] || '', st: g.stage, r: res.k, t: res.t || '', p: res.p || '', sc: g.score.A + '-' + g.score.B, ch: g.ch.slice(0, 30) });
  }
  // the team in possession could not answer: ball goes to the other team, or no goal if both failed
  function teamFail(room, nowT) {
    var g = room.g;
    g.td++;
    if (g.td >= 2) { endQ(room, { k: 'none', t: '' }, nowT); return; }
    g.ct = other(g.ct); g.ch.push({ k: 'sw', t: g.ct });
    g.h = starter(room, g.ct); g.dl = nowT + SWITCH_MS + HOLD_MS; g.seq++;
    if (!g.h) teamFail(room, nowT);
  }
  function penDecided(g) {
    var a = g.pen.A, b = g.pen.B, ga = a.filter(Boolean).length, gb = b.filter(Boolean).length, N = g.penN;
    if (a.length <= N && b.length <= N && g.stage === 'pen') {
      var remA = N - a.length, remB = N - b.length;
      if (ga + remA < gb || gb + remB < ga) return true;
      if (a.length === N && b.length === N) { if (ga !== gb) return true; g.stage = 'sd'; return false; }
      return false;
    }
    return a.length === b.length && ga !== gb;
  }
  function winner(g) {
    if (g.score.A !== g.score.B) return g.score.A > g.score.B ? 'A' : 'B';
    var ga = g.pen.A.filter(Boolean).length, gb = g.pen.B.filter(Boolean).length;
    return ga === gb ? '' : ga > gb ? 'A' : 'B';
  }
  function finish(room) { var g = room.g; room.status = 'finished'; g.phase = 'done'; g.win = winner(g); g.seq++; }

  // ------------------------------------------------------------ reducer
  function reduce(roomIn, a, qs) {
    var room = normalize(clone(roomIn)), P = room.players, g = room.g, by = a.by, nowT = a.now || 0;
    function err(m) { return { error: m }; }
    var t = a.type;
    if (t === 'join') {
      if (!a.pid) return err('?');
      var p = P[a.pid];
      if (p) { p.online = true; if (a.name) p.name = String(a.name).slice(0, 20); if (a.th && !p.th) p.th = a.th; return { room: room }; }
      if (Object.keys(P).length >= MAX_PLAYERS) return err('റൂം നിറഞ്ഞു');
      var team = '';
      if (room.status === 'lobby' && !a.spec) {
        var na = teamIds(room, 'A').length, nb = teamIds(room, 'B').length;
        team = nb < na ? 'B' : 'A'; if (team === 'A' && na >= MAX_TEAM) team = 'B'; if (team === 'B' && nb >= MAX_TEAM) team = na < MAX_TEAM ? 'A' : '';
      }
      P[a.pid] = { name: String(a.name || 'കളിക്കാരൻ').slice(0, 20), team: team, online: true, joinedAt: nowT };
      if (a.th) P[a.pid].th = a.th;
      if (team && !room.teams[team].captain) room.teams[team].captain = a.pid;
      return { room: room };
    }
    if (t === 'team') { // pick team A / B / spectator ('') in the lobby
      if (room.status !== 'lobby') return err('കളി തുടങ്ങിക്കഴിഞ്ഞു');
      var pid = a.pid || by, pp = P[pid];
      if (!pp) return err('കളിക്കാരനെ കണ്ടില്ല');
      if (pid !== by && !isAdmin(room, by)) return err('ഹോസ്റ്റിന് മാത്രം');
      var tt = a.team === 'A' || a.team === 'B' ? a.team : '';
      if (tt && pp.team !== tt && teamIds(room, tt).length >= MAX_TEAM) return err('ഈ ടീമിൽ 11 പേർ ആയി');
      var old = pp.team; pp.team = tt;
      if (old && room.teams[old].captain === pid) room.teams[old].captain = teamIds(room, old)[0] || '';
      if (tt && !room.teams[tt].captain) room.teams[tt].captain = pid;
      return { room: room };
    }
    if (t === 'captain') {
      var ct0 = a.team; if (!room.teams[ct0]) return err('?');
      if (!isCaptain(room, by, ct0)) return err('ക്യാപ്റ്റനോ ഹോസ്റ്റിനോ മാത്രം');
      if (teamOf(room, a.pid) !== ct0) return err('ആ ടീമിലെ ആളല്ല');
      room.teams[ct0].captain = a.pid; return { room: room };
    }
    if (t === 'teamName') {
      if (room.status !== 'lobby') return err('കളി തുടങ്ങിക്കഴിഞ്ഞു');
      if (!room.teams[a.team] || !isCaptain(room, by, a.team)) return err('ക്യാപ്റ്റനോ ഹോസ്റ്റിനോ മാത്രം');
      var nmv = String(a.name || '').replace(/\s+/g, ' ').trim().slice(0, 20); if (!nmv) return err('പേര് നൽകുക');
      room.teams[a.team].name = nmv; return { room: room };
    }
    if (t === 'setSet') {
      if (!isAdmin(room, by) || room.status !== 'lobby') return err('ഹോസ്റ്റിന് മാത്രം');
      if (!setPlayable(qs, a.set)) return err('ഈ സെറ്റ് ഉടൻ വരുന്നു');
      room.set = a.set; return { room: room };
    }
    if (t === 'toss') {
      if (!isAdmin(room, by)) return err('ഹോസ്റ്റിന് മാത്രം');
      if (room.status !== 'lobby') return err('കളി തുടങ്ങിക്കഴിഞ്ഞു');
      if (!teamIds(room, 'A').length || !teamIds(room, 'B').length) return err('രണ്ട് ടീമിലും കുറഞ്ഞത് ഒരാൾ വേണം');
      if (room.toss && room.toss.winner) return err('ടോസ് കഴിഞ്ഞു');
      var heads = (+a.coin || 0) < 0.5;
      room.toss = { id: ((room.toss && room.toss.id) || 0) + 1, face: heads ? 'H' : 'T', winner: heads ? 'A' : 'B', at: nowT };
      return { room: room };
    }
    if (t === 'start') {
      if (!isAdmin(room, by)) return err('ഹോസ്റ്റിന് മാത്രം തുടങ്ങാം');
      if (room.status !== 'lobby') return err('കളി തുടങ്ങിക്കഴിഞ്ഞു');
      var A = teamIds(room, 'A').slice(0, MAX_TEAM), B = teamIds(room, 'B').slice(0, MAX_TEAM);
      if (!A.length || !B.length) return err('രണ്ട് ടീമിലും കുറഞ്ഞത് ഒരാൾ വേണം');
      if (!(room.toss && room.toss.winner)) return err('ആദ്യം ടോസ് ഇടുക');
      // test-only shorter match (?test=1): even number of questions and fewer penalties
      var total = TOTAL, penN = PEN;
      if (a.dbg) { total = Math.max(2, Math.min(TOTAL, (+a.total || TOTAL) & ~1)); penN = Math.max(1, Math.min(PEN, +a.penN || PEN)); }
      if (!setPlayable(qs, room.set, total)) return err('കളിക്കാൻ പറ്റുന്ന സെറ്റ് തിരഞ്ഞെടുക്കുക');
      // question order: shuffled chosen set first (regulation), then the rest for penalties; no repeats in a match
      var R = rnd(a.seed || 12345);
      var shuf = function (arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; } return arr; };
      var main = shuf(setRefs(qs, room.set)), reg = main.slice(0, total), rest = main.slice(total);
      setRefs(qs, ALL).forEach(function (rf) { if (main.indexOf(rf) < 0) rest.push(rf); });
      var list = reg.concat(shuf(rest));
      var qp = list.map(function (rf) { var q = qOf(qs, rf).q; return shuf(q.o.map(function (o, k) { return k; })).join(''); });
      room.status = 'playing';
      room.g = { set: room.set, total: total, half: total / 2, penN: penN, first: room.toss.winner, order: { A: A, B: B }, kc: { A: 0, B: 0 }, score: { A: 0, B: 0 }, pen: { A: [], B: [] },
        stage: 'reg', k: 0, n: 0, h2: 0, phase: 'kick', at: nowT + KICK_MS, qs: list, qp: qp, tried: {}, td: 0, ch: [], res: null, h: '', log: [], miss: {}, goals: {}, seq: 1 };
      fixCaptains(room);
      return { room: room };
    }
    if (t === 'reset') {
      if (!isAdmin(room, by)) return err('ഹോസ്റ്റിന് മാത്രം');
      if (room.g) TEAMS.forEach(function (x) { room.g.order[x].forEach(function (id) { if (P[id]) P[id].team = x; }); });
      room.status = 'lobby'; room.g = null; room.toss = null; return { room: room };
    }
    if (!g || room.status !== 'playing') return err('കളി നടക്കുന്നില്ല');
    if (t === 'go') { // after kick-off / half-time / penalty intro
      if (['kick', 'half'].indexOf(g.phase) < 0 || nowT < g.at - 50) return err('wait');
      beginQuestion(room, Math.max(g.at, nowT - 1000)); return { room: room };
    }
    if (t === 'replace') {
      // captain/host swaps an OFFLINE player for a spectator (or removes the offline player from the team)
      var rt = teamOf(room, a.out);
      if (!rt) return err('കളിക്കാരനെ കണ്ടില്ല');
      if (!isCaptain(room, by, rt)) return err('ക്യാപ്റ്റനോ ഹോസ്റ്റിനോ മാത്രം');
      if (by !== 'solo' && online(room, a.out)) return err((P[a.out] || {}).name + ' ഓൺലൈൻ ആണ്');
      var ord = g.order[rt], ix = ord.indexOf(a.out);
      if (a['in']) {
        var np = P[a['in']]; if (!np || teamOf(room, a['in'])) return err('കാണികളിൽ നിന്ന് ഒരാളെ തിരഞ്ഞെടുക്കുക');
        ord[ix] = a['in']; np.team = rt; if (P[a.out]) P[a.out].team = '';
        if (g.tried[a.out]) g.tried[a['in']] = 1;
        if (g.h === a.out) { g.h = a['in']; g.dl = Math.max(g.dl, nowT + HOLD_MS); g.seq++; }
      } else {
        if (ord.length < 2) return err('ടീമിൽ ഒരാളെങ്കിലും വേണം');
        ord.splice(ix, 1); if (P[a.out]) P[a.out].team = '';
        if (g.h === a.out) {
          if (g.phase === 'q' && !inPen(g)) { g.tried[a.out] = 1; var nx = pickNext(room, rt, ''); if (nx) { g.h = nx; g.dl = Math.max(g.dl, nowT + HOLD_MS); g.seq++; } else teamFail(room, nowT); }
          else if (g.phase === 'q') { g.h = ord[0]; g.dl = Math.max(g.dl, nowT + HOLD_MS); g.seq++; }
        }
        g.kc[rt] = g.kc[rt] % ord.length;
      }
      fixCaptains(room);
      return { room: room };
    }
    var holder = (by === 'solo' && a.pid) ? a.pid : by;
    if (t === 'answer' || t === 'pass' || t === 'giveup') {
      if (g.phase !== 'q') return err('സമയം കഴിഞ്ഞു');
      if (g.h !== holder) return err('പന്ത് നിങ്ങളുടെ കയ്യിലല്ല');
      if (nowT < g.startAt - 250) return err('ആദ്യം ചോദ്യം വായിക്കൂ');
      if (nowT > g.dl + GRACE_MS) return err('സമയം കഴിഞ്ഞു');
      if (g.ch.length && g.ch[g.ch.length - 1].k === 'sw' && nowT < g.dl - HOLD_MS - 200) return err('wait');
    }
    if (t === 'answer') {
      var x = curQ(room, qs), q = x && x.q; if (!q) return err('?');
      var ch = +a.i, good = ch === q.a;
      if (inPen(g)) {
        g.ch.push({ p: holder, k: good ? 'ok' : 'w', c: ch });
        g.pen[g.ct].push(good ? 1 : 0);
        if (!good) addMiss(g, holder, ch);
        endQ(room, { k: good ? 'pgoal' : 'pmiss', t: g.ct, p: holder, c: ch }, nowT);
        return { room: room };
      }
      if (good) {
        g.ch.push({ p: holder, k: 'ok', c: ch }); g.score[g.ct]++;
        endQ(room, { k: 'goal', t: g.ct, p: holder, c: ch }, nowT); return { room: room };
      }
      // wrong answer = the ball moves on to the next teammate automatically
      g.ch.push({ p: holder, k: 'w', c: ch }); g.tried[holder] = 1; addMiss(g, holder, ch);
      var nx2 = pickNext(room, g.ct, holder);
      if (nx2) { g.h = nx2; g.dl = nowT + HOLD_MS; g.seq++; } else teamFail(room, nowT);
      return { room: room };
    }
    if (t === 'pass') {
      if (inPen(g)) return err('പെനാൽറ്റിയിൽ പാസ് ഇല്ല');
      var to = a.to;
      if (teamOf(room, to) !== g.ct || to === holder) return err('സ്വന്തം ടീമിലെ ആൾക്ക് മാത്രം');
      if (g.tried[to]) return err('ഈ ചോദ്യം അവർക്ക് കിട്ടിക്കഴിഞ്ഞു');
      if (!online(room, to)) return err((P[to] || {}).name + ' ഓഫ്‌ലൈൻ ആണ്');
      g.ch.push({ p: holder, k: 'p', to: to }); g.tried[holder] = 1; g.h = to; g.dl = nowT + HOLD_MS; g.seq++;
      return { room: room };
    }
    if (t === 'giveup') { // last player of the team does not know: ball to the other team
      if (inPen(g)) return err('?');
      if (untried(room, g.ct).filter(function (id) { return id !== holder; }).length) return err('ആദ്യം ടീമിലെ മറ്റൊരാൾക്ക് പാസ് ചെയ്യൂ');
      g.ch.push({ p: holder, k: 'x' }); g.tried[holder] = 1; teamFail(room, nowT);
      return { room: room };
    }
    if (t === 'timeout') { // ball held past 10 s = SELF GOAL (penalty: a miss)
      if (g.phase !== 'q' || nowT < g.dl + GRACE_MS) return err('wait');
      var hid = g.h; if (hid) addMiss(g, hid, -1);
      g.ch.push({ p: hid, k: 'to' });
      if (inPen(g)) { g.pen[g.ct].push(0); endQ(room, { k: 'pmiss', t: g.ct, p: hid, c: -1 }, nowT); return { room: room }; }
      g.score[other(g.ct)]++;
      endQ(room, { k: 'self', t: other(g.ct), p: hid, by: g.ct }, nowT);
      return { room: room };
    }
    if (t === 'next') {
      if (g.phase !== 'rev' || nowT < g.revEnd - 50) return err('wait');
      g.k++; g.n++;
      if (!inPen(g)) {
        if (g.n === g.half && !g.h2) { g.h2 = 1; g.phase = 'half'; g.at = nowT + HALF_MS; g.seq++; return { room: room }; }
        if (g.n >= g.total) {
          if (g.score.A === g.score.B) { g.stage = 'pen'; g.n = 0; g.phase = 'kick'; g.at = nowT + KICK_MS; g.seq++; return { room: room }; }
          finish(room); return { room: room };
        }
        beginQuestion(room, nowT); return { room: room };
      }
      if (penDecided(g)) { finish(room); return { room: room }; }
      beginQuestion(room, nowT); return { room: room };
    }
    return err('?');
  }

  // where the ball is on the field: 0 = team A goal ... 100 = team B goal (before half time A attacks to the right)
  function ballPos(room) {
    var g = room.g; if (!g) return 50;
    var dirA = g.h2 ? -1 : 1, res = g.res;
    if (g.phase === 'rev' && res) {
      if (res.k === 'goal' || res.k === 'pgoal') return res.t === 'A' ? (dirA > 0 ? 97 : 3) : (dirA > 0 ? 3 : 97);
      if (res.k === 'self') return res.by === 'A' ? (dirA > 0 ? 3 : 97) : (dirA > 0 ? 97 : 3);
      return 50;
    }
    if (g.phase !== 'q') return 50;
    var mine = g.ch.length; for (var i = g.ch.length - 1; i >= 0; i--) if (g.ch[i].k === 'sw') { mine = g.ch.length - 1 - i; break; }
    var step = Math.min(40, 12 + mine * 9); if (inPen(g)) step = 38;
    var d = (g.ct === 'A' ? dirA : -dirA);
    return 50 + d * step;
  }

  var api = {
    TOTAL: TOTAL, PEN: PEN, MAX_TEAM: MAX_TEAM, READ_MS: READ_MS, HOLD_MS: HOLD_MS, SWITCH_MS: SWITCH_MS, GRACE_MS: GRACE_MS, REVEAL_MS: REVEAL_MS, KICK_MS: KICK_MS, HALF_MS: HALF_MS, ALL: ALL,
    other: other, clone: clone, isMcq: isMcq, optionalSets: optionalSets, setRefs: setRefs, setPlayable: setPlayable, listSets: listSets, setLabel: setLabel, permute: permute, qOf: qOf, curQ: curQ,
    newRoom: newRoom, normalize: normalize, reduce: reduce, teamIds: teamIds, specIds: specIds, online: online, isAdmin: isAdmin, isCaptain: isCaptain, teamOf: teamOf, untried: untried,
    inPen: inPen, winner: winner, ballPos: ballPos, playerIds: playerIds
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(this);
