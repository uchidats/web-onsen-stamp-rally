const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const KEY = 'onsen-rally-stay-search-v1';
test('Stay search: panel form, saved device-locally, bed icons on cards, detail link, three widths', async t => {
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  if (!fs.existsSync(edge)) { t.skip('Edge not installed'); return; }
  const url = pathToFileURL(path.resolve('index.html')).href;
  const browser = await require('./helpers/browser.cjs').startBrowser(edge, url);
  t.after(() => browser.close());
  const { send, evaluate } = browser, delay = ms => new Promise(r => setTimeout(r, ms));
  await send('Page.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] }); // 外部へは一切出さない
  const ready = async () => { for (let i = 0; i < 100; i++) { if (await evaluate("!!window.OnsenHost && document.querySelectorAll('#cards .card').length>0")) return; await delay(100); } assert.fail('not ready'); };
  await ready();
  const showAll = () => evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
  const open = async id => { await showAll(); await evaluate(`document.querySelector('[data-detail="${id}"]').click()`); };
  const close = () => evaluate("document.getElementById('modalClose').click()");
  const dumpLs = () => evaluate('JSON.stringify(Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])))').then(JSON.parse);
  const future = await evaluate(`(()=>{const S=OnsenStaySearch,t=new Date();t.setDate(t.getDate()+40);return S.iso({y:t.getFullYear(),mo:t.getMonth()+1,d:t.getDate()})})()`);
  const past = await evaluate(`(()=>{const t=new Date();t.setDate(t.getDate()-3);return OnsenStaySearch.iso({y:t.getFullYear(),mo:t.getMonth()+1,d:t.getDate()})})()`);
  const vals = () => evaluate(`JSON.stringify([stayCheckIn.value,stayNights.value,stayAdults.value])`).then(JSON.parse);

  // 訪問記録・メモを先に作り、保存の前後で一切変わらないことを確認する
  await evaluate(`(()=>{const h=OnsenHost;let s=h.store.replace(h.store.empty(),h.getState(),true);s=h.store.addVisit(s,'onsen-001','2026-01-02','stay');s=h.store.setNotes(s,'onsen-001','残すメモ');h.setState(s)})()`);
  const before = await dumpLs();
  assert.ok(!(KEY in before));
  const verifiedCount = await evaluate('OnsenStaySearch.GOOGLE_VERIFIED_IDS.length');

  for (const width of [1280, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 400 });
    await evaluate(`localStorage.removeItem('${KEY}')`);
    await send('Page.reload'); await ready(); await showAll();

    // --- 入力欄は検索パネルの中(既存の検索欄の下、薄い区切り線つき)。詳細画面には無い
    const place = await evaluate(`(()=>{const p=document.querySelector('.filters'),s=document.getElementById('staySearch'),sum=document.getElementById('collectionSummary').getBoundingClientRect(),sr=s.getBoundingClientRect(),pr=p.getBoundingClientRect();
      return JSON.stringify({inPanel:p.contains(s),below:sr.top>=sum.bottom,insidePanel:sr.left>=pr.left-1&&sr.right<=pr.right+1,border:getComputedStyle(s).borderTopWidth,heading:document.getElementById('stayHeading')?'present':document.getElementById('staySearch').getAttribute('aria-label')+'|visibleText:'+document.getElementById('staySearch').textContent.includes('宿泊の検索条件'),inModal:!!document.querySelector('.modal #stayForm,.modal #stayCheckIn'),clearInside:!!document.getElementById('clearFilter').closest('.stay-search')})})()`).then(JSON.parse);
    assert.deepEqual(place, { inPanel: true, below: true, insidePanel: true, border: '1px', heading: '宿泊の検索条件|visibleText:false', /* 視覚的な見出しは無く、スクリーンリーダー向けの名前(aria-label)だけ */ inModal: false, clearInside: false });
    const layout = await evaluate(`(()=>{const els=[stayCheckIn,stayNights,stayAdults,staySave],r=els.map(e=>e.getBoundingClientRect());
      return JSON.stringify({overflow:document.documentElement.scrollWidth>innerWidth||document.getElementById('staySearch').scrollWidth>document.getElementById('staySearch').clientWidth,small:els.filter((e,i)=>r[i].height<44).map(e=>e.id),outside:els.filter((e,i)=>r[i].left<0||r[i].right>innerWidth).map(e=>e.id),
        overlap:r.some((a,i)=>r.some((b,j)=>j>i&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)),sameRowDesktop:r[0].top===r[1].top&&r[1].top===r[2].top})})()`).then(JSON.parse);
    { const { sameRowDesktop, ...rest } = layout; assert.deepEqual(rest, { overflow: false, small: [], outside: [], overlap: false }); }
    if (width > 600) assert.equal(layout.sameRowDesktop, true, 'check-in, nights, adults share one row on wide screens');

    // --- 初期値(日付なし・1泊・大人1名・1室)、保存ボタン、過去日・空は保存されない
    assert.deepEqual(await vals(), ['', '1', '1']);
    assert.equal(await evaluate('staySave.textContent'), '条件を保存');
    // 「1室」の独立表示・説明文は無く、ラベルは「1室・大人」。保存ボタンの書体は「条件クリア」と同じ
    assert.deepEqual(await evaluate(`JSON.stringify({rooms:!!document.querySelector('.stay-rooms'),note:!!document.querySelector('#staySearch .stay-note,#staySearch .note'),adults:document.querySelector('label[for=stayAdults]').textContent,text:document.getElementById('staySearch').textContent.includes('絞り込み')})`).then(JSON.parse), { rooms: false, note: false, adults: '1室・大人', text: false });
    const fontOf = id => evaluate(`(()=>{const c=getComputedStyle(document.getElementById('${id}'));return JSON.stringify([c.fontFamily,c.fontSize,c.fontWeight,c.letterSpacing,c.lineHeight,c.height])})()`).then(JSON.parse);
    assert.deepEqual(await fontOf('staySave'), await fontOf('clearFilter'), 'save button typography matches 条件クリア');
    assert.equal(await evaluate("(()=>{const r=document.getElementById('stayStatus').getBoundingClientRect();return r.width<=1&&r.height<=1})()"), true, 'status is not shown permanently');
    await evaluate('stayForm.requestSubmit()');
    assert.match(await evaluate('stayStatus.textContent'), /チェックイン日/);
    await evaluate(`stayCheckIn.value='${past}';stayForm.requestSubmit()`);
    assert.match(await evaluate('stayStatus.textContent'), /過去/);
    assert.equal(await evaluate(`localStorage.getItem('${KEY}')`), null);

    // --- ベッドアイコン: 対応59施設にだけ・地図ピンのすぐ右・文字や枠なし
    const bed = await evaluate(`(()=>{const links=[...document.querySelectorAll('#cards [data-stay]')],ids=links.map(a=>a.dataset.stay),first=links[0];first.scrollIntoView({block:'center',behavior:'instant'});const pin=first.previousElementSibling,fr=first.getBoundingClientRect(),pr=pin.getBoundingClientRect(),fs=getComputedStyle(first),ps=getComputedStyle(pin),
      mid={x:fr.left+fr.width/2,y:fr.top+fr.height/2},top=document.elementFromPoint(mid.x,fr.top-6);
      return JSON.stringify({count:links.length,ids,adjacent:pin.classList.contains('map-link')&&!pin.classList.contains('stay-link'),right:Math.abs(fr.left-pr.right)<=6&&Math.abs(fr.top-pr.top)<=1,same:[Math.round(fr.width),Math.round(fr.height),fs.color,fs.borderTopWidth,fs.backgroundColor].join()===[Math.round(pr.width),Math.round(pr.height),ps.color,ps.borderTopWidth,ps.backgroundColor].join(),
        label:first.getAttribute('aria-label'),tip:first.querySelector('.map-tooltip').textContent,text:[...first.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(''),svgSize:first.querySelector('svg').getAttribute('width')+'x'+first.querySelector('svg').getAttribute('height'),tapReach:!!(top&&top.closest('.stay-link')),pinLabel:pin.getAttribute('aria-label'),pinHref:pin.href.startsWith('https://www.google.com/maps')})})()`).then(JSON.parse);
    assert.equal(bed.count, verifiedCount); assert.deepEqual([...bed.ids].sort(), [...(await evaluate('OnsenStaySearch.GOOGLE_VERIFIED_IDS'))].sort());
    assert.deepEqual({ adjacent: bed.adjacent, right: bed.right, same: bed.same, label: bed.label, tip: bed.tip, text: bed.text, svgSize: bed.svgSize, tapReach: bed.tapReach, pinHref: bed.pinHref },
      { adjacent: true, right: true, same: true, label: 'Googleで宿泊料金を比較', tip: 'Googleで宿泊料金を比較', text: '', svgSize: '18x18', tapReach: true, pinHref: true });
    assert.match(bed.pinLabel, /Google Mapsで表示/, 'existing Google Maps link is unchanged');
    // 日帰り専用・未対応施設にはアイコンが無い
    const absent = await evaluate(`(()=>{const day=ONSEN_DATA.filter(x=>x.category==='日帰り旅名湯').map(x=>x.id),un=ONSEN_DATA.filter(x=>!OnsenStaySearch.googleVerified(x.id)).map(x=>x.id);return JSON.stringify({any:[...day,...un].filter(id=>document.querySelector('[data-facility-id="'+id+'"] [data-stay]')),unCount:un.length})})()`).then(JSON.parse);
    assert.deepEqual(absent.any, []); assert.equal(absent.unCount, (await evaluate('ONSEN_DATA.length')) - verifiedCount);

    // --- 日付が未保存のときアイコンは外部へ飛ばず、入力欄へ案内する(詳細も開かない)
    await evaluate(`window.__nav=0;document.addEventListener('click',e=>{if(e.target.closest('.stay-link'))e.preventDefault()},true)`);
    assert.equal(await evaluate("document.querySelector('[data-stay=\"onsen-002\"]').getAttribute('href')"), '#staySearch');
    assert.equal(await evaluate("document.querySelector('[data-stay=\"onsen-002\"]').hasAttribute('target')"), false);
    await evaluate("document.querySelector('[data-stay=\"onsen-002\"]').click()");
    assert.equal(await evaluate('document.activeElement.id'), 'stayCheckIn');
    assert.match(await evaluate('stayStatus.textContent'), /チェックイン日を入力/);
    assert.notEqual(await evaluate("document.getElementById('modalBg').style.display"), 'flex');

    // --- 保存 → ベッドアイコンのリンク先に日付・泊数・大人人数が入る
    await evaluate(`stayCheckIn.value='${future}';stayNights.value='2';stayForm.requestSubmit()`);
    assert.equal(await evaluate('stayStatus.textContent'), '条件を保存しました');
    assert.equal(await evaluate("document.getElementById('toast').textContent"), '条件を保存しました', 'brief toast');
    assert.deepEqual(JSON.parse(await evaluate(`localStorage.getItem('${KEY}')`)), { v: 1, checkIn: future, nights: 2, adults: 1, rooms: 1 });
    const linkOf = id => evaluate(`JSON.stringify({href:document.querySelector('[data-stay="${id}"]').href,target:document.querySelector('[data-stay="${id}"]').target,rel:document.querySelector('[data-stay="${id}"]').rel})`).then(JSON.parse);
    let l = await linkOf('onsen-002'); let u = new URL(l.href);
    assert.equal(u.origin + u.pathname, 'https://www.google.com/travel/search'); assert.equal(l.target, '_blank'); assert.match(l.rel, /noopener/);
    assert.equal(u.searchParams.get('q'), await evaluate("ONSEN_DATA.find(x=>x.id==='onsen-002').facility"));
    assert.equal(u.searchParams.get('ts'), await evaluate(`OnsenStaySearch.googleTs('${future}',2,1)`));
    assert.equal(new URL((await linkOf('onsen-008')).href).searchParams.get('q'), '大沢温泉 山水閣', 'rephrased query for facilities Google cannot find by name alone');
    await evaluate(`stayAdults.value='3';stayForm.requestSubmit()`);
    assert.equal(new URL((await linkOf('onsen-002')).href).searchParams.get('ts'), await evaluate(`OnsenStaySearch.googleTs('${future}',2,3)`));
    await evaluate(`stayAdults.value='1';stayForm.requestSubmit()`);
    // アイコンのクリックは詳細画面を開かない
    await evaluate("document.querySelector('[data-stay=\"onsen-002\"]').click()");
    assert.notEqual(await evaluate("document.getElementById('modalBg').style.display"), 'flex');

    // --- 「条件クリア」と施設の絞り込みでは宿泊条件は消えず、絞り込みは従来どおり動く
    await evaluate("search.value='酸ヶ湯';search.dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.querySelectorAll('#cards .facility-entry').length"), 1);
    await evaluate("clearFilter.click()");
    assert.equal(await evaluate("search.value"), '');
    assert.ok(await evaluate("document.querySelectorAll('#cards .facility-entry').length") > 1);
    assert.deepEqual(await vals(), [future, '2', '1']);
    assert.deepEqual(JSON.parse(await evaluate(`localStorage.getItem('${KEY}')`)), { v: 1, checkIn: future, nights: 2, adults: 1, rooms: 1 });
    await evaluate("prefSelect.value='青森県';prefSelect.dispatchEvent(new Event('change'))");
    {const n=await evaluate("document.querySelectorAll('#cards .facility-entry').length");assert.ok(n>0&&n<await evaluate('ONSEN_DATA.length'),'prefecture filter narrows the list');}
    await evaluate("clearFilter.click()");
    assert.ok(await evaluate("document.querySelector('[data-stay=\"onsen-002\"]')!==null"), 'icons re-render after filtering');

    // --- 詳細画面: 宿泊関連の表示は無い。メモ欄は低く、訪問ボタンは横並びで同じ大きさ
    await open('onsen-002');
    const dd = await evaluate(`(()=>{const q=id=>document.getElementById(id),m=q('modalBg'),a=q('visitAdd').getBoundingClientRect(),b=q('detailStamp').getBoundingClientRect(),memo=q('memoText').getBoundingClientRect(),modal=document.querySelector('.modal');
      return JSON.stringify({gone:['stayGoogle','stayGoogleNote','stayHint','stayLodgingNote','stayDetail','detailBook'].concat(modal.querySelector('#stayForm,#stayCheckIn,#staySave')?['stayFormInModal']:[]).filter(i=>i==='stayFormInModal'||q(i)),text:/宿泊料金|宿泊施設を探す|Google.*引き継|非公式/.test(modal.textContent),sameRow:Math.abs(a.top-b.top)<1,sameSize:Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1,h:a.height,memoH:memo.height,memoResize:getComputedStyle(q('memoText')).resize,labels:[q('visitAdd').textContent,q('detailStamp').textContent],fit:b.right<=modal.getBoundingClientRect().right&&a.left>=modal.getBoundingClientRect().left,overflow:modal.scrollWidth>modal.clientWidth||document.documentElement.scrollWidth>innerWidth})})()`).then(JSON.parse);
    assert.deepEqual(dd.gone, []); assert.equal(dd.text, false); assert.equal(dd.sameRow, true); assert.equal(dd.sameSize, true); assert.ok(dd.h >= 44);
    // 広い画面では元(93px)の約半分。狭い画面ではプレースホルダーが2行になるため72px(切れないための最小の高さ)
    assert.ok(width > 600 ? dd.memoH < 56 && dd.memoH > 30 : dd.memoH >= 70 && dd.memoH <= 76, 'memo height: ' + dd.memoH); assert.equal(dd.memoResize, 'vertical');
    assert.deepEqual(dd.labels, ['訪問日を追加', '訪問済みにする']); assert.equal(dd.fit, true); assert.equal(dd.overflow, false);
    fs.writeFileSync(path.join(browser.profile, `detail-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await close();

    // スクリーンショット(検索パネル・カード)
    await evaluate("document.getElementById('staySearch').scrollIntoView({block:'center',behavior:'instant'})");
    fs.writeFileSync(path.join(browser.profile, `stay-panel-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    await evaluate("document.querySelector('[data-stay=\"onsen-002\"]').scrollIntoView({block:'center',behavior:'instant'})");
    fs.writeFileSync(path.join(browser.profile, `stay-card-${width}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  }

  // 再読み込み後も復元(日付が保存済みなら、アイコンは最初から外部リンク)
  await send('Page.reload'); await ready();
  assert.deepEqual(await vals(), [future, '2', '1']);
  assert.equal(await evaluate("document.querySelector('[data-stay=\"onsen-002\"]').target"), '_blank');

  // 保存先は専用キーだけ。訪問履歴・メモ・同期関連キー・バックアップは不変
  const after = await dumpLs();
  const changed = Object.keys({ ...before, ...after }).filter(k => before[k] !== after[k]);
  assert.deepEqual(changed, [KEY]);
  assert.ok(!JSON.stringify(await evaluate('OnsenHost.backup()')).includes('onsen-rally-stay-search'), 'backup JSON does not contain the stay conditions');
  assert.equal((await evaluate('OnsenHost.backup()')).userData.visits['onsen-001'].notes, '残すメモ');

  // 既存のGoogle Mapsリンクは詳細にも残る。宿泊のリンクは詳細には無い
  await open('onsen-002');
  assert.match(await evaluate("document.querySelector('#modalSubtitle a[href*=\"maps\"]')?.href||''"), /maps/);
  assert.equal(await evaluate("!!document.getElementById('detailBook')||!!document.getElementById('stayGoogle')"), false);
  t.diagnostic('Screenshots: ' + browser.profile);
});
