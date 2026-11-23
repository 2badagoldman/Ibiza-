/* Ibiza playback controls: replay the song that's on, repeat it, and tap any song in "Just played" to bring it back. */
(function () {
  'use strict';
  const SEL = window.Selector;
  if (!SEL || window.IbizaControls) return;
  const { S, Engine, YTM, SP } = SEL;
  const $ = (s, r = document) => r.querySelector(s);
  const toast = (m) => SEL.toast(m);

  function replayNow() {
    if (!S.running) { toast('Start a set first.'); return; }
    if (S.mode === 'preview') {
      if (Engine.mix) { toast('Hold on, the DJ is in the middle of a mix.'); return; }
      const d = Engine.D[Engine.liveIdx()];
      if (!d || !d.buf) return;
      d.ended = false; d.playing = true;
      Engine.startSrc(d, d.cue || 0, d.curRate || d.rate || 1);
    } else if (S.mode === 'youtube' && YTM.cur) {
      const p = YTM.decks[YTM.cur.deckIdx];
      try { p.seekTo(YTM.plan(YTM.cur.pick.t, p.getDuration()).startS || 0, true); p.playVideo(); } catch {}
    } else if (S.mode === 'spotify' && SP.player) SP.player.seek(0).catch(() => {});
    toast(`From the top: ${S.nowT ? S.nowT.title : 'this song'}.`);
  }
  function setRepeat(on) {
    S.repeat = !!on;
    const b = $('#repeat'); if (b) { b.classList.toggle('on', S.repeat); b.setAttribute('aria-pressed', String(S.repeat)); }
    const g = $('#mix-style'); if (g && S.repeat) g.textContent = 'on repeat';
    toast(S.repeat ? `Repeat on: ${S.nowT ? S.nowT.title : 'this song'} keeps playing until you turn it off.` : 'Repeat off. The DJ picks up the mix.');
  }

  const css = `
.ctlbtn{display:inline-flex;align-items:center;gap:7px;border-radius:24px;padding:0 14px;height:48px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);font-weight:700}
.ctlbtn svg{width:18px;height:18px}
.ctlbtn.on{background:linear-gradient(135deg,rgba(124,92,255,.35),rgba(255,79,163,.35));border-color:rgba(255,79,163,.7)}
#history li[data-replay]{cursor:pointer;border-radius:10px;padding:4px;margin:-4px;transition:background .2s}
#history li[data-replay]:hover{background:rgba(255,255,255,.05)}
#history li .again{opacity:0;transition:opacity .2s}
#history li:hover .again,#history li:focus .again{opacity:1}
@media (hover:none){#history li .again{opacity:1}}
#history li.flash{background:rgba(124,92,255,.2)}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  const anchor = $('#rec') || $('#vox-now') || $('#skip');
  if (anchor && !$('#repeat')) {
    anchor.insertAdjacentHTML('afterend', `<button class="ctlbtn" id="replay" type="button" title="Play this song again from the top"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg><span>Replay</span></button><button class="ctlbtn" id="repeat" type="button" aria-pressed="false" title="Keep playing this song until you turn it off"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg><span>Repeat</span></button>`);
    $('#replay').addEventListener('click', replayNow);
    $('#repeat').addEventListener('click', () => setRepeat(!S.repeat));
  }
  const hist = $('#history');
  if (hist) hist.addEventListener('click', (e) => {
    const li = e.target.closest('[data-replay]'); if (!li) return;
    li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 600);
    if (S.repeat) setRepeat(false);
    SEL.replay(li.dataset.replay);
  });
  // a new set starts with repeat off
  window.addEventListener('sel:now', () => { const b = $('#repeat'); if (b) b.classList.toggle('on', !!S.repeat); });

  window.IbizaControls = { replayNow, setRepeat };
})();
