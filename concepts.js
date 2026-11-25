/* Concept overlays for the demo feed: drawn ON TOP of the real, running Ibiza player.
   Every overlay carries a "COMING SOON" label. window.__concept(name) runs a ~10 s timeline. */
(() => {
  const S = () => (window.Selector && window.Selector.S) || {};
  const now = () => S().nowT || { title: 'Tonight', artist: 'Ibiza DJ', cover: '' };
  const css = `
.cx{position:fixed;inset:0;z-index:2147483600;pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",Inter,system-ui,sans-serif;color:#fff}
.cx-badge{position:absolute;top:calc(env(safe-area-inset-top,0px) + 66px);left:50%;transform:translateX(-50%);padding:7px 14px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);font:800 11px/1 inherit;letter-spacing:.18em;white-space:nowrap;animation:cxIn .6s cubic-bezier(.2,.9,.3,1.3) both}
.cx-badge i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#ffcf3f;margin-right:8px;box-shadow:0 0 10px #ffcf3f;animation:cxBlink 1s infinite}
.cx-card{position:absolute;left:14px;right:14px;padding:16px;border-radius:24px;background:rgba(14,10,24,.62);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);box-shadow:0 30px 70px -20px rgba(0,0,0,.7);animation:cxUp .7s cubic-bezier(.2,.9,.3,1.15) both}
.cx-k{font:800 11px/1 inherit;letter-spacing:.16em;color:#ffcf3f;text-transform:uppercase}
.cx-t{font:800 22px/1.15 inherit;letter-spacing:-.02em;margin-top:6px}
.cx-s{font:500 13.5px/1.4 inherit;color:rgba(255,255,255,.78);margin-top:6px}
.cx-row{display:flex;align-items:center;gap:10px;margin-top:10px}
.cx-cov{width:46px;height:46px;border-radius:12px;background:#333 center/cover;flex:none;box-shadow:0 6px 18px rgba(0,0,0,.5)}
.cx-bar{height:10px;border-radius:6px;background:rgba(255,255,255,.12);overflow:hidden;flex:1}
.cx-bar b{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,#ff3d8b,#ffcf3f);transition:width 1.2s cubic-bezier(.2,.8,.2,1)}
.cx-n{font:800 13px/1 inherit;min-width:38px;text-align:right}
.cx-big{position:absolute;left:0;right:0;text-align:center;font:900 64px/1 inherit;letter-spacing:-.04em;text-shadow:0 10px 40px rgba(0,0,0,.5)}
.cx-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.12);font:700 12px/1 inherit;margin:6px 6px 0 0;animation:cxPop .5s cubic-bezier(.2,.9,.3,1.4) both}
.cx-av{width:30px;height:30px;border-radius:50%;display:inline-grid;place-items:center;font-size:16px;margin-left:-8px;border:2px solid #120d1d;animation:cxPop .45s cubic-bezier(.2,.9,.3,1.5) both}
.cx-wave{display:flex;align-items:center;gap:3px;height:42px}
.cx-wave i{flex:1;border-radius:3px;background:linear-gradient(#ffcf3f,#ff3d8b);animation:cxWave .9s ease-in-out infinite alternate}
.cx-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(255,200,90,.85),rgba(255,61,139,.35) 40%,transparent 70%);opacity:0}
.cx-flash.go{animation:cxFlash 1.4s ease-out}
.cx-sun{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,94,58,0),rgba(255,94,58,.0));transition:background 6s ease}
.cx-sun.on{background:linear-gradient(180deg,rgba(255,140,60,.38),rgba(255,61,139,.22) 45%,rgba(60,20,90,.15))}
.cx-orb{position:absolute;left:50%;width:150px;height:150px;margin-left:-75px;border-radius:50%;background:radial-gradient(circle,#ffd36b,#ff7a3d 60%,rgba(255,61,139,0) 72%);filter:blur(1px);transition:top 7s cubic-bezier(.4,0,.2,1)}
.cx-cam{position:absolute;left:14px;right:14px;top:120px;height:300px;border-radius:26px;overflow:hidden;border:2px solid rgba(255,255,255,.4);background:radial-gradient(circle at 50% 60%,rgba(124,92,255,.35),rgba(10,8,20,.75));animation:cxUp .6s both}
.cx-cam .fig{position:absolute;bottom:0;width:46px;height:120px;border-radius:24px 24px 6px 6px;background:linear-gradient(#fff3,#fff1);animation:cxDance .5s ease-in-out infinite alternate}
.cx-cam .fig::before{content:"";position:absolute;top:-30px;left:9px;width:28px;height:28px;border-radius:50%;background:#fff3}
.cx-cam .box{position:absolute;border:2px solid #3ddc97;border-radius:10px;animation:cxDance .5s ease-in-out infinite alternate}
.cx-rec{position:absolute;top:12px;left:14px;font:800 11px/1 inherit;letter-spacing:.14em}
.cx-rec::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff2d55;margin-right:6px;animation:cxBlink .8s infinite}
.cx-split{position:absolute;left:0;right:0;top:110px;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 14px}
.cx-split>div{border-radius:22px;padding:14px;text-align:center;background:rgba(14,10,24,.6);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(20px);animation:cxUp .6s both}
.cx-split .vs{position:absolute;left:50%;top:40px;transform:translateX(-50%);width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font:900 15px/1 inherit;background:linear-gradient(135deg,#ff3d8b,#ffcf3f);color:#170a12;box-shadow:0 0 30px rgba(255,61,139,.6);animation:cxPop .6s .3s both}
.cx-fader{display:flex;gap:14px;justify-content:space-around;margin-top:14px;height:170px}
.cx-fader>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;font:700 11px/1 inherit;letter-spacing:.08em;text-transform:uppercase}
.cx-fader .tr{position:relative;flex:1;width:10px;border-radius:6px;background:rgba(255,255,255,.14)}
.cx-fader .tr b{position:absolute;left:-11px;width:32px;height:20px;border-radius:7px;background:linear-gradient(#fff,#cfc8e8);box-shadow:0 4px 12px rgba(0,0,0,.5);transition:bottom 1s cubic-bezier(.2,.8,.2,1)}
.cx-fader .tr i{position:absolute;left:0;right:0;bottom:0;border-radius:6px;background:linear-gradient(0deg,#ff3d8b,#ffcf3f);transition:height 1s cubic-bezier(.2,.8,.2,1)}
.cx-reel{position:absolute;left:50%;top:110px;width:250px;height:445px;margin-left:-125px;border-radius:28px;overflow:hidden;border:2px solid rgba(255,255,255,.5);box-shadow:0 30px 80px -10px rgba(0,0,0,.8);background:linear-gradient(160deg,#ff3d8b,#7c5cff 55%,#0b0912);animation:cxUp .7s both}
.cx-reel .st{position:absolute;left:16px;right:16px;font:900 28px/1.05 inherit;letter-spacing:-.03em;opacity:0;transform:translateY(16px);transition:all .6s cubic-bezier(.2,.9,.3,1.2)}
.cx-reel .st.on{opacity:1;transform:none}
.cx-reel .st small{display:block;font:700 12px/1.3 inherit;letter-spacing:.08em;opacity:.8;text-transform:uppercase}
.cx-prog{position:absolute;top:8px;left:10px;right:10px;height:3px;border-radius:2px;background:rgba(255,255,255,.3)}
.cx-prog b{display:block;height:100%;width:0;background:#fff;border-radius:2px;transition:width 8s linear}
.cx-push{position:absolute;left:10px;right:10px;top:12px;padding:12px 14px;border-radius:22px;background:rgba(245,245,250,.82);color:#111;backdrop-filter:blur(20px);display:flex;gap:10px;align-items:center;box-shadow:0 20px 50px -10px rgba(0,0,0,.6);transform:translateY(-140%);transition:transform .7s cubic-bezier(.2,.9,.3,1.2)}
.cx-push.on{transform:none}
.cx-push .ic{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#ff9a3d,#ff3d8b);display:grid;place-items:center;font-size:20px;flex:none}
.cx-push b{display:block;font:700 14px/1.2 inherit}.cx-push span{font:500 13px/1.3 inherit;color:#333}
@keyframes cxIn{from{opacity:0;transform:translate(-50%,-10px) scale(.8)}}
@keyframes cxUp{from{opacity:0;transform:translateY(30px) scale(.96)}}
@keyframes cxPop{from{opacity:0;transform:scale(.3)}}
@keyframes cxBlink{50%{opacity:.25}}
@keyframes cxWave{from{height:12%}to{height:100%}}
@keyframes cxFlash{0%{opacity:0}15%{opacity:1}100%{opacity:0}}
@keyframes cxDance{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(-12px) rotate(4deg)}}
`;
  const el = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function root(label) {
    if (!document.getElementById('cx-css')) { const s = document.createElement('style'); s.id = 'cx-css'; s.textContent = css; document.head.appendChild(s); }
    const r = el(`<div class="cx"><div class="cx-badge"><i></i>COMING SOON · ${esc(label)}</div></div>`);
    document.body.appendChild(r); return r;
  }
  const waveBars = (n) => Array.from({ length: n }, (_, i) => `<i style="animation-delay:${(-(i * 0.13) % 0.9).toFixed(2)}s"></i>`).join('');
  const C = {};

  C.sunset = async () => {
    const r = root('SUNSET DROP');
    const sun = el('<div class="cx-sun"></div>'); r.prepend(sun);
    const orb = el('<div class="cx-orb" style="top:150px"></div>'); r.appendChild(orb);
    const fl = el('<div class="cx-flash"></div>'); r.appendChild(fl);
    const card = el(`<div class="cx-card" style="bottom:24px"><div class="cx-k">Sunset Drop · Café del Mar mode</div><div class="cx-t">Sun sets in <span id="cxc">00:08</span></div><div class="cx-s">Your DJ holds the biggest drop of the night for the exact minute the sun touches the sea where you are.</div></div>`); r.appendChild(card);
    await wait(300); sun.classList.add('on'); orb.style.top = '420px';
    for (let i = 8; i >= 0; i--) { r.querySelector('#cxc').textContent = '00:0' + i; await wait(820); }
    fl.classList.add('go'); card.querySelector('.cx-t').textContent = 'DROP 🌅'; card.querySelector('.cx-s').textContent = now().title + ' · ' + now().artist;
  };

  C.party = async () => {
    const r = root('PARTY ROOM');
    const t = now();
    const card = el(`<div class="cx-card" style="top:110px"><div class="cx-k">Party Room · 23 friends in</div><div class="cx-t">Vote the next song</div><div class="cx-row" style="margin-top:12px"><div style="display:flex;padding-left:8px" id="cxav"></div><span class="cx-s" style="margin:0 0 0 6px">scan to join · no app needed</span></div>
      <div class="cx-row"><div class="cx-cov" style="background-image:url('${esc(t.cover)}')"></div><div style="flex:1"><div style="font:700 13px/1.2 inherit">${esc(t.title)}</div><div class="cx-bar" style="margin-top:6px"><b id="cxb1"></b></div></div><span class="cx-n" id="cxn1">0</span></div>
      <div class="cx-row"><div class="cx-cov" style="background:linear-gradient(135deg,#7c5cff,#2fd3c6)"></div><div style="flex:1"><div style="font:700 13px/1.2 inherit">Something new 🔀</div><div class="cx-bar" style="margin-top:6px"><b id="cxb2"></b></div></div><span class="cx-n" id="cxn2">0</span></div>
      <div class="cx-row"><div class="cx-cov" style="background:linear-gradient(135deg,#ff9a3d,#ff3d8b)"></div><div style="flex:1"><div style="font:700 13px/1.2 inherit">Afrobeats takeover 🔥</div><div class="cx-bar" style="margin-top:6px"><b id="cxb3"></b></div></div><span class="cx-n" id="cxn3">0</span></div></div>`);
    r.appendChild(card);
    const av = card.querySelector('#cxav'), E = ['😎', '💃', '🕺', '🔥', '🥳', '🎧', '✨', '🌴'], G = ['#ff3d8b', '#7c5cff', '#2fd3c6', '#ffcf3f', '#ff9a3d', '#3ddc97', '#4fc3ff', '#e83cff'];
    for (let i = 0; i < 8; i++) { av.insertAdjacentHTML('beforeend', `<span class="cx-av" style="background:${G[i]};animation-delay:${i * 0.12}s">${E[i]}</span>`); }
    const v = [[3, 2, 1], [7, 3, 6], [11, 4, 12], [14, 5, 19]];
    await wait(900);
    for (const [a, b, c] of v) {
      const tot = 23;
      [[a, 1], [b, 2], [c, 3]].forEach(([n, k]) => { card.querySelector('#cxb' + k).style.width = (n / tot * 100) + '%'; card.querySelector('#cxn' + k).textContent = n; });
      await wait(1500);
    }
    card.querySelector('.cx-t').textContent = 'Afrobeats takeover wins 🔥';
  };

  C.crowdcam = async () => {
    const r = root('CROWD CAM');
    const cam = el(`<div class="cx-cam"><div class="cx-rec">READING THE ROOM</div>
      <div class="fig" style="left:18%;animation-duration:.42s"></div><div class="fig" style="left:42%;height:140px;animation-duration:.5s"></div><div class="fig" style="left:68%;animation-duration:.38s"></div>
      <div class="box" style="left:15%;bottom:4px;width:64px;height:160px"></div><div class="box" style="left:39%;bottom:4px;width:64px;height:180px"></div><div class="box" style="left:65%;bottom:4px;width:64px;height:160px"></div></div>`);
    r.appendChild(cam);
    const card = el(`<div class="cx-card" style="bottom:24px"><div class="cx-k">On-device · nothing leaves your phone</div><div class="cx-t">Dance floor energy <span id="cxe">48%</span></div><div class="cx-row"><div class="cx-bar"><b id="cxeb" style="width:48%"></b></div><span class="cx-n" id="cxbpm">118</span></div><div class="cx-s" id="cxs">The DJ watches the room move and lifts the tempo when the floor fills up.</div></div>`);
    r.appendChild(card);
    for (let i = 0; i < 8; i++) { await wait(900); const e = 48 + i * 6, bpm = 118 + Math.round(i * 0.9); card.querySelector('#cxe').textContent = e + '%'; card.querySelector('#cxeb').style.width = e + '%'; card.querySelector('#cxbpm').textContent = bpm + ' BPM'; }
    card.querySelector('#cxs').textContent = 'Floor is full. Bringing the drop forward 🔥';
  };

  C.dedicate = async () => {
    const r = root('DEDICATIONS');
    const t = now();
    const push = el(`<div class="cx-push"><div class="ic">🎧</div><div><b>Ibiza · Dedication for you</b><span>Dan sent you “${esc(t.title)}” with a shout-out from the DJ</span></div></div>`);
    const card = el(`<div class="cx-card" style="bottom:24px"><div class="cx-k">DJ shout-out</div><div class="cx-t">“This one goes out to Amara, happy birthday from Dan!”</div><div class="cx-wave" style="margin-top:12px">${waveBars(34)}</div><div class="cx-s">Pick a friend, type a line, and your DJ says it in their voice right before the drop.</div></div>`);
    r.appendChild(card); await wait(4200); r.appendChild(push); await wait(60); push.classList.add('on'); await wait(4500);
  };

  C.battle = async () => {
    const r = root('DJ BATTLE');
    const sp = el(`<div class="cx-split"><div><div style="font-size:40px">🇳🇬</div><div class="cx-t" style="font-size:18px">Afrobeats DJ</div><div class="cx-big" style="position:static;font-size:44px;margin-top:8px" id="cxl">50</div></div><div><div style="font-size:40px">🇯🇲</div><div class="cx-t" style="font-size:18px">Dancehall DJ</div><div class="cx-big" style="position:static;font-size:44px;margin-top:8px" id="cxr">50</div></div><span class="vs">VS</span></div>`);
    r.appendChild(sp);
    const card = el(`<div class="cx-card" style="bottom:24px"><div class="cx-k">Round 2 of 3 · crowd decides</div><div class="cx-t">Two AI DJs trade songs. Your reactions score them.</div><div class="cx-row"><div class="cx-bar"><b id="cxbb" style="width:50%"></b></div></div></div>`);
    r.appendChild(card);
    let l = 50;
    for (let i = 0; i < 9; i++) { await wait(850); l += [6, -3, 7, 4, -5, 8, 3, 4, 2][i]; sp.querySelector('#cxl').textContent = l; sp.querySelector('#cxr').textContent = 100 - l; card.querySelector('#cxbb').style.width = l + '%'; }
    card.querySelector('.cx-t').textContent = 'Afrobeats DJ takes the round 🏆';
  };

  C.hum = async () => {
    const r = root('HUM IT IN');
    const t = now();
    const card = el(`<div class="cx-card" style="top:120px;text-align:center"><div class="cx-k">Listening…</div><div class="cx-t">Hum a few seconds</div><div style="margin:18px auto 6px;width:96px;height:96px;border-radius:50%;display:grid;place-items:center;font-size:40px;background:radial-gradient(circle,#ff3d8b,#7c5cff);box-shadow:0 0 0 14px rgba(255,61,139,.15),0 0 0 28px rgba(255,61,139,.07)">🎙️</div><div class="cx-wave">${waveBars(30)}</div></div>`);
    r.appendChild(card); await wait(4200);
    card.innerHTML = `<div class="cx-k">Found it</div><div class="cx-row" style="justify-content:center;margin-top:12px"><div class="cx-cov" style="width:84px;height:84px;border-radius:18px;background-image:url('${esc(t.cover)}')"></div></div><div class="cx-t">${esc(t.title)}</div><div class="cx-s">${esc(t.artist)} · mixing it in on the next bar</div><span class="cx-pill">🎚️ key matched</span><span class="cx-pill">⏱ beat locked</span>`;
    await wait(4500);
  };

  C.reel = async () => {
    const r = root('YOUR NIGHT REEL');
    const reel = el(`<div class="cx-reel"><div class="cx-prog"><b></b></div>
      <div class="st" style="top:40px"><small>Your night on Ibiza</small>3 h 12 min</div>
      <div class="st" style="top:130px"><small>Songs</small>58 tracks, 4 DJs</div>
      <div class="st" style="top:220px"><small>Most loved</small>${esc(now().title)}</div>
      <div class="st" style="top:330px"><small>Peak moment</small>🔥 01:24 AM</div></div>`);
    r.appendChild(reel);
    const card = el(`<div class="cx-card" style="bottom:24px"><div class="cx-k">After every set</div><div class="cx-t">A 15-second vertical recap, ready to post</div></div>`);
    r.appendChild(card);
    await wait(200); reel.querySelector('.cx-prog b').style.width = '100%';
    for (const s of reel.querySelectorAll('.st')) { await wait(1500); s.classList.add('on'); }
    await wait(2500);
  };

  C.stems = async () => {
    const r = root('STEM REMOTE');
    const card = el(`<div class="cx-card" style="bottom:24px"><div class="cx-k">Live stems · your fingers on the mix</div><div class="cx-t" id="cxst">Pull the vocals, keep the drums</div>
      <div class="cx-fader">${['Vocals', 'Drums', 'Bass', 'Melody'].map((n, i) => `<div><div class="tr"><i id="cxi${i}" style="height:80%"></i><b id="cxf${i}" style="bottom:calc(80% - 10px)"></b></div>${n}</div>`).join('')}</div></div>`);
    r.appendChild(card);
    const set = (i, v) => { card.querySelector('#cxi' + i).style.height = v + '%'; card.querySelector('#cxf' + i).style.bottom = `calc(${v}% - 10px)`; };
    const steps = [[[0, 5]], [[3, 30]], [[1, 100], [2, 95]], [[0, 85], [3, 80]], [[1, 40]], [[0, 100], [1, 100], [2, 100], [3, 100]]];
    const txt = ['Vocals out: instant acapella-free beat', 'Melody down', 'Drums and bass up front', 'Vocals back in on the bar', 'Breakdown…', 'Everything in. DROP 🔥'];
    for (let i = 0; i < steps.length; i++) { await wait(1400); steps[i].forEach(([k, v]) => set(k, v)); card.querySelector('#cxst').textContent = txt[i]; }
    await wait(800);
  };

  window.__concept = (n) => (C[n] ? C[n]() : Promise.resolve());
  window.__conceptNames = Object.keys(C);
})();
