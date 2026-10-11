const fs = require('fs');

const svg = fs.readFileSync('assets/japan-map-geolonia.svg', 'utf8');

function extractNumbers(str) {
  const matches = str.match(/-?[\d.]+/g);
  return matches ? matches.map(Number) : [];
}

const prefGroups = svg.match(/<g class="[^"]*prefecture[^"]*" data-code="(\d+)"[^>]*>[\s\S]*?<\/g>/g);
const hokkaidoGroup = prefGroups.find(g => g.includes('data-code="1"'));

const transMatch = hokkaidoGroup.match(/transform="translate\(([^,]+),\s*([^\)]+)\)"/);
const tx = parseFloat(transMatch[1]);
const ty = parseFloat(transMatch[2]);

function toSvg(x, y) {
  const xp = x + tx + 6;
  const yp = y + ty + 18;
  return {
    x: xp * 1.028807 - 47.544239,
    y: yp * 1.028807 - 28.806583
  };
}

// In Hokkaido, let's find the polygon/path that corresponds to the Oshima peninsula (Hakodate/Matsumae/Shiriuchi area)
// Look at the paths and polygons in Hokkaido:
const paths = hokkaidoGroup.match(/<path d="([^"]+)"/g) || [];
console.log('Hokkaido paths count:', paths.length);
// Shiriuchi Onsen is in southern Hokkaido:
// Lat 41.5956904, Lng 140.2947278
// Cape Shirakami (southernmost tip) is 41.39°N, 140.20°E
// Cape Erimo is 41.92°N, 143.25°E
// Cape Soya (northernmost) is 45.52°N, 141.94°E
// Cape Nosappu (easternmost) is 43.38°N, 145.82°E
// Notice that the Russian Northern Territories (Kunashiri/Etorofu/Habomai/Shikotan) might be included in the SVG!
// Let's check the localBox of Hokkaido: minX=0, maxX=407, minY=0, maxY=287
// If Etorofu is included, maxLng is actually 148.88°E! And maxLat is 45.55°N!
// Let's inspect the shapes in Hokkaido to see if the Northern Territories are there!
const polygons = hokkaidoGroup.match(/<polygon points="([^"]+)"/g) || [];
console.log('Hokkaido polygons count:', polygons.length);

const d = paths[0].match(/d="([^"]+)"/)[1];
const subpaths = d.split(/[MZ]/i).filter(s => s.trim().length > 0);
console.log('Subpaths count:', subpaths.length);
subpaths.forEach((sp, idx) => {
  const pts = extractNumbers(sp);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i+1]); maxY = Math.max(maxY, pts[i+1]);
  }
  const sMin = toSvg(minX, minY);
  const sMax = toSvg(maxX, maxY);
  console.log(`Subpath ${idx} (len ${pts.length/2}): local x=[${minX}, ${maxX}] y=[${minY}, ${maxY}] -> svg x=[${sMin.x.toFixed(1)}, ${sMax.x.toFixed(1)}] y=[${sMin.y.toFixed(1)}, ${sMax.y.toFixed(1)}]`);
});
