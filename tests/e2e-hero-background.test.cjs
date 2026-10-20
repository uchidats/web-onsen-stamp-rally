const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

test('All five hero backgrounds fit three widths, preserve layout and contrast, and fail to green', async t => {
  const server = http.createServer((req, res) => {
    const file = path.resolve('.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(process.cwd() + path.sep)) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await require('./helpers/browser.cjs').startBrowser('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', url);
  t.after(() => browser.close());
  const { send, evaluate } = browser;
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-hero-qa-'));
  const wait = async expr => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expr)) return;
      await new Promise(r => setTimeout(r, 50));
    }
    assert.fail('Timed out: ' + expr);
  };
  const navigate = async suffix => {
    await send('Page.navigate', { url: url + suffix });
    await wait("document.readyState==='complete' && !!window.OnsenHeroBackground && document.querySelectorAll('#cards .card').length>0");
    await evaluate('document.fonts.ready');
    // Use one existing copy for comparable screenshots; production copy logic is untouched.
    await evaluate("document.getElementById('heroCopy').innerHTML='<span>温泉に浸かる。</span><span>それだけでいい。</span>'");
  };
  const imageReady = "new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(true);i.onerror=()=>resolve(false);i.src='assets/hero-onsen-bg.webp'})";
  const layout = () => evaluate("(()=>{const selectors=['.hero','.logo','#heroCopy','.hero-main > p','.hero-actions'];return {overflow:document.documentElement.scrollWidth>innerWidth,boxes:selectors.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]})}})()");
  for (const width of [1280, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 400 });
    const shots = [], results = [];
    let baseline;
    for (const pattern of ['mist', 'ridge', 'water', 'ryokan', 'lantern']) {
      await navigate('?hero-bg=' + pattern);
      assert.equal(await evaluate(imageReady), true);
      assert.equal(await evaluate('document.documentElement.dataset.heroBackground'), pattern);
      const current = await layout();
      assert.equal(current.overflow, false);
      if (!baseline) baseline = current;
      assert.deepEqual(current, baseline, 'Cropping must never change hero layout');
      const fixed = await evaluate('JSON.stringify(localStorage)');
      const height = Math.ceil(current.boxes[0][3]);
      const screenshot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
      fs.writeFileSync(path.join(output, `${width}-${pattern}.png`), Buffer.from(screenshot.data, 'base64'));
      shots.push(screenshot.data);
      // Sample the rendered background behind the text, without the text itself.
      const text = await evaluate(`['#heroCopy span','.hero-main > p','.hero-actions .outline','.hero-main > .eyebrow','.logo small','.beta-badge-header'].flatMap(s=>[...document.querySelectorAll(s)].map(e=>{const range=document.createRange();range.selectNodeContents(e);const r=range.getBoundingClientRect();return {selector:s,color:getComputedStyle(e).color,x:r.x,y:r.y,width:r.width,height:r.height}}))`);
      await evaluate("document.querySelector('.hero > .wrap').style.visibility='hidden'");
      const background = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
      const contrast = await evaluate(`new Promise(resolve=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,j)=>s+v*[.2126,.7152,.0722][j],0);resolve(${JSON.stringify(text)}.map(t=>{const fg=lum(t.color.match(/[0-9.]+/g).slice(0,3).map(Number));let min=100;for(let y=Math.max(0,Math.ceil(t.y));y<Math.min(c.height,t.y+t.height);y+=3)for(let x=Math.max(0,Math.ceil(t.x));x<Math.min(c.width,t.x+t.width);x+=3){const k=(y*c.width+x)*4,bg=lum([...pixels.slice(k,k+3)]);min=Math.min(min,(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05))}return {selector:t.selector,min}}))};i.src='data:image/png;base64,${background.data}'})`);
      await evaluate("document.querySelector('.hero > .wrap').style.visibility=''");
      for (const result of contrast) assert.ok(result.min >= (result.selector === '#heroCopy span' ? 3 : 4.5), JSON.stringify({ width, pattern, ...result }));
      assert.equal(await evaluate('document.documentElement.dataset.heroBackground'), pattern, 'No automatic switching');
      assert.equal(await evaluate('JSON.stringify(localStorage)'), fixed);
      results.push({ pattern, contrast });
    }
    const sheet = await evaluate(`(async()=>{const sources=${JSON.stringify(shots)};const images=await Promise.all(sources.map(s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s})));const c=document.createElement('canvas'),w=${width === 1280 ? 384 : 260},h=Math.ceil(images[0].height*w/images[0].width);c.width=w*5;c.height=h;const ctx=c.getContext('2d');images.forEach((i,n)=>ctx.drawImage(i,n*w,0,w,h));return c.toDataURL('image/png').split(',')[1]})()`);
    fs.writeFileSync(path.join(output, `all-${width}.png`), Buffer.from(sheet, 'base64'));
    fs.writeFileSync(path.join(output, `results-${width}.json`), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ width, patterns: results.length, minimumContrast: Math.min(...results.flatMap(r => r.contrast.map(c => c.min))), screenshots: output }));
  }
  await send('Network.setBlockedURLs', { urls: ['https://*', '*hero-onsen-bg.webp*'] });
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await navigate('?hero-bg=lantern');
  assert.equal(await evaluate(imageReady), false);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.hero')).backgroundImage"), 'linear-gradient(120deg, rgb(25, 46, 41) 10%, rgb(41, 61, 51) 65%, rgb(53, 72, 59))');
  fs.writeFileSync(path.join(output, 'fallback.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await navigate('');
  assert.equal(await evaluate('OnsenHeroBackground.PATTERNS.includes(document.documentElement.dataset.heroBackground)'), true);
});
