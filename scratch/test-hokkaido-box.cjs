const fs = require('fs');

// Subpath 1 is Hokkaido mainland!
// In geographic coords:
// Cape Shirakami: 41.396°N, 140.203°E
// Cape Soya: 45.523°N, 141.936°E
// Cape Nosappu: 43.385°N, 145.817°E
// Cape Erimo: 41.924°N, 143.250°E
// Cape Kamui: 43.332°N, 140.347°E
// Cape Shiretoko: 44.344°N, 145.275°E

// And in Subpath 1 (local coords x=[15, 287], y=[28, 287]):
// local minX = 15 (near Cape Kamui/Shirakami)
// local maxX = 287 (Cape Nosappu)
// local minY = 28 (Cape Soya)
// local maxY = 287 (Cape Shirakami / Cape Erimo)
// Wait! Subpath 0 (local x=[0, 6], y=[235, 246]) is Okushiri island or Matsumae/Kojima/Oshima!
// Okushiri is 139.4°E, 42.1°N.

// If we set Hokkaido mainland bbox:
// minLat: 41.35, maxLat: 45.55
// minLng: 139.75 (or 139.33 with Okushiri), maxLng: 145.82 (Cape Nosappu)
// and map to Subpath 1 + Subpath 0 bbox:
// With Okushiri, local x is [0, 287], local y is [28, 287] -> svg x=[578.0, 873.2], svg y=[28.8, 295.3]!

const tx = 602, ty = 10;
function toSvg(x, y) {
  const xp = x + tx + 6;
  const yp = y + ty + 18;
  return {
    x: xp * 1.028807 - 47.544239,
    y: yp * 1.028807 - 28.806583
  };
}

const hokkaidoMainSvgBox = {
  minX: toSvg(0, 0).x, // 578.0
  maxX: toSvg(287, 0).x, // 873.2
  minY: toSvg(0, 28).y, // 28.8
  maxY: toSvg(0, 287).y // 295.3
};
hokkaidoMainSvgBox.width = hokkaidoMainSvgBox.maxX - hokkaidoMainSvgBox.minX;
hokkaidoMainSvgBox.height = hokkaidoMainSvgBox.maxY - hokkaidoMainSvgBox.minY;

const hokkaidoGeo = {
  minLat: 41.35, maxLat: 45.55,
  minLng: 139.35, maxLng: 145.85
};

const shiriuchi = { lat: 41.5956904, lng: 140.2947278 };
const u = (shiriuchi.lng - hokkaidoGeo.minLng) / (hokkaidoGeo.maxLng - hokkaidoGeo.minLng);
const v = (hokkaidoGeo.maxLat - shiriuchi.lat) / (hokkaidoGeo.maxLat - hokkaidoGeo.minLat);
const pt = {
  x: hokkaidoMainSvgBox.minX + u * hokkaidoMainSvgBox.width,
  y: hokkaidoMainSvgBox.minY + v * hokkaidoMainSvgBox.height
};
console.log('Shiriuchi Onsen projected pt:', pt);

// Now test if pt is inside Hokkaido polygon!
const { pointInPoly, distToPref } = require('./scratch/test-pref-proj.cjs');
// Let's test with the poly tester from poly-test.cjs:
const polyTest = require('./scratch/poly-test.cjs');
