const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('E2E: 代表的な湯 in the detail view (Akita trial facilities, desktop and mobile)', async (t) => {
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-feature-baths-'));
  const port = 9225;
  const edge = spawn(edgePath, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--remote-allow-origins=*', htmlUrl]);

  try {
    await new Promise(r => setTimeout(r, 1200));
    let res;
    for (let i = 0; i < 50; i++) { try { res = await fetch(`http://127.0.0.1:${port}/json`); break; } catch { await new Promise(r => setTimeout(r, 200)); } }
    assert.ok(res, 'Edge debugging endpoint must start');
    const page = (await res.json()).find(p => p.type === 'page' && p.url === htmlUrl);
    assert.ok(page, 'Application browser page must be available');
    const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let idSeq = 0;
    const send = (method, params = {}) => new Promise(resolve => {
      const id = ++idSeq;
      const onMsg = event => { const msg = JSON.parse(event.data); if (msg.id === id) { ws.removeEventListener('message', onMsg); resolve(msg.result); } };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
    const waitFor = async expr => { for (let i = 0; i < 100; i++) { if (await evaluate(expr)) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out: ' + expr); };
    await send('Page.enable');
    ws.addEventListener('message', event => { if (JSON.parse(event.data).method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); });
    await waitFor("document.querySelectorAll('#cards .card').length>0");
    await evaluate("localStorage.clear()");
    fs.mkdirSync('scratch/feature-bath-qa', { recursive: true });

    const expected = {
      'onsen-013': { facility: '新玉川温泉', names: ['大浴場', '新緑の露天風呂', '貸切浴場'], colors: [], note: false },
      'onsen-014': { facility: '玉川温泉', names: ['大浴場', '箱蒸し湯', '天然岩盤浴'], colors: [], note: false },
      'onsen-015': { facility: '鶴の湯温泉', names: ['混浴露天風呂', '白湯', '黒湯'], colors: [], note: true },
      'onsen-016': { facility: '妙乃湯', names: ['やわらぎの湯－銀の湯'], colors: [], note: false },
      'onsen-017': { facility: '元湯雄山閣', names: ['温泉露天浴場', '温泉大浴場'], colors: [], note: true },
      'onsen-018': { facility: '後生掛温泉旅館', names: ['神経痛の湯', '箱蒸し風呂', '火山風呂'], colors: ['湯の色 灰白色のにごり湯'], note: false },
      'onsen-019': { facility: '鷹の湯温泉', names: ['大浴場', '河原野天風呂', '混浴半露天風呂'], colors: [], note: true },
      'onsen-020': { facility: '蒸ノ湯温泉', names: ['混浴野天風呂'], colors: [], note: false },
      'onsen-021': { facility: '奥山旅館', names: ['大露天風呂', '混浴露天風呂', '女性専用露天風呂'], colors: [], note: true },
      'onsen-022': { facility: '川原毛大湯滝', names: ['川原毛大湯滝'], colors: [], note: false },
      'onsen-023': { facility: '湯瀬ホテル', names: ['仙人の湯', '美人の湯', '瞑想 森の湯'], colors: [], note: false }
    };
    const readSection = `(()=>{const box=document.getElementById('featureBaths'),r=box.getBoundingClientRect(),m=document.querySelector('.modal'),items=[...box.querySelectorAll('.feature-bath')];
      const cs=n=>getComputedStyle(n);
      return{hidden:box.hidden,shown:r.height>0,facility:document.querySelector('#modalSubtitle .facility-name').textContent,title:document.getElementById('modalTitle').textContent,
      names:items.map(i=>i.querySelector('h4').textContent),colors:items.flatMap(i=>[...i.querySelectorAll('.feature-bath-color')].map(n=>n.textContent)),
      tags:items.map(i=>[...i.querySelectorAll('.feature-bath-tags .tag')].map(n=>n.textContent)),
      note:!document.getElementById('featureBathNote').hidden,heading:document.getElementById('featureBathsHeading').textContent,
      noLinks:box.querySelectorAll('a').length===0&&m.querySelectorAll('#modalSubtitle a, #detailMap, .facility-link, .map-link').length===0,
      overflowX:m.scrollWidth>m.clientWidth||document.documentElement.scrollWidth>innerWidth,
      inside:[...box.querySelectorAll('*')].filter(n=>{const b=n.getBoundingClientRect(),mr=m.getBoundingClientRect();return b.width>0&&!(b.right<=mr.right+0.5&&b.left>=mr.left-0.5)}).map(n=>n.tagName+':'+n.className+':'+JSON.stringify(n.getBoundingClientRect())+'|'+JSON.stringify(m.getBoundingClientRect())).join(';')||true,
      h4:cs(items[0]?.querySelector('h4')||box).fontSize,tagSize:cs(items[0]?.querySelector('.tag')||box).fontSize,modalH:Math.round(m.scrollHeight),boxH:Math.round(r.height),
      labels:[...document.querySelectorAll('#detailList dt')].map(n=>n.textContent),meta:[...document.querySelectorAll('#visitMeta dt, #visitMeta dd')].map(n=>n.textContent),metaInVisit:!!document.querySelector('.visit-section #visitMeta'),
      h3:['#featureBathsHeading','#visitHeading'].map(q=>{const n=document.querySelector(q),c=cs(n);return[c.fontSize,c.fontWeight,c.fontFamily.includes('Shippori Mincho'),c.color]}),
      itemBorders:items.map(i=>cs(i).borderTopWidth+'/'+cs(i).borderBottomWidth)}})()`;

    const order = `(()=>{const y=sel=>{const n=document.querySelector(sel);return n&&!n.hidden&&n.getClientRects().length?n.getBoundingClientRect().top:null};
      return['#modalTitle','#modalSubtitle','#featureBaths','#detailList','.visit-section','.detail-actions'].map(y)})()`;
    const inOrder = tops => { const shown = tops.filter(v => v !== null); return shown.every((v, i) => i === 0 || v > shown[i - 1]); };
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
      await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
      for (const [id, want] of Object.entries(expected)) {
        await evaluate(`document.querySelector('[data-detail="${id}"]').click()`);
        const s = await evaluate(readSection);
        assert.equal(s.hidden, false, id);
        { const tops = await evaluate(order); assert.ok(tops[2] !== null && inOrder(tops), `order ${id}@${width} ${tops}`); }
        assert.equal(s.shown, true, id);
        assert.equal(s.facility, want.facility);
        assert.equal(s.heading, '代表的な湯');
        assert.deepEqual(s.names, want.names, id);
        assert.deepEqual(s.colors, want.colors, id);
        assert.equal(s.note, want.note, id);
        assert.ok(s.tags.every(g => g.length <= 3), id);
        assert.ok(s.noLinks, 'no official/map links in detail');
        assert.equal(s.overflowX, false, `overflow ${id}@${width} ${JSON.stringify(s)}`);
        assert.equal(s.inside, true, `inside ${id}@${width}`);
        assert.ok(!s.labels.some(l => ['分類', '主泉質', '駅からの距離', '獲得標高'].includes(l)), JSON.stringify(s.labels));
        assert.deepEqual(s.labels, ['日帰り入浴', '最寄り駅']);
        assert.deepEqual(s.meta, ['初回訪問日', '—', '訪問メモ', '—']);
        assert.ok(s.metaInVisit);
        assert.deepEqual(s.h3.map(h=>h.slice(0,3)), [['22px', '600', true], ['18px', '600', true]]);
        assert.equal(s.h3[0][3], s.h3[1][3]);
        assert.ok(s.itemBorders.every(v => v === '0px/0px'), 'no rules between baths');
        if (id === 'onsen-018') assert.deepEqual(s.tags, [['メイン浴槽', '熱め・濃いめ'], ['名物', '天然蒸気'], ['気泡', 'ややぬるめ']]);
        if (width === 1280 || width === 390) await evaluate("document.getElementById('featureBaths').scrollIntoView({block:'center'})");
        if (width === 1280 || width === 390) { const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`scratch/feature-bath-qa/${id}-${width}.png`, Buffer.from(shot.data, 'base64')); }
        await evaluate("document.getElementById('modalClose').click()");
      }
      // 乳頭温泉郷: the two facilities sit in one grouped card and each opens its own data
      const nyuto = await evaluate("[...document.querySelectorAll('[data-facility-id=\"onsen-015\"],[data-facility-id=\"onsen-016\"]')].map(e=>e.closest('.card')?.dataset?.groupId||e.closest('.card')?.querySelector('h3')?.textContent)");
      assert.equal(nyuto[0], nyuto[1]);
      // other facilities have no data → section hidden
      for (const id of ['onsen-001', 'onsen-012', 'onsen-024', 'onsen-067']) {
        if (!await evaluate(`!!document.querySelector('[data-detail="${id}"]')`)) continue;
        await evaluate(`document.querySelector('[data-detail="${id}"]').click()`);
        const s = await evaluate(readSection);
        assert.equal(s.hidden, true, id); assert.equal(s.shown, false, id); assert.deepEqual(s.names, []);
        { const tops = await evaluate(order); assert.equal(tops[2], null); assert.ok(inOrder(tops), `order ${id}@${width} ${tops}`); }
        await evaluate("document.getElementById('modalClose').click()");
      }
    }

    // visit records still work from a detail view that has the section
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await evaluate("document.querySelector('[data-detail=\"onsen-018\"]').click()");
    await evaluate("document.getElementById('visitAdd').click();document.getElementById('visitDate').value='2026-10-01';document.getElementById('visitForm').requestSubmit()");
    await waitFor("document.getElementById('visitSummary').textContent.includes('訪問1回')");
    assert.equal(await evaluate("document.querySelector('#visitMeta dd').textContent"), '2026-10-01');
    assert.ok(await evaluate("document.getElementById('featureBaths').hidden===false"));
    await evaluate("document.querySelector('[data-edit-visit]').click();document.getElementById('visitDate').value='2026-10-02';document.getElementById('visitForm').requestSubmit()");
    await waitFor("document.getElementById('visitList').textContent.includes('2026-10-02')");
    assert.equal(await evaluate("document.querySelector('#visitMeta dd').textContent"), '2026-10-02');
    await evaluate("document.querySelector('[data-delete-visit]').click()");
    await waitFor("document.getElementById('visitSummary').textContent.includes('訪問0回')");
    assert.equal(await evaluate("document.querySelector('#visitMeta dd').textContent"), '—');
    await evaluate("document.getElementById('modalClose').click()");
    ws.close();
  } finally { edge.kill(); server.closeAllConnections(); server.close(); }
});
