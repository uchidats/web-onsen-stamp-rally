const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('E2E: facility name links and map icons fit desktop and mobile cards', async (t) => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    t.skip('Edge not installed at standard path');
    return;
  }

  const fixtures=Array.from({length:8},(_,i)=>({id:'onsen-'+String(i+1).padStart(3,'0'),prefecture:'青森県',category:'独自セレクション',onsen:'レイアウト検証温泉 '+(i+1),facility:i<4?'検証の温泉宿 '+(i+1):'長い宿名でも自然に読める静かな温泉旅館'.repeat(4),officialUrl:i%2?'https://example.com/':'',mapUrl:i%4>=2?'https://maps.google.com/':'',latitude:null,longitude:null,coordinateVerified:false}));
  const HITOU_IDS=Object.keys((()=>{const sb={window:{}};require('node:vm').runInNewContext(fs.readFileSync('hitou-membership.js','utf8'),sb);return sb.window.ONSEN_HITOU_MEMBERSHIP})());
  fixtures[0].id='onsen-015';fixtures[1].id='onsen-016';
  for(const x of fixtures.slice(0,2)){x.prefecture='秋田県';x.onsen='乳頭温泉郷';x.mapUrl='https://maps.google.com/?q='+x.id;x.officialUrl='https://example.com/'+x.id;}
  for(const x of fixtures.slice(4))x.springType='硫黄泉・酸性泉・放射能泉';
  let useMaster=false;
  const server = require('node:http').createServer((req,res)=>{
    if(!useMaster&&new URL(req.url,'http://localhost').pathname.endsWith('/data.js')){res.setHeader('Content-Type','application/javascript; charset=utf-8');res.end('window.ONSEN_DATA='+JSON.stringify(fixtures)+';');return;}
    const file = path.resolve('.'+new URL(req.url,'http://localhost').pathname.replace(/^\/web-onsen-stamp-rally\//,'/'));
    if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403).end();return;}
    const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)];
    if(type)res.setHeader('Content-Type',type);
    fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  // Match the GitHub Pages project subdirectory as well as local HTTP behavior.
  const htmlUrl = `http://127.0.0.1:${server.address().port}/web-onsen-stamp-rally/index.html`;
  let browser;
  t.after(async () => { await browser?.close(); server.closeAllConnections(); server.close(); });
  browser = await require('./helpers/browser.cjs').startBrowser(edgePath, htmlUrl);
  const { ws, send, evaluate } = browser;
  try {

    await send('Page.enable');
    ws.addEventListener('message',event=>{if(JSON.parse(event.data).method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true});});

    for (let attempt = 0; attempt < 50; attempt++) {
      if (await evaluate(`!!document.querySelector('.geolonia-svg-map .prefecture')`)) break;
      await new Promise(r => setTimeout(r, 100));
    }

    async function waitFor(expr){for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,100));}assert.fail('Timed out: '+expr);}
    const results=[];
    fs.mkdirSync('scratch/card-layout-qa',{recursive:true});
    for(const id of ['onsen-015','onsen-005'])await evaluate(`document.querySelector('[data-detail="${id}"]').click();document.getElementById('detailStamp').click();document.getElementById('modalClose').click()`);
    for(const width of [1440,1280,768,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      await evaluate("document.getElementById('onsens').scrollIntoView()");
      await new Promise(r=>setTimeout(r,150));
      const layout=await evaluate(`(() => {
        const cards=[...document.querySelectorAll('#cards .card')];
        return {overflow:document.documentElement.scrollWidth>innerWidth,cards:cards.map((card,i)=>{
          const row=card.querySelector('.facility'),meta=card.querySelector('.facility-meta'),name=row.querySelector('.facility-name'),pin=meta.querySelector('.map-link:not(.stay-link)');
          const r=row.getBoundingClientRect(),m=meta.getBoundingClientRect(),n=name.getBoundingClientRect(),p=pin?.getBoundingClientRect();
          return {id:row.parentElement.dataset.facilityId,official:name.tagName==='A',map:!!pin,name:name.textContent,
            officialUrl:name.href,mapLabel:pin?.getAttribute('aria-label'),safe:!pin||(pin.target==='_blank'&&pin.rel.includes('noopener')),
            font:parseFloat(getComputedStyle(name).fontSize),headingFont:parseFloat(getComputedStyle(card.querySelector('h3')).fontSize),descriptionFont:parseFloat(getComputedStyle(card.querySelector('.tag')).fontSize),
            contained:n.left>=r.left-1&&n.right<=r.right+1&&(!p||p.right<=r.right+1),
            grouped:Math.abs(m.left-r.left)<1&&Math.abs(m.top-r.bottom-5)<1&&(!p||Math.abs(p.left-m.left)<1),
            noSeparateOfficial:!row.querySelector('.facility-link'),direct:!pin||pin.parentElement===meta,
            leftAligned:getComputedStyle(meta).justifyContent==='flex-start',
            order:[...meta.children].map(e=>e.classList.contains('stay-link')?'stay':e.classList.contains('map-link')?'map':e.classList.contains('facility-detail')?'detail':'tag'),
            metadataContained:[...meta.children].every(e=>{const b=e.getBoundingClientRect();return b.left>=m.left-1&&b.right<=m.right+1}),
            badge:!!row.querySelector('.conquered-badge'),badgeFits:!row.querySelector('.conquered-badge')||row.querySelector('.conquered-badge').getBoundingClientRect().right<=r.right+1,
            badgeOutsideLink:!row.querySelector('a .conquered-badge'),noOldStatus:!card.querySelector('.facility-status')&&!/訪問済み|未訪問/.test(card.textContent)};
        })};
      })()`);
      assert.equal(layout.overflow,false,`${width}px: no page overflow`);
      assert.equal(layout.cards.length,7);
      const STAY=(()=>{const c={btoa:x=>Buffer.from(x,'latin1').toString('base64')};require('node:vm').runInNewContext(fs.readFileSync('stay-search.js','utf8'),Object.assign(c,{globalThis:c}));return c.OnsenStaySearch})();
      for(const c of layout.cards){
        const i=fixtures.findIndex(x=>x.id===c.id);
        assert.equal(c.official,!!fixtures[i].officialUrl);
        assert.equal(c.map,!!fixtures[i].mapUrl);
        assert.equal(c.name,fixtures[i].facility);
        assert.deepEqual(c.order,[...(c.map?['map']:[]),...(STAY.googleVerified(c.id)&&fixtures[i].category!=='日帰り旅名湯'?['stay']:[]),'detail','tag',...(HITOU_IDS.includes(c.id)?['tag']:[]),...(fixtures[i].springType?['tag']:[])]); // 加盟宿は「秘♨」が分類ラベルの右に並ぶ
        assert.equal(c.badge,['onsen-015','onsen-005'].includes(c.id));
        if(c.official)assert.equal(c.officialUrl,fixtures[i].officialUrl);
        if(c.map)assert.ok(c.mapLabel.includes('Google Maps')&&c.mapLabel.includes(fixtures[i].facility));
        assert.ok(c.font>c.descriptionFont&&c.font<c.headingFont);
        assert.ok(c.contained&&c.grouped&&c.safe&&c.direct&&c.noSeparateOfficial&&c.leftAligned&&c.metadataContained&&c.badgeFits&&c.badgeOutsideLink&&c.noOldStatus,JSON.stringify({width,...c}));
        await evaluate(`document.querySelector('[data-detail="${c.id}"]').click()`);
        assert.equal(await evaluate("document.getElementById('modalTitle').textContent"),fixtures[i].onsen);
        assert.equal(await evaluate("document.querySelector('#modalSubtitle .facility-name').textContent"),fixtures[i].facility);
        const detail=await evaluate(`(()=>{const n=document.querySelector('#modalSubtitle .facility-name'),s=getComputedStyle(n),r=n.getBoundingClientRect(),m=document.querySelector('.modal').getBoundingClientRect();return{url:n.getAttribute('href'),target:n.target,rel:n.rel,icon:!!n.querySelector('.external-link-icon'),font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,old:!!document.querySelector('#modalSubtitle .facility-link'),pin:document.querySelector('#detailMap')?.getAttribute('href')||null,fits:r.right<=m.right&&r.left>=m.left}})()`);
        assert.equal(detail.url,fixtures[i].officialUrl||null);assert.equal(detail.icon,!!fixtures[i].officialUrl);assert.equal(detail.target,fixtures[i].officialUrl?'_blank':undefined);assert.equal(detail.old,false);assert.equal(detail.pin,fixtures[i].mapUrl||null);assert.equal(detail.size,'24px');assert.equal(detail.weight,'600');assert.ok(detail.font.includes('Noto Sans JP')&&detail.fits);
        const simple=await evaluate(`(()=>{const m=document.querySelector('.modal'),labels=[...document.querySelectorAll('#detailList dt')].map(n=>n.textContent),h=getComputedStyle(document.querySelector('#modalSubtitle .facility-name'));return{links:m.querySelectorAll('#modalSubtitle a, #detailMap, .facility-link, .map-link').length,pref:!!m.querySelector('.detail-prefecture'),badge:!!m.querySelector('#modalSubtitle .conquered-badge, #modalSubtitle .tag'),labels,mainHeading:document.getElementById('detailFacilityHeading').tagName==='H2'&&parseFloat(h.fontSize)>parseFloat(getComputedStyle(document.getElementById('modalTitle')).fontSize),dialogLabel:m.getAttribute('aria-labelledby')==='detailFacilityHeading',slot:document.getElementById('featureBaths').hidden,id:document.querySelector('.facility-entry')&&'${c.id}'}})()`);
        assert.equal(simple.links,(fixtures[i].officialUrl?1:0)+(fixtures[i].mapUrl?1:0));assert.equal(simple.pref,false);assert.equal(simple.badge,false);assert.ok(simple.mainHeading&&simple.dialogLabel);assert.equal(simple.slot,!['onsen-002','onsen-003','onsen-004','onsen-005','onsen-006','onsen-007','onsen-008','onsen-015','onsen-016'].includes(c.id));
        assert.ok(simple.labels.includes('最寄り駅'));assert.ok(!simple.labels.some(l=>['分類','主泉質','駅からの距離','獲得標高'].includes(l)),JSON.stringify(simple.labels));
        if(i===5){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('scratch/card-layout-qa/detail-long-'+width+'.png',Buffer.from(shot.data,'base64'));}
        await evaluate("document.getElementById('modalClose').click()");
      }
      results.push({width,...layout});
      const bounds=await evaluate("(()=>{const r=document.getElementById('cards').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:bounds});
      fs.writeFileSync(`scratch/card-layout-qa/cards-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    assert.equal(await evaluate("document.querySelectorAll('[data-group=nyuto] .facility-entry').length"),2);
    await evaluate("document.querySelector('[data-detail=onsen-015]').click();document.getElementById('detailStamp').click();document.getElementById('modalClose').click()");
    assert.equal(await evaluate("document.querySelector('[data-facility-id=onsen-015] .conquered-badge').textContent"),'制覇');
    assert.equal(await evaluate("!!document.querySelector('[data-facility-id=onsen-016] .conquered-badge')"),false);
    for(const status of ['visited','unvisited']){
      await evaluate(`document.getElementById('statusSelect').value='${status}';document.getElementById('statusSelect').dispatchEvent(new Event('change'))`);
      assert.equal(await evaluate("document.querySelectorAll('[data-group=nyuto] .facility-entry').length"),1);
      assert.equal(await evaluate("document.querySelector('[data-group=nyuto] .facility-entry').dataset.facilityId"),status==='visited'?'onsen-015':'onsen-016');
    }
    await evaluate("document.getElementById('clearFilter').click();document.getElementById('search').value=ONSEN_DATA[1].facility;document.getElementById('search').dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.querySelectorAll('.facility-entry').length"),1);
    assert.equal(await evaluate("document.querySelector('.facility-entry').dataset.facilityId"),'onsen-016');
    useMaster=true;
    await evaluate('localStorage.clear();location.reload()');
    await waitFor("document.querySelector('[data-group=nyuto] .facility-entry') && ONSEN_DATA.length===67");
    for(const width of [1440,1280,768,390,320]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<400});
      await evaluate("document.getElementById('onsens').scrollIntoView()");
      await new Promise(r=>setTimeout(r,180));
      const layout=await evaluate(`(() => {
        const cards=[...document.querySelectorAll('#cards .card')],rows=[...document.querySelectorAll('.facility-entry')];
        const nyuto=[...document.querySelectorAll('[data-group=nyuto] .facility-entry')];
        return {overflow:document.documentElement.scrollWidth>innerWidth,columns:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().left))).size,
          heights:cards.map(c=>c.getBoundingClientRect().height),contained:rows.every(row=>[...row.querySelector('.facility').children].every(e=>e.getBoundingClientRect().right<=row.getBoundingClientRect().right+1)),
          nyuto:nyuto.map(r=>({id:r.dataset.facilityId,official:r.querySelector('.facility-name').href,map:r.querySelector('.map-link').href,detail:r.querySelector('[data-detail]').dataset.detail}))};
      })()`);
      assert.equal(layout.overflow,false);assert.equal(layout.contained,true);assert.equal(layout.columns,width>600?2:1);
      // 検索欄=表示中の入力・選択・ボタン・コレクション選択の見出し(宿泊の検索条件は施設の絞り込みではない別セクションなので除く。その配置は e2e-stay-search で検証)。閉じた選択肢のボタンと非表示のselect(categorySelect)は数えない(下で非表示であることも確認する)。
      const filters=await evaluate(`(()=>{const panel=document.querySelector('.filters'),controls=[...panel.querySelectorAll('input,select,button,summary')].filter(c=>c.offsetParent!==null&&!c.closest('.collection-options')&&!c.closest('.stay-search'));const hidden=document.getElementById('categorySelect'),picker=panel.querySelector('details.collection-picker')||panel.querySelector('.collection-picker');return{ids:controls.map(c=>c.id||c.tagName.toLowerCase()),items:controls.map(c=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}}),padding:getComputedStyle(panel).paddingTop,labelGap:getComputedStyle(panel.querySelector('label')).marginBottom,hiddenSelect:hidden.hidden&&hidden.offsetParent===null,pickerClosed:!picker.open,optionsClosed:[...panel.querySelectorAll('.collection-options button')].every(b=>!b.checkVisibility())}})()`);
      assert.deepEqual(filters.ids,['search','clearFilter','prefSelect','collectionSummary','colorSelect','statusSelect'],'the six visible search controls');
      assert.equal(filters.hiddenSelect,true);assert.equal(filters.pickerClosed,true);assert.equal(filters.optionsClosed,true,'closed picker options are not on screen');
      const [search,clear,pref,collection,color,status]=filters.items;
      assert.ok(filters.items.every(c=>Math.abs(c.height-46)<1),'search controls have matching heights at every width (phones included)');
      // 1行目: 検索欄+条件クリア(同じ行)。2行目: 都道府県・コレクション・湯の色・訪問状況(PCは4列均等、スマホは2列)。
      assert.equal(search.y,clear.y);assert.ok(clear.x>search.x);
      if(width>800){assert.ok([pref,collection,color,status].every(c=>c.y===pref.y&&c.y>search.y));assert.ok([collection,color,status].every(c=>Math.abs(pref.width-c.width)<1));assert.ok(collection.x>pref.x&&color.x>collection.x&&status.x>color.x);assert.equal(filters.padding,'18px');assert.equal(filters.labelGap,'4px');}
      else if(width>600){assert.ok([pref,collection,color,status].every(c=>c.y===pref.y&&c.y>search.y));assert.ok(collection.x>pref.x&&color.x>collection.x&&status.x>color.x);}
      else{assert.equal(filters.padding,'16px');assert.equal(filters.labelGap,'8px');assert.ok(pref.y>search.y&&color.y>pref.y,'two rows on phones');assert.equal(pref.y,collection.y);assert.equal(color.y,status.y);assert.ok(collection.x>pref.x&&status.x>color.x);assert.ok([pref,collection,color,status].every(c=>Math.abs(c.width-pref.width)<1));}
      const filterBounds=await evaluate("(()=>{const r=document.querySelector('.filters').getBoundingClientRect();return{x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const filterShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:filterBounds});fs.writeFileSync('scratch/card-layout-qa/filters-'+width+'.png',Buffer.from(filterShot.data,'base64'));
      assert.ok(await evaluate(`(()=>{const links=[document.querySelector('.hero-actions .primary'),...document.querySelectorAll('.facility-detail')];return links.filter(link=>link.getClientRects().length).every(link=>{const icon=link.querySelector('.external-link-icon'),style=getComputedStyle(link);return icon&&icon.getAttribute('aria-hidden')==='true'&&Math.abs(icon.getBoundingClientRect().width-14)<0.1&&Math.abs(icon.getBoundingClientRect().height-14)<0.1&&['flex','inline-flex'].includes(style.display)&&style.alignItems==='center'&&style.whiteSpace==='nowrap'&&style.gap==='6px';})&&links[0].getAttribute('href')==='#onsens'&&links[0].querySelector('svg').innerHTML===links[1].querySelector('svg').innerHTML;})()`),'matching SVG icons and aligned unbroken labels');
      assert.deepEqual(layout.nyuto.map(r=>r.id),['onsen-015','onsen-016']);
      assert.notEqual(layout.nyuto[0].official,layout.nyuto[1].official);assert.notEqual(layout.nyuto[0].map,layout.nyuto[1].map);
      assert.ok(new Set(layout.heights).size>1);
      results.push({width,master:true,...layout});
      const bounds=await evaluate("(()=>{const r=document.getElementById('cards').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:bounds});
      fs.writeFileSync(`scratch/card-layout-qa/master-${width}.png`,Buffer.from(shot.data,'base64'));
    }
    await evaluate("while(!document.getElementById('showMore').classList.contains('hide'))document.getElementById('showMore').click()");
    assert.equal(await evaluate("document.querySelectorAll('#cards .card').length"),62);
    assert.equal(await evaluate("new Set([...document.querySelectorAll('.facility-entry')].map(r=>r.dataset.facilityId)).size"),67);
    await evaluate("document.querySelector('[data-detail=onsen-015]').click()");
    assert.equal(await evaluate("document.querySelector('#modalSubtitle .facility-name').textContent"),'鶴の湯温泉');
    assert.ok(await evaluate("document.getElementById('detailList').textContent.includes('最寄り駅')"));
    await evaluate("document.getElementById('detailStamp').click();document.querySelector('[data-delete-visit]').click();document.getElementById('modalClose').click()");
    assert.equal(await evaluate("!!document.querySelector('[data-facility-id=onsen-015] .conquered-badge')"),false);
    await evaluate("document.querySelector('[data-detail=onsen-016]').click()");
    assert.equal(await evaluate("document.querySelector('#modalSubtitle .facility-name').textContent"),'妙乃湯');
    fs.writeFileSync('scratch/card-layout-qa/results.json',JSON.stringify(results,null,2));
    ws.close();
  }finally{await browser.close();server.closeAllConnections();server.close();}
});
