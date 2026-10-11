const fs = require('fs');

// Centres from map.js:
// Regional viewport centers only; never used to position facility markers.
const centers=[[43.3,142.5],[40.7,140.8],[39.6,141.4],[38.4,140.9],[39.7,140.4],[38.4,140.1],[37.4,140.2],[36.3,140.3],[36.7,139.8],[36.5,138.9],[36,139.4],[35.5,140.2],[35.7,139.5],[35.4,139.3],[37.5,138.9],[36.6,137.2],[36.7,136.8],[35.9,136.2],[35.6,138.6],[36.2,138],[35.8,137],[35.1,138.3],[35,137.1],[34.5,136.4],[35.2,136.1],[35.2,135.5],[34.6,135.5],[35,134.8],[34.3,135.9],[33.9,135.5],[35.4,133.8],[35.1,132.6],[34.8,133.8],[34.5,132.8],[34.2,131.5],[33.9,134.3],[34.3,134],[33.7,132.9],[33.5,133.4],[33.6,130.7],[33.3,130.1],[33.1,129.5],[32.6,130.7],[33.2,131.4],[32.2,131.3],[31.6,130.6],[26.3,127.8]];

const bounds = JSON.parse(fs.readFileSync('scratch/pref-bounds.json', 'utf8'));

// Compare Honshu/Kyushu/Shikoku: code 2 (index 1) to code 45 (index 44, Miyazaki) or code 46 (index 45 Kagoshima)
// Note: Kagoshima (code 46) spans mainland + Amami islands in the inset or bottom?
// Let's see: code 46 Kagoshima svgBox: minY=7.2, maxY=1000. Wait! Kagoshima in Geolonia SVG has islands!
// Let's check which prefectures are on the mainland:
// Codes 2 to 45 (Aomori to Miyazaki)

const data = [];
for (let code = 2; code <= 45; code++) {
  const i = code - 1;
  const [lat, lng] = centers[i];
  const b = bounds[String(code)].svgBox;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  data.push({ code, lat, lng, cx, cy });
}

// Fit affine transform:
// cx = a0 + a1 * lng + a2 * lat
// cy = b0 + b1 * lng + b2 * lat
function solveLinearRegression(xs, ys) {
  // xs: array of [1, lng, lat], ys: array of numbers
  // Normal equations: (X^T * X) * w = X^T * y
  const n = xs.length;
  const m = xs[0].length;
  const XtX = Array.from({ length: m }, () => Array(m).fill(0));
  const Xty = Array(m).fill(0);

  for (let i = 0; i < n; i++) {
    for (let r = 0; r < m; r++) {
      Xty[r] += xs[i][r] * ys[i];
      for (let c = 0; c < m; c++) {
        XtX[r][c] += xs[i][r] * xs[i][c];
      }
    }
  }

  // Gaussian elimination (3x3)
  for (let i = 0; i < m; i++) {
    let pivot = XtX[i][i];
    for (let j = i; j < m; j++) XtX[i][j] /= pivot;
    Xty[i] /= pivot;
    for (let k = 0; k < m; k++) {
      if (k !== i) {
        const factor = XtX[k][i];
        for (let j = i; j < m; j++) XtX[k][j] -= factor * XtX[i][j];
        Xty[k] -= factor * Xty[i];
      }
    }
  }
  return Xty;
}

const X = data.map(d => [1, d.lng, d.lat]);
const wX = solveLinearRegression(X, data.map(d => d.cx));
const wY = solveLinearRegression(X, data.map(d => d.cy));

console.log('Affine model for Honshu/Shikoku/Kyushu:');
console.log('X =', wX[0], '+', wX[1], '* lng +', wX[2], '* lat');
console.log('Y =', wY[0], '+', wY[1], '* lng +', wY[2], '* lat');

// Check errors for prefectures
let maxErr = 0;
data.forEach(d => {
  const predX = wX[0] + wX[1] * d.lng + wX[2] * d.lat;
  const predY = wY[0] + wY[1] * d.lng + wY[2] * d.lat;
  const err = Math.hypot(predX - d.cx, predY - d.cy);
  if (err > maxErr) maxErr = err;
});
console.log('Max center error across all 44 prefectures:', maxErr);
