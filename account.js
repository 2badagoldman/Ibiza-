/* Ibiza accounts. A "Make Ibiza yours" card on the home page and Sign in / Join free in the top bar.
   After about 2 minutes as a guest the DJ pauses and locks until the listener joins free or signs in
   (Google or email); the music comes straight back once they're in. A cell number is optional. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const SEL = window.Selector;
  const PROMPT_AFTER = 120; // seconds of using the app
  const FB = '10.14.1';
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('sel_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sel_' + k, JSON.stringify(v)); } catch {} },
  };
  const X_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.17h1.7L7.4 4.73H5.58l11.09 14.44z"/></svg>';
  const G_ICON = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  let auth = null, db = null, user = null, syncT = null, ready = false, busy = false, authKnown = false, locked = false;

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
  }
  async function boot(cfg) {
    if (!cfg || !cfg.firebase) { renderAcct(); return; }
    try {
      const base = `https://www.gstatic.com/firebasejs/${FB}/`;
      await loadScript(base + 'firebase-app-compat.js');
      await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
      const app = window.firebase.initializeApp(cfg.firebase);
      auth = app.auth(); db = app.firestore();
      ready = true;
      auth.onAuthStateChanged(async (u) => { user = u; authKnown = true; renderAcct(); if (u && locked) unlock(); if (u) await pullTaste(); });
    } catch { ready = false; }
    renderAcct();
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- share: a link that opens straight into this DJ, carrying the sharer's code ----------
  const SHARE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7c0 .3 0 .5.1.8L8.4 11.2a3 3 0 1 0 0 1.6l6.7 3.4A3 3 0 1 0 18 16z"/></svg>';
  const refCode = () => (user ? user.uid.slice(0, 10) : '');
  async function share() {
    const g = SEL.S.genre && SEL.S.genre !== 'all' && SEL.S.genre !== 'artists' ? SEL.S.genre : '';
    const name = g ? ((SEL.GENRES.find((x) => x.id === g) || {}).name || '') : '';
    const qs = new URLSearchParams(); if (g) qs.set('dj', g); if (refCode()) qs.set('r', refCode());
    const url = 'https://ibiza-dj.vercel.app/' + (qs.toString() ? '?' + qs : '');
    const text = name ? `Listen to the ${name} DJ on Ibiza, the free AI DJ.` : 'Listen to Ibiza, the free AI DJ that mixes your music.';
    if (user && db) { try { await db.collection('users').doc(user.uid).set({ ref: refCode() }, { merge: true }); } catch {} }
    try { if (navigator.share) { await navigator.share({ title: 'Ibiza', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); SEL.toast('Link copied. Send it to anyone: it opens straight into the music.'); }
    catch { window.prompt('Copy this link to share Ibiza:', url); }
  }
  // someone opened a shared link: remember who shared it, and open that DJ ready to play
  {
    const q = new URLSearchParams(location.search), r = (q.get('r') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20), dj = (q.get('dj') || '').replace(/[^a-z0-9]/g, '');
    if (r && !ls.get('ref', '')) ls.set('ref', r);
    if (r || dj) {
      q.delete('r'); q.delete('dj'); history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
      const G = dj && SEL.GENRES.find((x) => x.id === dj && !x.hidden);
      if (G) SEL.pickGenre(G.id);
      // one tap starts the music (browsers need a tap before sound)
      setTimeout(() => {
        if (SEL.S.running) return;
        document.body.insertAdjacentHTML('beforeend', `<div class="share-go" id="share-go"><button type="button" class="sg-btn"><span class="sg-disc"></span><b>${G ? 'Start the ' + esc(G.name) + ' DJ' : 'Start the party'}</b><small>A friend sent you Ibiza. Tap to play.</small></button></div>`);
        $('#share-go button').addEventListener('click', () => { $('#share-go').remove(); SEL.startSet(); });
      }, 600);
    }
  }
  // credit the person who shared, once, when someone they invited joins (only a new account counts, not someone already signed up)
  async function creditReferral() {
    const r = ls.get('ref', '');
    if (!r || !user || !db || r === refCode()) return;
    const made = Date.parse((user.metadata && user.metadata.creationTime) || '');
    if (!made || Date.now() - made > 86400000) { ls.set('ref', ''); return; }
    try {
      const ref = db.collection('users').doc(user.uid), d = await ref.get();
      if (!(d.exists && d.data().referredBy)) await ref.set({ referredBy: r, referredAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch {}
  }

  // ---------- who's listening: the account holder plus up to 2 more profiles ----------
  // A kid profile's nickname stays on this device only; the account keeps just that a kid profile exists.
  let profiles = [];
  const activeProfile = () => ls.get('profile', 'me');
  const localNames = () => ls.get('profileNames', {});
  const profileName = (p) => (p.kid ? localNames()[p.id] || 'Kid' : p.name || 'Profile');
  function profilesMenu(me) {
    const a = activeProfile(), first = String(me).split(/[ @]/)[0];
    const row = (id, label, kid) => `<button class="prof${a === id ? ' on' : ''}" type="button" data-prof="${esc(id)}"><i>${esc((label || '?')[0].toUpperCase())}</i><span>${esc(label)}${kid ? ' · kids' : ''}</span></button>`;
    return `<div class="profs"><div class="dim small">Who's listening?</div>${row('me', first)}${profiles.map((p) => row(p.id, profileName(p), p.kid)).join('')}${profiles.length < 2 ? '<button class="prof add" type="button" id="prof-add"><i>+</i><span>Add a profile</span></button>' : ''}</div>`;
  }
  function wireProfiles() {
    document.querySelectorAll('[data-prof]').forEach((b) => b.addEventListener('click', () => { setProfile(b.dataset.prof); renderAcct(); }));
    const add = $('#prof-add'); if (add) add.addEventListener('click', addProfile);
  }
  // each profile keeps its own taste; a kid profile goes to the Kids DJ and hears its own name
  function setProfile(id) {
    const cur = activeProfile();
    if (id === cur) return;
    const all = ls.get('profileTaste', {});
    all[cur] = SEL.S.taste; ls.set('profileTaste', all);
    SEL.S.taste = all[id] || { artists: {}, likes: {}, bans: {} }; ls.set('taste', SEL.S.taste); SEL.renderSeeds();
    if (!SEL.S.running) SEL.S.poolBuilt = false;
    ls.set('profile', id);
    const p = profiles.find((x) => x.id === id);
    if (p && p.kid) { ls.set('kidName', profileName(p)); ls.set('kidAsked', true); SEL.pickGenre('kids'); }
    else if (id === 'me') { const f = user && String(user.displayName || '').split(' ')[0]; if (f) { ls.set('kidName', f); ls.set('kidAsked', true); } }
    SEL.toast(id === 'me' ? 'Back to your own profile.' : `Now playing for ${profileName(p || {})}.`);
  }
  function addProfile() {
    document.body.insertAdjacentHTML('beforeend', `<div class="kid-ask" id="prof-dlg"><div class="kid-card" role="dialog" aria-label="Add a profile"><b>Add someone who listens with you</b><p>Each profile gets its own DJ that learns their songs. Up to 2 profiles.</p><input id="prof-name" maxlength="16" autocomplete="off" placeholder="First name or nickname"><label class="prof-kid"><input type="checkbox" id="prof-iskid"> This is a kid's profile (plays the Kids DJ; the name stays on this device)</label><div class="kid-row"><button type="button" id="prof-cancel">Cancel</button><button type="button" id="prof-save">Add</button></div></div></div>`);
    const close = () => { const d = $('#prof-dlg'); if (d) d.remove(); };
    $('#prof-cancel').onclick = close;
    $('#prof-save').onclick = async () => {
      const name = String($('#prof-name').value || '').trim().slice(0, 16), kid = $('#prof-iskid').checked;
      if (!/^[\p{L}' -]{1,16}$/u.test(name)) { $('#prof-name').focus(); return; }
      const id = 'p' + Date.now().toString(36);
      if (kid) { const n = localNames(); n[id] = name; ls.set('profileNames', n); }
      profiles = [...profiles, kid ? { id, kid: true } : { id, name }].slice(0, 2);
      close();
      try { await db.collection('users').doc(user.uid).set({ profiles }, { merge: true }); } catch {}
      setProfile(id); renderAcct();
    };
    setTimeout(() => { try { $('#prof-name').focus(); } catch {} }, 50);
  }

  // ---------- top bar ----------
  function renderAcct() {
    const el = $('#acct'); if (el) {
      if (user) {
        const name = user.displayName || user.email || 'You';
        el.innerHTML = `<details class="menu"><summary class="avatar" title="${esc(name)}">${esc(name.trim()[0].toUpperCase())}</summary><div class="pop-menu"><div class="who">${esc(name)}</div><div class="dim small">Your taste is saved to your account.</div>${profilesMenu(name)}<button class="btn" id="signout">Sign out</button></div></details>`;
        $('#signout').addEventListener('click', () => { setProfile('me'); auth.signOut(); });
        wireProfiles();
      } else {
        el.innerHTML = `<button class="btn ghost tb-in" type="button" data-auth="signin">Sign in</button><button class="btn primary tb-join" type="button" data-auth="signup">Join free</button>`;
      }
      el.insertAdjacentHTML('afterbegin', `<button class="btn ghost tb-share" type="button" id="share-btn" aria-label="Share Ibiza">${SHARE_ICON}<span>Share</span></button>`);
      $('#share-btn').addEventListener('click', share);
    }
    renderHome();
  }

  // ---------- home page card ----------
  function renderHome() {
    let c = $('#joincard');
    if (!c) {
      const opts = $('section[data-view=setup] .hero .opts');
      if (!opts) return;
      opts.insertAdjacentHTML('afterend', '<div class="joincard" id="joincard"></div>');
      c = $('#joincard');
    }
    if (user) {
      const name = (user.displayName || user.email || '').split(/[ @]/)[0];
      c.className = 'joincard in';
      c.innerHTML = `<div class="jc-text"><b>Welcome back${name ? ', ' + esc(name) : ''}.</b><span>Your DJ is learning your songs and saving them to your account.</span></div>`;
      return;
    }
    c.className = 'joincard';
    c.innerHTML = `
      <div class="jc-text"><b>Make Ibiza yours</b><span>Join free and your DJ learns your songs, your favorite artists and what to play when. Keep playing either way.</span></div>
      <div class="jc-btns">
        <button class="gbtn" type="button" data-auth="google">${G_ICON}<span>Continue with Google</span></button>
        <button class="gbtn xbtn" type="button" data-auth="x">${X_ICON}<span>Continue with X</span></button>
        <button class="btn primary" type="button" data-auth="signup">Sign up with email</button>
        <button class="linkbtn" type="button" data-auth="signin">I have an account</button>
      </div>`;
  }

  // ---------- guided walkthrough (a sheet over the page; the music keeps playing) ----------
  const STEPS = [
    { title: 'Your DJ is learning you', body: () => {
      const n = (SEL.S.played || []).length, a = Object.values(SEL.S.taste.artists || {}).filter((x) => x && x.w > 0.2).length;
      const heard = n > 1 ? `It has already mixed ${n} songs for you` : 'Every song it plays teaches it something';
      return `${heard}. It notices what you replay, what you skip and which artists keep you dancing${a ? `, like the ${a} artist${a > 1 ? 's' : ''} it’s picked up on so far` : ''}.`;
    } },
    { title: 'It knows what to play when', body: () => 'Easy sunset songs early, bangers when the party peaks. The more you play, the better it gets at the right song for the right moment, just for you.' },
    { title: 'Save your DJ. It’s free.', body: () => 'Join and everything it learns about you is saved, on your phone and your laptop. Without an account it forgets you when you leave.', form: true },
  ];
  let step = 0, mode = 'signup';
  function sheet() {
    let o = $('#onb');
    if (o) return o;
    document.body.insertAdjacentHTML('beforeend', `<div class="onb" id="onb" hidden role="dialog" aria-modal="false" aria-labelledby="onb-title">
      <div class="onb-back" data-onb="close"></div>
      <div class="onb-card">
        <button class="onb-x" type="button" data-onb="close" aria-label="Not now">×</button>
        <div class="onb-art" id="onb-art"></div>
        <h2 id="onb-title"></h2>
        <p class="onb-body" id="onb-body"></p>
        <div class="onb-form" id="onb-form" hidden>
          <button class="gbtn wide" type="button" data-auth="google">${G_ICON}<span>Continue with Google</span></button>
          <button class="gbtn wide xbtn" type="button" data-auth="x">${X_ICON}<span>Continue with X</span></button>
          <div class="onb-or"><span>or</span></div>
          <form id="onb-email" novalidate>
            <input type="email" id="h-email" placeholder="Email" autocomplete="email" aria-label="Email" required>
            <input type="password" id="h-pass" placeholder="Password (6+ characters)" autocomplete="new-password" aria-label="Password" minlength="6" required>
            <input type="tel" id="h-phone" placeholder="Cell number (optional)" autocomplete="tel" aria-label="Cell number, optional" inputmode="tel" maxlength="22">
            <button class="btn primary wide" type="submit" id="onb-submit">Join free</button>
          </form>
          <p class="herr" id="h-err" hidden></p>
          <button class="linkbtn" type="button" id="onb-mode">I already have an account</button>
        </div>
        <div class="onb-foot">
          <div class="onb-dots" id="onb-dots"></div>
          <div class="onb-nav"><button class="linkbtn" type="button" data-onb="close" id="onb-skip">Not now</button><button class="btn primary" type="button" id="onb-next">Next</button></div>
        </div>
        <p class="onb-keep">The music keeps playing.</p>
      </div>
    </div>`);
    o = $('#onb');
    o.addEventListener('click', (e) => {
      if (e.target.closest('[data-onb=close]') && !locked) close();
    });
    $('#onb-next').addEventListener('click', () => { if (step < STEPS.length - 1) { step++; draw(); } });
    $('#onb-email').addEventListener('submit', submit);
    $('#onb-mode').addEventListener('click', () => { mode = mode === 'signup' ? 'signin' : 'signup'; draw(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !o.hidden && !locked) close(); });
    return o;
  }
  function draw() {
    const o = sheet(), s = STEPS[step];
    $('#onb-art').innerHTML = '<i class="onb-disc"></i>'; // Ibiza's spinning record on every screen
    $('#onb-title').textContent = s.form && mode === 'signin' ? 'Welcome back' : locked ? 'Join free to keep the music playing' : s.title;
    $('#onb-body').textContent = s.form && mode === 'signin' ? 'Sign in and your DJ picks up right where it left off.' : locked ? 'Your DJ is paused. Join free in seconds and the music comes right back, with everything it learned about you saved.' : s.body();
    o.classList.toggle('locked', locked);
    $('.onb-x', o).hidden = locked;
    $('#onb-skip').hidden = locked;
    $('#h-phone').hidden = mode === 'signin';
    $('.onb-keep', o).textContent = locked ? 'Free forever. Your music is waiting.' : 'The music keeps playing.';
    $('#onb-form').hidden = !s.form;
    $('#onb-next').hidden = !!s.form;
    $('#onb-skip').textContent = s.form ? 'Keep playing as a guest' : 'Not now';
    $('#onb-submit').textContent = mode === 'signin' ? 'Sign in' : 'Join free';
    $('#h-pass').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    $('#onb-mode').textContent = mode === 'signin' ? 'New here? Join free' : 'I already have an account';
    $('#onb-dots').innerHTML = STEPS.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('');
    o.dataset.step = step;
    err('');
  }
  function open(at, m) {
    if (user) return;
    step = at == null ? 0 : at; mode = m || 'signup';
    const o = sheet(); draw(); o.hidden = false;
    requestAnimationFrame(() => o.classList.add('show'));
    if (s0()) setTimeout(() => { const e = $('#h-email'); if (e && !matchMedia('(pointer:coarse)').matches) e.focus({ preventScroll: true }); }, 250);
    function s0() { return STEPS[step].form; }
  }
  function close() {
    const o = $('#onb'); if (!o || o.hidden || locked) return;
    o.classList.remove('show'); setTimeout(() => { o.hidden = true; }, 250);
  }
  function err(t) { const e = $('#h-err'); if (!e) return; e.textContent = t; e.hidden = !t; }
  function notReady() {
    err('Accounts are switching on very soon. Keep the music going and try again a bit later.');
  }
  function friendly(e) {
    const c = (e && e.code) || '';
    try { console.warn('ibiza sign-in', c); } catch {}
    if (c.includes('email-already-in-use')) return 'That email already has an account. Tap “I already have an account”.';
    if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'That email and password don’t match.';
    if (c.includes('weak-password')) return 'Use at least 6 characters for the password.';
    if (c.includes('invalid-email') || c.includes('missing-email')) return 'Type your email first.';
    if (c.includes('missing-password')) return 'Type a password (6+ characters).';
    if (c.includes('popup-closed') || c.includes('cancelled-popup')) return '';
    if (c.includes('popup-blocked')) return 'Your browser blocked the Google window. Allow pop-ups and try again.';
    if (c.includes('too-many-requests')) return 'Too many tries. Wait a minute and try again.';
    if (c.includes('unauthorized-domain')) return 'Google sign-in works on ibiza-dj.vercel.app. Open Ibiza there to continue.';
    if (c.includes('network')) return 'No connection. Try again in a moment.';
    if (c.includes('account-exists')) return 'That email already has an Ibiza account. Sign in the way you joined first.';
    if (c.includes('operation-not-allowed') || c.includes('invalid-credential') && /twitter/i.test(String(e && e.message))) return 'X sign-in is still being switched on. Try Google or email for now.';
    return 'Something went wrong. Please try again.';
  }
  // Google only signs people in on Ibiza's main address, so a test or old link sends them there first
  const MAIN = 'ibiza-dj.vercel.app';
  const SIGNIN_HOSTS = [MAIN, 'selector-ai-dj.vercel.app', 'localhost'];
  async function google(kind) {
    open(STEPS.length - 1, 'signup');
    if (!SIGNIN_HOSTS.includes(location.hostname)) { location.href = 'https://' + MAIN + '/?join=1'; return; }
    if (!ready) { notReady(); return; }
    err('');
    const P = kind === 'x' ? new window.firebase.auth.TwitterAuthProvider() : new window.firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(P); done(kind || 'google'); }
    catch (e) { err(friendly(e)); }
  }
  async function submit(ev) {
    ev.preventDefault(); if (busy) return; err('');
    if (!ready) { notReady(); return; }
    const email = $('#h-email').value.trim(), pass = $('#h-pass').value;
    if (!email) { err('Type your email first.'); $('#h-email').focus(); return; }
    if (pass.length < 6) { err('Type a password with at least 6 characters.'); $('#h-pass').focus(); return; }
    busy = true; $('#onb-form').classList.add('busy');
    try {
      if (mode === 'signup') {
        try { await auth.createUserWithEmailAndPassword(email, pass); }
        catch (e) {
          // already has an account: just sign them in with what they typed
          if (String(e.code || '').includes('email-already-in-use')) { await auth.signInWithEmailAndPassword(email, pass); done('signin'); return; }
          throw e;
        }
      } else await auth.signInWithEmailAndPassword(email, pass);
      done(mode);
    } catch (e) { err(friendly(e)); }
    finally { busy = false; const f = $('#onb-form'); if (f) f.classList.remove('busy'); }
  }
  // ---------- the lock: after the free 2 minutes the DJ pauses until they join or sign in ----------
  function pauseMusic() {
    const S = SEL.S;
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch {}
    try { if (SEL.actx && SEL.actx.state === 'running') SEL.actx.suspend(); } catch {}
    try { for (const p of SEL.YTM.decks) p.pauseVideo(); } catch {}
    try { if (S.mode === 'spotify' && SEL.SP.player) SEL.SP.player.pause().catch(() => {}); } catch {}
  }
  function resumeMusic() {
    const S = SEL.S;
    if (!S.running) return;
    try { if (SEL.actx && SEL.actx.state === 'suspended') SEL.actx.resume(); } catch {}
    try { if (S.mode === 'youtube' && SEL.YTM.cur) SEL.YTM.decks[SEL.YTM.cur.deckIdx].playVideo(); } catch {}
    try { if (S.mode === 'spotify' && SEL.SP.player) SEL.SP.player.resume().catch(() => {}); } catch {}
  }
  function lock() {
    if (locked || user) return;
    locked = true; document.documentElement.classList.add('ibiza-locked');
    pauseMusic();
    open(STEPS.length - 1, 'signup');
  }
  function unlock() {
    if (!locked) return;
    locked = false; document.documentElement.classList.remove('ibiza-locked');
    close();
    resumeMusic();
  }
  // keep the music paused while the gate is up (a deck could be pressed behind it)
  setInterval(() => { if (locked) pauseMusic(); }, 1500);
  async function savePhone() {
    try {
      const el = $('#h-phone'), v = el ? el.value.trim() : '';
      const u = auth && auth.currentUser;
      if (!u || !db || !v || !/^\+?[0-9 ().-]{7,22}$/.test(v)) return;
      await db.collection('users').doc(u.uid).set({ phone: v.replace(/[^0-9+]/g, '') }, { merge: true });
    } catch {}
  }
  function done(m) {
    savePhone();
    unlock();
    close();
    SEL.toast(m === 'signin' ? 'Signed in. Your taste is back.' : 'You’re in. Your DJ will remember what you love.');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-auth]'); if (!b) return;
    const a = b.dataset.auth;
    if (a === 'google') google();
    else if (a === 'x') google('x');
    else open(STEPS.length - 1, a);
  });

  // ---------- taste sync ----------
  function merge(a, b) {
    const out = { artists: { ...(a.artists || {}) }, likes: { ...(a.likes || {}), ...(b.likes || {}) }, bans: { ...(a.bans || {}), ...(b.bans || {}) } };
    for (const [id, x] of Object.entries(b.artists || {})) {
      const y = out.artists[id];
      out.artists[id] = y ? { ...y, ...x, w: Math.max(y.w || 0, x.w || 0), seed: !!(y.seed || x.seed) } : x;
    }
    return out;
  }
  function trim(t) {
    const ents = Object.entries(t.artists).sort((a, b) => (b[1].seed - a[1].seed) || (b[1].w - a[1].w)).slice(0, 400);
    const cut = (o) => Object.fromEntries(Object.keys(o).slice(-1500).map((k) => [k, 1]));
    return { artists: Object.fromEntries(ents.map(([id, a]) => [id, { name: a.name || '', w: +(+a.w || 0).toFixed(3), pic: a.pic || '', seed: !!a.seed, related: !!a.related }])), likes: cut(t.likes || {}), bans: cut(t.bans || {}) };
  }
  async function pullTaste() {
    try {
      const doc = await db.collection('users').doc(user.uid).get();
      profiles = (doc.exists && Array.isArray(doc.data().profiles) ? doc.data().profiles : []).filter((p) => p && p.id).slice(0, 2);
      if (activeProfile() === 'me' && !ls.get('kidName', '')) { const f = String(user.displayName || '').split(' ')[0]; if (f) { ls.set('kidName', f); ls.set('kidAsked', true); } }
      renderAcct(); creditReferral();
      const cloud = activeProfile() === 'me' && doc.exists && doc.data().taste;
      if (cloud) {
        SEL.S.taste = merge(SEL.S.taste, cloud); ls.set('taste', SEL.S.taste); SEL.renderSeeds();
        if (!SEL.S.running) SEL.S.poolBuilt = false; // never rebuild under a playing set
      }
      await push();
    } catch {}
  }
  async function push() {
    if (!user || !db) return;
    const pid = activeProfile();
    const data = pid === 'me' ? { taste: trim(SEL.S.taste) } : { ptaste: { [pid]: trim(SEL.S.taste) } };
    try { await db.collection('users').doc(user.uid).set({ ...data, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch {}
  }
  window.addEventListener('sel:taste', () => { if (!user) return; clearTimeout(syncT); syncT = setTimeout(push, 4000); });

  // ---------- the free taste: about 4 songs, then a sign-up prompt over the playing DJ; 2 songs later the music pauses until they join ----------
  // (the Kids DJ never asks anyone to sign up, and its songs aren't counted)
  const PROMPT_SONGS = 4, LOCK_SONGS = 6;
  let heard = ls.get('guest_songs', 0), prompted = false;
  window.addEventListener('sel:now', () => {
    if (user || SEL.S.genre === 'kids') return;
    heard++; ls.set('guest_songs', heard);
    if (!authKnown || !ready) return;
    if (heard > LOCK_SONGS) { if (!locked) lock(); }
    else if (heard > PROMPT_SONGS && !prompted) {
      prompted = true; open(STEPS.length - 1, 'signup');
      const b = $('#onb-body'); if (b) b.textContent = `Join free to keep the music going. You've got ${LOCK_SONGS - heard + 1 > 1 ? 'about ' + (LOCK_SONGS - heard + 1) + ' more songs' : 'one more song'} on us.`;
    }
  });

  // ---------- landing: one tap plays the top songs where you are, mixed in 30-second cuts ----------
  function landing(tries = 0) {
    if (SEL.S.running || $('#share-go') || /[?&](join|welcome)=1/.test(location.search)) return;
    if ((!SEL.S.region || !authKnown) && tries < 14) { setTimeout(() => landing(tries + 1), 300); return; } // wait for the listener's country and sign-in
    let where = '';
    try { if (SEL.S.region) where = new Intl.DisplayNames(['en'], { type: 'region' }).of(SEL.S.region) || ''; } catch {}
    const g = SEL.S.genre && SEL.S.genre !== 'all' ? SEL.GENRES.find((x) => x.id === SEL.S.genre && !x.hidden) : null;
    const title = user ? (g ? `Start your ${esc(g.name)} DJ` : 'Start your mix') : g ? `Play the ${esc(g.name)} DJ` : `Play today's top songs${where ? ' in ' + esc(where) : ''}`;
    document.body.insertAdjacentHTML('beforeend', `<div class="share-go" id="share-go"><button type="button" class="sg-btn"><span class="sg-disc"></span><b>${title}</b><small>${user ? 'Picks up where you left off.' : 'Mixed live by your AI DJ. Free, no sign-up to start.'}</small></button><button type="button" class="sg-skip" id="sg-skip">Look around first</button></div>`);
    $('#share-go .sg-btn').addEventListener('click', () => {
      $('#share-go').remove();
      if (!user) SEL.S.mix30 = true; // guests hear the quick 30-second mix: more songs in their free taste
      SEL.startSet();
    });
    $('#sg-skip').addEventListener('click', () => $('#share-go').remove());
  }
  setTimeout(() => landing(), 700);
  if (/[?&]welcome=1/.test(location.search)) setTimeout(() => open(0, 'signup'), 800);
  if (/[?&]join=1/.test(location.search)) { history.replaceState(history.state, '', location.pathname + location.hash); setTimeout(() => open(STEPS.length - 1, 'signup'), 800); }

  // ---------- look ----------
  document.head.insertAdjacentHTML('beforeend', `<style>
.acct{display:flex;gap:8px;align-items:center}
.tb-share svg{vertical-align:-3px;margin-right:6px}
@media(max-width:520px){.tb-share span{display:none}.tb-share svg{margin:0}}
.profs{display:grid;gap:6px;margin:10px 0}
.prof{display:flex;align-items:center;gap:10px;width:100%;padding:6px 8px;border-radius:12px;border:1px solid transparent;background:none;color:inherit;font:inherit;cursor:pointer;text-align:left}
.prof:hover{background:rgba(255,255,255,.06)}.prof.on{border-color:rgba(255,179,138,.5);background:rgba(255,179,138,.08)}
.prof i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:800;background:linear-gradient(135deg,#ff9a3d,#ff3d8b);color:#fff;flex:none}
.prof.add i{background:rgba(255,255,255,.1)}
.prof-kid{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px;color:#c9c0e4}
.share-go{position:fixed;inset:0;z-index:70;display:grid;place-items:center;background:rgba(6,4,12,.55);backdrop-filter:blur(6px)}
.sg-btn{display:grid;justify-items:center;gap:8px;padding:28px 34px;border-radius:28px;border:1px solid rgba(255,255,255,.16);background:linear-gradient(160deg,#1d1730,#110d1b);color:#fff;font:inherit;cursor:pointer;box-shadow:0 30px 80px -20px rgba(255,61,139,.6);animation:sgin .5s cubic-bezier(.2,.7,.2,1)}
.sg-btn b{font-size:22px}.sg-btn small{color:#c9c0e4}
.sg-disc{width:84px;height:84px;border-radius:50%;background:repeating-radial-gradient(circle,rgba(11,9,18,.25) 0 1px,transparent 1px 4px),conic-gradient(#ffd65c,#ff5f6d,#c45cff,#ffd65c);animation:onbspin 4s linear infinite}
@keyframes sgin{from{opacity:0;transform:translateY(20px) scale(.96)}}
.acct .btn{padding:8px 14px;border-radius:999px;font-size:14px;white-space:nowrap}
.acct .btn.ghost{background:transparent}
@media(max-width:520px){.acct .tb-in{display:none}}
.joincard{display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center;margin:22px auto 0;max-width:640px;padding:16px 18px;border-radius:20px;background:linear-gradient(135deg,rgba(124,92,255,.16),rgba(255,79,163,.12));border:1px solid rgba(255,255,255,.12);text-align:left;backdrop-filter:blur(8px)}
.joincard .jc-text{flex:1 1 260px;min-width:0}
.joincard b{display:block;font-size:17px;margin-bottom:3px}
.joincard span{color:var(--dim);font-size:14px;line-height:1.45}
.joincard.in{justify-content:flex-start}
.jc-btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.jc-btns .btn{border-radius:999px;padding:10px 16px}
.gbtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:42px;padding:0 16px;border-radius:999px;background:#fff;color:#1f1f1f;border:0;font-weight:700;font-size:14px;cursor:pointer}
.gbtn.wide,.btn.wide{width:100%}
.gbtn.xbtn{background:#000;color:#fff;border:1px solid rgba(255,255,255,.22)}
.onb-form .gbtn.xbtn{margin-top:10px}
.linkbtn{background:none;border:0;color:var(--text);text-decoration:underline;text-underline-offset:3px;font-weight:600;cursor:pointer;padding:6px}
.onb{position:fixed;inset:0;z-index:60;display:grid;place-items:end center;padding:16px}
@media(min-width:700px){.onb{place-items:center}}
.onb-back{position:absolute;inset:0;background:rgba(5,4,10,.55);backdrop-filter:blur(4px);opacity:0;transition:opacity .25s}
.onb-card{position:relative;width:min(440px,100%);padding:28px 24px 18px;border-radius:26px;background:linear-gradient(180deg,#1d1829,#120f1b);border:1px solid rgba(255,255,255,.12);box-shadow:0 40px 100px -20px rgba(0,0,0,.7),0 0 0 1px rgba(124,92,255,.15);text-align:center;transform:translateY(24px) scale(.98);opacity:0;transition:transform .3s cubic-bezier(.2,.8,.2,1),opacity .25s}
.onb.show .onb-back{opacity:1}.onb.show .onb-card{transform:none;opacity:1}
.onb.locked .onb-back{background:rgba(6,4,12,.42);backdrop-filter:blur(2px)}
.sg-skip{margin-top:14px;background:none;border:0;color:#c9c0e4;text-decoration:underline;text-underline-offset:3px;font:inherit;font-size:14px;cursor:pointer}
.share-go{grid-template-rows:auto auto;align-content:center}
.onb-x[hidden],#onb-skip[hidden],#h-phone[hidden]{display:none!important}
.onb-x{position:absolute;top:10px;right:12px;width:36px;height:36px;border-radius:50%;font-size:24px;line-height:1;color:var(--dim);background:rgba(255,255,255,.05)}
.onb-art{width:84px;height:84px;margin:0 auto 12px;display:grid;place-items:center;border-radius:26px;background:radial-gradient(circle at 30% 30%,rgba(255,79,163,.35),rgba(124,92,255,.25));box-shadow:0 16px 40px -12px rgba(255,79,163,.5)}
.onb-disc{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:repeating-radial-gradient(circle,rgba(11,9,18,.22) 0 1px,transparent 1px 4px),conic-gradient(from 0deg,#ffd65c,#ff5f6d,#c45cff,#ffd65c);animation:onbspin 6s linear infinite;box-shadow:0 8px 24px -6px rgba(255,95,109,.6)}
.onb-disc:after{content:"";width:16px;height:16px;border-radius:50%;background:#0b0912;box-shadow:inset 0 0 0 5px #0b0912,inset 0 0 0 7px #fff}
@keyframes onbspin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.onb-disc{animation:none}}
.onb h2{margin:0 0 8px;font-size:24px;letter-spacing:-.02em}
.onb-body{margin:0 auto 18px;color:var(--dim);font-size:15px;line-height:1.5;max-width:340px}
.onb-form{display:grid;gap:10px;margin-bottom:6px}
.onb-form.busy{opacity:.6;pointer-events:none}
.onb-form form{display:grid;gap:8px}
.onb-form input{width:100%;background:rgba(21,18,31,.9);border:1px solid var(--line);color:var(--text);padding:12px 14px;border-radius:14px;font:inherit;outline:none}
.onb-form input:focus{border-color:rgba(255,95,109,.65);box-shadow:0 0 0 3px rgba(255,95,109,.15)}
.onb-or{display:flex;align-items:center;gap:10px;color:var(--dim);font-size:12px}.onb-or:before,.onb-or:after{content:"";flex:1;height:1px;background:var(--line)}
.onb .herr{color:#ffb38a;font-size:13px;margin:0}
.onb-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px}
.onb-dots{display:flex;gap:6px}.onb-dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.2);transition:width .25s,background .25s}.onb-dots i.on{width:22px;border-radius:6px;background:linear-gradient(90deg,var(--a),var(--b))}
.onb-nav{display:flex;align-items:center;gap:6px}.onb-nav .btn{border-radius:999px;padding:10px 22px}
.onb-nav .linkbtn{color:var(--dim)}
.onb-keep{margin:10px 0 0;font-size:12px;color:var(--dim)}
</style>`);

  if (SEL.CFG.loaded) boot(SEL.CFG); else window.addEventListener('sel:config', (e) => boot(e.detail), { once: true });
  window.IbizaAccount = { open: (m) => open(STEPS.length - 1, m || 'signup'), tour: () => open(0, 'signup'), get user() { return user; } };
})();
