const fs = require('fs');

// We have 40 verified onsens across 12 prefectures:
const dataJs = fs.readFileSync('data.js', 'utf8');
const win = {};
new Function('window', dataJs)(win);
const verified = win.ONSEN_DATA.filter(x => x.coordinateVerified && Number.isFinite(x.latitude) && Number.isFinite(x.longitude));

const bounds = JSON.parse(fs.readFileSync('scratch/pref-bounds.json', 'utf8'));
const prefList = [
  { code: 1, name: '北海道' }, { code: 2, name: '青森県' }, { code: 3, name: '岩手県' },
  { code: 4, name: '宮城県' }, { code: 5, name: '秋田県' }, { code: 6, name: '山形県' },
  { code: 7, name: '福島県' }, { code: 8, name: '茨城県' }, { code: 9, name: '栃木県' },
  { code: 10, name: '群馬県' }, { code: 11, name: '埼玉県' }, { code: 12, name: '千葉県' },
  { code: 13, name: '東京都' }, { code: 14, name: '神奈川県' }, { code: 15, name: '新潟県' },
  { code: 16, name: '富山県' }, { code: 17, name: '石川県' }, { code: 18, name: '福井県' },
  { code: 19, name: '山梨県' }, { code: 20, name: '長野県' }, { code: 21, name: '岐阜県' },
  { code: 22, name: '静岡県' }, { code: 23, name: '愛知県' }, { code: 24, name: '三重県' },
  { code: 25, name: '滋賀県' }, { code: 26, name: '京都府' }, { code: 27, name: '大阪府' },
  { code: 28, name: '兵庫県' }, { code: 29, name: '奈良県' }, { code: 30, name: '和歌山県' },
  { code: 31, name: '鳥取県' }, { code: 32, name: '島根県' }, { code: 33, name: '岡山県' },
  { code: 34, name: '広島県' }, { code: 35, name: '山口県' }, { code: 36, name: '徳島県' },
  { code: 37, name: '香川県' }, { code: 38, name: '愛媛県' }, { code: 39, name: '高知県' },
  { code: 40, name: '福岡県' }, { code: 41, name: '佐賀県' }, { code: 42, name: '長崎県' },
  { code: 43, name: '熊本県' }, { code: 44, name: '大分県' }, { code: 45, name: '宮崎県' },
  { code: 46, name: '鹿児島県' }, { code: 47, name: '沖縄県' }
];

console.log('Total verified facilities:', verified.length);
console.log('By prefecture:');
const byPref = {};
verified.forEach(v => {
  byPref[v.prefecture] = byPref[v.prefecture] || [];
  byPref[v.prefecture].push(v);
});

for (const [pref, list] of Object.entries(byPref)) {
  console.log(`\n=== ${pref} (${list.length} facilities) ===`);
  list.forEach(o => {
    console.log(`  ${o.id}: ${o.facility} (${o.onsen}) lat=${o.latitude}, lng=${o.longitude}`);
  });
}
