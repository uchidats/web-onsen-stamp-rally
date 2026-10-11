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
const dataJs = fs.readFileSync('data.js', 'utf8');
const win = {};
new Function('window', dataJs)(win);
const verified = win.ONSEN_DATA.filter(x => x.coordinateVerified);

function toSvgHokkaido(x, y) {
  const xp = x + 602 + 6;
  const yp = y + 10 + 18;
  return {
    x: xp * 1.028807 - 47.544239,
    y: yp * 1.028807 - 28.806583
  };
}

const geoConfig = {
  '1': {
    // Hokkaido mainland (excluding Kurils / Northern Territories in inset)
    minLng: 139.40, maxLng: 145.85,
    minLat: 41.35, maxLat: 45.55,
    svgMinX: toSvgHokkaido(0, 0).x,
    svgMaxX: toSvgHokkaido(287, 0).x,
    svgMinY: toSvgHokkaido(0, 28).y,
    svgMaxY: toSvgHokkaido(0, 287).y
  },
  '2':  { minLat: 40.22, maxLat: 41.56, minLng: 139.50, maxLng: 141.68 },
  '3':  { minLat: 38.74, maxLat: 40.45, minLng: 140.65, maxLng: 142.07 },
  '4':  { minLat: 37.77, maxLat: 39.00, minLng: 140.27, maxLng: 141.67 },
  '5':  { minLat: 38.88, maxLat: 40.52, minLng: 139.69, maxLng: 140.99 },
  '6':  { minLat: 37.73, maxLat: 39.16, minLng: 139.54, maxLng: 140.65 },
  '7':  { minLat: 36.79, maxLat: 37.97, minLng: 139.17, maxLng: 141.05 },
  '9':  { minLat: 36.20, maxLat: 37.15, minLng: 139.33, maxLng: 140.29 },
  '10': { minLat: 36.08, maxLat: 37.06, minLng: 138.39, maxLng: 139.66 },
  '15': { minLat: 36.73, maxLat: 38.55, minLng: 137.64, maxLng: 139.90 },
  '16': { minLat: 36.27, maxLat: 36.98, minLng: 136.77, maxLng: 137.76 },
  '20': { minLat: 35.19, maxLat: 37.03, minLng: 137.32, maxLng: 138.75 }
};

const prefCodeMap = {
  '北海道': '1', '青森県': '2', '岩手県': '3', '宮城県': '4', '秋田県': '5', '山形県': '6',
  '福島県': '7', '栃木県': '9', '群馬県': '10', '新潟県': '15', '富山県': '16', '長野県': '20'
};

const projected = [];
let allInside = true;

verified.forEach(o => {
  const code = prefCodeMap[o.prefecture];
  const cfg = geoConfig[code];
  const b = bounds[code].svgBox;
  
  const svgMinX = cfg.svgMinX !== undefined ? cfg.svgMinX : b.minX;
  const svgMaxX = cfg.svgMaxX !== undefined ? cfg.svgMaxX : b.maxX;
  const svgMinY = cfg.svgMinY !== undefined ? cfg.svgMinY : b.minY;
  const svgMaxY = cfg.svgMaxY !== undefined ? cfg.svgMaxY : b.maxY;
  
  const u = (o.longitude - cfg.minLng) / (cfg.maxLng - cfg.minLng);
  const v = (cfg.maxLat - o.latitude) / (cfg.maxLat - cfg.minLat);
  
  const x = svgMinX + u * (svgMaxX - svgMinX);
  const y = svgMinY + v * (svgMaxY - svgMinY);
  
  const isInside = prefGeom[code].polygons.some(p => pointInPoly({ x, y }, p));
  if (!isInside) allInside = false;
  
  projected.push({
    id: o.id,
    facility: o.facility,
    pref: o.prefecture,
    lat: o.latitude,
    lng: o.longitude,
    x, y,
    inside: isInside
  });
});

console.log(`Results: ${projected.filter(p => p.inside).length} / ${projected.length} inside!`);
fs.writeFileSync('scratch/all-projected.json', JSON.stringify(projected, null, 2));

// Check distances between facilities for potential overlap:
console.log('\nChecking pairs with distance < 8px:');
for (let i = 0; i < projected.length; i++) {
  for (let j = i + 1; j < projected.length; j++) {
    const p1 = projected[i], p2 = projected[j];
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    if (d < 8) {
      console.log(`Close pair (${d.toFixed(2)}px): ${p1.id} (${p1.facility}) & ${p2.id} (${p2.facility}) in ${p1.pref}`);
    }
  }
}
