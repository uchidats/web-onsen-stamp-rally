// Preserve source geometry AND its coordinate transforms when embedding the map.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
require(path.join(root, 'japan-map.js'));
const names = new Map(globalThis.JapanPrefMap.PREFECTURES.map(p => [String(p.code), p.name]));
let svg = fs.readFileSync(path.join(root, 'assets/japan-map-geolonia.svg'), 'utf8')
  .replace(/<\?xml[^>]*>\s*/, '')
  .replace(/<g\b[^>]*\bdata-code="(\d+)"[^>]*>/g, (tag, code) => {
    // Only remove presentation attributes; transform is essential geographic data.
    return tag.replace(/\s(?:stroke-linejoin|fill|fill-rule|stroke|stroke-width)="[^"]*"/g, '')
      .replace(/>$/, ` data-pref="${names.get(code)}" role="button" tabindex="0">`);
  })
  .replace('<svg class="geolonia-svg-map"', '<svg preserveAspectRatio="xMidYMid meet" class="geolonia-svg-map"')
  .replace('<title>Japanese Prefectures</title>', '<title>日本の47都道府県</title>');
const target = path.join(root, 'japan-map.js');
const js = fs.readFileSync(target, 'utf8');
fs.writeFileSync(target, js.replace(/  const SVG_MARKUP = [^\r\n]+;/, `  const SVG_MARKUP = ${JSON.stringify(svg)};`));
