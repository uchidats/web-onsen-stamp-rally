const fs = require('fs');

const svg = fs.readFileSync('assets/japan-map-geolonia.svg', 'utf8');

// The outer transforms:
// <g class="svg-map" transform="matrix(1.028807, 0, 0, 1.028807, -47.544239, -28.806583)">
//   <g class="prefectures" transform="matrix(1, 0, 0, 1, 6, 18)">
//     <g class="... prefecture" data-code="..." transform="translate(tx, ty)">

// Let's compute the bounding box of polygon points and path points for each prefecture.
function extractNumbers(str) {
  const matches = str.match(/-?[\d.]+/g);
  return matches ? matches.map(Number) : [];
}

const prefGroups = svg.match(/<g class="[^"]*prefecture[^"]*" data-code="(\d+)"[^>]*>[\s\S]*?<\/g>/g);

const prefBounds = {};

prefGroups.forEach(group => {
  const code = group.match(/data-code="(\d+)"/)[1];
  const title = group.match(/<title>([^<]+)<\/title>/)?.[1] || '';
  const transMatch = group.match(/transform="translate\(([^,]+),\s*([^\)]+)\)"/);
  const tx = transMatch ? parseFloat(transMatch[1]) : 0;
  const ty = transMatch ? parseFloat(transMatch[2]) : 0;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  // Polygons
  const polygons = group.match(/<polygon points="([^"]+)"/g) || [];
  polygons.forEach(p => {
    const pts = extractNumbers(p.match(/points="([^"]+)"/)[1]);
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i];
      const y = pts[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });

  // Paths
  const paths = group.match(/<path d="([^"]+)"/g) || [];
  paths.forEach(p => {
    const d = p.match(/d="([^"]+)"/)[1];
    // Simple command parser for M, L, Z
    const commands = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
    let curX = 0, curY = 0;
    commands.forEach(cmd => {
      const type = cmd[0];
      const nums = extractNumbers(cmd.slice(1));
      if (type === 'M' || type === 'L') {
        for (let i = 0; i < nums.length; i += 2) {
          curX = nums[i]; curY = nums[i + 1];
          if (curX < minX) minX = curX;
          if (curX > maxX) maxX = curX;
          if (curY < minY) minY = curY;
          if (curY > maxY) maxY = curY;
        }
      }
    });
  });

  // Convert to prefectures coordinate space (add tx, ty)
  // And to the root SVG space:
  // x_prefectures = x_local + tx + 6
  // y_prefectures = y_local + ty + 18
  // x_svg = x_prefectures * 1.028807 - 47.544239
  // y_svg = y_prefectures * 1.028807 - 28.806583

  function toSvg(x, y) {
    const xp = x + tx + 6;
    const yp = y + ty + 18;
    return {
      x: xp * 1.028807 - 47.544239,
      y: yp * 1.028807 - 28.806583
    };
  }

  const pMin = toSvg(minX, minY);
  const pMax = toSvg(maxX, maxY);

  prefBounds[code] = {
    title,
    tx, ty,
    localBox: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
    svgBox: { minX: pMin.x, maxX: pMax.x, minY: pMin.y, maxY: pMax.y, width: pMax.x - pMin.x, height: pMax.y - pMin.y }
  };
});

fs.writeFileSync('scratch/pref-bounds.json', JSON.stringify(prefBounds, null, 2));
console.log('Processed', Object.keys(prefBounds).length, 'prefectures.');
console.log('Sample Aomori (code 2):', prefBounds['2']);
console.log('Sample Hokkaido (code 1):', prefBounds['1']);
console.log('Sample Tokyo (code 13):', prefBounds['13']);
console.log('Sample Kagoshima (code 46):', prefBounds['46']);
console.log('Sample Okinawa (code 47):', prefBounds['47']);
