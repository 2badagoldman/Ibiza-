/* Ibiza background: a faded wall of real Ibiza party and sunset photos in separate tiles, changing
   every 2 minutes, under drifting sunset clouds. Ibiza's own gallery photos (/api/gallery) join the
   free-licensed Wikimedia Commons photos credited on /photos.html. */
(() => {
  const PICS = [
    'f/f1/Ibiza_Rocks_2019.jpg',
    '1/11/Pukka_Up_boat_party-Ibiza_Spain-Andres_Larin.jpg',
    '6/6f/O_Beach_Ibiza-Ibiza_Spain-Andres_Larin.jpg',
    'c/c3/Ibiza_Sunset_-_4.jpg',
    '1/16/CAFE_MAMBO_.jpg',
    '2/20/2015_Ibiza_sunset1.jpg',
    '9/94/Es_Vedr%C3%A0_i_es_Vedranell_2020-07-31.jpg',
  ];
  const EVERY = 2 * 60 * 1000;
  const wall = document.getElementById('bgwall');
  if (!wall) return;
  const small = matchMedia('(max-width:700px)').matches;
  const n = 6;
  const w = small ? 500 : 960;
  const url = (p) => (p.charAt(0) === '/' ? p : '/api/img?u=' + encodeURIComponent(`https://upload.wikimedia.org/wikipedia/commons/thumb/${p}/${w}px-${p.split('/').pop()}`));
  // shuffle once per visit; the gallery's photos are added as soon as their list arrives
  const shuffle = (a) => a.map((p) => [Math.random(), p]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const order = shuffle(PICS);
  fetch('/api/gallery').then((r) => r.json()).then((d) => { const mine = shuffle((d.items || []).filter((x) => x.bg).map((x) => x.url)); for (let i = 0; i < mine.length; i++) order.splice(Math.min(order.length, next + 1 + i * 2), 0, mine[i]); }).catch(() => {});
  let next = 0;
  const take = () => order[next++ % order.length];
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const t = document.createElement('div');
    t.className = 'tile t' + i;
    const a = new Image(), b = new Image();
    a.alt = b.alt = ''; a.decoding = b.decoding = 'async';
    t.append(a, b);
    wall.append(t);
    tiles.push({ a, b, front: a });
  }
  function swap(tile, tries = 0) {
    const back = tile.front === tile.a ? tile.b : tile.a;
    const img = new Image();
    img.onload = () => {
      back.src = img.src;
      back.style.objectPosition = img.src.indexOf('/api/gallery') >= 0 ? 'center 28%' : '';
      requestAnimationFrame(() => { back.classList.add('on'); tile.front.classList.remove('on'); tile.front = back; });
    };
    img.onerror = () => { if (tries < 2) swap(tile, tries + 1); };
    img.src = url(take());
  }
  tiles.forEach((tile, i) => setTimeout(() => swap(tile), 150 * i));
  // every 2 minutes all tiles change, in a soft ripple a few seconds apart
  setInterval(() => {
    if (document.hidden) return;
    tiles.forEach((tile, i) => setTimeout(() => swap(tile), 1800 * i));
  }, EVERY);
})();
