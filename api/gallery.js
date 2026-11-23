// Ibiza gallery: the app's own Ibiza photos, kept in Firestore (gallery collection, public read).
// GET /api/gallery            -> the list (id, title, size, whether it joins the background)
// GET /api/gallery?id=<slug>  -> the photo itself, cached at the edge
const BASE = 'https://firestore.googleapis.com/v1/projects/gen-lang-client-0743348256/databases/(default)/documents/gallery';
module.exports = async (req, res) => {
  try {
    const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '');
    if (id) {
      if (!/^[a-z0-9-]{1,60}$/.test(id)) { res.status(400).end(); return; }
      const r = await fetch(`${BASE}/${id}?mask.fieldPaths=img&mask.fieldPaths=type`);
      if (!r.ok) { res.setHeader('cache-control', 'no-store'); res.status(r.status === 404 ? 404 : 502).end(); return; }
      const d = await r.json();
      const b64 = d.fields && d.fields.img && d.fields.img.bytesValue;
      if (!b64) { res.status(404).end(); return; }
      const type = (d.fields.type && d.fields.type.stringValue) || 'image/jpeg';
      res.setHeader('content-type', /^(image|video)\/[a-z0-9.+-]+$/.test(type) ? type : 'image/jpeg');
      res.setHeader('cache-control', 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=31536000');
      res.status(200).send(Buffer.from(b64, 'base64'));
      return;
    }
    const f = ['title', 'bg', 'w', 'h', 'order', 'type'].map((x) => 'mask.fieldPaths=' + x).join('&');
    const r = await fetch(`${BASE}?${f}&pageSize=30`);
    // NOTE: reconstructed from this point on — recovered partial content ended at the request
    // above; the list-shaping logic below is a best-effort reimplementation, not an exact pull.
    if (!r.ok) { res.setHeader('cache-control', 'no-store'); res.status(502).end(); return; }
    const d = await r.json();
    const items = (d.documents || []).map((doc) => {
      const flds = doc.fields || {};
      const num = (k) => (flds[k] && Number(flds[k].integerValue || flds[k].doubleValue || 0)) || 0;
      return {
        id: doc.name.split('/').pop(),
        title: (flds.title && flds.title.stringValue) || '',
        w: num('w'),
        h: num('h'),
        order: num('order'),
        bg: !!(flds.bg && flds.bg.booleanValue),
        type: (flds.type && flds.type.stringValue) || 'image/jpeg',
      };
    }).sort((a, b) => a.order - b.order);
    res.setHeader('cache-control', 'public, max-age=300, s-maxage=3600');
    res.status(200).json({ items });
  } catch (e) {
    res.status(502).json({ error: 'upstream_failed' });
  }
};
