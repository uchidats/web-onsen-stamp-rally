const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('Card font subsets cover all master labels, local WOFF2 assets and preserve licenses',()=>{
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),ctx);
  const rows=ctx.window.ONSEN_DATA,manifest=JSON.parse(fs.readFileSync('assets/fonts/manifest.json','utf8'));
  for(const family of manifest){
    const labels=family.family==='Shippori Mincho'?rows.map(x=>x.onsen).join(''):rows.map(x=>[x.prefecture,x.facility,x.category,x.springType].join('')).join('')+'制覇詳細 →Google Maps';
    for(const char of labels)assert.ok(family.text.includes(char),'Missing glyph '+char);
    for(const file of family.files){const bytes=fs.readFileSync('assets/fonts/'+file.file);assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert.equal(bytes.length,file.bytes);}
  }
  for(const id of ['shipporimincho','notosansjp'])assert.match(fs.readFileSync('assets/fonts/'+id+'-OFL.txt','utf8'),/SIL OPEN FONT LICENSE Version 1.1/);
  const css=fs.readFileSync('assets/fonts/cards.css','utf8');assert.ok(!css.includes('https://'));assert.match(css,/font-display: swap/);
});
