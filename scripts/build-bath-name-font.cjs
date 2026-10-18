// 「代表的な湯」の浴場名(.feature-bath h4)用に、feature-baths.js に載る全ての浴場名の字を収めた Noto Sans JP(太さ600)のWOFF2サブセットを作る。
//   使い方: node scripts/build-bath-name-font.cjs   (浴場名を追加・変更したら再実行する。tests/bath-name-fonts.test.cjs が字の不足を検出する)
// 施設名(.facility)と同じ書体・太さにそろえるのが目的。端末の代替フォントは太さが端末ごとに違い、細く見える端末があるため、字形をWebフォントで網羅する。
// 取得元: Google Fonts API(既存の assets/fonts と同じ方法)。ライセンス: SIL OFL 1.1(assets/fonts/notosansjp-OFL.txt)。
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync('feature-baths.js', 'utf8'), ctx);
const names = Object.values(ctx.window.ONSEN_FEATURE_BATHS).flatMap(e => e.baths.map(b => b.name));
// 既に収録済みの字は消さない(浴場名を減らしたり変えたりしても、字形が欠落する向きには動かさない)
const previous = fs.existsSync('assets/fonts/bathnames-manifest.json') ? JSON.parse(fs.readFileSync('assets/fonts/bathnames-manifest.json', 'utf8')).text : '';
const text = [...new Set(names.join('') + previous)].sort().join('');
(async () => {
  const url = new URL('https://fonts.googleapis.com/css2');
  url.searchParams.set('family', 'Noto Sans JP:wght@600');
  url.searchParams.set('display', 'swap');
  url.searchParams.set('text', text);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw Error(res.status);
  let css = await res.text();
  const sources = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]))], files = [];
  for (const [i, source] of sources.entries()) {
    if (new URL(source).hostname !== 'fonts.gstatic.com') throw Error('Unexpected source');
    const r = await fetch(source);
    if (!r.ok) throw Error(r.status);
    const bytes = Buffer.from(await r.arrayBuffer()), file = 'notosansjp-bathnames-' + i + '.woff2';
    fs.writeFileSync(path.join('assets/fonts', file), bytes);
    css = css.split(source).join(file);
    files.push({ file, bytes: bytes.length });
  }
  fs.writeFileSync('assets/fonts/bathnames.css', css);
  fs.writeFileSync('assets/fonts/bathnames-manifest.json', JSON.stringify({ family: 'Noto Sans JP', weights: '600', text, files, source: url.href }, null, 2) + '\n');
  console.log({ chars: text.length, files });
})().catch(e => { console.error(e); process.exitCode = 1; });
