// Ibiza DJ voices (ElevenLabs). Every DJ line here is fixed, so the credits spent are bounded: each line is
// recorded once per voice, kept in Ibiza's Blob storage, and served from there to every listener after that.
//   GET /api/voice?list=1          -> the voices and their lines (no ElevenLabs call)
//   GET /api/voice?v=jerry&l=drop3 -> that voice saying that line (mp3)
//   GET /api/voice?v=jerry&l=name  -> a signed-in listener's hello with their first name (needs their sign-in token)
const { put, head } = require('@vercel/blob');
const crypto = require('crypto');

// how "Ibiza" is said: a spelling the voices read the right way
const IBIZA = 'Ee-BEE-zuh';
const PACK = 'p1'; // bump when the lines or the spelling change, so new recordings are made

const VOICES = {
  jerry: { label: 'Jerry B. · classic radio', match: 'Jerry B', scope: 'main' },
  tyler: { label: 'Tyler Cruz · cool and energetic', match: 'Tyler Cruz', scope: 'main' },
  blondie: { label: 'Blondie · London radio', match: 'Blondie', scope: 'main' },
  cera: { label: 'Cera · laid-back radio', match: 'Cera', scope: 'main' },
  sparkles: { label: 'Sparkles · kids', match: 'Sparkles for Kids', scope: 'kids' },
  shanny: { label: 'Shanny · kids storyteller', match: 'Shanny', scope: 'kids' },
  kavya: { label: 'Kavya · Hindi', match: 'Kavya', scope: 'hindi' },
  piku: { label: 'Piku · Indian English', match: 'Piku', scope: 'hindi' },
  ifeoma: { label: 'Ifeoma · Nigerian radio', match: 'Ifeoma', scope: 'main' },
  // ============================================================================================
  // NOT RECOVERED PAST THIS POINT.
  //
  // The live deployment's API introspection tool truncates any source file at ~1500 bytes with
  // no pagination, and this is a serverless function (not a statically-servable file), so the
  // live-URL workaround that recovered every *.html/*.js page in this repo does not apply here.
  // Everything above this block is an exact, byte-for-byte pull from the deployment. Everything
  // that originally followed — roughly 11,900 characters, the bulk of this file — is genuinely
  // unrecovered, not just unformatted, and is NOT reproduced below as a guess, to avoid passing
  // off fabricated logic as real source.
  //
  // From the file's own header comment and from how it's called elsewhere in this app, the
  // missing part needs to:
  //   - scope: 'main' is used in index.html for the Jerry/Tyler/Blondie/Cera lines, 'kids' for
  //     Sparkles/Shanny, 'hindi' for Kavya/Piku (Ifeoma's scope value is itself unrecovered —
  //     assumed 'main' above as the closest guess, not confirmed)
  //   - a fixed set of named lines per voice (e.g. "drop3") spoken over the DJ, plus a "name"
  //     line that's personalized with a signed-in listener's first name
  //   - module.exports = async (req, res) => { ... } handling ?list=1, ?v=&l=, and ?v=&l=name
  //   - a cache key/path in Vercel Blob storage keyed by PACK + voice + line (and by the
  //     listener's name for the "name" line), via `head()` to check for an existing recording
  //     before calling ElevenLabs, and `put()` to store a newly generated one
  //   - the actual ElevenLabs API call (voice IDs, model, request shape) when nothing is cached
  //
  // To restore this file exactly, pull it from the project's own Vercel/GitHub history (this was
  // never pushed to a git repo before now) or from a local backup — not from this reconstruction.
  // ============================================================================================
};

module.exports = async (req, res) => {
  res.status(501).json({ error: 'voice.js was not fully recoverable from the live deployment — see comments in this file' });
};
