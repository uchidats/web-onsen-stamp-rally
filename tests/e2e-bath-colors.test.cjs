const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('E2E: bath color dots on onsen cards and in 代表的な湯 (hover, tap, keyboard, layout, multiple colors)', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) { t.skip('Edge not installed at standard path'); return; }
  const server = require('node:http').createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//, '/'));
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[path.extname(file)];
    if (type) res.setHeader('Content-Type', type);
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { ws, send, evaluate } = browser;
  try {
    const waitFor = async expr => { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");
    await evaluate('localStorage.clear()');
    fs.mkdirSync('scratch/bath-color-qa', { recursive: true });

    const LIST = '丸の並びは資料の記載順です。';
    const SEASONAL = '季節や気温で茶褐色・緑・白色に変わります。';
    const TIPS = {
      'onsen-002': ['湯の色: 乳白色（玉の湯）。公式の表現「白濁」。'],
      'onsen-004': ['湯の色: 茶褐色（施設全体）。公式の表現「赤褐色(茶褐色)」。'],
      'onsen-006': ['湯の色: 乳白色（混浴露天風呂）。公式の表現「わずかに緑をふくんだ乳白色」。わずかに緑をふくみます。'],
      'onsen-010': ['湯の色: 緑（施設全体）。公式の表現「珍しい緑色(黄緑色)」。まれに青色に変わることがあります。', '湯の色: 青（施設全体）。まれに緑色から青色に変わることがあります。'],
      'onsen-012': ['湯の色: 乳白色（混浴露天風呂・男女別内湯）。'],
      'onsen-015': ['湯の色: 乳白色（施設全体）。資料の表現「乳白色の湯」。第三者資料の記載です。'],
      'onsen-020': ['湯の色: 乳白色（施設全体）。資料の表現「溢れる乳白色の硫黄泉」。第三者資料の記載です。'],
      'onsen-030': ['湯の色: 茶褐色（かわら湯）。公式の表現「微かに茶褐色」。', '湯の色: 黄（展望風呂(地蔵の湯・観音の湯)）。公式の表現「微かに黄色」。'],
      'onsen-031': ['湯の色: 乳白色（岩風呂・檜露天風呂・混浴内風呂）。公式の表現「乳白色の濁り湯」。日本秘湯を守る会は「青白く濁る湯」と紹介しています(乳白色と同じ湯の別の表現で、別の色とは扱いません)。'],
      'onsen-032': ['湯の色: 乳白色（混浴露天風呂・女性専用露天風呂）。資料の表現「公式写真の青みを帯びた乳白色の湯」。写真では青みを帯びた乳白色に見えます。写真からの推定です。'],
      'onsen-017': ['茶褐色', '緑', '白'].map(l => `湯の色: ${l}（施設全体）。${SEASONAL}${LIST}`),
      'onsen-018': ['湯の色: 灰白色（神経痛の湯）。公式の表現「灰白色の「にごり湯」」。'],
      'onsen-021': ['湯の色: 白（施設全体）。公式の表現「白濁の湯」。'],
      'onsen-034': ['湯の色: 乳白色（施設全体）。公式の表現「白濁」。'],
      'onsen-035': ['湯の色: 乳白色（施設全体）。公式の表現「白濁」。'],
      'onsen-036': ['湯の色: 乳白色（施設全体）。公式の表現「乳白色にごり湯」。'],
      'onsen-039': ['湯の色: 乳白色（施設全体）。年に数回、乳白色になります。'],
      'onsen-048': ['湯の色: 無色透明（施設全体）。'],
      'onsen-054': ['湯の色: 乳白色（四季の湯・源泉槽）。'],
      'onsen-057': ['湯の色: 乳白色（施設全体）。無色透明の湯が空気に触れて乳白色に変わると公式が説明しています。'],
      'onsen-059': ['湯の色: その他（施設全体）。資料の表現「橙色の濁ったミネラル湯」。第三者資料の記載です。'],
      'onsen-061': ['湯の色: 無色透明（施設全体）。'],
      'onsen-066': ['湯の色: 白（男女別の展望内湯）。公式の表現「白く濁る」。'],
      'onsen-062': ['湯の色: 無色透明（施設全体）。'],
      'onsen-064': ['湯の色: 無色透明（施設全体）。'],
      'onsen-041': ['湯の色: 乳白色（施設全体）。公式の表現「白や青白」。湯船にためると白や青白くなり、投入量・気温・気圧で変わります。', '湯の色: 黒（施設全体）。年に数回、黒くなることがあります。'],
      'onsen-043': ['乳白色', '緑', '黒'].map(l => `湯の色: ${l}（施設全体）。日によって色が変わります。${LIST}`),
      'onsen-044': ['湯の色: 乳白色（施設全体）。資料の表現「白いにごり湯」。第三者資料の記載です。'],
      'onsen-026': ['湯の色: 無色透明（露天風呂付き大浴場(洞窟の湯)）。第三者資料の記載です。'],
      // 2026-10-22 追加(公式・第三者資料の記載。根拠は docs/bath-color-research-2026-10-22.md)
      'onsen-003': ['湯の色: 無色透明（久安の湯・泉響の湯）。資料の表現「透明」。第三者資料の記載です。'],
      'onsen-008': ['湯の色: 無色透明（大沢温泉）。第三者資料の記載です。'],
      'onsen-016': ['湯の色: 無色透明（やわらぎの湯－銀の湯）。'],
      'onsen-019': ['湯の色: 無色透明（施設全体）。公式の表現「透明度が高く」。'],
      'onsen-027': ['湯の色: 茶褐色（自家源泉の湯）。丸の並びは資料の記載順です。', '湯の色: 無色透明（共同源泉の湯）。丸の並びは資料の記載順です。'],
      'onsen-028': ['湯の色: 無色透明（施設全体）。'],
      'onsen-040': ['湯の色: 茶褐色（施設全体）。'],
      'onsen-045': ['湯の色: 無色透明（施設全体）。'],
      'onsen-049': ['湯の色: 無色透明（施設全体）。写真からの推定です。'],
      'onsen-053': ['湯の色: 無色透明（施設全体）。写真からの推定です。'],
      'onsen-023': ['湯の色: 無色透明（施設全体）。写真からの推定です。'],
      'onsen-046': ['湯の色: 無色透明（施設全体）。第三者資料の記載です。'],
      'onsen-051': ['湯の色: 乳白色（施設全体）。毎月第2・第4土曜日は「白濁の日」として、にごり湯を楽しめる(公式)。それ以外の日の色は公式に書かれていない。'],
      'onsen-052': ['湯の色: 乳白色（施設全体）。公式の表現「乳白濁色」。'],
      'onsen-033': ['湯の色: 乳白色（根っこ風呂）。資料の表現「乳白色の湯」。第三者資料の記載です。'],
      'onsen-065': ['湯の色: 無色透明（施設全体）。第三者資料の記載です。'],
      'onsen-067': ['湯の色: 無色透明（施設全体）。']
    };
    const TOTAL_DOTS = Object.values(TIPS).reduce((n, a) => n + a.length, 0);
    // 保留(根拠不足)の施設には丸を出さない
    const NONE = ['onsen-001', 'onsen-005', 'onsen-007', 'onsen-009', 'onsen-011', 'onsen-013', 'onsen-014', 'onsen-022', 'onsen-024', 'onsen-025', 'onsen-037', 'onsen-038', 'onsen-042', 'onsen-047', 'onsen-050', 'onsen-055', 'onsen-056', 'onsen-058', 'onsen-060', 'onsen-063', 'onsen-068'];
    const entry = id => `document.querySelector('[data-facility-id="${id}"]')`;
    const rect = async expr => evaluate(`(()=>{const n=${expr};if(!n)return null;const r=n.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()`);
    const center = async expr => { const r = await rect(expr); return { x: r.x + r.w / 2, y: r.y + r.h / 2 }; };
    const dotExpr = (id, i) => `${entry(id)}.querySelectorAll('.bath-color')[${i}]`;
    const tipState = async (id, i = 0) => evaluate(`(()=>{const e=${entry(id)},t=e.querySelectorAll('.bath-colors .bath-color-tip')[${i}],s=getComputedStyle(t),r=t.getBoundingClientRect(),c=e.closest('.card').getBoundingClientRect();return{visible:s.visibility==='visible'&&+s.opacity>0,inside:r.left>=c.left-1&&r.right<=c.right+1&&r.top>=c.top-1}})()`);
    const key = async (name, code, vk, text) => {
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk });
    };
    // the dots sit right after the facility name: same line, ~8px gap to the first dot, 4-5px between dots, vertically centered, outside the official link
    const layoutProbe = id => `(()=>{const e=${entry(id)},f=e.querySelector('.facility'),link=f.querySelector('.facility-name-link,.facility-name'),wrap=f.querySelector('.bath-colors'),dots=[...wrap.querySelectorAll('.bath-color-dot')].map(d=>d.getBoundingClientRect()),
      btns=[...wrap.querySelectorAll('.bath-color')].map(b=>b.getBoundingClientRect()),card=e.closest('.card'),cr=card.getBoundingClientRect(),lr=[...link.getClientRects()].pop(),
      meta=e.querySelector('.facility-meta'),others=[...meta.children].map(n=>n.getBoundingClientRect()),badge=f.querySelector('.conquered-badge'),
      hit=others.some(o=>btns.some(br=>br.left<o.right-1&&br.right>o.left+1&&br.top<o.bottom-1&&br.bottom>o.top+1));
      const h1=card.offsetHeight;wrap.style.display='none';const h2=card.offsetHeight;wrap.style.display='';
      return{count:dots.length,sizes:dots.map(d=>d.width+'x'+d.height),hit,inside:dots.every(d=>d.left>=cr.left&&d.right<=cr.right)&&btns.every(b=>b.right<=cr.right),delta:h1-h2,overflow:document.documentElement.scrollWidth>innerWidth,
        gap:Math.round((dots[0].left-lr.right)*10)/10,spacing:dots.slice(1).map((d,i)=>Math.round((d.left-dots[i].right)*10)/10),sameRow:dots.every(d=>Math.abs((d.top+d.height/2)-(lr.top+lr.height/2))<=3),
        insideLink:link.contains(wrap),prev:wrap.previousSibling===link,inFacilityRow:wrap.parentElement===f,inMeta:!!meta.querySelector('.bath-colors'),badgeAfter:!badge||(wrap.compareDocumentPosition(badge)&Node.DOCUMENT_POSITION_FOLLOWING)>0}})()`;

    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
      await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
      await delay(150);

      // ---- cards: one dot per confirmed color (max 3, no duplicates), unconfirmed facilities show none ----
      for (const [id, tips] of Object.entries(TIPS)) {
        assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.bath-color').length`), tips.length, id);
        assert.deepEqual(await evaluate(`[...${entry(id)}.querySelectorAll('.bath-color')].map(b=>b.getAttribute('aria-label'))`), tips, id);
        assert.deepEqual(await evaluate(`[...${entry(id)}.querySelectorAll('.bath-colors .bath-color-tip')].map(b=>b.textContent)`), tips, id);
      }
      for (const id of NONE) assert.equal(await evaluate(`${entry(id)}.querySelectorAll('.bath-color').length`), 0, id + ' must have no dot');
      assert.equal(await evaluate("document.querySelectorAll('#cards .bath-color').length"), TOTAL_DOTS);
      // order = order in the source document (茶褐色・緑・白色 / 緑・青), no duplicates
      assert.deepEqual(await evaluate(`[...${entry('onsen-017')}.querySelectorAll('.bath-color-dot')].map(d=>d.style.getPropertyValue('--dot'))`), ['#98694a', '#86a05f', '#fffdf8']);
      assert.deepEqual(await evaluate(`[...${entry('onsen-010')}.querySelectorAll('.bath-color-dot')].map(d=>d.style.getPropertyValue('--dot'))`), ['#86a05f', '#6f97ae']);

      for (const [id, tips] of Object.entries(TIPS)) {
        const L = await evaluate(layoutProbe(id));
        assert.equal(L.count, tips.length, id);
        assert.ok(L.sizes.every(s => s === '16x16'), `${id}: ${L.sizes}`);
        assert.equal(L.hit, false, `${id}@${width}: dots overlap another control`);
        assert.ok(L.gap >= 7 && L.gap <= 9, `${id}@${width}: gap between name and first dot is ${L.gap}px (expected about 8)`);
        assert.ok(L.spacing.every(g => g >= 3.5 && g <= 5.5), `${id}@${width}: spacing between dots ${L.spacing} (expected 4-5px)`);
        assert.ok(L.sameRow, `${id}@${width}: dots are not on the name line`);
        assert.equal(L.insideLink, false, id);
        assert.ok(L.prev && L.inFacilityRow && !L.inMeta, id + ': dots directly follow the facility name, not in the meta row');
        assert.ok(L.badgeAfter, id);
        assert.ok(L.inside, `${id}@${width}: dots outside the card`);
        assert.ok(L.delta <= 1, `${id}@${width}: card grew by ${L.delta}px`);
        assert.equal(L.overflow, false, id);
      }

      // a very long facility name never pushes the three dots outside the card
      const longCase = await evaluate(`(()=>{const e=${entry('onsen-017')},link=e.querySelector('.facility-name-link,.facility-name'),orig=link.textContent;link.textContent='長い宿名でも自然に読める静かな温泉旅館'.repeat(3);const cr=e.closest('.card').getBoundingClientRect(),ds=[...e.querySelectorAll('.bath-color-dot')].map(d=>d.getBoundingClientRect()),ok=ds.every(d=>d.left>=cr.left&&d.right<=cr.right),ov=document.documentElement.scrollWidth>innerWidth;link.textContent=orig;return{ok,ov,n:ds.length}})()`);
      assert.deepEqual(longCase, { ok: true, ov: false, n: 3 }, `${width}px long name`);

      // milky white (filled) and colorless transparent (hollow ring) stay visually distinct
      const look = await evaluate(`(()=>{const mk=(c)=>{const d=window.ONSEN_COLOR_DEFS[c],i=document.createElement('i');i.className='bath-color-dot'+(d.hollow?' is-hollow':'');i.style.setProperty('--dot',d.fill);i.style.setProperty('--ring',d.ring);document.body.appendChild(i);const s=getComputedStyle(i),o={bg:s.backgroundColor,bw:s.borderTopWidth};i.remove();return o};return{milky:mk('milky_white'),colorless:mk('colorless'),white:mk('white')}})()`);
      assert.equal(look.colorless.bg, 'rgba(0, 0, 0, 0)');
      assert.equal(look.colorless.bw, '2px');
      assert.notEqual(look.milky.bg, 'rgba(0, 0, 0, 0)');
      assert.notEqual(look.milky.bg, look.white.bg);

      // ---- hover (PC): each of the three dots opens only its own tooltip ----
      if (width === 1280) {
        await evaluate(`${entry('onsen-017')}.scrollIntoView({block:'center'})`);
        await delay(100);
        for (let i = 0; i < 3; i++) {
          const p = await center(dotExpr('onsen-017', i));
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
          await delay(100);
          const states = [await tipState('onsen-017', 0), await tipState('onsen-017', 1), await tipState('onsen-017', 2)];
          assert.deepEqual(states.map(s => s.visible), [0, 1, 2].map(k => k === i), `hover dot ${i}`);
          assert.ok(states[i].inside);
          if (i === 2) { const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`scratch/bath-color-qa/multi-hover-${width}.png`, Buffer.from(shot.data, 'base64')); }
        }
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
        await delay(100);
        assert.equal((await tipState('onsen-017', 2)).visible, false);
      }

      // ---- tap (touch): each dot opens its own text; tapping another dot switches; tapping elsewhere closes ----
      if (width < 400) {
        await evaluate(`${entry('onsen-010')}.scrollIntoView({block:'center'})`);
        await delay(100);
        const tap = async p => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await delay(150); };
        await tap(await center(dotExpr('onsen-010', 0)));
        assert.deepEqual([(await tipState('onsen-010', 0)).visible, (await tipState('onsen-010', 1)).visible], [true, false]);
        await tap(await center(dotExpr('onsen-010', 1)));
        assert.deepEqual([(await tipState('onsen-010', 0)).visible, (await tipState('onsen-010', 1)).visible], [false, true]);
        assert.ok((await tipState('onsen-010', 1)).inside);
        assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`scratch/bath-color-qa/multi-tap-${width}.png`, Buffer.from(shot.data, 'base64'));
        await tap({ x: 3, y: 3 });
        assert.equal((await tipState('onsen-010', 1)).visible, false);
      }

      // ---- keyboard: Tab order reaches each dot; Enter opens, Escape closes; never opens the detail view ----
      await evaluate(`${entry('onsen-017')}.scrollIntoView({block:'center'});${dotExpr('onsen-017', 1)}.focus()`);
      await key('Enter', 'Enter', 13, '\r');
      await delay(100);
      assert.deepEqual([(await tipState('onsen-017', 0)).visible, (await tipState('onsen-017', 1)).visible, (await tipState('onsen-017', 2)).visible], [false, true, false]);
      await key('Tab', 'Tab', 9);
      await delay(100);
      assert.equal(await evaluate("document.activeElement.classList.contains('bath-color')"), true, 'Tab moves to the next dot');
      await key('Escape', 'Escape', 27);
      await delay(100);
      assert.equal(await evaluate("document.querySelectorAll('.bath-color.is-open').length"), 0);
      assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false);

      for (const id of Object.keys(TIPS)) {
        assert.equal(await evaluate(`!!${entry(id)}.querySelector('.facility-name-link')`), true, id + ' official link');
        assert.equal(await evaluate(`!!${entry(id)}.querySelector('.map-link')`), true, id + ' map link');
      }
    }

    // ---- 詳細画面「代表的な湯」: the dot right after a bath name, only for colors confirmed for that bath ----
    const DETAIL = {
      'onsen-002': { '玉の湯': 1, 'ヒバ千人風呂': 1 },
      'onsen-006': { '混浴露天風呂': 1, '内湯': 1 },
      'onsen-010': { '薬師の湯': 1, '混浴露天風呂': 1, '小浴場': 1 },
      'onsen-012': { '混浴露天風呂': 1, '男女別内湯': 1, '宿泊者専用露天風呂': 1 },
      'onsen-018': { '神経痛の湯': 1 },
      'onsen-021': { '大露天風呂': 1 },
      'onsen-026': { '露天風呂付き大浴場(洞窟の湯)': 1 },
      'onsen-035': { '大気の湯(東・西)': 1 },
      'onsen-030': { 'かわら湯': 1, '展望風呂(地蔵の湯・観音の湯)': 1 },
      'onsen-031': { '岩風呂': 1, '檜露天風呂': 1, '混浴内風呂': 1 },
      'onsen-032': { '混浴露天風呂': 1, '女性専用露天風呂': 1 },
      'onsen-003': { '久安の湯': 1, '泉響の湯': 1 },
      'onsen-033': { '根っこ風呂': 1 },
      'onsen-016': { 'やわらぎの湯－銀の湯': 1 },
      'onsen-061': { 'したの湯': 1, 'うえの湯': 1, 'おくの湯': 1 },
      'onsen-066': { '男女別の展望内湯': 1 }
    };
    const NO_DETAIL_DOTS = ['onsen-041', 'onsen-043', 'onsen-044', 'onsen-034', 'onsen-036', 'onsen-039', 'onsen-028', 'onsen-004', 'onsen-015', 'onsen-017', 'onsen-007', 'onsen-008', 'onsen-009', 'onsen-013', 'onsen-014', 'onsen-019', 'onsen-023', 'onsen-027', 'onsen-040', 'onsen-045', 'onsen-049', 'onsen-053', 'onsen-065', 'onsen-067'];
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      for (const [id, want] of Object.entries(DETAIL)) {
        await evaluate(`${entry(id)}.querySelector('[data-detail]').click()`);
        await delay(100);
        const D = await evaluate(`(()=>{const m=document.querySelector('.modal').getBoundingClientRect();return[...document.querySelectorAll('#featureBathList .feature-bath')].map(li=>{const h=li.querySelector('h4').getBoundingClientRect(),ds=[...li.querySelectorAll('.bath-color-dot')].map(d=>d.getBoundingClientRect()),btn=li.querySelector('.bath-color');
          return{name:li.querySelector('h4').textContent,n:ds.length,size:ds.map(d=>d.width+'x'+d.height),gap:ds.length?Math.round((ds[0].left-h.right)*10)/10:null,centered:ds.length?Math.abs((ds[0].top+ds[0].height/2)-(h.top+h.height/2))<=4:null,inside:ds.every(d=>d.right<=m.right&&d.left>=m.left),label:btn?btn.getAttribute('aria-label'):null,sibling:ds.length?li.querySelector('.bath-colors').previousElementSibling.tagName:null}})})()`);
        for (const b of D) {
          assert.equal(b.n, want[b.name] || 0, `${id}/${b.name}@${width}`);
          if (b.n) {
            assert.deepEqual(b.size, ['16x16']);
            assert.ok(b.gap >= 6 && b.gap <= 10, `${id}/${b.name}@${width}: gap ${b.gap}px`);
            assert.ok(b.centered && b.inside, `${id}/${b.name}@${width}`);
            assert.equal(b.sibling, 'H4');
            // the detail tooltip text equals the card tooltip text for the same color (no contradiction)
            assert.ok(b.label.startsWith('湯の色: ') && b.label.includes('（' ) && b.label.includes(b.name), `${id}/${b.name}: ${b.label}`);
          }
        }
        assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth || document.querySelector('.modal').scrollWidth>document.querySelector('.modal').clientWidth"), false);
        if (width === 390 && id === 'onsen-012') {
          // tap on a detail dot opens its tooltip inside the modal; Escape/outside tap closes it; the modal stays open
          const p = await center("document.querySelectorAll('#featureBathList .bath-color')[0]");
          await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
          await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await delay(150);
          assert.equal(await evaluate("(()=>{const t=document.querySelector('#featureBathList .bath-color-tip'),s=getComputedStyle(t),r=t.getBoundingClientRect(),m=document.querySelector('.modal').getBoundingClientRect();return s.visibility==='visible'&&r.left>=m.left&&r.right<=m.right})()"), true);
          const shot = await send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(`scratch/bath-color-qa/detail-tap-${width}.png`, Buffer.from(shot.data, 'base64'));
          await key('Escape', 'Escape', 27);
          // Escape closes the tooltip first (the detail view may close too: both are acceptable, the dot never saves anything)
          await delay(100);
          assert.equal(await evaluate("document.querySelectorAll('.bath-color.is-open').length"), 0);
        }
        if (width === 1280 && id === 'onsen-006') { const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`scratch/bath-color-qa/detail-${width}.png`, Buffer.from(shot.data, 'base64')); }
        await evaluate("document.getElementById('modalClose').click()");
        await delay(50);
      }
      // facility-wide colors are never copied onto individual baths; uncolored baths get no dot
      for (const id of NO_DETAIL_DOTS) {
        await evaluate(`${entry(id)}.querySelector('[data-detail]').click()`);
        await delay(100);
        assert.equal(await evaluate("document.querySelectorAll('#featureBathList .bath-color').length"), 0, `${id}: no dot on baths in the detail view`);
        await evaluate("document.getElementById('modalClose').click()");
        await delay(50);
      }
    }

    // 湯の色フィルター: 9色+未確認、複数色はどの色でも該当、他の条件・検索との併用、条件クリアで初期値へ
    {
      const ids = async () => evaluate("(async()=>{const s=document.getElementById('showMore');while(s&&!s.classList.contains('hide'))s.click();return [...document.querySelectorAll('#cards [data-facility-id]')].map(e=>e.dataset.facilityId)})()");
      const setSel = async (id, v) => { await evaluate(`(()=>{const e=document.getElementById('${id}');e.value='${v}';e.dispatchEvent(new Event('change'))})()`); await delay(150); };
      const opts = await evaluate("[...document.querySelectorAll('#colorSelect option')].map(o=>o.value+':'+o.textContent)");
      assert.deepEqual(opts, [':すべての色', 'colorless:無色透明', 'milky_white:乳白色', 'white:白', 'gray_white:灰白色', 'green:緑', 'blue:青', 'yellow:黄', 'brown:茶褐色', 'black:黒', 'other:その他', 'unknown:未確認']);
      const all = await ids();
      await setSel('colorSelect', 'green');
      const green = await ids();
      assert.ok(green.includes('onsen-010') && green.includes('onsen-017'), 'multi-color facilities match any of their colors');
      await setSel('colorSelect', 'blue');
      assert.ok((await ids()).includes('onsen-010'));
      await setSel('colorSelect', 'unknown');
      const unknown = await ids();
      assert.equal(unknown.length, NONE.length);
      assert.ok(NONE.every(id => unknown.includes(id)) && !unknown.includes('onsen-010'));
      await setSel('statusSelect', 'visited');
      assert.deepEqual(await ids(), []);
      await setSel('statusSelect', '');
      await evaluate("document.getElementById('clearFilter').click()");
      await delay(150);
      assert.equal(await evaluate("document.getElementById('colorSelect').value"), '');
      assert.deepEqual(await ids(), all);
      // 色付きの丸+色名のピッカー(カードの丸と同じ色定義)。キーボード(Escで閉じる)と選択
      const labels = await evaluate("[...document.querySelectorAll('#colorOptions button')].map(b=>b.textContent+'|'+(b.querySelector('.bath-color-dot')?.style.getPropertyValue('--dot')||''))");
      assert.equal(labels.length, 12);
      assert.ok(labels[1].startsWith('無色透明|transparent') && labels[2].startsWith('乳白色|#f1e9d3') && labels[11].startsWith('未確認|'));
      await evaluate("document.getElementById('colorSummary').click()");
      assert.equal(await evaluate("document.getElementById('colorPicker').open"), true);
      await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
      assert.equal(await evaluate("document.getElementById('colorPicker').open"), false);
      await evaluate("document.getElementById('colorSummary').click();document.querySelector('#colorOptions button[data-color=\"green\"]').click()");
      await delay(150);
      assert.equal(await evaluate("document.getElementById('colorSelect').value"), 'green');
      assert.ok((await evaluate("document.getElementById('colorSummary').textContent")).includes('緑'));
      assert.ok((await ids()).includes('onsen-010'));
      await evaluate("document.getElementById('clearFilter').click()");
      await delay(150);
      assert.ok((await evaluate("document.getElementById('colorSummary').textContent")).includes('すべての色'));
    }

    // the dots never touch visit records or localStorage
    assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
