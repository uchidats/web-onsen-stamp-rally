const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// 浴場名(.feature-bath h4)は施設名と同じ Noto Sans JP で描く。字形が足りないと端末の代替フォントになり太さが混ざるため、全ての浴場名の字がサブセットに含まれることを確かめる。
test('bath name font subset covers every featured bath name, local WOFF2, license and CSS wiring', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('feature-baths.js', 'utf8'), ctx);
  const names = Object.values(ctx.window.ONSEN_FEATURE_BATHS).flatMap(e => e.baths.map(b => b.name));
  const manifest = JSON.parse(fs.readFileSync('assets/fonts/bathnames-manifest.json', 'utf8'));
  for (const name of names) for (const char of name) assert.ok(manifest.text.includes(char), `Missing glyph "${char}" in "${name}" — run: node scripts/build-bath-name-font.cjs`);
  for (const file of manifest.files) {
    const bytes = fs.readFileSync('assets/fonts/' + file.file);
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
    assert.equal(bytes.length, file.bytes);
  }
  assert.match(fs.readFileSync('assets/fonts/notosansjp-OFL.txt', 'utf8'), /SIL OPEN FONT LICENSE Version 1.1/);
  const css = fs.readFileSync('assets/fonts/bathnames.css', 'utf8');
  assert.ok(!css.includes('https://'));
  assert.match(css, /font-family: 'Noto Sans JP'/);
  assert.match(css, /font-weight: 600/);
  assert.match(css, /font-display: swap/);
  const design = fs.readFileSync('design.css', 'utf8');
  assert.ok(design.includes('@import url("assets/fonts/bathnames.css");'));
  // 浴場名は施設名と同じ書体・太さ(共通CSSのみ。施設ごとの例外なし)
  const h4 = design.match(/\.feature-bath h4 \{[^}]*\}/)[0], fac = design.match(/#modalSubtitle \.facility \{[^}]*\}/)[0];
  assert.match(h4, /font-family: "Noto Sans JP"/); assert.match(h4, /font-weight: 600/);
  assert.match(fac, /font-family: "Noto Sans JP"/); assert.match(fac, /font-weight: 600/);
  assert.ok(!/onsen-0\d\d/.test(h4));
});
