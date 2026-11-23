// Proxy for the public Deezer API (no key needed). Only a fixed set of read-only paths is allowed.
const ALLOWED = [
  /^\/search\/artist$/,
  /^\/search$/,
  /^\/artist\/\d+$/,
  /^\/artist\/\d+\/(top|related|albums)$/,
  /^\/album\/\d+\/tracks$/,
  /^\/track\/(\d+|isrc:[A-Za-z0-9]{12})$/,
  /^\/chart\/\d+\/(artists|tracks)$/,
  /^\/genre$/,
  /^\/genre\/\d+\/artists$/,
  /^\/search\/playlist$/,
  /^\/playlist\/\d+\/tracks$/,
];
const PARAMS = ['q', 'limit', 'index'];

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const p = url.searchParams.get('p') || '';
    if (!ALLOWED.some((r) => r.test(p))) {
      res.status(400).json({ error: 'path not allowed' });
      return;
    }
    const out = new URL('https://api.deezer.com' + p);
    for (const k of PARAMS) {
      const v = url.searchParams.get(k);
      if (v != null) out.searchParams.set(k, v.slice(0, 200));
    }
    // Deezer allows about 50 calls per 5 seconds per server, shared by every listener: wait and retry when it says slow down
    let r, body, bad = false;
    for (let i = 0; i < 4; i++) {
      r = await fetch(out.toString(), { headers: { 'accept': 'application/json' } });
      body = await r.text();
      bad = !r.ok || /^\s*\{\s*"error"/.test(body);
      if (!bad || !/"code"\s*:\s*4\b|quota/i.test(body) || i === 3) break;
      await new Promise((ok) => setTimeout(ok, 700 * (i + 1)));
    }
    // artist search: biggest artist first, so a DJ named for an artist gets them, not a tribute act or soundalike
    // NOTE: reconstructed from this point on — recovered partial content ended here; the exact
    // ranking/response-shaping logic below is a best-effort reimplementation, not an exact pull.
    if (!bad && (p === '/search/artist' || p === '/search')) {
      try {
        const j = JSON.parse(body);
        if (Array.isArray(j.data)) j.data.sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0));
        body = JSON.stringify(j);
      } catch {}
    }
    res.setHeader('cache-control', 'public, max-age=300, s-maxage=3600');
    res.status(bad ? 502 : 200).send(body);
  } catch (e) {
    res.status(502).json({ error: 'upstream_failed' });
  }
};
