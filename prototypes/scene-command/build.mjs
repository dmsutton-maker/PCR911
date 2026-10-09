// Builds OpsBoard (incident, supervisor and event boards) from src/board.html.
//
//   node prototypes/scene-command/build.mjs                    → index.html, the page published inside Claude
//   node prototypes/scene-command/build.mjs --site <folder>    → also <folder>/index.html, a full web page with its
//                                                                 home-screen icon and manifest (GitHub Pages)
//
// The page has to be one file with everything inlined, because the Claude-hosted
// copy is a sandboxed page that can only load scripts from a few CDNs. So the
// map geometry, the sample scene's aerial photo, and Leaflet's stylesheet are
// spliced in here instead of being fetched at runtime.

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(here, p), 'utf8');

const replacements = {
  '/*@LEAFLET_CSS*/': read('vendor/leaflet-1.9.4.css'),
  '/*@GEO*/null': read('data/monmouth-geo.json').trim(),
  '/*@SCENE*/null': read('data/sample-scene.json').trim(),
  // The squad relay's address, so tablets joining by invite code alone know where to go. Not a secret.
  "/*@RELAY_URL*/''": JSON.stringify((process.env.PCR_RELAY_URL || '').trim()),
};

let html = read('src/board.html');
for (const [marker, value] of Object.entries(replacements)) {
  if (!html.includes(marker)) throw new Error(`Marker ${marker} is missing from src/board.html`);
  html = html.replace(marker, () => value);
}

const out = join(here, 'index.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);

// The Claude-hosted copy is wrapped in a document by the host. A standalone web
// page needs its own: head (title, fonts, styles go there), a viewport that
// reaches under the status bar, and what iOS needs to open it full screen from
// the home screen.
const site = process.argv.indexOf('--site');
if (site > -1) {
  const dir = resolve(process.argv[site + 1] || 'site');
  const split = html.indexOf('<div class="app"');
  if (split < 0) throw new Error('Could not find the app root in the built page');
  const head = html.slice(0, split), body = html.slice(split);
  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0B1B2B">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="OpsBoard">
<meta name="robots" content="noindex">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="logo.svg" type="image/svg+xml">
<link rel="alternate icon" href="icon-180.png">
<link rel="manifest" href="manifest.webmanifest">
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
${head}</head>
<body>
${body}</body>
</html>
`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page);
  copyFileSync(join(here, 'icon-180.png'), join(dir, 'icon-180.png'));
  copyFileSync(join(here, 'icon-512.png'), join(dir, 'icon-512.png'));
  copyFileSync(join(here, 'logo.svg'), join(dir, 'logo.svg'));
  writeFileSync(join(dir, 'manifest.webmanifest'), JSON.stringify({
    name: 'OpsBoard',
    short_name: 'OpsBoard',
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0B1B2B',
    theme_color: '#0B1B2B',
    icons: [
      { src: 'icon-180.png', sizes: '180x180', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2));
  // The offline copy. A new version of the page gets a new cache name, so tablets pick it up the next time they're online.
  const version = createHash('sha256').update(page).digest('hex').slice(0, 12);
  const libs = [...new Set([...page.matchAll(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/[^"'\s)]+\.js/g)].map(m => m[0]))];
  writeFileSync(join(dir, 'sw.js'), read('src/sw.js').replace("'@VERSION'", JSON.stringify(version)).replace('/*@LIBS*/[]', JSON.stringify(libs, null, 2)));
  console.log(`Wrote ${join(dir, 'index.html')} (${Math.round(page.length / 1024)} KB) with icon, manifest and offline copy ${version} (${libs.length} libraries)`);
}
