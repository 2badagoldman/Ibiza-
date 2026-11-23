// Proxy for a Deezer 30-second preview URL, with CORS, so the browser can play it without
// Deezer's own CORS restrictions getting in the way. Only Deezer's own preview CDN is allowed.
const OK = /^https:\/\/cdn[a-z]*-preview(?:-[a-z0-9]+)?\.dzcdn\.net\//i;
module.exports = async (req, res) => {
  try {
    const u = String(new URL(req.url, 'http://x').searchParams.get('u') || '');
    const target = (() => { try { return new URL(u); } catch { return null; } })();
    if (!target || target.protocol !== 'https:' || !OK.test(u)) { res.status(400).end('not allowed'); return; }
    const r = await fetch(target.toString(), { headers: { accept: 'audio/*' } });
    if (!r.ok) { res.setHeader('cache-control', 'no-store'); res.status(r.status === 404 ? 404 : 502).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) { res.status(413).end(); return; }
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('content-type', r.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('cache-control', 'public, s-maxage=86400');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).end();
  }
};
