// Tells the browser which country the listener is in, from Vercel's own edge header. Used so the
// app can default things sensibly (e.g. language or region-flavored picks) without asking.
module.exports = (req, res) => {
  const raw = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const country = /^[A-Z]{2}$/.test(raw) ? raw : '';
  res.setHeader('cache-control', 'private, no-store');
  res.status(200).json({ country });
};
