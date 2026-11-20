// Headless-Chromium layout + load check via CDP (Node 22 global WebSocket).
// Chrome must already run headless with --remote-debugging-port=<port>.
// Usage: node cdp-check.mjs --url <url> --width <w> --height <h>
//   --shot <png-path> --out <json-path> [--cdp-port 9222] [--wait-ms 4000]
import fs from 'node:fs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => {
    if (!a.startsWith('--')) return [];
    const key = a.slice(2);
    const val = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true';
    return [key, val];
  }),
);

const url = args.url;
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const shotPath = args.shot || 'shot.png';
const outPath = args.out || 'cdp.json';
const cdpPort = Number(args['cdp-port'] || 9222);
const waitMs = Number(args['wait-ms'] || 4000);
const seedVault = args.vault === 'true';
const clickMore = args['click-more'] === 'true';
if (!url) throw new Error('missing --url');

const putRes = await fetch(
  `http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`,
  { method: 'PUT' },
);
const target = await putRes.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
const network = new Map();
const consoleErrors = [];
const exceptions = [];

function send(method, params = {}) {
  return new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result || {});
    pending.delete(msg.id);
    return;
  }
  if (!msg.method) return;
  events.push(msg.method);
  if (msg.method === 'Network.responseReceived') {
    const r = msg.params.response;
    network.set(msg.params.requestId, {
      url: r.url,
      status: r.status,
      mime: r.mimeType,
      encoded: 0,
    });
  }
  if (msg.method === 'Network.loadingFinished') {
    const e = network.get(msg.params.requestId);
    if (e) e.encoded = msg.params.encodedDataLength;
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    exceptions.push(
      msg.params.exceptionDetails.exception?.description ||
        msg.params.exceptionDetails.text ||
        'exception',
    );
  }
};

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: 1, mobile: width < 500,
});
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, waitMs));
if (seedVault) {
  // Same locked-vault fixture shape as the app tests: gives the locked
  // dashboard (hero + asset rows + activity) without creating a wallet.
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('bawa-vault', JSON.stringify({version:1,kdf:{name:'PBKDF2',hash:'SHA-256',iterations:600000,saltB64:'AAAAAAAAAAAAAAAAAAAAAA=='},ivB64:'AAAAAAAAAAAAAAAA',ciphertextB64:'AAAAAAAAAAAAAAAAAAAAAA==',profileIds:[]}))`,
  });
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, waitMs));
}
if (clickMore) {
  await send('Runtime.evaluate', {
    expression: `document.querySelector('button[aria-label="More"]')?.click(); 'clicked'`,
  });
  await new Promise((r) => setTimeout(r, 800));
}

const evalRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = Object.fromEntries(
      performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]),
    );
    const resources = performance.getEntriesByType('resource')
      .map((r) => ({ name: r.name.split('/').slice(-1)[0], kb: Math.round(r.transferSize / 1024), ms: Math.round(r.duration) }))
      .sort((a, b) => b.kb - a.kb).slice(0, 12);
    return JSON.stringify({
      title: document.title,
      url: location.href,
      bodyTextStart: (document.body.innerText || '').slice(0, 200),
      innerWidth, innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      hOverflow: document.documentElement.scrollWidth > innerWidth,
      sidebar: (() => { const a = document.querySelector('aside'); if (!a) return null; const r = a.getBoundingClientRect(); return { visible: getComputedStyle(a).display !== 'none', width: Math.round(r.width) }; })(),
      sidebarNav: (() => { const n = document.querySelector('aside nav[aria-label="Main navigation"]'); if (!n) return null; return { visible: getComputedStyle(n).display !== 'none' }; })(),
      bottomNav: (() => { const n = [...document.querySelectorAll('nav[aria-label="Main navigation"]')].find((el) => !el.closest('aside')); if (!n) return null; return { visible: getComputedStyle(n).display !== 'none' }; })(),
      hasText: {
        portfolio: (document.body.innerText || '').includes('Portfolio balance'),
        createTitle: !!document.querySelector('#create-title'),
        trackTitle: (document.body.innerText || '').includes('Track a transaction'),
        recentActivity: (document.body.innerText || '').includes('Recent activity'),
      },
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadEvent: nav ? Math.round(nav.loadEventEnd) : null,
      transferKB: nav ? Math.round(nav.transferSize / 1024) : null,
      paints, resources,
    });
  })()`,
  returnByValue: true,
});
const metrics = JSON.parse(evalRes.result.value);
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));

const netRows = [...network.values()]
  .filter((e) => e.encoded > 0)
  .sort((a, b) => b.encoded - a.encoded);
const totalNetworkKB = Math.round(netRows.reduce((s, e) => s + e.encoded, 0) / 1024);

const report = {
  url, width, height, ...metrics,
  networkRequests: netRows.length,
  totalNetworkKB,
  largestRequests: netRows.slice(0, 12).map((e) => ({
    url: e.url.split('/').slice(-1)[0], status: e.status, kb: Math.round(e.encoded / 1024),
  })),
  consoleErrors, exceptions,
  screenshot: shotPath,
};
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
process.exit(0);
