// Solo vs computer, short debug match. PWX=... NODE_PATH=/workspace/zcq-test/node_modules node tests/solo.e2e.js
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8777/'; const SH = process.env.SH || '/workspace/football-quiz-shots/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PWX, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await c.addInitScript(() => localStorage.setItem('zfq_voice', 'false'));
  const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|net::|fonts/.test(m.text())) errs.push(m.text()); });
  const st = () => p.evaluate(() => { const r = ZFQ.S.room; if (!r) return null; const g = r.g || {}; return { status: r.status, phase: g.phase, k: g.k, h: g.h, me: ZFQ.S.me, seq: g.seq, res: g.res, score: g.score, stage: g.stage, log: g.log }; });
  await p.goto(BASE + '?test=1&q=8&pen=2'); await p.waitForTimeout(700);
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + '00-home.png' });
  await p.fill('#nameIn', 'അൻവർ'); await p.selectOption('#soloSize', '2');
  await p.click('[data-act=homeSet][data-set="OPTIONAL QUESTIONS 2"]');
  await p.click('[data-act=solo]');
  let s = await st(); ok(s && s.status === 'playing' && s.phase === 'kick', 'solo match started with toss + kick-off');
  const did = []; let botMoves = 0, lastSeq = -1, t0 = Date.now(), shotDone = false;
  while (Date.now() - t0 < 300000) {
    s = await st(); if (!s || s.status !== 'playing') break;
    if (s.phase === 'q' && s.h !== s.me && s.seq !== lastSeq) { lastSeq = s.seq; }
    if (s.phase === 'q' && s.h === s.me) {
      const btn = await p.$('[data-act=ans]:not([disabled])'); if (!btn) { await p.waitForTimeout(150); continue; }
      const a = await p.evaluate(() => ZFQ.E.curQ(ZFQ.S.room, ZFQ.QS).q.a), pass = await p.$('[data-act=pass]');
      const mode = did.length % 4; const seq = s.seq;
      if (s.stage !== 'reg') { await p.click(`[data-act=ans][data-i="${a}"]`); did.push('pen'); }
      else if (mode === 0 && pass) { if (!shotDone) { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + 'solo-question.png' }); shotDone = true; } await pass.click(); did.push('pass'); }
      else if (mode === 1) { await p.click(`[data-act=ans][data-i="${a}"]`); did.push('ok'); }
      else if (mode === 2) { await p.click(`[data-act=ans][data-i="${(a + 1) % 4}"]`); did.push('wrong'); }
      else { did.push('hold'); }
      const t = Date.now(); while (Date.now() - t < 13000) { const x = await st(); if (x.seq !== seq) break; await p.waitForTimeout(150); }
      continue;
    }
    await p.waitForTimeout(150);
  }
  s = await st();
  ok(s.status === 'finished', 'solo match finished (' + s.score.A + '-' + s.score.B + ', stage ' + s.stage + ')');
  ok(did.includes('pass') && did.includes('ok') && did.includes('wrong'), 'my actions: ' + did.join(','));
  const kinds = s.log.map(l => l.r); ok(s.log.length >= 8, 'questions played: ' + s.log.length + ' [' + kinds.join(',') + ']');
  ok(s.log.filter(l => l.st === 'reg').every(l => l.ref.startsWith('OPTIONAL QUESTIONS 2|')), 'chosen set (OPTIONAL QUESTIONS 2) used');
  ok(s.log.some(l => (l.ch || []).some(c => c.p && !c.p.startsWith('p') && c.k)), 'computer players acted');
  ok(new Set(s.log.map(l => l.ref)).size === s.log.length, 'no repeated questions');
  if (did.includes('hold')) ok(kinds.includes('self'), 'holding 10 s gave a self goal');
  await p.waitForSelector('#result .ad'); ok(true, 'result with academy ad');
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: SH + 'solo-result.png' });
  // reload keeps the solo match? (finished → resume not offered) ; sounds logged
  const sfx = await p.evaluate(() => ZFQ.sfxLog || []); ok(sfx.some(x => x.startsWith('whistle')) && sfx.some(x => x.startsWith('goal') || x.startsWith('low')), 'whistle + goal/low sounds played: ' + [...new Set(sfx.map(x => x.split('@')[0]))].join(','));
  ok(!sfx.some(x => /^(goal|low)@q/.test(x)), 'no result sounds while a question is live');
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
