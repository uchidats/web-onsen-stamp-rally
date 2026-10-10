const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
require('../records.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),ctx);
const data=ctx.window.ONSEN_DATA,app=fs.readFileSync('app.js','utf8');
assert.equal(data.length,67);
assert.deepEqual(Array.from(data,x=>x.id),Array.from({length:67},(_,i)=>'onsen-'+String(i+1).padStart(3,'0')));
for(const x of data){assert.equal(typeof x.officialUrl,'string');if(x.officialUrl){const u=new URL(x.officialUrl);assert.ok(['http:','https:'].includes(u.protocol));assert.equal(u.username,'');assert.equal(u.password,'')}}
function render(rows){const elements=new Map(),saved=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',style:{},innerHTML:'',textContent:'',dataset:{},classList:{toggle(){}},querySelectorAll:()=>[],addEventListener(){}});return elements.get(id)};
  vm.runInNewContext(app,{URL,window:{ONSEN_DATA:rows,OnsenRecords:globalThis.OnsenRecords},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},setTimeout:()=>0,clearTimeout(){}});
  for(let i=0;i<4;i++)el('showMore').onclick();return el('cards').innerHTML;
}
const html=render(data);
assert.equal((html.match(/class="facility-link"/g)||[]).length,data.filter(x=>x.officialUrl).length);
assert.equal((html.match(/data-detail=/g)||[]).length,67);
assert.equal((html.match(/data-visit=/g)||[]).length,67);
assert.equal((html.match(/<h3>/g)||[]).length,67);
assert.ok(!/<h3>\s*<a/.test(html));
for(const x of data){if(x.officialUrl){assert.ok(html.includes('href="'+x.officialUrl+'" target="_blank" rel="noopener noreferrer"'));}else{assert.ok(html.includes('<span class="facility-name">'+x.facility+'</span>'))}}
assert.equal((html.match(/class="map-link"/g)||[]).length,67);
assert.equal((html.match(/role="tooltip"/g)||[]).length,67);
assert.equal((html.match(/>公式<\/a>/g)||[]).length,data.filter(x=>x.officialUrl).length);
for(const x of data){assert.ok(html.includes('href="'+x.mapUrl.replaceAll('&','&amp;')+'"'));assert.ok(html.includes('aria-describedby="card-map-'+x.id+'"'))}
assert.ok(html.includes('aria-hidden="true" focusable="false"'));
assert.ok(!render([{...data[0],mapUrl:'javascript:alert(1)'}]).includes('class="map-link"'));
const invalid=['',null,undefined,42,'javascript:alert(1)','data:text/html,test','ftp://example.com/','//example.com','/relative','https://','https://user:password@example.com/','httpx://example.com/'];
for(const officialUrl of invalid){const s=render([{...data[0],officialUrl}]);assert.ok(!s.includes('class="facility-link"'),String(officialUrl));assert.ok(s.includes('<span class="facility-name">'+data[0].facility+'</span>'))}
for(const officialUrl of ['http://example.com/','https://example.com/','HTTPS://example.com/',' https://example.com/ '])assert.ok(render([{...data[0],officialUrl}]).includes('class="facility-link"'));
const escaped=render([{...data[0],facility:'宿"<&>',officialUrl:'https://example.com/?q="&x=1'}]);
assert.ok(escaped.includes('宿&quot;&lt;&amp;&gt;'));
assert.ok(escaped.includes('href="https://example.com/?q=%22&amp;x=1"'));
console.log('PASS: all 67 IDs, official/empty links, http(s) allowlist, malformed/unsafe URLs, escaping, external-tab attributes, unchanged names/detail/visit controls');
