// uploads feed.html to Vercel Blob as demo/feed.html (the /demo page loads it)
const fs = require('fs');
const { put } = require('@vercel/blob');
(async () => {
  fs.mkdirSync('public', { recursive: true });
  const r = await put('demo/feed.html', fs.readFileSync('feed.html'), { access: 'public', contentType: 'text/html; charset=utf-8', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
  console.log('feed url', r.url);
  fs.writeFileSync('public/index.html', '<a href="' + r.url + '">' + r.url + '</a>');
})().catch((e) => { console.error(e); process.exit(1); });
