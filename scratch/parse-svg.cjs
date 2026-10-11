const fs = require('fs');
const svg = fs.readFileSync('assets/japan-map-geolonia.svg', 'utf8');
const prefRegex = /<g class="([^"]*prefecture[^"]*)" data-code="(\d+)"[^>]*transform="translate\(([^,]+),\s*([^\)]+)\)"/g;
let match;
const prefs = [];
while ((match = prefRegex.exec(svg)) !== null) {
  prefs.push({ class: match[1], code: match[2], tx: parseFloat(match[3]), ty: parseFloat(match[4]) });
}
console.log('Found prefectures:', prefs.length);
console.log(prefs.slice(0, 10));
