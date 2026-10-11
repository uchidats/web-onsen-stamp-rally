const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scratch/all-projected.json', 'utf8'));
const svg = fs.readFileSync('assets/japan-map-geolonia.svg', 'utf8');

function extractNumbers(str) {
  const matches = str.match(/-?[\d.]+/g);
  return matches ? matches.map(Number) : [];
}
const prefGroups = svg.match(/<g class="[^"]*prefecture[^"]*" data-code="(\d+)"[^>]*>[\s\S]*?<\/g>/g);
const prefGeom = {};
prefGroups.forEach(group => {
  const code = group.match(/data-code="(\d+)"/)[1];
  const transMatch = group.match(/transform="translate\(([^,]+),\s*([^)]+)\)"/);
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
  prefGeom[code] = { polygons: [...polygons, ...paths] };
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

const prefCodeMap = {
  '北海道': '1', '青森県': '2', '岩手県': '3', '宮城県': '4', '秋田県': '5', '山形県': '6',
  '福島県': '7', '栃木県': '9', '群馬県': '10', '新潟県': '15', '富山県': '16', '長野県': '20'
};

function isInsidePref(p, x, y) {
  const code = prefCodeMap[p.pref];
  return prefGeom[code].polygons.some(poly => pointInPoly({ x, y }, poly));
}

// Relaxation with boundary constraint:
// If moving p out of polygon, reject that step or step halfway!
function resolveConstrained(points, minDistance = 7.0, maxDisplacement = 4.0) {
  const pts = points.map(p => ({ ...p, origX: p.x, origY: p.y }));
  
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-4) {
          const angle = (i * 1.5);
          const stepX = 1.5 * Math.cos(angle);
          const stepY = 1.5 * Math.sin(angle);
          if (isInsidePref(pts[i], pts[i].x - stepX, pts[i].y - stepY)) {
            pts[i].x -= stepX; pts[i].y -= stepY;
          }
          if (isInsidePref(pts[j], pts[j].x + stepX, pts[j].y + stepY)) {
            pts[j].x += stepX; pts[j].y += stepY;
          }
          continue;
        }
        if (d < minDistance) {
          const overlap = (minDistance - d) / 2;
          const nx = (dx / d) * overlap * 0.4;
          const ny = (dy / d) * overlap * 0.4;

          const nextIX = pts[i].x - nx;
          const nextIY = pts[i].y - ny;
          if (isInsidePref(pts[i], nextIX, nextIY) && Math.hypot(nextIX - pts[i].origX, nextIY - pts[i].origY) <= maxDisplacement) {
            pts[i].x = nextIX;
            pts[i].y = nextIY;
          }

          const nextJX = pts[j].x + nx;
          const nextJY = pts[j].y + ny;
          if (isInsidePref(pts[j], nextJX, nextJY) && Math.hypot(nextJX - pts[j].origX, nextJY - pts[j].origY) <= maxDisplacement) {
            pts[j].x = nextJX;
            pts[j].y = nextJY;
          }
        }
      }
    }
  }
  return pts;
}

const res = resolveConstrained(raw);
let insideAll = 0;
res.forEach(p => {
  if (isInsidePref(p, p.x, p.y)) insideAll++;
});
console.log(`Constrained relaxation: ${insideAll} / ${res.length} inside!`);

let minD = Infinity;
for (let i = 0; i < res.length; i++) {
  for (let j = i + 1; j < res.length; j++) {
    const d = Math.hypot(res[i].x - res[j].x, res[i].y - res[j].y);
    if (d < minD) minD = d;
  }
}
console.log('Min distance after constrained relaxation:', minD.toFixed(2), 'px');
const resultTable = {};
res.forEach(p => {
  resultTable[p.id] = [Number(p.x.toFixed(2)), Number(p.y.toFixed(2))];
});
fs.writeFileSync('scratch/final-positions.json', JSON.stringify(resultTable, null, 2));
