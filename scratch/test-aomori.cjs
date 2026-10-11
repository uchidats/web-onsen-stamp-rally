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

function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function testPref(code) {
  const geom = prefGeom[code];
  return {
    pointInPref: pt => geom.polygons.some(poly => pointInPoly(pt, poly)),
    distToPref: pt => {
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
  };
}

// Let's inspect Aomori facilities with Aomori geometry!
const aomori = testPref('2');
const bounds = JSON.parse(fs.readFileSync('scratch/pref-bounds.json', 'utf8'))['2'].svgBox;
console.log('Aomori SVG bounds:', bounds);

// Aomori real bounds:
// Latitude: ~40.216 to 41.554 (Cape Oma is ~41.55, but note Oma is on Shimokita peninsula)
// Longitude: ~139.5 to 141.68
// If we normalize within Aomori lat/lng:
// Let's test a local bounding box affine fit for Aomori's 4 facilities
const dataJs = fs.readFileSync('data.js', 'utf8');
const win = {};
new Function('window', dataJs)(win);
const aomoriFacilities = win.ONSEN_DATA.filter(x => x.prefecture === '青森県' && x.coordinateVerified);
console.log('Aomori facilities:');
aomoriFacilities.forEach(f => console.log(f.id, f.facility, f.latitude, f.longitude));
