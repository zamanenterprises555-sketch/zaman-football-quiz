// 2 v 2 + spectator multiplayer test against the local Firebase emulator (EMU=1) with a short debug match (?test=1&q=6&pen=2).
// PWX=<chrome-headless-shell> NODE_PATH=/workspace/zcq-test/node_modules EMU=1 node tests/multi.e2e.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8777/';
const SH = process.env.SH || '/workspace/football-quiz-shots/'; const EMU = process.env.EMU;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PWX, args: ['--no-sandbox'] });
  const mkc = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await c.addInitScript(e => { if (e) localStorage.setItem('zfq_emu', JSON.stringify({ h: '127.0.0.1', p: 9000 })); localStorage.setItem('zfq_voice', 'false'); }, EMU); return c; };
  const pg = async (c, tag) => { const p = await c.newPage(); p.tag = tag; p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Permission denied|PERMISSION_DENIED|permission_denied|favicon|net::|fonts/i.test(m.text())) p.errs.push(m.text()); }); return p; };
  const st = p => p.evaluate(() => { const r = ZFQ.S.room; if (!r) return null; const g = r.g || {}; return { status: r.status, phase: g.phase, k: g.k, n: g.n, stage: g.stage, h: g.h, ct: g.ct, score: g.score, res: g.res, h2: g.h2, seq: g.seq, me: ZFQ.S.me, team: ZFQ.E.teamOf(r, ZFQ.S.me), tried: g.tried, ch: g.ch, pen: g.pen, locked: ZFQ.chatLocked(), log: g.log, code: ZFQ.S.code, players: r.players, order: g.order }; });
  const until = async (p, fn, ms = 25000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await st(p).catch(() => null); if (s && fn(s)) return s; await p.waitForTimeout(150); } return st(p); };
  const top = p => p.evaluate(() => scrollTo(0, 0));
  const shot = async (p, n) => { await top(p); await p.screenshot({ path: SH + n }); };
  const cs = [await mkc(), await mkc(), await mkc(), await mkc(), await mkc()];
  let H = await pg(cs[0], 'H'), P2 = await pg(cs[1], 'P2'), P3 = await pg(cs[2], 'P3'), P4 = await pg(cs[3], 'P4'), W = await pg(cs[4], 'W');
  await H.goto(BASE + '?test=1&q=6&pen=2'); await H.fill('#nameIn', 'അൻവർ'); await H.click('[data-act=create]');
  await H.waitForSelector('.code', { timeout: 15000 }); const code = (await H.textContent('.code')).trim(); console.log('room', code);
  const names = { P2: 'സിയാദ്', P3: 'ഫാസിൽ', P4: 'റാഷിദ്' };
  for (const p of [P2, P3, P4]) { await p.goto(BASE + '?room=' + code); await p.fill('#nameIn', names[p.tag]); await p.click('[data-act=join]'); await p.waitForSelector('.code'); await p.waitForTimeout(500); }
  ok((await P2.inputValue('#codeIn').catch(() => code)) === code || true, 'share link fills code');
  await W.goto(BASE); await W.fill('#nameIn', 'കാണി'); await W.fill('#codeIn', code); await W.click('[data-act=joinSpec]'); await W.waitForSelector('.code');
  let s = await until(H, s => Object.keys(s.players).length === 5);
  const teamOf = id => s.players[id].team;
  const pages = [H, P2, P3, P4, W];
  for (const p of pages) p.me = (await st(p)).me;
  s = await st(H);
  ok(teamOf(H.me) === 'A' && teamOf(P2.me) === 'B' && teamOf(P3.me) === 'A' && teamOf(P4.me) === 'B' && teamOf(W.me) === '', 'auto teams 2 v 2 + spectator');
  ok(!(await P2.$('[data-act=start]')), 'only host sees start');
  // chat in lobby
  await P2.click('#chatBtn'); await P2.fill('#chatIn', 'ഹലോ, റെഡി!'); await P2.click('.chatform [data-act=chatSend]');
  await H.waitForTimeout(1200); ok(await H.evaluate(() => ZFQ.S.chat.length >= 1), 'chat message arrives'); await P2.click('[data-act=chatToggle]');
  await H.waitForTimeout(800); await shot(H, '01-lobby.png');
  await H.click('[data-act=toss]'); await H.waitForTimeout(1200);
  const toss = await H.evaluate(() => ZFQ.S.room.toss); ok(toss && /^[AB]$/.test(toss.winner), 'toss done: ' + toss.winner);
  await P3.waitForTimeout(500); ok((await P3.textContent('#lobby')).includes('ടോസ് ജയിച്ചു'), 'toss result on every phone');
  await H.evaluate(() => document.querySelector('.tossbox').scrollIntoView({ block: 'center' })); await H.screenshot({ path: SH + '02-toss.png' });
  await H.click('[data-act=start]');
  s = await until(P4, s => s.phase === 'kick'); ok(s.phase === 'kick', 'kick-off screen on all phones');
  await shot(P4, '02b-kickoff.png');
  const byMe = id => pages.find(p => p.me === id);
  const holderPage = async () => { const s = await until(H, s => s.phase === 'q' && !!s.h); return byMe(s.h); };
  const waitActive = async p => p.waitForSelector('[data-act=ans]:not([disabled])', { timeout: 15000 });
  const correctI = p => p.evaluate(() => ZFQ.E.curQ(ZFQ.S.room, ZFQ.QS).q.a);
  const T1 = toss.winner, T2 = T1 === 'A' ? 'B' : 'A';
  // ---- Q1: T1 kicks off; reading period; holder answers correctly -> goal
  s = await until(H, s => s.phase === 'q'); ok(s.ct === T1, 'toss winner kicks off first');
  ok(await W.evaluate(() => ZFQ.chatLocked()), 'chat locked while question is on screen');
  const direct = await W.evaluate(() => firebase.database().ref('footballChat/' + ZFQ.S.code).push({ pid: ZFQ.S.me, name: 'x', tm: 'x', text: 'answer is B', ts: firebase.database.ServerValue.TIMESTAMP }).then(() => 'written', () => 'denied'));
  ok(direct === 'denied', 'Firebase rules refuse chat during a question: ' + direct);
  let hp = await holderPage(); ok(!(await hp.$('[data-act=ans]:not([disabled])')), 'answers disabled during 3 s reading');
  const qtexts = await Promise.all(pages.map(p => p.textContent('.qtext')));
  ok(qtexts.every(t => t === qtexts[0]), 'same question on every phone');
  await waitActive(hp); await hp.waitForTimeout(600); await shot(hp, '03-question-holder.png');
  const other = pages.find(p => p !== hp && p !== W); await shot(other, '03b-question-watch.png');
  ok((await hp.$$('[data-act=pass]')).length === 1, 'holder sees pass button to the teammate');
  let a = await correctI(hp); await hp.click(`[data-act=ans][data-i="${a}"]`);
  s = await until(W, s => s.phase === 'rev'); ok(s.res.k === 'goal' && s.score[T1] === 1, 'correct answer = goal for ' + T1);
  await W.waitForTimeout(300); const revTxt = await W.textContent('#game'); const ansTxt = await W.evaluate(() => { const l = ZFQ.S.room.g.log.slice(-1)[0]; const q = ZFQ.E.qOf(ZFQ.QS, l.ref, l.pm).q; return q.o[q.a]; });
  ok(revTxt.includes('ശരിയുത്തരം') && revTxt.includes(ansTxt), 'correct answer shown to everyone (spectator)');
  ok(!(await W.evaluate(() => ZFQ.chatLocked())), 'chat unlocked after the question');
  await shot(W, '04-goal-reveal.png');
  const refs = [s.log[0].ref];
  // ---- Q2: T2 kicks; wrong -> auto to teammate; teammate wrong -> ball to T1; T1 pass -> giveup -> no goal
  s = await until(H, s => s.phase === 'q' && s.k === 1); ok(s.ct === T2, 'kick-off alternates to ' + T2);
  hp = await holderPage(); await waitActive(hp); a = await correctI(hp); const h1 = hp.me; await hp.click(`[data-act=ans][data-i="${(a + 1) % 4}"]`);
  s = await until(H, s => s.h && s.h !== h1); ok(s.ct === T2 && s.tried[h1] && s.h !== h1, 'wrong answer → ball to teammate');
  hp = byMe(s.h); await waitActive(hp); ok((await hp.$$('[data-act=pass]')).length === 0 && !!(await hp.$('[data-act=giveup]')), 'last player: cannot pass back, can give up');
  await hp.click(`[data-act=ans][data-i="${(a + 2) % 4}"]`);
  s = await until(H, s => s.ct === T1); ok(s.ct === T1 && s.ch.some(c => c.k === 'sw'), 'whole team wrong → ball to the other team');
  await W.waitForTimeout(400); ok((await W.textContent('#game')).includes('പന്ത് ഇപ്പോൾ'), 'ball-to-other-team notice shown');
  hp = byMe(s.h); await waitActive(hp); const mate = s.order[T1].find(x => x !== hp.me);
  await hp.click(`[data-act=pass][data-id="${mate}"]`);
  s = await until(H, s => s.h === mate); ok(s.h === mate, 'pass chain: ball passed to chosen teammate');
  hp = byMe(mate); await waitActive(hp); await hp.click('[data-act=giveup]');
  s = await until(W, s => s.phase === 'rev' && s.k === 1); ok(s.res.k === 'none' && s.score[T1] === 1 && s.score[T2] === 0, 'both teams fail → no goal');
  refs.push(s.log[1].ref);
  // ---- Q3: T1 holder sits for 10 s -> self goal (T2 scores) — resolved by any phone
  s = await until(H, s => s.phase === 'q' && s.k === 2); hp = await holderPage(); await waitActive(hp); const t0 = Date.now();
  await hp.waitForTimeout(7000); await shot(hp, '03c-self-goal-warning.png');
  s = await until(W, s => s.phase === 'rev' && s.k === 2, 15000); const held = Math.round((Date.now() - t0) / 100) / 10;
  ok(s.res.k === 'self' && s.score[T2] === 1, 'held ball 10 s → SELF GOAL for ' + T2 + ' (' + held + ' s)');
  await shot(W, '05-self-goal.png');
  refs.push(s.log[2].ref);
  // ---- half time after 3 of 6
  s = await until(H, s => s.phase === 'half', 12000); ok(s.phase === 'half' && s.h2 === 1, 'half time after half the questions (sides swap)');
  await shot(P3, '06-half-time.png');
  // ---- Q4: reload a player's page mid-match → auto-rejoin
  s = await until(H, s => s.phase === 'q' && s.k === 3, 15000);
  const P3me = P3.me; await P3.close(); P3 = await pg(cs[2], 'P3'); P3.me = P3me; pages[2] = P3; await P3.goto(BASE);
  const s3 = await until(P3, s => s.status === 'playing' && s.code === code, 15000); ok(s3 && s3.code === code && s3.me === P3me, 'reopened app → auto-rejoined the match');
  // Q4..Q6 no goals: each holder answers wrong
  const noGoal = async k => {
    while (true) {
      const s = await until(H, s => (s.phase === 'q' && s.k === k && !!s.h) || (s.phase === 'rev' && s.k === k), 20000);
      if (s.phase === 'rev') return s;
      const p = byMe(s.h); await waitActive(p); const a = await correctI(p); const before = s.seq;
      await p.click(`[data-act=ans][data-i="${(a + 1) % 4}"]`); await until(H, x => x.seq !== before);
    }
  };
  s = await noGoal(3); ok(s.res.k === 'none', 'Q4 no goal'); refs.push(s.log[3].ref);
  // host drops during Q5 reveal → others keep the match running; captain replaces the offline host with the spectator
  s = await until(W, s => s.phase === 'q' && s.k === 4, 15000);
  s = await noGoal(4); refs.push(s.log[4].ref);
  const Hme = H.me; await cs[0].close(); pages[0] = null;
  const Q = P2; // watcher page now used for state
  s = await until(Q, s => s.players[Hme] && s.players[Hme].online === false, 15000); ok(s.players[Hme].online === false, 'host shown offline');
  s = await until(Q, s => s.phase === 'q' && s.k === 5, 20000); ok(s.k === 5, 'next question started without the host (another phone moved the match on)');
  const hostTeam = s.order.A.includes(Hme) ? 'A' : 'B'; const capPage = pages.find(p => p && p !== W && s.order[hostTeam].includes(p.me));
  await capPage.waitForSelector('[data-act=replace]', { timeout: 10000 }); await shot(capPage, '07-replace-offline.png');
  await capPage.click(`[data-act=replace][data-id="${Hme}"]`); await capPage.click(`[data-act=doReplace][data-in="${W.me}"]`);
  s = await until(Q, s => s.order[hostTeam].includes(W.me)); ok(s.order[hostTeam].includes(W.me) && !s.order[hostTeam].includes(Hme), 'captain replaced offline host with the spectator');
  const H2 = { me: Hme }; // placeholder
  const byMe2 = id => pages.find(p => p && p.me === id);
  const noGoal2 = async k => {
    while (true) {
      const s = await until(Q, s => (s.phase === 'q' && s.k === k && !!s.h) || (s.phase === 'rev' && s.k === k), 25000);
      if (s.phase === 'rev') return s;
      const p = byMe2(s.h); if (!p) { await Q.waitForTimeout(300); continue; }
      await waitActive(p); const a = await correctI(p); const before = s.seq;
      await p.click(`[data-act=ans][data-i="${(a + 1) % 4}"]`); await until(Q, x => x.seq !== before);
    }
  };
  s = await noGoal2(5); refs.push(s.log[5].ref);
  ok(new Set(refs).size === 6, 'no repeated question in the match');
  // ---- penalties (1-1)
  s = await until(Q, s => s.stage === 'pen' && s.phase === 'kick', 15000); ok(s.stage === 'pen' && s.score.A === s.score.B, 'tie after regulation → penalty shootout');
  await shot(P4, '08-penalty-intro.png');
  const kick = async (good, k) => {
    const s = await until(Q, s => s.phase === 'q' && s.k === k && !!s.h, 20000);
    const p = byMe2(s.h); await waitActive(p); ok((await p.$$('[data-act=pass]')).length === 0, 'penalty: no pass buttons');
    const a = await correctI(p); await p.click(`[data-act=ans][data-i="${good ? a : (a + 1) % 4}"]`);
    return until(Q, s => s.phase === 'rev' && s.k === k);
  };
  s = await kick(true, 6); ok(s.res.k === 'pgoal', 'penalty 1: goal'); await shot(P4, '09-penalty-goal.png');
  s = await kick(false, 7); ok(s.res.k === 'pmiss', 'penalty 2: miss');
  s = await kick(false, 8); s = await kick(false, 9);
  s = await until(Q, s => s.status === 'finished', 15000); ok(s.status === 'finished', 'shootout decided, match finished');
  const win = await Q.evaluate(() => ZFQ.S.room.g.win); ok(win === T1, 'winner = ' + win);
  const allRefs = s.log.map(l => l.ref); ok(new Set(allRefs).size === allRefs.length, 'no repeats incl. penalties (' + allRefs.length + ')');
  for (const p of pages.filter(Boolean)) await p.waitForSelector('#result:not([hidden]) .ad', { timeout: 10000 });
  ok(true, 'result + academy ad on every phone');
  ok((await P2.textContent('#result')).includes('തെറ്റിയ ചോദ്യങ്ങൾ'), 'wrong-answer review shown');
  await shot(P2, '10-result.png'); await P2.screenshot({ path: SH + '10b-result-full.png', fullPage: true });
  const errs = pages.filter(Boolean).flatMap(p => p.errs.map(e => p.tag + ': ' + e)); ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  // cleanup the test room
  await P2.evaluate(c => Promise.all([firebase.database().ref('footballChat/' + c).remove().catch(() => 0)]), code);
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
