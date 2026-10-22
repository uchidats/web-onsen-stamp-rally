// 施設カードの文字(温泉名=Shippori Mincho、都道府県・施設名・分類・泉質=Noto Sans JP)のローカルWOFF2サブセットを、
// 収録済みの字を減らさずに拡張する。施設を追加・変更したら再実行する(tests/card-fonts.test.cjs が字の不足を検出する)。
//   使い方: node scripts/update-card-name-font.cjs
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
// 各書体に必要な字(tests/card-fonts.test.cjs と同じ規則)
const labelsFor=(family,rows)=>family==='Shippori Mincho'
  ?rows.map(x=>x.onsen).join('')
  :rows.map(x=>[x.prefecture,x.facility,x.category,x.springType].join('')).join('')+'制覇詳細 →Google Maps';
const slug=family=>family.toLowerCase().replace(/\s+/g,'');
(async()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),context);
 const rows=context.window.ONSEN_DATA;
 const manifest=JSON.parse(fs.readFileSync('assets/fonts/manifest.json','utf8'));
 let css=fs.readFileSync('assets/fonts/cards.css','utf8'),changed=false;
 for(const entry of manifest){
  const text=[...new Set(entry.text+labelsFor(entry.family,rows))].join('');
  if(text===entry.text){console.log(entry.family+': glyph coverage is current');continue;}
  const url=new URL('https://fonts.googleapis.com/css2');url.searchParams.set('family',entry.family+':wght@'+entry.weights);url.searchParams.set('display','swap');url.searchParams.set('text',text);
  const response=await fetch(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(response.status);let fresh=await response.text();const files=[],downloads=[];
  for(const [i,source] of [...new Set([...fresh.matchAll(/url\(([^)]+)\)/g)].map(m=>m[1]))].entries()){
   if(new URL(source).hostname!=='fonts.gstatic.com')throw Error('Unexpected font source');
   const r=await fetch(source,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(r.status);
   const bytes=Buffer.from(await r.arrayBuffer()),file=slug(entry.family)+'-'+i+'.woff2';
   if(bytes.subarray(0,4).toString()!=='wOF2')throw Error('Expected WOFF2');
   downloads.push({file,bytes});files.push({file,bytes:bytes.length});fresh=fresh.split(source).join(file+'?v='+bytes.length);
  }
  if(!downloads.length)throw Error('No fonts returned');
  // この書体の @font-face だけを差し替える(他の書体はそのまま)
  const own=new RegExp("@font-face\\s*\\{[^}]*font-family:\\s*'"+entry.family+"';[^}]*\\}\\s*","g");
  css=css.replace(own,'').trimEnd()+'\n\n'+fresh;
  for(const {file,bytes} of downloads)fs.writeFileSync(path.join('assets/fonts',file),bytes);
  console.log(entry.family,{addedCharacters:text.length-entry.text.length,files});
  Object.assign(entry,{text,files,source:url.href});changed=true;
 }
 if(changed){fs.writeFileSync('assets/fonts/cards.css',css.trimEnd()+'\n');fs.writeFileSync('assets/fonts/manifest.json',JSON.stringify(manifest,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1});
