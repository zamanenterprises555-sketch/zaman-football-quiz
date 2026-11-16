// node tests/engine.test.js — pure rule tests (no browser, no Firebase)
const E = require('../engine.js'); const fs = require('fs');
const QS = new Function(fs.readFileSync(__dirname + '/../questions.js', 'utf8') + ';return questionSets')();
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } else console.log('PASS ' + m); };
let T = 1e6; let room;
const act = (a, expectErr) => { a.now = a.now || T; const r = E.reduce(room, a, QS); if (r.error) { if (!expectErr) { console.log('  err', a.type, r.error); } return r.error; } room = r.room; return null; };
function setup(nA, nB, opts = {}) {
  T = 1e6; room = E.newRoom({ code: 'TEST01', pid: 'a1', name: 'A1', now: T, set: opts.set || 'OPTIONAL QUESTIONS 1' });
  for (let i = 2; i <= nA; i++) { act({ type: 'join', pid: 'a' + i, name: 'A' + i, by: 'a' + i }); act({ type: 'team', team: 'A', by: 'a' + i }); }
  for (let i = 1; i <= nB; i++) { act({ type: 'join', pid: 'b' + i, name: 'B' + i, by: 'b' + i }); act({ type: 'team', team: 'B', by: 'b' + i }); }
  act({ type: 'join', pid: 's1', name: 'S', by: 's1', spec: true });
  act({ type: 'toss', coin: 0.2, by: 'a1' });
  act(Object.assign({ type: 'start', by: 'a1', seed: 777 }, opts.start || {}));
  T = room.g.at; act({ type: 'go', by: 'a1' });
}
const g = () => room.g; const q = () => E.curQ(room, QS).q; const read = () => { T = g().startAt + 10; };
const nextQ = () => { T = g().revEnd + 10; act({ type: 'next', by: 'a1' }); if (g().phase === 'half' || g().phase === 'kick') { T = g().at + 10; act({ type: 'go', by: 'a1' }); } };

setup(2, 2);
ok(E.teamIds(room, 'A').join() === 'a1,a2' && E.teamIds(room, 'B').join() === 'b1,b2' && room.players.s1.team === '', 'teams + spectator');
ok(room.toss.winner === 'A' && g().ft === 'A' && g().h === 'a1', 'toss winner A kicks off, starter a1');
ok(act({ type: 'answer', i: q().a, by: 'a1', now: g().qAt + 1000 }, 1), 'answer refused during 3 s reading');
read(); let h = g().h; ok(act({ type: 'answer', i: q().a, by: 'a2' }, 1), 'only the holder can answer');
act({ type: 'answer', i: q().a, by: h });
ok(g().phase === 'rev' && g().res.k === 'goal' && g().score.A === 1, 'correct answer = goal');
const seen = [g().qs[g().k]];
nextQ(); ok(g().ft === 'B' && g().h === 'b1', 'kick-off alternates to team B (starter b1)');
read(); act({ type: 'answer', i: (q().a + 1) % 4, by: 'b1' });
ok(g().h === 'b2' && g().tried.b1 && g().phase === 'q', 'wrong answer → ball passes to next teammate');
ok(act({ type: 'pass', to: 'b1', by: 'b2' }, 1), 'cannot pass to someone who already had the question');
act({ type: 'answer', i: (q().a + 2) % 4, by: 'b2' });
ok(g().ct === 'A' && g().td === 1 && ['a1', 'a2'].includes(g().h), 'whole team failed → ball to the other team');
ok(act({ type: 'answer', i: q().a, by: g().h }, 1), 'switch notice: short wait before the other team can act');
T += E.SWITCH_MS + 10; let h2 = g().h, mate = h2 === 'a1' ? 'a2' : 'a1';
act({ type: 'pass', to: mate, by: h2 }); ok(g().h === mate, 'pass to a chosen teammate');
act({ type: 'giveup', by: mate }); ok(g().phase === 'rev' && g().res.k === 'none' && g().score.A === 1 && g().score.B === 0, 'both teams fail → no goal');
seen.push(g().qs[g().k]);
nextQ(); read();
let dl = g().dl; T = dl + 100; ok(act({ type: 'timeout', by: 'b1' }, 1), 'no self goal before 10 s (+grace)');
T = dl + E.GRACE_MS + 10; const holdTeam = g().ct; act({ type: 'timeout', by: 'b1' });
ok(g().res.k === 'self' && g().res.t === E.other(holdTeam) && g().score[E.other(holdTeam)] >= 1, 'held 10 s → self goal for the other team');
seen.push(g().qs[g().k]);
// pass chain then goal
nextQ(); read(); h = g().h; let tm = g().ct; let m2 = g().order[tm].find(x => x !== h);
act({ type: 'pass', to: m2, by: h }); T += 3000; act({ type: 'answer', i: q().a, by: m2 });
ok(g().res.k === 'goal' && g().res.p === m2, 'pass chain → teammate scores');
// after a pass the receiver gets a fresh 10 s
// play to the end, check half-time and no repeats
let halfSeen = false; let guard = 0;
while (room.status === 'playing' && guard++ < 200) {
  T = g().revEnd + 10; act({ type: 'next', by: 'a1' });
  if (g().phase === 'half') { halfSeen = g().n === 15; T = g().at + 10; act({ type: 'go', by: 'a1' }); }
  if (g().phase === 'kick' || room.status !== 'playing') break;
  read(); act({ type: 'answer', i: g().ct === 'A' ? q().a : (q().a + 1) % 4, by: g().h });
  while (g().phase === 'q') { T += 100; const r = act({ type: 'answer', i: (q().a + 1) % 4, by: g().h }, 1); if (r) { T += 2000; act({ type: 'giveup', by: g().h }, 1); } }
}
ok(halfSeen, 'half time after question 15');
const regRefs = g().log.filter(l => l.st === 'reg').map(l => l.ref);
ok(regRefs.length === 30 && new Set(regRefs).size === 30, '30 regulation questions, no repeats (' + regRefs.length + ')');
ok(regRefs.every(r => r.startsWith('OPTIONAL QUESTIONS 1|')), 'regulation questions from the chosen set');
ok(room.status === 'finished' && g().win === 'A', 'match finished, A wins ' + g().score.A + '-' + g().score.B);

// penalties: short debug match 2 questions, both no goal → shootout 5 → sudden death
setup(1, 1, { start: { dbg: 1, total: 2, penN: 5 } });
ok(g().total === 2, 'debug short match');
for (let i = 0; i < 2; i++) { read(); act({ type: 'giveup', by: g().h }); T += E.SWITCH_MS + 10; act({ type: 'giveup', by: g().h }); nextQ(); }
ok(g().stage === 'pen' && g().phase === 'q', 'tie after regulation → penalty shootout');
ok(act({ type: 'pass', to: 'b1', by: g().h }, 1), 'no pass in penalties');
// A scores, B misses x3: A leads 3-0 after 3 rounds -> decided when B cannot catch up
const kick = good => { read(); act({ type: 'answer', i: good ? q().a : (q().a + 1) % 4, by: g().h }); };
kick(1); ok(g().res.k === 'pgoal', 'penalty goal'); nextQ(); kick(0); ok(g().res.k === 'pmiss', 'penalty miss'); nextQ();
kick(1); nextQ(); kick(0); nextQ(); kick(1); nextQ(); kick(0);
T = g().revEnd + 10; act({ type: 'next', by: 'a1' });
ok(room.status === 'finished' && g().win === 'A', 'shootout ends early when decided (A 3-0 after 3 rounds)');
const all = g().log.map(l => l.ref); ok(new Set(all).size === all.length, 'no repeats incl. penalties');
// sudden death
setup(1, 1, { start: { dbg: 1, total: 2, penN: 1 } });
for (let i = 0; i < 2; i++) { read(); act({ type: 'giveup', by: g().h }); T += E.SWITCH_MS + 10; act({ type: 'giveup', by: g().h }); nextQ(); }
kick(1); nextQ(); kick(1); nextQ(); ok(g().stage === 'sd' && room.status === 'playing', 'penalties level → sudden death');
kick(1); nextQ(); kick(0); T = g().revEnd + 10; act({ type: 'next', by: 'a1' });
ok(room.status === 'finished' && g().win === 'A', 'sudden death decided');
// penalty timeout = miss, not self goal
setup(1, 1, { start: { dbg: 1, total: 2, penN: 1 } });
for (let i = 0; i < 2; i++) { read(); act({ type: 'giveup', by: g().h }); T += E.SWITCH_MS + 10; act({ type: 'giveup', by: g().h }); nextQ(); }
read(); T = g().dl + E.GRACE_MS + 10; act({ type: 'timeout', by: 'b1' }); ok(g().res.k === 'pmiss' && g().score.B === 0, 'penalty timeout = miss');
// replace offline holder with a spectator
setup(2, 2); read(); h = g().h; room.players[h].online = false;
ok(act({ type: 'replace', out: h, in: 's1', by: 'b1' }, 1), 'other team captain cannot replace');
ok(!act({ type: 'replace', out: h, in: 's1', by: 'a2' }), 'captain/host replaces offline player');
ok(g().h === 's1' && g().order.A.includes('s1') && room.players[h].team === '', 'substitute takes the ball');
// wrong-answer review data
ok((g().miss.b1 || []).length === 0 && E.setPlayable(QS, E.ALL), 'mixed set playable');
setup(2, 2, { set: E.ALL }); ok(g().qs.length === 60, 'ALL set: 60 questions in pool');
// set list only optional
ok(E.listSets(QS).length === 3, 'set picker: 2 sets + mixed');
// stale action
setup(2, 2); read(); const seq = g().seq; T = g().dl + E.GRACE_MS + 10; act({ type: 'timeout', by: 'a1' }); ok(act({ type: 'timeout', by: 'b1' }, 1), 'duplicate timeout refused (resolves once)');
console.log(fails ? fails + ' FAILED of ' + n : 'ALL ' + n + ' PASSED'); process.exit(fails ? 1 : 0);
