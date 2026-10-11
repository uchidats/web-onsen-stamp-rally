const fs = require('fs');

const pts = {"onsen-001":[618.93,279.68],"onsen-002":[654.59,341.56],"onsen-003":[660.42,346.28],"onsen-004":[615.32,344.47],"onsen-005":[673.63,338.44],"onsen-007":[657.22,415.06],"onsen-008":[661.18,421.43],"onsen-011":[647.97,427],"onsen-013":[638.84,390.5],"onsen-014":[642.92,384.21],"onsen-015":[641.86,397.36],"onsen-016":[649.33,398.08],"onsen-020":[649.93,386.89],"onsen-021":[640.2,450.94],"onsen-022":[633.24,448.13],"onsen-023":[647.8,377.24],"onsen-024":[633.75,503.59],"onsen-025":[641.23,503.04],"onsen-027":[648.18,464.02],"onsen-028":[614.95,527.27],"onsen-030":[619.08,475.84],"onsen-031":[622.96,524.34],"onsen-032":[621.06,531.63],"onsen-036":[627.35,536.49],"onsen-038":[628.74,529.12],"onsen-039":[620.59,539.73],"onsen-041":[582.32,587.22],"onsen-044":[613.52,572.29],"onsen-046":[565.73,591.05],"onsen-047":[555.51,596.96],"onsen-049":[551.19,603.1],"onsen-050":[540.78,604.49],"onsen-051":[546.54,609.15],"onsen-052":[533.36,605.02],"onsen-056":[533.71,584.98],"onsen-060":[540.02,575.13],"onsen-062":[548.65,587.54],"onsen-063":[582.7,501.05],"onsen-066":[490.24,606.65],"onsen-067":[491.99,587.73]};

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

const dataJs = fs.readFileSync('data.js', 'utf8');
const win = {};
new Function('window', dataJs)(win);
const prefCodeMap = {
  '北海道': '1', '青森県': '2', '岩手県': '3', '宮城県': '4', '秋田県': '5', '山形県': '6',
  '福島県': '7', '栃木県': '9', '群馬県': '10', '新潟県': '15', '富山県': '16', '長野県': '20'
};

let insideCount = 0;
const list = Object.entries(pts);
list.forEach(([id, [x, y]]) => {
  const o = win.ONSEN_DATA.find(d => d.id === id);
  const code = prefCodeMap[o.prefecture];
  const ok = prefGeom[code].polygons.some(poly => pointInPoly({ x, y }, poly));
  if (ok) insideCount++;
  else console.log(id, o.facility, o.prefecture, 'is outside polygon boundary after relaxation');
});
console.log(`Relaxed coordinates inside polygon: ${insideCount} / ${list.length}`);
