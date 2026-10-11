const fs = require('fs');

// We have 40 verified onsens across 12 prefectures:
// 北海道 (1), 青森県 (4), 岩手県 (3), 秋田県 (8), 宮城県 (3), 山形県 (4),
// 福島県 (3), 栃木県 (2), 群馬県 (6), 長野県 (1), 新潟県 (3), 富山県 (2).

// Notice that except for Hokkaido and Okinawa, Honshu/Shikoku/Kyushu are continuous in this map!
// Let's check the boundary lines in the SVG:
// line 1: x1="320.227" y1="361.996" x2="582.351" y2="109.378" (dividing Hokkaido inset / sea)
// line 2: x1="277.337" y1="380.162" x2="46.213" y2="380.162" (dividing Okinawa inset)

// Are Honshu, Kyushu, Shikoku connected in one coordinate space?
// Let's check the relative positions of adjacent prefectures in Honshu!
const bounds = JSON.parse(fs.readFileSync('scratch/pref-bounds.json', 'utf8'));

// Code 2 Aomori: minY ~ 285, maxY ~ 369. minX ~ 600, maxX ~ 689
// Code 3 Iwate:
console.log('Iwate (3):', bounds['3'].svgBox);
// Code 5 Akita:
console.log('Akita (5):', bounds['5'].svgBox);
// Code 4 Miyagi:
console.log('Miyagi (4):', bounds['4'].svgBox);
// Code 6 Yamagata:
console.log('Yamagata (6):', bounds['6'].svgBox);
// Code 7 Fukushima:
console.log('Fukushima (7):', bounds['7'].svgBox);
// Code 15 Niigata:
console.log('Niigata (15):', bounds['15'].svgBox);
// Code 9 Tochigi:
console.log('Tochigi (9):', bounds['9'].svgBox);
// Code 10 Gunma:
console.log('Gunma (10):', bounds['10'].svgBox);
// Code 16 Toyama:
console.log('Toyama (16):', bounds['16'].svgBox);
// Code 20 Nagano:
console.log('Nagano (20):', bounds['20'].svgBox);
// Code 13 Tokyo:
console.log('Tokyo (13):', bounds['13'].svgBox);
// Code 27 Osaka:
console.log('Osaka (27):', bounds['27'].svgBox);
// Code 40 Fukuoka:
console.log('Fukuoka (40):', bounds['40'].svgBox);
