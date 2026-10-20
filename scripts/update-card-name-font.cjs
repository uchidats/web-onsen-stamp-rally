// Extend the local facility-name subset without dropping previously covered characters.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
(async()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('data.js','utf8'),context);
 const manifest=JSON.parse(fs.readFileSync('assets/fonts/manifest.json','utf8'));
 const entry=manifest.find(x=>x.family==='Noto Sans JP');
 const text=[...new Set(entry.text+context.window.ONSEN_DATA.map(x=>x.facility).join(''))].join('');
 if(text===entry.text){console.log('Facility name glyph coverage is current');return;}
 const url=new URL('https://fonts.googleapis.com/css2');url.searchParams.set('family',entry.family+':wght@'+entry.weights);url.searchParams.set('display','swap');url.searchParams.set('text',text);
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'},signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error(response.status);let css=await response.text();const files=[],downloads=[];
 for(const [i,source] of [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(m=>m[1]))].entries()){
  if(new URL(source).hostname!=='fonts.gstatic.com')throw Error('Unexpected font source');
  const r=await fetch(source,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(r.status);
  const bytes=Buffer.from(await r.arrayBuffer()),file='notosansjp-'+i+'.woff2';
  if(bytes.subarray(0,4).toString()!=='wOF2')throw Error('Expected WOFF2');
  downloads.push({file,bytes});files.push({file,bytes:bytes.length});css=css.split(source).join(file+'?v='+bytes.length);
 }
 if(!downloads.length)throw Error('No fonts returned');
 const oldCss=fs.readFileSync('assets/fonts/cards.css','utf8');
 const mincho=oldCss.replace(/@font-face\s*\{[^}]*font-family:\s*'Noto Sans JP';[^}]*\}/g,'').trimEnd();
 for(const {file,bytes} of downloads)fs.writeFileSync(path.join('assets/fonts',file),bytes);
 const addedCharacters=text.length-entry.text.length;
 Object.assign(entry,{text,files,source:url.href});
 fs.writeFileSync('assets/fonts/cards.css',mincho+'\n\n'+css);
 fs.writeFileSync('assets/fonts/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 console.log({addedCharacters,files});
})().catch(e=>{console.error(e);process.exitCode=1});
