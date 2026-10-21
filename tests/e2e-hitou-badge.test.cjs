const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('E2E: 地♨ / 秘♨ labels on cards (same look, order, mobile layout, accessible names, official links)', async (t) => {
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
    await send('Page.enable');
    await waitFor("document.querySelectorAll('#cards .card').length>0");
    await evaluate('localStorage.clear()');
    await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");

    const MEMBERS = ['onsen-001', 'onsen-006', 'onsen-009', 'onsen-010', 'onsen-012', 'onsen-015', 'onsen-017', 'onsen-019', 'onsen-020', 'onsen-021', 'onsen-024', 'onsen-027', 'onsen-030', 'onsen-031', 'onsen-032', 'onsen-033', 'onsen-038', 'onsen-039', 'onsen-042', 'onsen-047', 'onsen-054', 'onsen-059', 'onsen-061', 'onsen-062', 'onsen-064', 'onsen-066'];
    const entry = id => `document.querySelector('[data-facility-id="${id}"]')`;
    const URLS = JSON.parse(await evaluate('JSON.stringify(Object.fromEntries(Object.entries(window.ONSEN_HITOU_MEMBERSHIP).map(([k,v])=>[k,v.url])))'));

    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      // 表示対象: 加盟確認済みの26施設だけ(各1個)。非加盟・未確定には出ない
      assert.equal(await evaluate("document.querySelectorAll('#cards .hitou-tag').length"), 26);
      const ids = JSON.parse(await evaluate("JSON.stringify([...document.querySelectorAll('#cards .facility-entry')].filter(e=>e.querySelector('.hitou-tag')).map(e=>e.dataset.facilityId))"));
      assert.deepEqual(ids.sort(), MEMBERS);
      assert.equal(await evaluate(`${entry('onsen-028')}.querySelectorAll('.hitou-tag').length`), 0, 'Higashiya (withdrawn) must not show it');
      assert.equal(await evaluate(`${entry('onsen-033')}.querySelectorAll('.hitou-tag').length`), 1, 'Azumaya (Shin-Takayu) is a member');
      assert.equal(await evaluate(`${entry('onsen-037')}.querySelectorAll('.hitou-tag').length`), 0);
      // 「地♨」の表示条件は従来と同じ(分類のある43施設: 現行34 + 旧9)。旧認定も表示・読み上げ・ホバーとも「地♨」「地・温泉」で区別しない
      assert.equal(await evaluate("document.querySelectorAll('#cards [role=img][aria-label=\"地・温泉\"]').length"), 42);
      assert.equal(await evaluate("document.querySelectorAll('#cards [aria-label*=\"（旧）\"]').length"), 0);
      assert.equal(await evaluate("[...document.querySelectorAll('#cards [role=img].tag')].some(n=>n.textContent.includes('旧'))"), false);
      assert.equal(await evaluate("[...document.querySelectorAll('#cards [role=img][aria-label=\"地・温泉\"]')].every(n=>n.textContent==='地♨'&&n.title==='地・温泉')"), true);

      // 両方に該当する施設: 「地♨」「秘♨」の順に横並び、見た目は共通
      const both = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('#cards .facility-entry')].filter(e=>e.querySelector('.hitou-tag')&&e.querySelector('[role=img].tag')).map(e=>{
        const c=e.querySelector('[role=img].tag'),h=e.querySelector('.hitou-tag'),a=c.getBoundingClientRect(),b=h.getBoundingClientRect(),cs=getComputedStyle(c),hs=getComputedStyle(h),card=e.closest('.card').getBoundingClientRect(),m=e.querySelector('.facility-meta').getBoundingClientRect();
        const same=['fontSize','fontWeight','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','backgroundColor','color','borderTopWidth','fontFamily'].filter(k=>cs[k]!==hs[k]);
        return{id:e.dataset.facilityId,order:c.nextElementSibling===h,sameRow:Math.abs((a.top+a.height/2)-(b.top+b.height/2))<=1,gap:Math.round((b.left-a.right)*10)/10,diff:same,h:[Math.round(a.height*10)/10,Math.round(b.height*10)/10],inside:b.right<=card.right&&a.left>=card.left&&b.right<=m.right+0.5,text:[c.textContent,h.textContent]}}))`));
      assert.ok(both.length >= 20, 'most members are also 地・温泉: ' + both.length);
      for (const r of both) {
        assert.ok(r.order, `${r.id}@${width}: 地♨ then 秘♨`);
        assert.deepEqual(r.diff, [], `${r.id}@${width}: same typography/colors`);
        assert.equal(r.h[0], r.h[1], `${r.id}@${width}: same height`);
        assert.ok(r.inside, `${r.id}@${width}: inside the card`);
        assert.deepEqual(r.text, r.text[0].startsWith('地♨') ? [r.text[0], '秘♨'] : r.text);
        if (width >= 390 && r.sameRow) assert.ok(r.gap >= 0 && r.gap <= 12, `${r.id}@${width}: gap ${r.gap}`);
      }
      // 秘♨単独(「地・温泉」でない会員)でも崩れない
      assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false, `no horizontal overflow @${width}`);
      assert.equal(await evaluate("[...document.querySelectorAll('#cards .card')].every(c=>{const r=c.getBoundingClientRect();return [...c.querySelectorAll('.tag')].every(n=>{const b=n.getBoundingClientRect();return b.right<=r.right+0.5&&b.left>=r.left-0.5})})"), true, `tags stay inside cards @${width}`);
    }

    // リンク: 公式の加盟宿ページ(新しいタブ)。名前・説明は読み上げ/ホバーで「日本秘湯を守る会 加盟宿」
    for (const id of MEMBERS) {
      const a = JSON.parse(await evaluate(`(()=>{const n=${entry(id)}.querySelector('.hitou-tag');return JSON.stringify({tag:n.tagName,href:n.href,target:n.target,rel:n.rel,title:n.title,label:n.getAttribute('aria-label'),text:n.textContent,tab:n.tabIndex,img:!!n.querySelector('img,svg')})})()`));
      assert.equal(a.tag, 'A', id);
      assert.equal(a.href, URLS[id], id);
      assert.equal(a.target, '_blank', id);
      assert.match(a.rel, /noopener/, id);
      assert.equal(a.title, '日本秘湯を守る会 加盟宿', id);
      assert.match(a.label, /^日本秘湯を守る会 加盟宿/, id);
      assert.equal(a.text, '秘♨', id);
      assert.equal(a.tab, 0, id);
      assert.equal(a.img, false, 'no official logo image');
    }
    // クリックはカード・詳細・他のリンクの動作を妨げない(詳細は開かず、既定の遷移だけを許す)。実際の遷移はテスト内で止める
    await evaluate("window.__dp=[];window.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.hitou-tag')){window.__dp.push(e.defaultPrevented);e.preventDefault()}},false)");
    await evaluate(`${entry('onsen-001')}.querySelector('.hitou-tag').click()`);
    assert.deepEqual(JSON.parse(await evaluate('JSON.stringify(window.__dp)')), [false], 'app code must not cancel the link');
    assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), false, 'the click does not open the detail view');
    assert.equal(await evaluate("document.querySelectorAll('.is-open').length"), 0);
    // 他のリンク(詳細)は従来どおり
    await evaluate(`${entry('onsen-001')}.querySelector('[data-detail]').click()`);
    assert.equal(await evaluate("document.getElementById('modalBg').style.display==='flex'"), true);
    await evaluate("document.getElementById('modalClose').click()");

    // 個人データ・保存形式に影響しない
    assert.equal(await evaluate('JSON.stringify(localStorage)'), '{}');
    ws.close();
  } finally { await browser.close(); server.closeAllConnections(); server.close(); }
});
