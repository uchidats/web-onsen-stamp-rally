const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../records.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),ctx);
const data=ctx.window.ONSEN_DATA,app=fs.readFileSync('app.js','utf8');
assert.equal(data.length,67);
assert.deepEqual(Array.from(data,x=>x.id),Array.from({length:67},(_,i)=>'onsen-'+String(i+1).padStart(3,'0')));
for(const x of data){assert.equal(typeof x.officialUrl,'string');if(x.officialUrl){const u=new URL(x.officialUrl);assert.ok(['http:','https:'].includes(u.protocol));assert.equal(u.username,'');assert.equal(u.password,'')}}
function render(rows,filters={},visitedIds=[]){const elements=new Map(),saved=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',style:{},innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},querySelectorAll:()=>[],addEventListener(){}});return elements.get(id)};
  const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},repo=globalThis.OnsenRecords.create(storage);let state=repo.load();for(const id of visitedIds)state=repo.setVisited(state,id,true);
  vm.runInNewContext(app,{URL,window:{ONSEN_DATA:rows,OnsenRecords:globalThis.OnsenRecords},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},setTimeout:()=>0,clearTimeout(){}});
  for(const [id,value] of Object.entries(filters))el(id).value=value;
  for(let i=0;i<4;i++)el('showMore').onclick();return el('cards').innerHTML;
}
const html=render(data);
assert.ok(!html.includes('現・旧')&&!html.includes('現（新規）')&&!html.includes('旧（掲載終了）'));
assert.equal((html.match(/>地温泉<\/span>/g)||[]).length,34);
assert.equal((html.match(/>地温泉（掲載終了）<\/span>/g)||[]).length,9);
for(const filter of ['search','categorySelect']){
  assert.equal((render(data,{[filter]:'地温泉'}).match(/data-facility-id=/g)||[]).length,filter==='search'?43:34);
  assert.equal((render(data,{[filter]:'地温泉（掲載終了）'}).match(/data-facility-id=/g)||[]).length,9);
}
for(const [category,count] of [['現・旧',26],['現（新規）',8],['旧（掲載終了）',9]])assert.equal((render(data,{categorySelect:category}).match(/data-facility-id=/g)||[]).length,count);
assert.equal((html.match(/class="facility-name facility-name-link"/g)||[]).length,data.filter(x=>x.officialUrl).length);
assert.equal((html.match(/data-detail=/g)||[]).length,67);
assert.equal((html.match(/data-visit=/g)||[]).length,0);
assert.equal((html.match(/<h3>/g)||[]).length,62);
assert.ok(!/<h3>\s*<a/.test(html));
for(const x of data){if(x.officialUrl){assert.ok(html.includes('href="'+x.officialUrl+'" target="_blank" rel="noopener noreferrer"'));}else{assert.ok(html.includes('<span class="facility-name">'+x.facility+'</span>'))}}
assert.equal((html.match(/class="map-link"/g)||[]).length,67);
assert.equal((html.match(/role="tooltip"/g)||[]).length,67);
assert.equal((html.match(/>公式<\/a>/g)||[]).length,0);
for(const x of data){assert.ok(html.includes('href="'+x.mapUrl.replaceAll('&','&amp;')+'"'));assert.ok(html.includes('aria-describedby="card-map-'+x.id+'"'))}
assert.ok(html.includes('aria-hidden="true" focusable="false"'));
assert.ok(!render([{...data[0],mapUrl:'javascript:alert(1)'}]).includes('class="map-link"'));
const invalid=['',null,undefined,42,'javascript:alert(1)','data:text/html,test','ftp://example.com/','//example.com','/relative','https://','https://user:password@example.com/','httpx://example.com/'];
for(const officialUrl of invalid){const s=render([{...data[0],officialUrl}]);assert.ok(!s.includes('class="facility-name facility-name-link"'),String(officialUrl));assert.ok(s.includes('<span class="facility-name">'+data[0].facility+'</span>'))}
for(const officialUrl of ['http://example.com/','https://example.com/','HTTPS://example.com/',' https://example.com/ '])assert.ok(render([{...data[0],officialUrl}]).includes('class="facility-name facility-name-link"'));
for(const official of [false,true])for(const maps of [false,true]){
  const row={...data[0],officialUrl:official?'https://example.com/':'',mapUrl:maps?'https://maps.google.com/':''};
  const s=render([row]);
  assert.equal(s.includes('class="facility-name facility-name-link"'),official);
  assert.equal(s.includes('class="map-link"'),maps);
  assert.ok(!s.includes('>公式</a>'));
  assert.ok(!s.includes('class="facility-links"'));
}
const escaped=render([{...data[0],facility:'宿"<&>',officialUrl:'https://example.com/?q="&x=1'}]);
assert.ok(escaped.includes('宿&quot;&lt;&amp;&gt;'));
assert.ok(escaped.includes('href="https://example.com/?q=%22&amp;x=1"'));
console.log('PASS: all 67 IDs, official/empty links, http(s) allowlist, malformed/unsafe URLs, escaping, external-tab attributes, unchanged names/detail/visit controls');

const ids=[...html.matchAll(/data-facility-id="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,67);assert.deepEqual(ids,Array.from(data,x=>x.id));
for(const [group,a,b] of [['nyuto','onsen-015','onsen-016'],['takayu','onsen-034','onsen-035'],['okukinu','onsen-041','onsen-042'],['shima','onsen-048','onsen-049'],['kusatsu','onsen-050','onsen-051']]){
 const card=html.split('data-group="'+group+'"')[1].split('</article>')[0];assert.ok(card.includes(a)&&card.includes(b));
}
assert.ok(!html.includes('最寄り'));assert.ok(!html.includes('card-foot'));
assert.equal((render(data,{search:data[15].facility}).match(/data-facility-id=/g)||[]).length,1);
assert.equal((render(data,{search:data[14].onsen}).match(/data-facility-id=/g)||[]).length,2);
assert.equal((render(data,{prefSelect:data[14].prefecture}).match(/data-facility-id=/g)||[]).length,11);
assert.equal((render(data,{statusSelect:'visited'}).match(/data-facility-id=/g)||[]).length,0);
assert.equal((render(data,{statusSelect:'unvisited'}).match(/data-facility-id=/g)||[]).length,67);
assert.equal((render(data,{search:data[14].onsen,categorySelect:data[15].category}).match(/data-facility-id=/g)||[]).length,1);
assert.equal((render([{...data[0],onsen:data[14].onsen},data[14],data[15]]).match(/<h3>/g)||[]).length,2);
console.log('PASS: explicit five groups, 62 cards, all 67 unique facilities, facility-level search/prefecture/status/category and singleton fallback');
assert.equal(html.includes('conquered-badge'),false);
assert.equal(html.includes('facility-status'),false);
const conquered=render(data,{},['onsen-001','onsen-015']);
assert.equal((conquered.match(/class="conquered-badge"/g)||[]).length,2);
assert.ok(conquered.includes('<span class="conquered-badge">制覇</span>'));
assert.equal((render(data,{statusSelect:'visited'},['onsen-001','onsen-015']).match(/data-facility-id=/g)||[]).length,2);
assert.equal((render(data,{statusSelect:'unvisited'},['onsen-001','onsen-015']).match(/data-facility-id=/g)||[]).length,65);
console.log('PASS: conquered badges only on visited facilities, no old status text, independent visited/unvisited filters');
