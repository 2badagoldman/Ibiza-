/* Selector booth: draws the decks and mixer, and lets you mix with your hands. */
(function () {
  'use strict';
  const SEL = window.Selector;
  if (!SEL) return;
  const { S, Engine, YTM, SP, Ctl } = SEL;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TURN = 1.8;
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const xfg = (x) => [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)];
  const playerOn = () => !$('[data-view=player]').hidden;

  // ---------- build meters ----------
  for (const id of ['vu0', 'vu1']) { const el = $('#' + id); el.innerHTML = Array.from({ length: 14 }, (_, k) => `<b class="${k >= 12 ? 'r' : k >= 9 ? 'y' : ''}"></b>`).join(''); }

  // ---------- what each deck is doing right now ----------
  function deckInfo(i) {
    const mode = S.mode;
    if (mode === 'preview') {
      const d = Engine.D[i];
      if (!d || !d.t) return { empty: true };
      const c = Engine.ch[i];
      let lvl = 0;
      if (c && (d.playing || d.scratching)) { const a = new Uint8Array(c.an.fftSize); c.an.getByteTimeDomainData(a); let s = 0; for (let k = 0; k < a.length; k += 4) { const v = (a[k] - 128) / 128; s += v * v; } lvl = clamp(Math.sqrt(s / (a.length / 4)) * 3.2, 0, 1); }
      return { t: d.t, pick: d.pick, pos: Engine.pos(d), dur: Engine.dur(d), playing: d.playing || d.scratching, rate: d.scratching ? d.rate : d.curRate || d.rate, pitch: (d.rate * (1 + d.bend) - 1) * 100, lvl, announced: d.announced, buf: d.buf, d };
    }
    if (mode === 'youtube') {
      const slot = YTM.slots && YTM.slots[i];
      if (!slot) return { empty: true };
      const p = YTM.decks[i];
      let pos = 0, dur = 0, st = -1;
      try { pos = p.getCurrentTime() || 0; dur = p.getDuration() || 0; st = p.getPlayerState(); } catch {}
      const playing = st === 1;
      const t = slot.pick.t, beat = 60 / (t.f.bpm || 120);
      const pulse = playing ? 0.55 + 0.4 * Math.pow(Math.abs(Math.cos((pos / beat) * Math.PI)), 6) : 0;
      return { t, pick: slot.pick, pos, dur: dur || t.duration || 200, playing, rate: 1, pitch: 0, lvl: pulse * Ctl.fader[i], announced: slot.announced };
    }
    // Spotify: one stream on deck A, the AI's next pick waits on deck B
    if (i === 0 && SP.cur) return { t: SP.cur.pick.t, pick: SP.cur.pick, pos: (SP.pos || 0) / 1000, dur: (SP.dur || 1) / 1000, playing: S.running, rate: 1, pitch: 0, lvl: S.running ? 0.6 : 0, announced: true };
    if (i === 1) { const c = topCandidate(); if (c) return { t: c.t, pick: c, pos: 0, dur: c.t.duration || 200, playing: false, rate: 1, pitch: 0, lvl: 0, announced: false }; }
    return { empty: true };
  }
  function liveIdx() {
    if (S.mode === 'preview') return Engine.liveIdx();
    if (S.mode === 'youtube') return YTM.cur ? YTM.cur.deckIdx : 0;
    return 0;
  }
  let candCache = null, candAt = 0;
  function topCandidate() {
    if (Date.now() - candAt < 1000) return candCache;
    candAt = Date.now();
    const prev = S.nowT;
    let best = null;
    for (const t of S.ready) { const s = SEL.scoreNext(prev, t, S.setIndex); if (!best || s.total > best.s.total) best = { t, s }; }
    return (candCache = best);
  }

  // ---------- waveform overview ----------
  const peaksOf = new WeakMap();
  function peaks(buf) {
    if (peaksOf.has(buf)) return peaksOf.get(buf);
    const n = 220, ch = buf.getChannelData(0), step = Math.floor(ch.length / n), out = new Float32Array(n);
    let mx = 0.0001;
    for (let k = 0; k < n; k++) { let m = 0; for (let j = k * step, e = j + step; j < e; j += 8) { const v = Math.abs(ch[j]); if (v > m) m = v; } out[k] = m; if (m > mx) mx = m; }
    for (let k = 0; k < n; k++) out[k] /= mx;
    peaksOf.set(buf, out);
    return out;
  }
  function drawWave(i, info, live) {
    const c = $('#d' + i + '-wave'); if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (!w) return;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    if (info.empty) return;
    const x0 = (info.pos / info.dur) * w;
    const hot = live ? ['#ff4fa3', '#7c5cff'] : ['#9d8bff', '#5b4bbd'];
    if (info.buf) {
      const pk = peaks(info.buf), n = pk.length, bw = w / n;
      for (let k = 0; k < n; k++) {
        const x = k * bw, bh = Math.max(1.5, pk[k] * (h - 8));
        g.fillStyle = x < x0 ? 'rgba(255,255,255,.22)' : (k % 2 ? hot[0] : hot[1]);
        g.fillRect(x, (h - bh) / 2, Math.max(1, bw - 1), bh);
      }
    } else {
      // full songs on YouTube or Spotify: draw the beat grid
      const beat = 60 / (info.t.f.bpm || 120), n = Math.min(400, Math.floor(info.dur / beat));
      for (let k = 0; k < n; k++) {
        const x = ((k * beat) / info.dur) * w, bar = k % 4 === 0;
        g.fillStyle = x < x0 ? 'rgba(255,255,255,.18)' : bar ? hot[0] : 'rgba(157,139,255,.45)';
        const bh = bar ? h - 12 : (h - 12) * 0.45;
        g.fillRect(x, (h - bh) / 2, bar ? 2 : 1, bh);
      }
    }
    g.fillStyle = '#fff'; g.fillRect(x0 - 1, 2, 2, h - 4);
    g.shadowColor = '#fff'; g.shadowBlur = 8; g.fillRect(x0 - 0.5, 2, 1, h - 4); g.shadowBlur = 0;
  }

  // ---------- render loop ----------
  const angle = [0, 0];
  function frame() {
    requestAnimationFrame(frame);
    if (!playerOn()) return;
    const live = liveIdx();
    const infos = [deckInfo(0), deckInfo(1)];
    for (let i = 0; i < 2; i++) {
      const info = infos[i], el = $(`.deck[data-side="${i}"]`);
      const isLive = !info.empty && i === live && info.playing;
      el.classList.toggle('live', isLive);
      el.classList.toggle('cue', !info.empty && !isLive);
      el.classList.toggle('idle', !!info.empty);
      $('#d' + i + '-state').textContent = info.empty ? 'Empty' : isLive ? 'On air' : info.playing ? 'Playing' : info.announced ? 'Played' : 'Cued · AI pick';
      $('#d' + i + '-title').textContent = info.empty ? 'Waiting for a record' : info.t.title;
      $('#d' + i + '-artist').textContent = info.empty ? '' : info.t.artist;
      const art = $('#d' + i + '-art'); const src = info.empty ? '' : info.t.cover || '';
      if (art.dataset.src !== src) { art.dataset.src = src; if (src) art.src = src; else art.removeAttribute('src'); }
      $('#d' + i + '-bpm').textContent = info.empty ? '— BPM' : (info.t.f.bpm * (info.rate || 1)).toFixed(1) + ' BPM';
      $('#d' + i + '-key').textContent = info.empty ? '—' : info.t.f.camelot;
      $('#d' + i + '-pitch').textContent = (info.pitch >= 0 ? '+' : '') + (info.pitch || 0).toFixed(1) + '%';
      $('#d' + i + '-time').textContent = info.empty ? '' : '-' + fmt((info.dur - info.pos) / (info.rate || 1));
      if (!dragging[i]) angle[i] = info.empty ? angle[i] : (info.pos / TURN) * 360;
      $('#d' + i + '-vinyl').style.transform = `rotate(${angle[i] % 360}deg)`;
      $('#d' + i + '-arm').style.transform = `rotate(${info.empty ? 0 : 16 + 20 * clamp(info.pos / info.dur, 0, 1)}deg)`;
      const pb = $(`.pbtn[data-act=play][data-d="${i}"]`); pb.classList.toggle('on', !!info.playing); pb.innerHTML = info.playing ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>';
      const pt = $(`.pitch[data-d="${i}"] i`); if (pt) pt.style.setProperty('--p', clamp((info.pitch || 0) / 16, -1, 1));
      drawWave(i, info, isLive);
      // channel strip
      const strip = $(`.strip[data-ch="${i}"]`);
      for (const k of ['hi', 'mid', 'low', 'flt']) { const kn = $(`.knob[data-k=${k}]`, strip), v = Ctl[k][i]; kn.style.setProperty('--r', v * 135 + 'deg'); kn.classList.toggle('hot', Math.abs(v) > 0.04); }
      $('#fd' + i).style.setProperty('--f', Ctl.fader[i]);
      const on = Math.round((info.lvl || 0) * xfg(Ctl.xf)[i] * 14 + (info.lvl ? 1 : 0));
      $$('#vu' + i + ' b').forEach((b, k) => b.classList.toggle('on', k < on));
    }
    $('#xf').style.setProperty('--x', (Ctl.xf * 100).toFixed(2) + '%');
    const L = infos[live];
    $('#master-bpm').textContent = L && !L.empty ? (L.t.f.bpm * (L.rate || 1)).toFixed(1) : '---';
    $('#master-key').textContent = L && !L.empty ? L.t.f.camelot : '--';
    // next mix countdown
    const nm = $('.nextmix'); let txt = '--', sty = '', now = false;
    if (S.mode === 'preview' && Engine.mix) { now = true; txt = 'MIXING'; sty = styleName(Engine.D[1 - live].styleHint); }
    else if (S.mode === 'youtube' && YTM.busy && YTM.incoming) { now = true; txt = 'MIXING'; sty = 'two-deck crossfade'; }
    else if (!Ctl.auto && S.mode !== 'spotify') { txt = 'YOU'; sty = 'hand mixing'; }
    else if (L && !L.empty) {
      let rem = null;
      if (S.mode === 'preview') { const o = infos[1 - live]; const ok = o.pick && Math.abs(1 - o.pick.s.ratio) <= 0.06 && o.pick.s.parts.harm >= 0.5; rem = (L.dur - L.pos) / (L.rate || 1) - ((ok ? 8 : 4.5) + 0.6); sty = ok ? 'beat-matched blend' : 'filter fade'; }
      else if (S.mode === 'youtube' && YTM.cur && YTM.cur.mixS != null) { rem = YTM.cur.mixS - L.pos; sty = 'crossfade'; }
      else if (S.mode === 'spotify' && SP.cur) { rem = (SP.cur.mixMs - (SP.pos || 0)) / 1000; sty = 'smooth fade'; }
      if (rem != null) txt = fmt(Math.max(0, rem));
    }
    nm.classList.toggle('now', now);
    $('#mix-count').textContent = txt; $('#mix-style').textContent = sty;
    const orb = $('#ai-orb');
    orb.classList.toggle('talk', 'speechSynthesis' in window && speechSynthesis.speaking);
    orb.classList.toggle('think', now);
    $('#ai-phase').textContent = S.running ? { warm: 'warming up', build: 'building', peak: 'peak time', cool: 'cooling down' }[SEL.arcPhase(Math.max(0, S.setIndex - 1))] : '';
    const sw = $('#auto-sw'); sw.classList.toggle('on', Ctl.auto); sw.setAttribute('aria-pressed', String(Ctl.auto));
  }
  function styleName(s) { return { blend: 'beat-matched blend', filter: 'filter fade', cut: 'quick cut', fade: 'smooth fade', crossfade: 'two-deck crossfade', hand: 'your hand mix' }[s] || ''; }
  requestAnimationFrame(frame);

  // ---------- AI cue panel ----------
  function renderBrain() {
    if (!playerOn()) return;
    const live = liveIdx(), o = deckInfo(1 - live);
    const pick = !o.empty && !o.announced ? o.pick : topCandidate();
    if (!pick) return;
    const t = pick.t, p = pick.s.parts;
    $('#brain-art').src = t.cover || '';
    $('#brain-title').textContent = t.title;
    $('#brain-artist').textContent = t.artist;
    $('#brain-sub').textContent = !o.empty && !o.announced ? `on deck ${live ? 'A' : 'B'}` : 'next';
    const bars = [['Your taste', clamp(p.taste / 2, 0, 1)], ['Key match', clamp(p.harm, 0, 1)], ['Tempo match', clamp(p.tempo, 0, 1)], ['Energy fit', clamp(p.energy, 0, 1)]];
    $('#brain-bars').innerHTML = bars.map(([n, v]) => `<div class="bar"><span>${n}</span><i style="--w:${Math.round(v * 100)}%"></i><em>${Math.round(v * 100)}</em></div>`).join('');
    const prev = S.nowT;
    const why = [];
    if (prev && prev.f) why.push(`${prev.f.camelot} to ${t.f.camelot}`, `${Math.round(prev.f.bpm)} to ${Math.round(t.f.bpm)} BPM`);
    why.push(`aiming for ${Math.round((pick.s.target || 0.5) * 100)}% energy`);
    if (SEL.isNew(t)) why.push('a new find for you');
    $('#brain-why').textContent = why.join(' · ');
  }
  setInterval(renderBrain, 1000);

  // ---------- mix log ----------
  const log = [];
  window.addEventListener('sel:now', (e) => {
    const { pick, prevT, style } = e.detail;
    const t = pick.t, tm = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const how = !prevT ? 'Opened the set with' : style === 'hand' ? 'You mixed into' : `Mixed into`;
    log.unshift(`<li><time>${esc(tm)}</time><b>${how} ${esc(t.title)}</b> by ${esc(t.artist)}${style && style !== 'hand' ? ` with a ${esc(styleName(style))}` : ''}. ${esc((S.lastReason || '').split(' · ').slice(0, 2).join(', '))}</li>`);
    $('#mixlog').innerHTML = log.slice(0, 12).join('');
  });

  // ---------- hands on the decks ----------
  let warned = false;
  function takeOver() {
    const was = Ctl.auto;
    Engine.userTouch();
    if (was && !warned) { warned = true; window.dispatchEvent(new CustomEvent('sel:toast', { detail: "You've got the decks. AI auto-mix is off until you turn it back on." })); }
  }
  function apply() { if (S.mode === 'preview') Engine.applyCtl(false); else if (S.mode === 'youtube') YTM.applyVols(); }
  function fullOnly(msg) {
    if (S.mode === 'spotify') { window.dispatchEvent(new CustomEvent('sel:toast', { detail: 'Hand mixing works with Free clips and YouTube. Spotify plays one song at a time.' })); return false; }
    if (msg && S.mode === 'youtube') { window.dispatchEvent(new CustomEvent('sel:toast', { detail: msg })); return false; }
    return true;
  }
  window.addEventListener('sel:auto', () => {});

  // drag helper with pointer capture
  function drag(el, { down, move, up }) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch {}
      const st = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      down && down(e, st);
      const mv = (ev) => { if (ev.pointerId !== st.id) return; move && move(ev, st); };
      const end = (ev) => { if (ev.pointerId !== st.id) return; el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end); up && up(ev, st); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    });
  }

  // platters: scratch in the middle, nudge on the rim; on YouTube the wheel scrubs
  const dragging = [false, false];
  $$('.platter').forEach((pl) => {
    const i = +pl.closest('.deck').dataset.side;
    let last = 0, lastT = 0, rim = false, idleT = null, ytAcc = 0, ytSeekT = 0;
    const ang = (e) => { const r = pl.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    drag(pl, {
      down(e) {
        const info = deckInfo(i);
        if (info.empty || !fullOnly()) return;
        takeOver();
        const r = pl.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
        rim = dist > 0.8 && info.playing;
        last = ang(e); lastT = performance.now(); dragging[i] = true; ytAcc = 0;
        pl.classList.add('touch'); pl.classList.toggle('rim', rim);
        buzz(6);
        if (S.mode === 'preview' && !rim) Engine.scratchStart(i);
      },
      move(e) {
        if (!dragging[i]) return;
        const a = ang(e), now = performance.now();
        let da = a - last; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        const dt = Math.max(0.001, (now - lastT) / 1000);
        last = a; lastT = now;
        angle[i] += (da * 180) / Math.PI;
        const dPos = (da / (2 * Math.PI)) * TURN;
        if (S.mode === 'preview') {
          if (rim) Engine.nudge(i, clamp((dPos / dt) * 0.08, -0.2, 0.2));
          else Engine.scratchMove(i, dPos, dt);
          clearTimeout(idleT);
          idleT = setTimeout(() => { if (!dragging[i]) return; if (rim) Engine.nudge(i, 0); else Engine.scratchMove(i, 0, 0.05); }, 60);
        } else if (S.mode === 'youtube') {
          ytAcc += dPos * 4;
          if (now - ytSeekT > 180) { ytSeekT = now; const p = YTM.decks[i]; try { p.seekTo(Math.max(0, p.getCurrentTime() + ytAcc), true); } catch {} ytAcc = 0; }
        }
      },
      up() {
        if (!dragging[i]) return;
        dragging[i] = false; clearTimeout(idleT);
        pl.classList.remove('touch', 'rim');
        if (S.mode === 'preview') { if (rim) Engine.nudge(i, 0); else Engine.scratchEnd(i); }
        else if (S.mode === 'youtube' && ytAcc) { const p = YTM.decks[i]; try { p.seekTo(Math.max(0, p.getCurrentTime() + ytAcc), true); } catch {} }
      },
    });
  });

  // transport buttons on each deck
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.pbtn'); if (!b) return;
    const i = +b.dataset.d, act = b.dataset.act;
    if (!fullOnly()) return;
    const info = deckInfo(i); if (info.empty) return;
    buzz(8); takeOver();
    if (S.mode === 'preview') {
      if (act === 'play') { if (Engine.D[i].playing) Engine.pause(i); else Engine.play(i); }
      else if (act === 'cue') Engine.toCue(i);
      else if (act === 'sync') { if (!Engine.sync(i)) window.dispatchEvent(new CustomEvent('sel:toast', { detail: 'Sync needs the other deck playing and tempos within 16%.' })); else b.classList.add('flash'), setTimeout(() => b.classList.remove('flash'), 400); }
    } else if (S.mode === 'youtube') {
      const p = YTM.decks[i];
      try {
        if (act === 'play') { if (YTM.state(i) === 1) p.pauseVideo(); else { YTM.applyVols(true); p.playVideo(); } }
        else if (act === 'cue') { p.pauseVideo(); p.seekTo(YTM.plan(info.t).startS, true); }
        else if (act === 'sync') window.dispatchEvent(new CustomEvent('sel:toast', { detail: 'YouTube doesn’t let apps change tempo, so sync works on Free clips.' }));
      } catch {}
    }
  });

  // pitch sliders (free clips)
  $$('.pitch').forEach((el) => {
    const i = +el.dataset.d;
    const set = (e) => { const r = el.getBoundingClientRect(); const v = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); Engine.setRate(i, 1 + v * 0.08); };
    drag(el, { down(e) { if (!fullOnly('YouTube doesn’t let apps change tempo, so pitch works on Free clips.') || !Engine.D[i] || !Engine.D[i].t) return; takeOver(); set(e); }, move(e) { if (Engine.D[i] && Engine.D[i].t && S.mode === 'preview') set(e); } });
    el.addEventListener('dblclick', () => { if (S.mode === 'preview') Engine.setRate(i, 1); });
  });

  // crossfader
  const xt = $('.xtrack');
  const setXf = (e) => { const r = xt.getBoundingClientRect(); Ctl.xf = clamp((e.clientX - r.left) / r.width, 0, 1); if (Math.abs(Ctl.xf - 0.5) < 0.025) Ctl.xf = 0.5; apply(); };
  drag(xt, { down(e) { if (!fullOnly()) return; takeOver(); buzz(5); setXf(e); }, move(e) { if (S.mode !== 'spotify') setXf(e); } });

  // channel faders
  $$('.fader').forEach((el, i) => {
    const set = (e) => { const r = el.getBoundingClientRect(); Ctl.fader[i] = clamp(1 - (e.clientY - r.top) / r.height, 0, 1); apply(); };
    drag(el, { down(e) { if (!fullOnly()) return; takeOver(); set(e); }, move(e) { if (S.mode !== 'spotify') set(e); } });
  });

  // knobs: drag up or down, double-tap to reset
  $$('.knob').forEach((kn) => {
    const i = +kn.closest('.strip').dataset.ch, k = kn.dataset.k;
    let v0 = 0;
    drag(kn, {
      down(e, st) { if (!fullOnly('YouTube doesn’t let apps reshape its sound, so EQ and filter work on Free clips.')) { st.no = true; return; } takeOver(); v0 = Ctl[k][i]; },
      move(e, st) { if (st.no) return; Ctl[k][i] = clamp(v0 + (st.y - e.clientY) / 110, -1, 1); if (Math.abs(Ctl[k][i]) < 0.05) Ctl[k][i] = 0; apply(); },
    });
    kn.addEventListener('dblclick', () => { Ctl[k][i] = 0; apply(); });
  });

  // AI auto-mix switch
  $('#auto-sw').addEventListener('click', () => {
    if (S.mode === 'spotify') return;
    Ctl.auto = !Ctl.auto;
    buzz(10);
    if (!Ctl.auto) warned = true;
    window.dispatchEvent(new CustomEvent('sel:toast', { detail: Ctl.auto ? 'AI auto-mix is on. I’ll take it from here.' : 'AI auto-mix is off. The decks are yours.' }));
  });

  // load a record from the crate onto the free deck
  $('#upnext').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    if (SEL.loadTrack(li.dataset.id)) { buzz(8); li.classList.add('flash'); }
  });
})();
