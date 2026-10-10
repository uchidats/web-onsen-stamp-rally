// Read-only network audit. Known OSM IDs only, one cached Nominatim lookup (<=50).
const fs=require('node:fs');const vm=require('node:vm');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),ctx);const data=ctx.window.ONSEN_DATA;
const dir='scratch/coordinate-audit';fs.mkdirSync(dir,{recursive:true});
const userAgent='OnsenCoordinateAudit/1.0 (https://github.com/uchidats/web-onsen-stamp-rally)';
async function main(){
  const entries=data.filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
  if(entries.length>50)throw Error('Nominatim lookup supports at most 50 IDs; split the audit deliberately with rate limiting.');
  const ids=entries.map(x=>{const m=x.coordinateSource.match(/\/(node|way|relation)\/(\d+)$/);if(!m)throw Error('Unsupported source: '+x.id);return m[1][0].toUpperCase()+m[2];});
  const url='https://nominatim.openstreetmap.org/lookup?osm_ids='+ids.join(',')+'&format=jsonv2&polygon_geojson=1&addressdetails=1&extratags=1&namedetails=1';
  const cache=dir+'/osm-lookup.json';let osm;
  if(fs.existsSync(cache)){osm=JSON.parse(fs.readFileSync(cache,'utf8'));}else{
    const r=await fetch(url,{headers:{'User-Agent':userAgent},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('OSM lookup HTTP '+r.status);
    osm={checkedAt:'2026-10-11',url,results:await r.json()};fs.writeFileSync(cache,JSON.stringify(osm,null,2)+'\n');
  }
  const source=JSON.parse(fs.readFileSync('assets/coordinates.json','utf8'));
  const officialCache=dir+'/address-fetch.json';let addressFetch=fs.existsSync(officialCache)?JSON.parse(fs.readFileSync(officialCache,'utf8')):{};
  for(const x of entries){
    if(addressFetch[x.id])continue;
    const row=source.rows.find(r=>r.id===x.id);const url=x.officialUrl||row.addressReference;
    try{
      const r=await fetch(url,{headers:{'User-Agent':userAgent},signal:AbortSignal.timeout(15000)});
      const buffer=Buffer.from(await r.arrayBuffer());let html=buffer.toString('utf8');const charset=html.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
      if(charset&&/shift|sjis|euc/i.test(charset))html=new TextDecoder(charset).decode(buffer);
      const text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
      const snippets=[...text.matchAll(/.{0,15}(?:〒\s*\d{3}[－-]?\d{4}|(?:北海道|青森県|岩手県|秋田県|宮城県|山形県|福島県|栃木県|群馬県|長野県|新潟県|富山県)).{0,100}/g)].map(m=>m[0]);
      addressFetch[x.id]={url,finalUrl:r.url,status:r.status,charset:charset||'utf-8',addressSnippets:snippets.slice(-8)};
    }catch(e){addressFetch[x.id]={url,error:e.message};}
    fs.writeFileSync(officialCache,JSON.stringify(addressFetch,null,2)+'\n');
    console.log(x.id,x.facility,addressFetch[x.id].status||addressFetch[x.id].error);
  }
  console.log('Audited',entries.length,'coordinate rows; returned OSM objects',osm.results.length);
}
main().catch(e=>{console.error(e);process.exitCode=1});
