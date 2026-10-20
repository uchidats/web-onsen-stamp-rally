const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
require('../records.js');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('data.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('kakenagashi.js','utf8'),ctx);
const data=ctx.window.ONSEN_DATA,code=fs.readFileSync('app.js','utf8');
const chi=x=>['現・旧','現（新規）','旧（掲載終了）'].includes(x.category);
const kake=x=>!!ctx.window.ONSEN_KAKENAGASHI[x.id];
const gensei=x=>ctx.window.ONSEN_GENSEI.certifiedBaths(ctx.window.ONSEN_KAKENAGASHI[x.id]||null).length>0;
function boot(ids=[]){
  const saved=new Map(),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},repo=OnsenRecords.create(storage);
  let state=repo.load();for(const id of ids)state=repo.setVisited(state,id,true);
  const els=new Map(),el=id=>{if(!els.has(id))els.set(id,{value:'',style:{},innerHTML:'',textContent:'',dataset:{},hidden:false,classList:{toggle(){}},querySelectorAll:()=>[],addEventListener(){}});return els.get(id)};
  const start=()=>vm.runInNewContext(code,{URL,window:{ONSEN_DATA:data,OnsenRecords,ONSEN_KAKENAGASHI:ctx.window.ONSEN_KAKENAGASHI,ONSEN_GENSEI:ctx.window.ONSEN_GENSEI},document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},localStorage:storage,setTimeout:()=>0,clearTimeout(){}});
  start();return {el,start,saved};
}
test('Achievement scopes count facility IDs, retired listings, kakenagashi, and gensei scopes',()=>{
  const all=data.map(x=>x.id),chiRows=data.filter(chi),kakeRows=data.filter(kake),genseiRows=data.filter(gensei);
  assert.equal(chiRows.length,43);
  assert.equal(kakeRows.length,51);
  assert.equal(genseiRows.length,7);
  for(const ids of [[],all.slice(0,17),all,chiRows.map(x=>x.id),genseiRows.map(x=>x.id),['onsen-015'],['onsen-015','onsen-016']]){
    const {el,start,saved}=boot(ids);assert.equal(el('progressScope').value,'all');
    for(const [scope,rows] of [['all',data],['chi',chiRows],['kake',kakeRows],['gensei',genseiRows]]){
      const done=rows.filter(x=>ids.includes(x.id)).length,percent=Math.round(done/rows.length*1000)/10;
      const cards=el('cards').innerHTML,stored=JSON.stringify([...saved]);el('search').value='乳頭温泉郷';el('prefSelect').value='秋田県';el('progressScope').value=scope;el('progressScope').onchange();
      assert.equal(el('totalText').textContent,`${done} / ${rows.length} 施設を訪問済み`);
      assert.equal(el('totalBar').style.width,percent+'%');
      assert.equal(el('cards').innerHTML,cards);assert.equal(el('search').value,'乳頭温泉郷');assert.equal(el('prefSelect').value,'秋田県');assert.equal(JSON.stringify([...saved]),stored);
    }
    start();assert.equal(el('progressScope').value,'all');
  }
});
