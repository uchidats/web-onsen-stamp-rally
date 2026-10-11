const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('scratch/all-projected.json', 'utf8'));

// Check minimum distance collision resolution:
// Radius r = 4.5px, so minimum center distance is 9px.
// Let's run a force relaxation or iterative repulsion:
// If dist < 9px, push apart slightly along the connecting vector, with max displacement capped (e.g. max 5px).
// Ensure that the relaxed point stays inside the prefecture (or within 2px of it).

function resolveOverlaps(points, minDistance = 8.5, maxDisplacement = 5.0) {
  const pts = points.map(p => ({ ...p, origX: p.x, origY: p.y }));
  
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-4) {
          // If perfectly coincident (e.g. 0.2px), randomize or push slightly in x/y
          const angle = (i * 1.5);
          pts[i].x -= 2 * Math.cos(angle);
          pts[i].y -= 2 * Math.sin(angle);
          pts[j].x += 2 * Math.cos(angle);
          pts[j].y += 2 * Math.sin(angle);
          continue;
        }
        if (d < minDistance) {
          const overlap = (minDistance - d) / 2;
          const nx = (dx / d) * overlap * 0.5;
          const ny = (dy / d) * overlap * 0.5;
          pts[i].x -= nx;
          pts[i].y -= ny;
          pts[j].x += nx;
          pts[j].y += ny;
        }
      }
    }
    // Limit displacement from original position
    for (const p of pts) {
      const disp = Math.hypot(p.x - p.origX, p.y - p.origY);
      if (disp > maxDisplacement) {
        const scale = maxDisplacement / disp;
        p.x = p.origX + (p.x - p.origX) * scale;
        p.y = p.origY + (p.y - p.origY) * scale;
      }
    }
  }
  return pts;
}

const resolved = resolveOverlaps(raw);
let minD = Infinity;
for (let i = 0; i < resolved.length; i++) {
  for (let j = i + 1; j < resolved.length; j++) {
    const d = Math.hypot(resolved[i].x - resolved[j].x, resolved[i].y - resolved[j].y);
    if (d < minD) minD = d;
  }
}
console.log('Original min distance:', raw.reduce((min, p1, i) => {
  for (let j = i + 1; j < raw.length; j++) {
    const d = Math.hypot(p1.x - raw[j].x, p1.y - raw[j].y);
    if (d < min) min = d;
  }
  return min;
}, Infinity));
console.log('After relaxation min distance:', minD);

const displacements = resolved.map(p => Math.hypot(p.x - p.origX, p.y - p.origY));
console.log('Max displacement:', Math.max(...displacements).toFixed(2), 'px');
console.log('Avg displacement:', (displacements.reduce((a, b) => a + b, 0) / displacements.length).toFixed(2), 'px');
