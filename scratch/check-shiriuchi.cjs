const fs = require('fs');

const svg = fs.readFileSync('assets/japan-map-geolonia.svg', 'utf8');

function extractNumbers(str) {
  const matches = str.match(/-?[\d.]+/g);
  return matches ? matches.map(Number) : [];
}

const prefGroups = svg.match(/<g class="[^"]*prefecture[^"]*" data-code="(\d+)"[^>]*>[\s\S]*?<\/g>/g);
const prefGeom = {};

prefGroups.forEach(group => {
  const code = group.match(/data-code="(\d+)"/)[1];
  const transMatch = group.match(/transform="translate\(([^,]+),\s*([^\)]+)\)"/);
  const tx = transMatch ? parseFloat(transMatch[1]) : 0;
  const ty = transMatch ? parseFloat(transMatch[2]) : 0;

  function toSvg(x, y) {
    const xp = x + tx + 6;
    const yp = y + ty + 18;
    return {
      x: xp * 1.028807 - 47.544239,
      y: yp * 1.028807 - 28.806583
    };
  }

  const polygons = [];
  (group.match(/<polygon points="([^"]+)"/g) || []).forEach(p => {
    const pts = extractNumbers(p.match(/points="([^"]+)"/)[1]);
    const poly = [];
    for (let i = 0; i < pts.length; i += 2) poly.push(toSvg(pts[i], pts[i+1]));
    polygons.push(poly);
  });

  const paths = [];
  (group.match(/<path d="([^"]+)"/g) || []).forEach(p => {
    const d = p.match(/d="([^"]+)"/)[1];
    const subpaths = d.split(/[MZ]/i).filter(s => s.trim().length > 0);
    subpaths.forEach(sp => {
      const nums = extractNumbers(sp);
      const poly = [];
      for (let i = 0; i < nums.length; i += 2) poly.push(toSvg(nums[i], nums[i+1]));
      if (poly.length > 2) paths.push(poly);
    });
  });

  prefGeom[code] = { tx, ty, polygons: [...polygons, ...paths] };
});

function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const bounds = JSON.parse(fs.readFileSync('scratch/pref-bounds.json', 'utf8'));

// Test Shiriuchi with Hokkaido mainland bounds:
const tx = 602, ty = 10;
function toSvg(x, y) {
  const xp = x + tx + 6;
  const yp = y + ty + 18;
  return {
    x: xp * 1.028807 - 47.544239,
    y: yp * 1.028807 - 28.806583
  };
}

// In Hokkaido Subpath 1:
// Oshima peninsula southern tip (Cape Shirakami) has local x ~ 37, y = 287 -> svg x=616.0, y=295.3!
// Cape Soya has local x = 105, y = 28 -> svg x=686.0, y=28.8!
// Cape Nosappu has local x = 287, y = 148 -> svg x=873.2, y=152.2!
// Okushiri has local x = 0, y = 246 -> svg x=578.0, y=253.1!
// Cape Kamui has local x = 39, y = 173 -> svg x=618.1, y=177.9!

// Geographic:
// Cape Shirakami: 41.40°N, 140.20°E
// Cape Soya: 45.52°N, 141.94°E
// Cape Nosappu: 43.38°N, 145.82°E
// Okushiri: 42.17°N, 139.43°E

const hMain = {
  minLng: 139.40, maxLng: 145.85,
  minLat: 41.35, maxLat: 45.55,
  svgMinX: toSvg(0, 0).x,
  svgMaxX: toSvg(287, 0).x,
  svgMinY: toSvg(0, 28).y,
  svgMaxY: toSvg(0, 287).y
};

const shiriuchi = { lat: 41.5956904, lng: 140.2947278 };
const u = (shiriuchi.lng - hMain.minLng) / (hMain.maxLng - hMain.minLng);
const v = (hMain.maxLat - shiriuchi.lat) / (hMain.maxLat - hMain.minLat);
const pt = {
  x: hMain.svgMinX + u * (hMain.svgMaxX - hMain.svgMinX),
  y: hMain.svgMinY + v * (hMain.svgMaxY - hMain.svgMinY)
};

const inside = prefGeom['1'].polygons.some(poly => pointInPoly(pt, poly));
console.log('Shiriuchi inside Hokkaido?', inside, pt);
