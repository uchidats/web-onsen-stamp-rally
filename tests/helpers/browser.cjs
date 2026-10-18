'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(Error('CDP websocket startup timeout')); }, 10000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(Error('CDP websocket failed: ' + url)); }, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  function rejectAll(reason) { for (const job of pending.values()) { clearTimeout(job.timer); job.reject(reason); } pending.clear(); }
  ws.addEventListener('close', () => rejectAll(Error('CDP connection closed')));
  ws.addEventListener('error', () => rejectAll(Error('CDP connection error')));
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data), job = pending.get(message.id);
    if (!job) return;
    clearTimeout(job.timer); pending.delete(message.id);
    if (message.error) job.reject(Error(job.method + ': ' + JSON.stringify(message.error)));
    else job.resolve(message.result);
  });
  function send(method, params = {}, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method + ' ' + JSON.stringify(params).slice(0, 200))); }, timeout);
      pending.set(id, { resolve, reject, timer, method });
      try { ws.send(JSON.stringify({ id, method, params })); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  return { ws, send, close: () => { rejectAll(Error('CDP client closed')); ws.close(); } };
}

async function startBrowser(executable, url) {
  // Every invocation owns a fresh profile and an OS-assigned CDP port. Guest mode
  // prevents Edge's OS sign-in dialog / policy extension welcome tabs taking focus.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'onsen-e2e-'));
  const child = spawn(executable, ['--headless=new', '--disable-gpu', '--guest',
    '--disable-extensions', '--disable-sync', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-allow-origins=*', url],
  { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '', spawnError, client, control, closing;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8000); });
  child.on('error', error => { spawnError = error; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  let port;
  async function close() {
    if (closing) return closing;
    closing = (async () => {
      // The socket and PID belong to this child only. Never kill a browser by image name.
      if (control) await control.send('Browser.close', {}, 2000).catch(() => {});
      client?.close();
      control?.close();
      if (child.exitCode === null && !spawnError) {
        await Promise.race([exited, delay(2000)]);
        if (child.exitCode === null) { child.kill(); await Promise.race([exited, delay(2000)]); }
      }
      child.stderr.destroy();
      // Keep profiles for diagnostics. Do not recursively delete temp directories here.
      if (process.env.ONSEN_E2E_TRACE) console.error(JSON.stringify({ event: 'browser-closed', pid: child.pid, port, profile, exitCode: child.exitCode }));
    })();
    return closing;
  }
  try {
    const deadline = Date.now() + 20000;
    let page;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw Error('Browser exited before CDP startup: ' + stderr);
      const activePort = path.join(profile, 'DevToolsActivePort');
      if (fs.existsSync(activePort)) port = Number(fs.readFileSync(activePort, 'utf8').split('\n')[0]);
      if (port) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(1000) });
          page = (await response.json()).find(p => p.type === 'page' && p.url === url);
          if (page) break;
        } catch {}
      }
      await delay(100);
    }
    if (!page) throw Error('Browser startup timeout: ' + JSON.stringify({ pid: child.pid, port, profile, stderr }));
    const version = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) })).json();
    control = await connect(version.webSocketDebuggerUrl);
    client = await connect(page.webSocketDebuggerUrl);
    await client.send('Page.bringToFront');
    const evaluate = async expression => {
      const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw Error('Runtime.evaluate: ' + JSON.stringify(result.exceptionDetails));
      return result.result?.value;
    };
    if (process.env.ONSEN_E2E_TRACE) console.error(JSON.stringify({ event: 'browser-ready', pid: child.pid, port, profile, url }));
    return { ws: client.ws, send: client.send, evaluate, close, pid: child.pid, port, profile };
  } catch (error) { await close(); throw error; }
}

module.exports = { startBrowser, connect, delay };
