const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

(async () => {
  const url = pathToFileURL(path.resolve('index.html')).href;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-header-'));
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
    '--remote-debugging-port=9226', '--remote-allow-origins=*', url
  ], { stdio: 'ignore' });
  let ws;
  try {
    await new Promise(r => setTimeout(r, 1500));
    const pages = await (await fetch('http://localhost:9226/json')).json();
    ws = new WebSocket(pages.find(p => p.url === url).webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let sequence = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const listener = event => {
        const message = JSON.parse(event.data);
        if (message.id !== id) return;
        ws.removeEventListener('message', listener);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      };
      ws.addEventListener('message', listener);
      ws.send(JSON.stringify({id, method, params}));
    });
    const evaluate = async expression => (await send('Runtime.evaluate', {expression, returnByValue:true})).result.value;
    fs.mkdirSync('scratch/header-screenshots', {recursive:true});
    for (const width of [1440, 1280, 768, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', {width, height:1000, deviceScaleFactor:1, mobile:width <= 390});
      await new Promise(r => setTimeout(r, 150));
      const result = await evaluate(`(() => {
        const logo = document.querySelector('.logo');
        const english = logo.querySelector('small');
        const button = document.getElementById('loginBtn');
        const rect = logo.getBoundingClientRect();
        const br = button.getBoundingClientRect();
        const styles = getComputedStyle(logo);
        const top = document.querySelector('.top').getBoundingClientRect();
        const actionsTop = document.querySelector('.hero-actions').getBoundingClientRect().top;
        const baseline = document.createElement('style');
        baseline.textContent = '.top{gap:20px}.logo{font-size:19px;letter-spacing:.1em;line-height:1.5}.logo small{font-size:10px;letter-spacing:.2em;line-height:1.5;margin-top:7px}@media(max-width:600px){.logo{font-size:17px}.logo small{font-size:9px}}';
        document.head.append(baseline);
        const originalActionsTop = document.querySelector('.hero-actions').getBoundingClientRect().top;
        baseline.remove();
        return { width:innerWidth, japaneseSize:styles.fontSize, englishSize:getComputedStyle(english).fontSize,
          overflow:document.documentElement.scrollWidth > innerWidth,
          sameRow:Math.abs(rect.top + rect.height/2 - br.top - br.height/2) < 1,
          separated:rect.right <= br.left,
          headerHeight:top.height, buttonShift:actionsTop - originalActionsTop };
      })()`);
      if (result.overflow || !result.sameRow || !result.separated || Math.abs(result.buttonShift) > 12) throw new Error(JSON.stringify(result));
      console.log(JSON.stringify(result));
      const screenshot = await send('Page.captureScreenshot', {format:'png'});
      fs.writeFileSync(`scratch/header-screenshots/header-${width}.png`, Buffer.from(screenshot.data,'base64'));
    }
  } finally {
    ws?.close();
    edge.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
