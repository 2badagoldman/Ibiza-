// Build step: rebuilds changed files from their uploaded base versions + patches.json, checks each,
// makes the link preview picture, and puts the site in public/.
const fs = require('fs'), crypto = require('crypto');
fs.mkdirSync('public', { recursive: true });
for (const p of fs.readdirSync('.').filter((f) => /^patches\d*\.json$/.test(f)).sort((a, b) => (+(a.match(/\d+/) || [1])[0]) - (+(b.match(/\d+/) || [1])[0])).flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')))) {
  const a = fs.readFileSync(p.base, 'utf8').split('\n'), out = []; let k = 0;
  for (const [i1, i2, lines] of p.ops) { while (k < i1) out.push(a[k++]); out.push(...lines); k = i2; }
  while (k < a.length) out.push(a[k++]);
  const s = out.join('\n'), got = crypto.createHash('sha1').update(s).digest('hex');
  if (got !== p.sha) { console.error(p.out, 'mismatch', got, p.sha); process.exit(1); }
  fs.writeFileSync('public/' + p.out, s); console.log('built', p.out, got);
}
for (const f of ['index.html', 'booth.js', 'analysis.js', 'account.js', 'bg.js', 'studio.js', 'spotify.js', 'app.js', 'controls.js', 'photos.html', 'artists.html', 'artists.js', 'gallery.html', 'privacy.html', 'terms.html']) if (fs.existsSync(f) && !fs.existsSync('public/' + f)) fs.copyFileSync(f, 'public/' + f);
require('./og.js')('public/og.jpg').catch((e) => console.warn('og image skipped', e));
