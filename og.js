// Builds the link preview picture (public/og.jpg, 1200x630): a real Ibiza beach party photo
// (O Beach Ibiza by O Beach Group, CC BY 4.0, Wikimedia Commons; credited on /photos.html)
// tinted in Ibiza's sunset colors, with the IBIZA logo. Falls back to a sunset gradient.
const fs = require('fs'), path = require('path');
const PHOTO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/O_Beach_Ibiza.jpg/1920px-O_Beach_Ibiza.jpg';
const UA = { 'user-agent': 'IbizaDJ-og-build/1.0 (https://ibiza-dj.vercel.app/photos.html)' };
const W = 1200, H = 630;
const FONTS = path.dirname(require.resolve('@expo-google-fonts/inter/package.json'));
const font = (w) => path.join(FONTS, w, `Inter_${w}.ttf`);
const svg = (s, w = W, h = H) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${s}</svg>`);
const tint = svg(`<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a3d"/><stop offset=".5" stop-color="#ff3d8b"/><stop offset="1" stop-color="#7c3cff"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#t)"/>`);
const shade = svg(`<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b0912" stop-opacity=".9"/><stop offset=".55" stop-color="#0b0912" stop-opacity=".45"/><stop offset="1" stop-color="#0b0912" stop-opacity="0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="#0b0912" stop-opacity="0"/><stop offset="1" stop-color="#0b0912" stop-opacity=".85"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#l)"/><rect width="${W}" height="${H}" fill="url(#b)"/>`);

// ================================================================================================
// NOT RECOVERED PAST THIS POINT.
//
// This is a build-time-only script (run by build.js, via `require('./og.js')('public/og.jpg')`)
// and is never served over HTTP, so the live-URL workaround used for every *.html/*.js page in
// this repo doesn't apply, and the deployment-introspection tool truncates any source file at
// ~1500 bytes with no pagination. Everything above is an exact, byte-for-byte pull from the
// deployment. Everything that originally followed — roughly 5,700 characters, the bulk of this
// file — is genuinely unrecovered and is NOT reproduced below as a guess.
//
// From the header comment, the file's signature, and what's referenced above, the missing part
// needs to:
//   - module.exports = async (outPath) => { ... } — fetch PHOTO with UA, composite `tint` and/or
//     `shade` over it with `sharp` (a package.json dependency), draw the IBIZA wordmark/logo using
//     the Inter font files resolved via `font(weight)`, and write the result to `outPath`
//   - fall back to a plain sunset gradient (no photo) if the fetch fails
//
// To restore this file exactly, pull it from the project's own Vercel/GitHub history (this was
// never pushed to a git repo before now) or from a local backup — not from this reconstruction.
// ================================================================================================
module.exports = async (outPath) => {
  throw new Error('og.js was not fully recoverable from the live deployment — see comments in this file');
};
