// Builds index.html, a single self-contained page, from src/board.html.
//
//   node prototypes/scene-command/build.mjs
//
// The page has to be one file with everything inlined, because it is published
// as a sandboxed web page that can only load scripts from a few CDNs. So the
// map geometry, the sample scene's aerial photo, and Leaflet's stylesheet are
// spliced in here instead of being fetched at runtime.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(here, p), 'utf8');

const replacements = {
  '/*@LEAFLET_CSS*/': read('vendor/leaflet-1.9.4.css'),
  '/*@GEO*/null': read('data/monmouth-geo.json').trim(),
  '/*@SCENE*/null': read('data/sample-scene.json').trim(),
};

let html = read('src/board.html');
for (const [marker, value] of Object.entries(replacements)) {
  if (!html.includes(marker)) throw new Error(`Marker ${marker} is missing from src/board.html`);
  html = html.replace(marker, () => value);
}

const out = join(here, 'index.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB)`);
