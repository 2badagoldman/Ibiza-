/* Ibiza Studio: AI acapella/beat splitting, Blend Studio and Record. Runs on the free preview mix. */
(function () {
  'use strict';
  const SEL = window.Selector;
  if (!SEL || window.IbizaStudio) return;
  const { S, Engine } = SEL;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => SEL.toast(m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch {} await sleep(250); } return false; };

  // ---------- AI stems: a free MDX-Net model (Ultimate Vocal Remover) running in the browser ----------
  const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/ort.webgpu.min.mjs';
  const LIB = 'https://cdn.jsdelivr.net/npm/web-audio-separation@0.3.1/dist/index.js';
  const MODEL = 'UVR_MDXNET_KARA_2'; // ~30MB, splits lead vocal from the beat
  const Stems = {
    state: 'idle', note: '', p: null, sep: null, AU: null, gpu: false, chain: Promise.resolve(), pending: 0, lastSec: 0,
    supported() { return typeof WebAssembly === 'object' && (!!navigator.gpu || !SEL.IS_PHONE); },
    wanted() { return S.mode === 'preview' && this.state !== 'failed' && this.supported() && (SEL.kingOn() || Studio.active()); },
    init() {
      if (this.p) return this.p;
      this.p = (async () => {
        this.state = 'loading'; this.note = 'getting the vocal splitter'; ui();
        const ort = await import(ORT);
        let adapter = null;
        try { adapter = navigator.gpu ? await navigator.gpu.requestAdapter() : null; } catch {}
        this.gpu = !!adapter;
        if (!this.gpu) { try { ort.env.wasm.proxy = true; } catch {} } // keep the mix smooth while the CPU works
        const src = (await (await fetch(LIB)).text()).replace(/from\s*["']onnxruntime-web["']/g, `from "${ORT}"`);
        const mod = await import(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
        this.AU = mod.AudioUtils;
        this.sep = mod.createSeparator(MODEL, {
          common: { logLevel: 'warning', onProgress: (p) => { if (p.stage === 'loading-model') { this.note = `downloading the splitter ${Math.round(p.fraction * 100)}%`; ui(); } else if (p.stage === 'demixing' && p.totalChunks) { this.note = `splitting ${this.cur || ''} ${Math.round((p.chunk / p.totalChunks) * 100)}%`; ui(); } } },
          mdx: { executionProviders: this.gpu ? ['webgpu', 'wasm'] : ['wasm'] },
        });
        await this.sep.loadModel();
        this.state = 'ready'; this.note = ''; ui();
        return true;
      })().catch((e) => { console.warn('vocal splitter unavailable', e); this.state = 'failed'; this.note = ''; ui(); return false; });
      return this.p;
    },
    sourceBuffer(t) {
      if (t.buffer) return t.buffer;
      const d = Engine.D.find((x) => x && x.t === t && x.buf);
      return d ? d.buf : null;
    },
    get(t) {
      if (!t) return Promise.resolve(null);
      if (t.stems) return Promise.resolve(t.stems);
      if (t._stemP) return t._stemP;
      this.pending++; ui();
      t._stemP = (this.chain = this.chain.then(async () => {
        try {
          if (t.stems) return t.stems;
          if (!(await this.init())) return null;
          const buf = this.sourceBuffer(t);
          if (!buf) return null;
          this.cur = t.title; this.state = 'working'; ui();
          const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
          const url = URL.createObjectURL(this.AU.createWAVBlob([L, R], buf.sampleRate));
          const t0 = performance.now();
          this.sep.primarySource = undefined; this.sep.secondarySource = undefined;
          const out = await this.sep.separate(url);
          URL.revokeObjectURL(url);
          const names = [this.sep.secondaryStemName, this.sep.primaryStemName];
          const bufs = await Promise.all(out.map(async (u) => { const ab = await (await fetch(u)).arrayBuffer(); URL.revokeObjectURL(u); return SEL.actx.decodeAudioData(ab); }));
          const vi = names.findIndex((n) => /vocal/i.test(n)), ii = names.findIndex((n) => /instrument/i.test(n));
          if (vi < 0 || ii < 0) return null;
          this.lastSec = (performance.now() - t0) / 1000;
          t.stems = { voc: bufs[vi], inst: bufs[ii] };
          return t.stems;
        } catch (e) { console.warn('split failed', t.title, e); return null; }
        finally { this.pending--; this.cur = ''; if (this.state === 'working') this.state = 'ready'; t._stemP = null; ui(); }
      }));
      return t._stemP;
    },
    // free the memory of records that are done
    sweep() {
      const keep = new Set();
      for (const d of Engine.D) if (d && d.t) keep.add(d.t);
      for (const t of S.ready) keep.add(t);
      for (const t of S.pool.values()) if (t.stems && !keep.has(t)) { t.stems = null; }
    },
  };
  setInterval(() => Stems.sweep(), 15000);

  // split every record the moment it lands on a deck, when blends are on
  const origLoad = Engine.load.bind(Engine);
  Engine.load = function (i, pick) {
    origLoad(i, pick);
    const t = pick && pick.t;
    if (t && Stems.wanted()) Stems.get(t).then((st) => { if (st) Engine.attachStems(t, st); });
  };
  // when King of Blends is switched on mid-set, split what's already on the decks
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.king-sw,#kingcard')) return;
    setTimeout(() => { if (Stems.wanted()) for (const d of Engine.D) if (d && d.t && !d.t.stems) Stems.get(d.t).then((st) => { if (st) Engine.attachStems(d.t, st); }); }, 300);
  });

  // ---------- Blend Studio: you pick the vocals and the beat ----------
  const Studio = {
    voc: null, beat: null, busy: false, live: false,
    active() { return this.live || S.ready.some((t) => t.forceVox) || Engine.D.some((d) => d && d.t && d.t.forceVox); },
    async go() {
      if (!this.voc || !this.beat) { toast('Pick a song for the vocals and a song for the beat.'); return; }
      if (this.voc.id === this.beat.id) { toast('Pick two different songs.'); return; }
      if (this.busy) return;
      this.busy = true; this.live = true; btn();
      try {
        if (S.mode !== 'preview' && S.running) { toast('Blend Studio works on the preview mix. Disconnect Spotify to use it.'); return; }
        if (!S.running) { SEL.startSet(); await waitFor(() => S.running && Engine.announced, 45000); }
        if (!S.running) { toast('The DJ could not start. Try again in a moment.'); return; }
        if (Stems.supported()) Stems.init();
        toast('Loading your blend…');
        // 1. the beat goes on air first
        const beat = await SEL.queueSong(this.beat, { quiet: true });
        if (!beat) return;
        const isLive = () => Engine.announced && Engine.announced.t === beat;
        if (!isLive()) {
          await waitFor(() => !Engine.mix && Engine.D.some((d) => d && d.t === beat && !d.announced && d.buf), 20000);
          if (!isLive() && !Engine.mix) Engine.transition('filter');
          await waitFor(isLive, 15000);
        }
        if (!isLive()) { toast('The beat didn’t load in time. Try Blend them again.'); return; }
        // 2. the vocal song is cued next; its acapella comes in over this beat
        const voc = await SEL.queueSong(this.voc, { quiet: true, forceVox: true });
        if (!voc) return;
        const A = window.DJAnalysis;
        if (A && beat.f && voc.f) {
          const m = A.tempoMatch(beat.f.bpm, voc.f.bpm);
          if (Math.abs(1 - m.ratio) > 0.12) toast(`Heads up: ${Math.round(voc.f.bpm)} vs ${Math.round(beat.f.bpm)} BPM is a big tempo gap, so this blend may fall back to a normal mix.`);
        }
        SEL.setDjNote(`🎛 Blend Studio: ${voc.title} vocals over the ${beat.title} beat, coming up`);
        toast(`Blend set: ${voc.title} vocals over the ${beat.title} beat.`);
      } finally { this.busy = false; btn(); setTimeout(() => { this.live = false; }, 90000); }
    },
  };

  // ---------- Record: saves what you hear as an audio file ----------
  const Rec = {
    mr: null, chunks: [], t0: 0, dest: null, timer: null, ext: 'webm',
    start() {
      const ctx = SEL.actx;
      if (S.mode !== 'preview') { toast('Recording works on the preview mix only.'); return; }
      if (!ctx || !Engine.analyser || !S.running) { toast('Start a mix first, then record.'); return; }
      if (!window.MediaRecorder) { toast('This browser can’t record audio.'); return; }
      if (!this.dest) { this.dest = ctx.createMediaStreamDestination(); Engine.analyser.connect(this.dest); }
      const types = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
      const type = types.find((x) => { try { return MediaRecorder.isTypeSupported(x); } catch { return false; } }) || '';
      this.ext = /mp4/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm';
      try { this.mr = new MediaRecorder(this.dest.stream, type ? { mimeType: type, audioBitsPerSecond: 192000 } : undefined); }
      catch { this.mr = new MediaRecorder(this.dest.stream); }
      this.chunks = [];
      this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mr.mimeType || type || 'audio/webm' });
        const d = new Date();
        const name = `Ibiza mix ${d.toLocaleDateString().replace(/\//g, '-')} ${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.${this.ext}`;
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 60000);
        toast(`Saved “${name}”. It’s in your downloads.`);
      };
      this.mr.start(1000); this.t0 = Date.now();
      clearInterval(this.timer); this.timer = setInterval(recUi, 500); recUi();
      toast('Recording your mix. Tap Stop when you’re done.');
    },
    stop() { if (this.mr && this.mr.state !== 'inactive') this.mr.stop(); this.mr = null; clearInterval(this.timer); recUi(); },
    on() { return !!(this.mr && this.mr.state === 'recording'); },
  };

  // ---------- UI ----------
  const css = `
.studio{margin-top:16px}.studio p.lead{margin:2px 0 12px;color:var(--dim)}
.bs-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:700px){.bs-grid{grid-template-columns:1fr}}
.bs-col{position:relative;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:16px;padding:12px}
.bs-col label{display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}
.bs-col input{width:100%}
.bs-pick{display:flex;align-items:center;gap:10px;margin-top:10px;min-height:44px}
.bs-pick img{width:44px;height:44px;border-radius:10px}.bs-pick b{display:block}.bs-pick span{color:var(--dim);font-size:13px}
.bs-res{position:absolute;z-index:7;left:12px;right:12px;top:72px;background:#1a1626;border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.bs-res button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;text-align:left}
.bs-res button:hover,.bs-res button:focus{background:rgba(255,255,255,.06);outline:none}
.bs-res img{width:36px;height:36px;border-radius:8px}.bs-res b{display:block;font-weight:600}.bs-res span{color:var(--dim);font-size:13px}
.bs-act{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:14px}
.bs-act .dim{font-size:13px}
#bs-go{background:linear-gradient(135deg,#ffcf3f,#ff3d77);color:#1b0b12;font-weight:800;border:0}
#bs-go[disabled]{opacity:.6}
.recbtn{display:inline-flex;align-items:center;gap:8px;border-radius:24px;padding:0 16px;height:48px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);font-weight:700}
.recbtn i{width:10px;height:10px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 0 0 rgba(255,59,92,.6)}
.recbtn.on{background:rgba(255,59,92,.18);border-color:rgba(255,59,92,.6)}
.recbtn.on i{border-radius:2px;animation:recpulse 1.2s infinite}
@keyframes recpulse{0%{box-shadow:0 0 0 0 rgba(255,59,92,.6)}70%{box-shadow:0 0 0 10px rgba(255,59,92,0)}100%{box-shadow:0 0 0 0 rgba(255,59,92,0)}}
body:not([data-mode=preview]) .recbtn{display:none}
.stemchip{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--dim);white-space:nowrap}
.stemchip b{color:#fff;font-weight:700}
.stemchip.ok b{color:#7dffb1}.stemchip.bad b{color:#ffb38a}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

  const add = $('.addsong');
  if (add && !$('#bs-go')) add.insertAdjacentHTML('afterend', `<div class="card studio" id="studio">
  <h3>Blend Studio</h3>
  <p class="lead">Pick the vocals from one song and the beat from another. The DJ mutes the first song's beat and lays its acapella over the second, in time.</p>
  <div class="bs-grid">
    <div class="bs-col"><label for="bs-voc-q">Vocals from</label><input id="bs-voc-q" type="search" placeholder="Search a song…" autocomplete="off"><div class="bs-res" id="bs-voc-res" hidden></div><div class="bs-pick" id="bs-voc-pick"><span>No song picked yet</span></div></div>
    <div class="bs-col"><label for="bs-beat-q">Beat from</label><input id="bs-beat-q" type="search" placeholder="Search a song…" autocomplete="off"><div class="bs-res" id="bs-beat-res" hidden></div><div class="bs-pick" id="bs-beat-pick"><span>No song picked yet</span></div></div>
  </div>
  <div class="bs-act"><button class="btn" id="bs-go" type="button">Blend them</button><span class="dim">Or turn on 👑 King of Blends and the DJ picks the pairs for you.</span></div>
</div>`);
  const vox = $('#vox-now');
  if (vox && !$('#rec')) vox.insertAdjacentHTML('afterend', `<button class="recbtn" id="rec" type="button" title="Record your mix to an audio file"><i></i><span>Record</span></button>`);
  const aisw = $('.aisw');
  if (aisw && !$('#stemchip')) aisw.insertAdjacentHTML('beforeend', `<span class="stemchip" id="stemchip" hidden></span>`);

  function ui() {
    const el = $('#stemchip'); if (!el) return;
    const show = Stems.state !== 'idle' || Stems.wanted();
    el.hidden = !show || S.mode !== 'preview';
    el.className = 'stemchip' + (Stems.state === 'ready' ? ' ok' : Stems.state === 'failed' ? ' bad' : '');
    let txt;
    if (!Stems.supported()) txt = 'AI acapellas: <b>off on this phone</b>';
    else if (Stems.state === 'failed') txt = 'AI acapellas: <b>unavailable</b>, using EQ blends';
    else if (Stems.state === 'loading' || Stems.state === 'working') txt = `AI acapellas: <b>${esc(Stems.note || 'working')}</b>`;
    else if (Stems.state === 'ready') txt = `AI acapellas: <b>ready</b>${Stems.lastSec ? ` · ${Math.round(Stems.lastSec)}s per song` : ''}`;
    else txt = 'AI acapellas: <b>on</b>';
    el.innerHTML = txt;
  }
  function recUi() {
    const b = $('#rec'); if (!b) return;
    const on = Rec.on();
    b.classList.toggle('on', on);
    const s = Math.floor((Date.now() - Rec.t0) / 1000);
    b.querySelector('span').textContent = on ? `Stop ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Record';
  }
  function btn() { const b = $('#bs-go'); if (b) { b.disabled = Studio.busy; b.textContent = Studio.busy ? 'Setting up…' : 'Blend them'; } }

  const hits = { voc: [], beat: [] };
  let qt = {};
  function wire(kind) {
    const q = $(`#bs-${kind}-q`), res = $(`#bs-${kind}-res`), pick = $(`#bs-${kind}-pick`);
    if (!q) return;
    q.addEventListener('input', () => {
      clearTimeout(qt[kind]);
      const v = q.value.trim();
      if (v.length < 2) { res.hidden = true; return; }
      qt[kind] = setTimeout(async () => {
        try {
          const r = await SEL.dz('/search', { q: v, limit: 8 });
          const seen = new Set();
          hits[kind] = (r.data || []).filter((t) => { if (!t.preview) return false; const k = ((t.title_short || t.title) + '|' + (t.artist && t.artist.name)).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
          res.innerHTML = hits[kind].map((t, i) => `<button type="button" data-i="${i}"><img src="${esc((t.album && t.album.cover_small) || '')}" alt=""><div><b>${esc(t.title_short || t.title)}</b><span>${esc(t.artist && t.artist.name)}</span></div></button>`).join('') || '<div class="dim pad">No songs found</div>';
          res.hidden = false;
        } catch { res.hidden = true; }
      }, 250);
    });
    res.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const t = hits[kind][+b.dataset.i]; if (!t) return;
      Studio[kind] = t; res.hidden = true; q.value = '';
      pick.innerHTML = `<img src="${esc((t.album && t.album.cover_small) || '')}" alt=""><div><b>${esc(t.title_short || t.title)}</b><span>${esc(t.artist && t.artist.name)}</span></div>`;
    });
  }
  wire('voc'); wire('beat');
  document.addEventListener('click', (e) => { if (!e.target.closest('.bs-col')) document.querySelectorAll('.bs-res').forEach((r) => (r.hidden = true)); });
  const go = $('#bs-go'); if (go) go.addEventListener('click', () => Studio.go());
  const rec = $('#rec'); if (rec) rec.addEventListener('click', () => (Rec.on() ? Rec.stop() : Rec.start()));
  setInterval(ui, 2000); ui();

  window.IbizaStudio = { Stems, Studio, Rec };
})();
