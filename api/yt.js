// Finds a YouTube video for "artist title" with the site's own key, kept on the server.
module.exports = async (req, res) => {
  const key = String(process.env.YOUTUBE_API_KEY || '').trim();
  if (!key) return res.status(503).json({ error: 'not_configured' });
  const artist = String((req.query && req.query.a) || '').slice(0, 120);
  const title = String((req.query && req.query.t) || '').slice(0, 160);
  if (!artist || !title) return res.status(400).json({ error: 'missing' });
  const q = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '3', videoEmbeddable: 'true', videoCategoryId: '10', q: `${artist} ${title} official audio`, key });
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + q.toString(), { headers: { referer: 'https://selector-ai-dj.vercel.app/' } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const reason = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || 'error';
      res.setHeader('cache-control', 'no-store');
      return res.status(r.status === 403 ? 429 : 502).json({ error: reason });
    }
    const items = j.items || [];
    const want = artist.toLowerCase();
    const hit = items.find((x) => (x.snippet.channelTitle + ' ' + x.snippet.title).toLowerCase().includes(want)) || items[0];
    res.setHeader('cache-control', 'public, s-maxage=2592000, stale-while-revalidate=604800');
    return res.status(200).json({ id: hit ? hit.id.videoId : null });
  } catch (e) {
    res.setHeader('cache-control', 'no-store');
    return res.status(502).json({ error: 'fetch_failed' });
  }
};
