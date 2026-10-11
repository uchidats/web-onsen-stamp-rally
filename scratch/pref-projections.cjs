const fs = require('fs');

// We have 40 verified facilities across 12 prefectures:
// 北海道 (1), 青森県 (4), 岩手県 (3), 秋田県 (8), 宮城県 (3), 山形県 (4),
// 福島県 (3), 栃木県 (2), 群馬県 (6), 長野県 (1), 新潟県 (3), 富山県 (2).

// Let's inspect each prefecture's bounding box in SVG vs actual lat/lng bbox of the prefecture!
// In map.js:
// const centers = [...]
// prefBounds(pref) gives a lat/lng bounding box!
