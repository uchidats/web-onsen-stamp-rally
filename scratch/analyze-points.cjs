const fs = require('fs');

const svg = fs.readFileSync('assets/japan-map-geolonia.svg', 'utf8');

const prefGroups = svg.match(/<g class="[^"]*prefecture[^"]*" data-code="(\d+)"[^>]*>[\s\S]*?<\/g>/g);

const prefPoints = {};

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

  // Extract all points
  const points = [];
  const polygons = group.match(/<polygon points="([^"]+)"/g) || [];
  polygons.forEach(p => {
    const pts = p.match(/points="([^"]+)"/)[1].match(/-?[\d.]+/g).map(Number);
    for (let i = 0; i < pts.length; i += 2) {
      points.push(toSvg(pts[i], pts[i+1]));
    }
  });

  const paths = group.match(/<path d="([^"]+)"/g) || [];
  paths.forEach(p => {
    const d = p.match(/d="([^"]+)"/)[1];
    const commands = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
    commands.forEach(cmd => {
      const type = cmd[0];
      const nums = (cmd.slice(1).match(/-?[\d.]+/g) || []).map(Number);
      if (type === 'M' || type === 'L') {
        for (let i = 0; i < nums.length; i += 2) {
          points.push(toSvg(nums[i], nums[i+1]));
        }
      }
    });
  });

  prefPoints[code] = points;
});

// Aomori has code 2:
console.log('Aomori points count:', prefPoints['2'].length);
// Let's print extrema points of Aomori in SVG:
const aomoriPts = prefPoints['2'];
const minX = aomoriPts.reduce((min, p) => p.x < min.x ? p : min, aomoriPts[0]);
const maxX = aomoriPts.reduce((max, p) => p.x > max.x ? p : max, aomoriPts[0]);
const minY = aomoriPts.reduce((min, p) => p.y < min.y ? p : min, aomoriPts[0]);
const maxY = aomoriPts.reduce((max, p) => p.y > max.y ? p : max, aomoriPts[0]);

console.log('Aomori Westmost (minX):', minX);
console.log('Aomori Eastmost (maxX):', maxX);
console.log('Aomori Northmost (minY):', minY);
console.log('Aomori Southmost (maxY):', maxY);

// Let's check Shimokita peninsula vs Tsugaru peninsula vs Hachinohe
// Also check Hokkaido, Akita, Iwate, etc.
