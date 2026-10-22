const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
require('../records.js');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync('data.js','utf8'),ctx);
vm.runInNewContext(fs.readFileSync('kakenagashi.js','utf8'),ctx);
const data=ctx.window.ONSEN_DATA,code=fs.readFileSync('app.js','utf8');
const chi=x=>['現・旧','現（新規）','旧（掲載終了）'].includes(x.category);
const kake=x=>!!ctx.window.ONSEN_KAKENAGASHI[x.id];
const gensei=x=>ctx.window.ONSEN_GENSEI.certifiedBaths(ctx.window.ONSEN_KAKENAGASHI[x.id]||null).length>0;
function boot(ids=[],rows=data){
  const saved=new Map(),storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},repo=OnsenRecords.create(storage);
  let state=repo.load();for(const id of ids)state=repo.setVisited(state,id,true);
  const els=new Map(),el=id=>{if(!els.has(id))els.set(id,{value:'',style:{},innerHTML:'',textContent:'',dataset:{},hidden:false,classList:{toggle(){}},querySelectorAll:()=>[],addEventListener(){}});return els.get(id)};
  const window={ONSEN_DATA:rows,OnsenRecords,ONSEN_KAKENAGASHI:ctx.window.ONSEN_KAKENAGASHI,ONSEN_GENSEI:ctx.window.ONSEN_GENSEI};
  const start=()=>vm.runInNewContext(code,{URL,window,document:{getElementById:el,querySelectorAll:()=>[],addEventListener(){}},localStorage:storage,setTimeout:()=>0,clearTimeout(){}});
  start();return {el,start,saved,host:window.OnsenHost};
}

function check(ui,scope,done,total){
  const p=total?Math.round(done/total*1000)/10:0;
  assert.equal(ui.el(scope==='all'?'totalText':`progress-${scope}-count`).textContent,`${done} / ${total} 施設`);
  assert.equal(ui.el(scope==='all'?'totalPercent':`progress-${scope}-percent`).textContent,p.toFixed(1)+'%');
  assert.equal(ui.el(`progress-${scope}-ring`).style.strokeDashoffset,String(100-p));
  assert.equal(ui.el(`progress-${scope}-ring`).style.visibility,p?'visible':'hidden');
}
test('Achievement scopes count facility IDs, retired listings, kakenagashi, and gensei scopes',()=>{
  const all=data.map(x=>x.id),chiRows=data.filter(chi),kakeRows=data.filter(kake),genseiRows=data.filter(gensei);
  assert.equal(chiRows.length,43);
  assert.equal(kakeRows.length,52);
  assert.equal(genseiRows.length,7);
  for(const ids of [[],all.slice(0,17),all,chiRows.map(x=>x.id),genseiRows.map(x=>x.id),['onsen-015'],['onsen-015','onsen-016']]){
    const ui=boot(ids);
    for(const [scope,rows] of [['all',data],['chi',chiRows],['kake',kakeRows],['gensei',genseiRows]]){
      check(ui,scope,rows.filter(x=>ids.includes(x.id)).length,rows.length);
    }
    const stored=JSON.stringify([...ui.saved]);ui.el('search').value='乳頭温泉郷';ui.el('prefSelect').value='秋田県';
    ui.host.setState(ui.host.getState());
    assert.equal(ui.el('search').value,'乳頭温泉郷');assert.equal(ui.el('prefSelect').value,'秋田県');assert.equal(JSON.stringify([...ui.saved]),stored);
  }
});

test('Denominators follow the supplied dataset, including no facilities and no confirmed targets',()=>{
  for(const rows of [[],data.slice(0,3),data.filter(x=>!chi(x)&&!kake(x)&&!gensei(x))]){
    const ui=boot(rows.map(x=>x.id),rows);
    for(const [scope,predicate] of [['all',()=>true],['chi',chi],['kake',kake],['gensei',gensei]]){
      const total=rows.filter(predicate).length;check(ui,scope,total,total);
    }
  }
});

test('Repeated visits and multiple certified baths count once; add/delete/restore/sync re-render all rings',()=>{
  const x=data.find(x=>gensei(x)&&ctx.window.ONSEN_GENSEI.certifiedBaths(ctx.window.ONSEN_KAKENAGASHI[x.id]).length>1);
  assert.ok(x,'Fixture has several certified baths');
  const ui=boot([], [x]),{store}=ui.host;
  const checkAll=done=>{for(const scope of ['all','chi','kake','gensei']){const total=scope==='chi'&&!chi(x)?0:1;check(ui,scope,total?done:0,total)}};
  let state=store.addVisit(ui.host.getState(),x.id,'2026-10-01');
  state=store.addVisit(state,x.id,'2026-10-02');ui.host.setState(state);
  checkAll(1);
  const backup=store.backup(state);
  state=store.deleteVisit(state,x.id,state.userData.visits[x.id].records[0].id);ui.host.setState(state);check(ui,'all',1,1);
  state=store.deleteVisit(state,x.id,state.userData.visits[x.id].records[0].id);ui.host.setState(state);
  checkAll(0);
  state=store.replace(store.prepareImport(backup,state),state,true);ui.host.setState(state);
  checkAll(1);
  // The existing cloud-sync integration calls this same host setter.
  ui.host.setState(store.empty());checkAll(0);
  ui.host.setState(state);checkAll(1);
});
