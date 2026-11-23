// Serves Deezer artist pictures (by picture address or artist id), album covers and the credited Wikimedia Commons Ibiza photos from Ibiza's own
// address, so they show even where a browser or network blocks those image servers. Only those image paths are allowed.
const OK = /^https:\/\/(cdn-images|e-cdns-images)\.dzcdn\.net\/images\/(artist|cover|misc)\/[0-9a-f]{0,40}\/\d{2,4}x\d{2,4}-[0-9a-z.-]+\.(jpg|jpeg|png)$/i;
const COMMONS = /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/[A-Za-z0-9_.,()%'-]+\.(jpg|jpeg|png)\/\d{2,4}px-[A-Za-z0-9_.,()%'-]+\.(jpg|jpeg|png)$/i;
// an artist's own picture by Deezer id (Deezer sends it on to its image server)
const DZART = /^https:\/\/api\.deezer\.com\/artist\/\d{1,12}\/image\?size=(medium|big|xl)$/;
const UA = 'IbizaDJ/1.0 (https://ibiza-dj.vercel.app/photos.html)';
module.exports = async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x').searchParams.get('u') || '';
    if (!OK.test(u) && !COMMONS.test(u) && !DZART.test(u)) { res.status(400).end('not allowed'); return; }
    const r = await fetch(u, { headers: { accept: 'image/*', 'user-agent': UA } });
    if (!r.ok) { res.setHeader('cache-control', 'no-store'); res.status(r.status === 404 ? 404 : 502).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('content-type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('cache-control', 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000');
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).end();
  }
};
