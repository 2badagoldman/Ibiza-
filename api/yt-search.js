// Free-text YouTube search ("search any video") using the site's own key, kept on the server.
module.exports = async (req, res) => {
  const key = String(process.env.YOUTUBE_API_KEY || '').trim();
  if (!key) return res.status(503).json({ error: 'not_configured' });
  const q = String((req.query && req.query.q) || '').trim().slice(0, 160);
  if (!q) return res.status(400).json({ error: 'missing' });
  const query = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '8', videoEmbeddable: 'true', q, key });
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + query.toString(), { headers: { referer: 'https://ibiza-dj.vercel.app/' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || 'error';
      res.setHeader('cache-control', 'no-store');
      return res.status(r.status === 403 ? 429 : 502).json({ error: reason });
    }
    const items = (j.items || []).filter((x) => x.id && x.id.videoId).map((x) => ({
      id: x.id.videoId,
      title: x.snippet.title,
      channel: x.snippet.channelTitle,
      thumb: x.snippet.thumbnails && (x.snippet.thumbnails.default || x.snippet.thumbnails.medium || {}).url,
    }));
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ items });
  } catch (e) {
    res.setHeader('cache-control', 'no-store');
    return res.status(502).json({ error: 'fetch_failed' });
  }
};
