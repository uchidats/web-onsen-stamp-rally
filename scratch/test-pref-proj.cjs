const fs = require('fs');

// Let's test a projection for each prefecture.
// For any prefecture P:
// What if we compute an affine transformation mapping (lng, lat) -> (svgX, svgY)
// based on either:
// A) The prefecture's geographic bounding box [minLng, maxLng], [minLat, maxLat] to its SVG bounding box [minX, maxX], [minY, maxY]?
// OR
// B) Geographic features / boundaries?
// Let's test approach A for all 12 prefectures that contain verified onsens!
const bounds = JSON.parse(fs.readFileSync('scratch/pref-bounds.json', 'utf8'));
const dataJs = fs.readFileSync('data.js', 'utf8');
const win = {};
new Function('window', dataJs)(win);
const verified = win.ONSEN_DATA.filter(x => x.coordinateVerified);

// Load poly tester
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

function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function distToPref(pt, code) {
  const geom = prefGeom[code];
  if (geom.polygons.some(poly => pointInPoly(pt, poly))) return 0;
  let minDist = Infinity;
  geom.polygons.forEach(poly => {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const d = distToSegment(pt, poly[i], poly[j]);
      if (d < minDist) minDist = d;
    }
  });
  return minDist;
}

// Geographic real bounding boxes of the 12 prefectures:
// [minLat, maxLat, minLng, maxLng]
const geoBBoxes = {
  '1':  { name: '北海道', minLat: 41.35, maxLat: 45.55, minLng: 139.33, maxLng: 145.82 },
  '2':  { name: '青森県', minLat: 40.22, maxLat: 41.56, minLng: 139.50, maxLng: 141.68 },
  '3':  { name: '岩手県', minLat: 38.74, maxLat: 40.45, minLng: 140.65, maxLng: 142.07 },
  '4':  { name: '宮城県', minLat: 37.77, maxLat: 39.00, minLng: 140.27, maxLng: 141.67 },
  '5':  { name: '秋田県', minLat: 38.88, maxLat: 40.52, minLng: 139.69, maxLng: 140.99 },
  '6':  { name: '山形県', minLat: 37.73, maxLat: 39.16, minLng: 139.54, maxLng: 140.65 },
  '7':  { name: '福島県', minLat: 36.79, maxLat: 37.97, minLng: 139.17, maxLng: 141.05 },
  '9':  { name: '栃木県', minLat: 36.20, maxLat: 37.15, minLng: 139.33, maxLng: 140.29 },
  '10': { name: '群馬県', minLat: 36.08, maxLat: 37.06, minLng: 138.39, maxLng: 139.66 },
  '15': { name: '新潟県', minLat: 36.73, maxLat: 38.55, minLng: 137.64, maxLng: 139.90 }, // note Sado island
  '16': { name: '富山県', minLat: 36.27, maxLat: 36.98, minLng: 136.77, maxLng: 137.76 },
  '20': { name: '長野県', minLat: 35.19, maxLat: 37.03, minLng: 137.32, maxLng: 138.75 }
};

const prefCodeMap = {
  '北海道': '1', '青森県': '2', '岩手県': '3', '宮城県': '4', '秋田県': '5', '山形県': '6',
  '福島県': '7', '栃木県': '9', '群馬県': '10', '新潟県': '15', '富山県': '16', '長野県': '20'
};

console.log('Testing prefecture-relative bounding box projection:');
let totalInside = 0;
verified.forEach(o => {
  const code = prefCodeMap[o.prefecture];
  const g = geoBBoxes[code];
  const s = bounds[code].svgBox;
  
  // Normalization:
  const u = (o.longitude - g.minLng) / (g.maxLng - g.minLng);
  const v = (g.maxLat - o.latitude) / (g.maxLat - g.minLat);
  
  const x = s.minX + u * s.width;
  const y = s.minY + v * s.height;
  
  const dist = distToPref({ x, y }, code);
  const inside = dist === 0;
  if (inside) totalInside++;
  console.log(`${o.id} ${o.facility} (${o.prefecture}): inside=${inside}, dist=${dist.toFixed(1)}px (u=${u.toFixed(2)}, v=${v.toFixed(2)})`);
});
console.log(`Summary: ${totalInside} / ${verified.length} inside prefecture polygon.`);
