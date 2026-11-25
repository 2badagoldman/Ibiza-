// Ibiza demo recorder: runs inside a Vercel build (which can reach the live site).
// Records phone-size clips of ibizadj.app with CDP screencast, encodes H.264 MP4 (no audio),
// uploads each clip + poster to Vercel Blob (demo/<run>/...), writes public/rec/manifest.json.
// Never fails the build: errors are logged into the manifest.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const OUT = path.join(__dirname, 'public', 'rec');
fs.mkdirSync(OUT, { recursive: true });
const RUN = 'v' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const BASE = process.env.REC_BASE || 'https://ibizadj.app';
const ONLY = (process.env.REC_ONLY || '').split(',').filter(Boolean);
const manifest = { run: RUN, base: BASE, started: new Date().toISOString(), clips: [], log: [] };
const log = (...a) => { const s = a.join(' '); console.log(s); manifest.log.push(s.slice(0, 400)); };
const save = () => fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), '<!doctype html><title>rec</title><a href="/rec/manifest.json">manifest</a>');
save();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CONCEPTS = fs.readFileSync(path.join(__dirname, 'concepts.js'), 'utf8');

(async () => {
  let chromium, puppeteer, ffmpeg, put;
  process.env.AWS_EXECUTION_ENV = process.env.AWS_EXECUTION_ENV || 'AWS_Lambda_nodejs22.x';
  process.env.AWS_LAMBDA_JS_RUNTIME = process.env.AWS_LAMBDA_JS_RUNTIME || 'nodejs22.x';
  try {
    chromium = require('@sparticuz/chromium'); puppeteer = require('puppeteer-core');
    ffmpeg = require('ffmpeg-static'); ({ put } = require('@vercel/blob'));
  } catch (e) { log('deps', e.message); save(); return; }
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN; log('blob token present:', hasBlob);
  try { fs.mkdirSync('/tmp/fonts', { recursive: true }); const r = await fetch('https://raw.githubusercontent.com/googlefonts/noto-emoji/main/fonts/NotoColorEmoji.ttf'); fs.writeFileSync('/tmp/fonts/NotoColorEmoji.ttf', Buffer.from(await r.arrayBuffer())); log('emoji font', r.status, fs.statSync('/tmp/fonts/NotoColorEmoji.ttf').size); } catch (e) { log('emoji font', String(e)); }
  let browser;
  const launch = async () => {
    browser = await puppeteer.launch({
      args: [...chromium.args.filter((a) => !/single-process/.test(a)), '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--disable-dev-shm-usage'],
      executablePath: await chromium.executablePath(), headless: true, defaultViewport: null, protocolTimeout: 120000,
    });
  };
  try { await launch(); } catch (e) { log('launch', e.stack); save(); return; }

  async function newPage() {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: +(process.env.REC_DPR || 1.5), isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    page.on('pageerror', (e) => log('  pageerror', String(e.message).slice(0, 160)));
    page.setDefaultTimeout(30000);
    return page;
  }
  // helpers injected into the page
  const HELP = `window.__tap=(x,y)=>{const d=document.createElement('div');d.style.cssText='position:fixed;left:'+(x-24)+'px;top:'+(y-24)+'px;width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.9);z-index:2147483646;pointer-events:none;transition:transform .5s ease,opacity .5s ease';document.documentElement.appendChild(d);requestAnimationFrame(()=>{d.style.transform='scale(1.6)';d.style.opacity='0'});setTimeout(()=>d.remove(),600)};`;
  async function tapEl(page, sel) {
    const h = typeof sel === 'string' ? await page.$(sel) : sel; if (!h) { log('  no el', sel); return false; }
    try { await h.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' })); } catch {}
    await wait(250);
    const b = await h.boundingBox(); if (!b) { log('  no box', sel); return false; }
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.evaluate((x, y) => window.__tap && window.__tap(x, y), x, y);
    await page.mouse.click(x, y); return true;
  }
  async function tapText(page, re, scope = 'button,a,[role=button]') {
    const h = await page.evaluateHandle((src, scope) => { const r = new RegExp(src, 'i'); return [...document.querySelectorAll(scope)].find((e) => r.test(e.textContent || e.getAttribute('aria-label') || '') && e.offsetParent !== null) || null; }, re.source, scope);
    const el = h.asElement(); if (!el) { log('  no text', re); return false; }
    return tapEl(page, el);
  }
  async function smooth(page, dy, ms) {
    await page.evaluate((dy, ms) => new Promise((res) => { const s = scrollY, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; scrollTo(0, s + dy * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }), dy, ms);
  }
  async function load(page, url) {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(HELP);
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 }).catch(() => {});
    await wait(2500);
  }
  async function home(page) {
    await load(page, '/');
    await page.waitForFunction(() => window.Selector && window.Selector.pickGenre && window.Selector.S && window.Selector.S.region, { timeout: 30000 }).catch(() => log('  Selector not ready'));
    await wait(800);
  }
  async function startDJ(page, id) {
    await page.evaluate((id) => { const s = window.Selector; s.S.mix30 = true; s.pickGenre(id); s.startSet(); }, id);
    const ok = await page.waitForFunction(() => window.Selector.S.running && window.Selector.S.nowT && document.body.dataset.view === 'player', { timeout: 45000 }).then(() => true).catch(() => false);
    if (!ok) log('  set did not start for', id);
    await page.evaluate(() => scrollTo(0, 0)); await wait(1500);
    return ok;
  }

  // ---- recorder ----
  async function record(page, id, secs, during) {
    const cdp = await page.target().createCDPSession();
    const frames = [];
    cdp.on('Page.screencastFrame', async (f) => { frames.push({ t: f.metadata.timestamp, d: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 72, maxWidth: 600, maxHeight: 1300, everyNthFrame: 1 });
    const t0 = Date.now() / 1000;
    try { if (during) await Promise.race([during(), wait(secs * 1000 + 4000)]); } catch (e) { log('  during err', e.message); }
    const left = secs - (Date.now() / 1000 - t0); if (left > 0) await wait(left * 1000);
    const tEnd = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {}); await cdp.detach().catch(() => {});
    if (frames.length < 3) throw new Error('only ' + frames.length + ' frames');
    const dir = fs.mkdtempSync('/tmp/f-'); let list = '';
    frames.forEach((f, i) => { const p = path.join(dir, String(i).padStart(5, '0') + '.jpg'); fs.writeFileSync(p, Buffer.from(f.d, 'base64')); const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(f.t + 0.05, tEnd); list += `file '${p}'\nduration ${Math.max(0.02, Math.min(2, next - f.t)).toFixed(3)}\n`; });
    list += `file '${path.join(dir, String(frames.length - 1).padStart(5, '0') + '.jpg')}'\n`;
    fs.writeFileSync(path.join(dir, 'list.txt'), list);
    const mp4 = path.join(OUT, id + '.mp4'), jpg = path.join(OUT, id + '.jpg'), sheet = path.join(OUT, id + '.sheet.jpg');
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', 'scale=540:-2:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-profile:v', 'high', '-movflags', '+faststart', '-an', mp4]);
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', '1.2', '-i', mp4, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '5', jpg]);
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `fps=${(5 / secs).toFixed(3)},scale=200:-2,tile=5x1`, '-frames:v', '1', '-q:v', '6', sheet]);
    fs.writeFileSync(sheet + '.b64.txt', fs.readFileSync(sheet).toString('base64'));
    fs.rmSync(dir, { recursive: true, force: true });
    const out = { id, fps: +(frames.length / (tEnd - t0)).toFixed(1), frames: frames.length, secs: +(tEnd - t0).toFixed(1), bytes: fs.statSync(mp4).size };
    if (hasBlob) {
      const a = await put(`demo/${RUN}/${id}.mp4`, fs.readFileSync(mp4), { access: 'public', contentType: 'video/mp4', addRandomSuffix: false, allowOverwrite: true });
      const b = await put(`demo/${RUN}/${id}.jpg`, fs.readFileSync(jpg), { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true });
      out.url = a.url; out.poster = b.url;
    }
    return out;
  }

  // ---- the clips ----
  const live = (id, title, fn, secs = 9) => ({ id, title, fn, secs });
  const CLIPS = [
    live('home', 'Home', async (p) => { await home(p); await p.evaluate(() => scrollTo(0, 0)); return () => smooth(p, 1500, 8000); }, 9),
    live('decks', 'Decks', async (p) => { await home(p); await startDJ(p, 'ibiza'); return async () => { await wait(4500); await smooth(p, 260, 2500); }; }, 9),
    live('djmenu', 'Switch DJ', async (p) => { await home(p); await startDJ(p, 'pop'); return async () => { await wait(900); await tapEl(p, '.djm-btn'); await wait(1800); await tapEl(p, '.djm-i[data-dj="afrobeats"]'); }; }, 10),
    live('sara', 'DJ Sara', async (p) => { await home(p); await startDJ(p, 'habesha'); return async () => { await wait(5000); await smooth(p, 220, 2000); }; }, 9),
    live('loves', 'Loves', async (p) => { await home(p); await startDJ(p, 'afrobeats'); await p.evaluate(() => { const b = document.querySelector('#like'); b && b.scrollIntoView({ block: 'center' }); }); await wait(600); return async () => { await wait(800); await tapEl(p, '#like'); await wait(2600); await p.evaluate(() => window.IbizaLove && window.IbizaLove.test.big()); await wait(2200); await p.evaluate(() => window.IbizaLove && window.IbizaLove.test.burst()); }; }, 9),
    live('reactions', 'Reactions', async (p) => { await home(p); await startDJ(p, 'hiphop'); await p.evaluate(() => { const b = document.querySelector('#like'); b && b.scrollIntoView({ block: 'center' }); }); await wait(800); return async () => {
      await wait(500); await tapEl(p, '#lv-react'); await wait(1300);
      await tapEl(p, '[data-rx="fire"]'); await wait(2600);
      await tapEl(p, '#lv-react'); await wait(900); await tapEl(p, '[data-rx="laugh"]'); await wait(2400);
      await tapEl(p, '#lv-react'); await wait(900); await tapEl(p, '[data-rx="like"]'); }; }, 12),
    live('bell', 'Bell', async (p) => { await home(p); await startDJ(p, 'rnb'); await p.evaluate(() => { try { const t = window.Selector.S.nowT; window.IbizaReact && window.IbizaReact.react('fire'); } catch {} }); await wait(2200); await p.evaluate(() => scrollTo(0, 0)); await wait(500); return async () => { await wait(700); await tapEl(p, '#g3-bell'); await wait(5500); }; }, 9),
    live('christmas', 'Christmas DJ', async (p) => { await home(p); await startDJ(p, 'christmas'); return async () => { await wait(6000); await smooth(p, 200, 2000); }; }, 10),
    live('aiblends', 'AI Blends', async (p) => { await home(p); await p.evaluate(() => { const a = document.getElementById('aiblends'); a && a.scrollIntoView({ block: 'start' }); scrollBy(0, -60); }); await wait(1200); return async () => { await wait(1500); await tapEl(p, '#aiblends [data-aib="2"]'); await wait(6000); }; }, 10),
    live('kids', 'Kids DJ', async (p) => { await home(p); await startDJ(p, 'kids'); return async () => { await wait(6000); }; }, 8),
    live('upnext', 'Smart picks', async (p) => { await home(p); await startDJ(p, 'amapiano'); await wait(1500); return async () => { await wait(1500); await p.evaluate(() => { const u = document.getElementById('upnext'); if (u) { const y = u.getBoundingClientRect().top + scrollY - 140; window.__ty = y; } }); const y = await p.evaluate(() => window.__ty || 900); await smooth(p, y, 4500); }; }, 9),
    live('mydj', 'My DJ', async (p) => { await load(p, '/mydj'); await wait(1500); return async () => { await wait(2500); await tapText(p, /mixer|fx|pads/); await wait(2500); await tapText(p, /pads|fx/); }; }, 9),
    live('gallery', 'Gallery', async (p) => { await load(p, '/gallery.html'); await wait(1500); return () => smooth(p, 1800, 8000); }, 9),
    live('artists', 'Artists', async (p) => { await load(p, '/artists.html'); await wait(1500); return () => smooth(p, 1400, 7500); }, 9),
    live('enter', 'Enter Ibiza', async (p) => { await load(p, '/enter.html'); await wait(1500); return () => smooth(p, 2200, 8500); }, 9),
    live('brain', 'AI brain', async (p) => { await load(p, '/brain.html'); await wait(1500); return () => smooth(p, 900, 7000); }, 8),
  ];
  const CONCEPT = [['sunset', 'house'], ['party', 'afrobeats'], ['crowdcam', 'house'], ['dedicate', 'rnb'], ['battle', 'dancehall'], ['hum', 'pop'], ['reel', 'ibiza'], ['stems', 'hiphop']];
  for (const [c, dj] of CONCEPT) CLIPS.push({ id: 'cx-' + c, title: c, secs: 10, fn: async (p) => { await home(p); await startDJ(p, dj); await p.evaluate(CONCEPTS); return () => p.evaluate((c) => window.__concept(c), c); } });

  for (const c of CLIPS) {
    if (ONLY.length && !ONLY.includes(c.id)) continue;
    const t = Date.now(); let page;
    try {
      if (!browser || !browser.connected) await launch();
      page = await newPage();
      const during = await c.fn(page);
      const r = await record(page, c.id, c.secs, during);
      const info = await page.evaluate(() => ({ dj: window.Selector && window.Selector.S && window.Selector.S.genre, song: window.Selector && window.Selector.S && window.Selector.S.nowT ? window.Selector.S.nowT.title + ' · ' + window.Selector.S.nowT.artist : '' })).catch(() => ({}));
      manifest.clips.push({ ...r, title: c.title, ...info, ms: Date.now() - t });
      log('ok', c.id, JSON.stringify(r));
    } catch (e) { log('FAIL', c.id, e.message); manifest.clips.push({ id: c.id, error: e.message }); }
    try { await page.close(); } catch {}
    save();
  }
  manifest.done = new Date().toISOString(); save();
  await Promise.race([browser.close().catch(() => {}), wait(5000)]);
  process.exit(0);
})().catch((e) => { log('fatal', e.stack); save(); process.exit(0); });
setTimeout(() => { log('global timeout'); save(); process.exit(0); }, 38 * 60 * 1000).unref();
