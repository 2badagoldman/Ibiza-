/* Ibiza artist picker: search any artist, tap their pictures to pick one or many, and the DJ plays only
   them, back to back. Also counts a play for each song's artist (signed-in listeners) so artists can be
   paid from real play counts later. Artist data and pictures come from Deezer through /api/dz. */
(function () {
  'use strict';
  const SEL = window.Selector;
  if (!SEL || window.IbizaArtists) return;
  const { S, GENRES } = SEL;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m) => SEL.toast(m);
  const KEY = 'ibiza-artists';
  const MAX = 50;
  // pictures come through Ibiza's own address, in sharp sizes, so they show in every browser
  const px = (u) => (u && /dzcdn\.net/.test(u) && !/^\/api\/img/.test(u) ? '/api/img?u=' + encodeURIComponent(u) : u || '');
  const big = (u) => String(u || '').replace(/\/\d{2,3}x\d{2,3}-/, '/500x500-');
  // any Deezer picture or cover in the app that fails to load is retried through Ibiza, at a sharper size
  document.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && /dzcdn\.net/.test(t.src) && !t.dataset.px) { t.dataset.px = '1'; t.src = px(big(t.src)); } }, true);
  const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n || 0));

  // the picked artists live in their own DJ, "Your artists"
  let picked = [];
  try { picked = JSON.parse(localStorage.getItem(KEY) || '[]').filter((x) => x && x.id && x.name).slice(0, MAX); } catch {}
  const G = { id: 'artists', name: 'Your artists', sub: 'Only the artists you picked', hidden: true, artistList: picked, c: ['#ff5f6d', '#ffc371'] };
  GENRES.push(G);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(picked)); } catch {} G.artistList = picked; };
  if (S.genre === 'artists' && !picked.length) SEL.pickGenre('all');

  // a link like /?artists=27:Drake,259:Michael%20Jackson picks those artists
  try {
    const q = new URLSearchParams(location.search).get('artists');
    if (q) {
      picked = q.split(',').map((x) => { const i = x.indexOf(':'); return { id: x.slice(0, i).replace(/\D/g, ''), name: decodeURIComponent(x.slice(i + 1)).slice(0, 80) }; }).filter((x) => x.id && x.name).slice(0, MAX);
      save(); SEL.pickGenre('artists'); history.replaceState(history.state, '', location.pathname + location.hash);
      setTimeout(() => toast(`${picked.length === 1 ? picked[0].name + ' is' : picked.length + ' artists are'} ready. Press Start.`), 900);
    }
  } catch {}

  const css = `
.art-fab{position:fixed;right:18px;bottom:18px;z-index:60;display:inline-flex;align-items:center;gap:8px;height:50px;padding:0 18px 0 14px;border-radius:26px;border:1px solid rgba(255,255,255,.18);background:linear-gradient(135deg,rgba(124,92,255,.92),rgba(255,79,163,.92));color:#fff;font:700 15px/1 inherit;box-shadow:0 14px 34px -10px rgba(255,79,163,.7);cursor:pointer;backdrop-filter:blur(8px)}
.art-fab svg{width:20px;height:20px}.art-fab .n{min-width:22px;height:22px;border-radius:11px;background:#fff;color:#c2185b;display:grid;place-items:center;font-size:12px;padding:0 6px}
.art-fab .n:empty{display:none}
.art-pick{display:inline-flex;align-items:center;gap:8px;margin:0 0 12px;height:42px;padding:0 16px;border-radius:21px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:inherit;font-weight:700;cursor:pointer}
.art-pick svg{width:18px;height:18px}
.art-sheet{position:fixed;inset:0;z-index:90;display:none;background:rgba(6,4,12,.72);backdrop-filter:blur(10px)}
.art-sheet.on{display:flex;align-items:flex-end;justify-content:center}
@media(min-width:760px){.art-sheet.on{align-items:center}}
.art-box{width:min(920px,100%);max-height:92vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#191226,#0e0a17);border:1px solid rgba(255,255,255,.1);border-radius:24px 24px 0 0;box-shadow:0 -20px 60px -20px rgba(0,0,0,.8);overflow:hidden}
@media(min-width:760px){.art-box{border-radius:24px;max-height:86vh}}
.art-head{padding:18px 20px 10px;display:flex;align-items:center;gap:12px}
.art-head h2{margin:0;font-size:22px;letter-spacing:-.01em;flex:1}
.art-x{width:40px;height:40px;border-radius:20px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;font-size:20px;cursor:pointer}
.art-search{margin:0 20px 10px;display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-radius:24px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.art-search input{flex:1;background:none;border:0;outline:0;color:inherit;font:inherit;font-size:16px}
.art-search svg{width:18px;height:18px;opacity:.7}
.art-chips{display:flex;gap:8px;overflow-x:auto;padding:0 20px 10px;min-height:0}
.art-chips:empty{display:none}
.art-chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 10px 0 4px;border-radius:17px;background:rgba(255,79,163,.18);border:1px solid rgba(255,79,163,.45);font-size:13px;font-weight:700;cursor:pointer}
.art-chip img{width:26px;height:26px;border-radius:50%;object-fit:cover}
.art-label{padding:4px 20px 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
.art-grid{flex:1;overflow-y:auto;padding:4px 16px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
.art-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 6px;border-radius:18px;border:1px solid transparent;background:rgba(255,255,255,.04);color:inherit;cursor:pointer;text-align:center;transition:background .2s,border-color .2s,transform .15s}
.art-card:hover{background:rgba(255,255,255,.08)}.art-card:active{transform:scale(.97)}
.art-card img{width:84px;height:84px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.08);box-shadow:0 8px 20px -8px rgba(0,0,0,.7)}
.art-card b{font-size:14px;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.art-card span{font-size:12px;opacity:.6}
.art-card.on{border-color:rgba(255,79,163,.8);background:linear-gradient(135deg,rgba(124,92,255,.22),rgba(255,79,163,.22))}
.art-card.on:after{content:"✓";position:absolute;top:10px;right:calc(50% - 48px);width:24px;height:24px;border-radius:12px;background:#ff4fa3;color:#fff;display:grid;place-items:center;font-size:14px;font-weight:800;box-shadow:0 0 0 3px #150f20}
.art-foot{display:flex;gap:10px;align-items:center;padding:14px 20px calc(14px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.2)}
.art-foot .grow{flex:1;font-size:14px;opacity:.75}
.art-go{height:50px;padding:0 22px;border-radius:25px;border:0;background:linear-gradient(135deg,#ff9a3d,#ff3d8b 55%,#7c3cff);color:#fff;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 12px 30px -10px rgba(255,61,139,.8)}
.art-go:disabled{opacity:.4;cursor:default;box-shadow:none}
.art-clear{height:44px;padding:0 14px;border-radius:22px;border:1px solid rgba(255,255,255,.16);background:none;color:inherit;font-weight:700;cursor:pointer}
.art-meet{color:inherit;text-decoration:none;font-weight:700;opacity:.85;margin-right:12px}
.art-meet:hover{opacity:1}
.art-empty{grid-column:1/-1;padding:30px;text-align:center;opacity:.6}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);

  const icon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.5 3a6.5 6.5 0 0 1 5.2 10.4l5.4 5.4-1.4 1.4-5.4-5.4A6.5 6.5 0 1 1 9.5 3zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/></svg>';
  document.body.insertAdjacentHTML('beforeend', `<button class="art-fab" id="art-fab" type="button" title="Pick the artists your DJ plays">${icon}<span>Artists</span><span class="n" id="art-n"></span></button>
<div class="art-sheet" id="art-sheet" role="dialog" aria-modal="true" aria-label="Pick your artists"><div class="art-box">
<div class="art-head"><h2>Pick your artists</h2><a class="art-meet" href="/artists.html">Meet the Artists</a><button class="art-x" id="art-x" type="button" aria-label="Close">×</button></div>
<label class="art-search">${icon}<input id="art-q" type="search" placeholder="Search any artist: Drake, Michael Jackson, Flavour…" autocomplete="off"></label>
<div class="art-chips" id="art-chips"></div>
<div class="art-label" id="art-label">Top artists right now</div>
<div class="art-grid" id="art-grid"></div>
<div class="art-foot"><span class="grow" id="art-count">Tap artists to pick them. Pick one or as many as you like.</span><button class="art-clear" id="art-clear" type="button">Clear</button><button class="art-go" id="art-go" type="button" disabled>Play them</button></div>
</div></div>`);
  // a button above the DJ tiles too
  const tiles = $('#genres');
  if (tiles) tiles.insertAdjacentHTML('beforebegin', `<button class="art-pick" id="art-pick" type="button">${icon}<span>Pick your artists</span></button>`);
  // and Gallery and Meet the Artists links in the top bar
  const acct = $('#acct');
  if (acct) acct.insertAdjacentHTML('beforebegin', '<a class="art-meet" href="/gallery.html">Gallery</a><a class="art-meet" href="/artists.html">Meet the Artists</a>');

  const sheet = $('#art-sheet'), grid = $('#art-grid');
  let shown = [], topCache = null, qT = null, qN = 0;
  const isOn = (id) => picked.some((x) => String(x.id) === String(id));

  function renderChips() {
    $('#art-chips').innerHTML = picked.map((a) => `<button class="art-chip" type="button" data-id="${esc(a.id)}" title="Remove ${esc(a.name)}"><img src="${esc(px(a.pic))}" alt="">${esc(a.name)} ×</button>`).join('');
    $('#art-n').textContent = picked.length ? String(picked.length) : '';
    $('#art-go').disabled = !picked.length;
    $('#art-go').textContent = picked.length > 1 ? `Play these ${picked.length}` : picked.length ? `Play ${picked[0].name}` : 'Play them';
    $('#art-count').textContent = picked.length ? `${picked.length} picked. The DJ plays only them, back to back.` : 'Tap artists to pick them. Pick one or as many as you like.';
  }
  function renderGrid(list, label) {
    shown = list;
    $('#art-label').textContent = label;
    grid.innerHTML = list.length ? list.map((a) => `<button class="art-card${isOn(a.id) ? ' on' : ''}" type="button" data-id="${esc(a.id)}"><img loading="lazy" src="${esc(px(a.pic))}" alt=""><b>${esc(a.name)}</b><span>${a.fans ? fmt(a.fans) + ' fans' : ''}</span></button>`).join('') : '<div class="art-empty">No artists found. Try another spelling.</div>';
  }
  const fromDz = (x) => ({ id: String(x.id), name: x.name, pic: px(x.picture_big || x.picture_medium || x.picture), fans: x.nb_fan || 0 });
  async function showTop() {
    if (!topCache) {
      grid.innerHTML = '<div class="art-empty">Loading artists…</div>';
      const seen = new Set(), out = [];
      const add = (x) => { if (x && !seen.has(String(x.id))) { seen.add(String(x.id)); out.push(x); } };
      // your favorite artists first, then the world's top artists
      Object.entries(S.taste.artists || {}).filter(([, a]) => a.seed && a.name).slice(0, 12).forEach(([id, a]) => add({ id, name: a.name, pic: px(big(a.pic)), fans: 0 }));
      try { ((await SEL.dz('/chart/0/artists', { limit: 100 })).data || []).forEach((x) => add(fromDz(x))); } catch {}
      topCache = out;
    }
    renderGrid(picked.filter((p) => !topCache.some((x) => x.id === String(p.id))).concat(topCache), 'Top artists right now');
  }
  async function search(q) {
    const n = ++qN;
    if (!q) return showTop();
    try {
      const r = await SEL.dz('/search/artist', { q, limit: 40 });
      if (n !== qN) return;
      renderGrid((r.data || []).map(fromDz), `Artists matching "${q}"`);
    } catch { if (n === qN) grid.innerHTML = '<div class="art-empty">Search is busy. Try again in a moment.</div>'; }
  }
  function open() { sheet.classList.add('on'); renderChips(); showTop(); setTimeout(() => $('#art-q').focus(), 50); }
  function close() { sheet.classList.remove('on'); }
  function toggle(id) {
    const a = shown.find((x) => String(x.id) === String(id)) || picked.find((x) => String(x.id) === String(id));
    if (!a) return;
    if (isOn(id)) picked = picked.filter((x) => String(x.id) !== String(id));
    else if (picked.length >= MAX) { toast(`You can pick up to ${MAX} artists.`); return; }
    else picked = picked.concat({ id: String(a.id), name: a.name, pic: a.pic });
    save(); renderChips();
    grid.querySelectorAll(`[data-id="${CSS.escape(String(id))}"]`).forEach((b) => b.classList.toggle('on', isOn(id)));
  }
  async function play() {
    if (!picked.length) return;
    close();
    // songs tagged for an earlier pick don't count for this one
    for (const t of S.pool.values()) if (t.genre === 'artists') t.genre = null;
    if (S.running || S.warming) SEL.stopSet();
    S.poolBuilt = false;
    SEL.pickGenre('artists');
    toast(`Loading every song from ${picked.length === 1 ? picked[0].name : picked.length + ' artists'}…`);
    SEL.startSet();
  }

  $('#art-fab').addEventListener('click', open);
  $('#art-pick') && $('#art-pick').addEventListener('click', open);
  $('#art-x').addEventListener('click', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('on')) close(); });
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) toggle(b.dataset.id); });
  $('#art-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) toggle(b.dataset.id); });
  $('#art-q').addEventListener('input', (e) => { clearTimeout(qT); const q = e.target.value.trim(); qT = setTimeout(() => search(q), 280); });
  $('#art-clear').addEventListener('click', () => { picked = []; save(); renderChips(); grid.querySelectorAll('.art-card.on').forEach((b) => b.classList.remove('on')); });
  $('#art-go').addEventListener('click', play);
  renderChips();

  // ---------- plays per artist, for paying artists later ----------
  // One play is counted when a song has been on for 30 seconds, for signed-in listeners only,
  // so the counts can't be inflated anonymously. Stored in Firestore under plays/{deezer artist id}.
  let playT = null;
  window.addEventListener('sel:now', (e) => {
    clearTimeout(playT);
    const t = e.detail && e.detail.pick && e.detail.pick.t;
    if (!t || !t.artistId) return;
    playT = setTimeout(() => countPlay(t), 30000);
  });
  function countPlay(t) {
    try {
      const fb = window.firebase;
      const user = window.IbizaAccount && window.IbizaAccount.user;
      if (!fb || !fb.apps || !fb.apps.length || !user) return;
      const id = String(t.artistId).replace(/\D/g, '');
      if (!id) return;
      fb.firestore().collection('plays').doc(id).set({ name: String(t.artist || '').slice(0, 120), count: fb.firestore.FieldValue.increment(1) }, { merge: true }).catch(() => {});
    } catch {}
  }

  window.IbizaArtists = { open, get picked() { return picked.slice(); } };
})();
