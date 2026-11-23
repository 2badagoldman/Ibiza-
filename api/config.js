// Public settings the app needs in the browser. Nothing secret lives here:
// a Spotify Client ID and a Firebase web config are designed to be public.
// FIREBASE_CONFIG accepts the whole snippet Firebase shows (npm or script tag) or plain JSON;
// separate NEXT_PUBLIC_FIREBASE_* variables work too.
const FIELD = /["']?(apiKey|authDomain|projectId|appId|messagingSenderId|storageBucket)["']?\s*:\s*["']([^"'\s]+)["']/g;
function firebase() {
  try {
    const raw = String(process.env.FIREBASE_CONFIG || '');
    const out = {};
    for (const m of raw.matchAll(FIELD)) if (!out[m[1]]) out[m[1]] = m[2];
    // or one variable per field (NEXT_PUBLIC_FIREBASE_API_KEY and so on), the way Firebase's setup guides name them
    const E = { apiKey: 'API_KEY', authDomain: 'AUTH_DOMAIN', projectId: 'PROJECT_ID', appId: 'APP_ID', messagingSenderId: 'MESSAGING_SENDER_ID', storageBucket: 'STORAGE_BUCKET' };
    for (const [k, v] of Object.entries(E)) {
      const val = String(process.env['NEXT_PUBLIC_FIREBASE_' + v] || process.env['FIREBASE_' + v] || '').trim();
      if (!out[k] && /^[\w.:-]+$/.test(val)) out[k] = val;
    }
    return out.apiKey && out.authDomain && out.projectId && out.appId ? out : null;
  } catch { return null; }
}
module.exports = (req, res) => {
  const id = String(process.env.SPOTIFY_CLIENT_ID || '').trim();
  res.setHeader('cache-control', 'public, max-age=60, s-maxage=300');
  res.status(200).json({
    spotifyClientId: /^[0-9a-f]{32}$/i.test(id) ? id : '',
    youtube: !!String(process.env.YOUTUBE_API_KEY || '').trim(),
    firebase: firebase(),
  });
};
