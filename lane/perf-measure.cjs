// Lane A (Performance) measurement harness — BEFORE numbers.
// Runs in headless Chromium (Playwright) against a locally served dist/.
// NEVER logs mnemonics, passwords or addresses: words are read inside the
// page and used to fill confirmation inputs without ever leaving the page.
// Disposable test password only; the wallet is thrown away with the profile.
const { chromium } = require('playwright-core');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8931';
const OUT = process.argv[3] || 'lane/perf-before.json';
const PASSWORD = 'PerfTest-9876!x';
const CHROME = '/home/boxd/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

async function settledCount(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    // Terminal per-row states: zero / unavailable / error / a native amount.
    const settled = (text.match(/Zero balance|Balance unavailable|Could not load balance/g) || []).length;
    const amounts = (text.match(/0 (BTC|ETH|TRX|TON)\b/g) || []).length;
    // Loading rows only (asset-row skeletons), not toaster live regions.
    const loading = document.querySelectorAll('section[aria-label="Assets"] li[role="status"]').length;
    return { settled: settled + amounts, loading };
  });
}

async function waitSettled(page, want, timeoutMs, label, t0) {
  const deadline = now() + timeoutMs;
  let last = { settled: 0, loading: 0 };
  while (now() < deadline) {
    last = await settledCount(page);
    if (last.settled >= want && last.loading === 0) return { ms: now() - t0, ...last };
    await sleep(250);
  }
  return { ms: now() - t0, timedOut: true, ...last, label };
}

(async () => {
  const out = { base: BASE, startedAt: new Date().toISOString(), steps: {}, requests: [], pbkdf2Ms: [] };
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const page = await context.newPage();
  const reqStart = new Map();
  page.on('request', (req) => reqStart.set(req.url(), now()));
  page.on('response', (res) => {
    const t0 = reqStart.get(res.url());
    if (t0 === undefined) return;
    const url = res.url();
    if (/mempool|publicnode|blockscout|trongrid|tronscan|toncenter|wallet-core|\.js|\.css/.test(url)) {
      out.requests.push({ url: url.slice(0, 120), status: res.status(), ms: now() - t0 });
    }
  });
  page.on('pageerror', (e) => { out.pageError = String(e).slice(0, 300); });

  // ---- (a) Initial load, no wallet ----
  let t0 = now();
  await page.goto(BASE + '/', { waitUntil: 'commit' });
  await page.waitForSelector('text=Bawa Web Wallet', { timeout: 30000 });
  const paint = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = {};
    for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime);
    const res = performance.getEntriesByType('resource').map((r) => ({
      name: r.name.split('/').slice(-1)[0], kb: Math.round(r.transferSize / 1024),
      ms: Math.round(r.duration), encodedKb: Math.round(r.encodedBodySize / 1024),
    })).filter((r) => /\.js$|\.css$|\.wasm$|\.woff/.test(r.name));
    return { domContentLoaded: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), paints, resources: res };
  });
  out.steps.initialLoad = { wallMs: now() - t0, ...paint };
  await page.waitForSelector('text=Create a wallet', { timeout: 30000 });
  out.steps.timeToInteractiveMs = now() - t0;

  // ---- (b1) Generate step: password -> phrase shown (includes WASM load) ----
  await page.goto(BASE + '/create-wallet', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#vault-password', { timeout: 30000 });
  await page.fill('#vault-password', PASSWORD);
  await page.fill('#vault-password-confirm', PASSWORD);
  t0 = now();
  await page.click('button[type="submit"]');
  // Step 2's 24-word list is the true completion signal: the text
  // "Write down your recovery phrase" also appears in the step overview
  // on step 1, so a text selector would match instantly and lie.
  await page.waitForSelector('ol[aria-label="Recovery phrase"]', { timeout: 60000 });
  out.steps.generateMs = now() - t0;
  const wasmRes = await page.evaluate(() => {
    const r = performance.getEntriesByType('resource').find((e) => e.name.includes('wallet-core.wasm'));
    return r ? { transferKb: Math.round(r.transferSize / 1024), durationMs: Math.round(r.duration) } : null;
  });
  out.steps.wasmResource = wasmRes;

  // ---- (b2) Confirm words, then confirm+create -> step 4 ----
  // Stash the phrase words on the page itself while step 2 is still
  // visible (the list unmounts in step 3). They never leave the page.
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('ol[aria-label="Recovery phrase"] li')];
    window.__perfWords = items.map((li) => li.textContent.replace(/^\d+\.\s*/, '').trim());
  });
  await page.click('text=I have written them down');
  // Step 3's confirm inputs are the true signal (its heading text also
  // appears in the step overview on earlier steps).
  await page.waitForSelector('input[id^="confirm-word-"]', { timeout: 15000 });
  // Fill the 3 confirmation inputs from the stashed words, inside the page.
  await page.evaluate(() => {
    const words = window.__perfWords || [];
    const labels = [...document.querySelectorAll('label')].filter((l) => /^Word \d+$/.test(l.textContent.trim()));
    labels.forEach((label) => {
      const n = parseInt(label.textContent.replace('Word ', ''), 10);
      const input = document.getElementById(label.getAttribute('for'));
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, words[n - 1]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    delete window.__perfWords;
  });
  t0 = now();
  await page.click('button[type="submit"]');
  try {
    await page.waitForSelector('text=Your wallet is ready', { timeout: 120000 });
  } catch (e) {
    const alert = await page.evaluate(() => {
      const el = document.querySelector('[role="alert"]');
      return el ? el.textContent : '(no alert shown)';
    });
    out.steps.confirmError = alert;
    out.steps.confirmToReadyMs = now() - t0;
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    throw new Error('step 4 never appeared; alert: ' + alert);
  }
  out.steps.confirmToReadyMs = now() - t0;
  const addrCount = await page.evaluate(() => document.querySelectorAll('code').length);
  out.steps.step4AddressBlocks = addrCount;

  // ---- (c1) Dashboard right after creation (client-side nav, no reload:
  // a reload would drop the in-memory unlock, so Home link only) ----
  t0 = now();
  await page.click('nav a[href="/"]');
  await page.waitForSelector('text=Portfolio balance', { timeout: 30000 });
  const c1 = await waitSettled(page, 4, 60000, 'dashboard-after-create', t0);
  out.steps.dashboardAfterCreate = c1;

  // ---- (c2) Reload with vault present (locked) -> /lock -> unlock -> settle ----
  t0 = now();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Vault locked', { timeout: 30000 }).catch(() => {});
  out.steps.reloadToLockedBoxMs = now() - t0;
  const unlockLink = await page.$('a[href="/lock"]');
  if (unlockLink) {
    await page.click('a[href="/lock"]');
    await page.waitForSelector('#lock-password', { timeout: 30000 });
    await page.fill('#lock-password', PASSWORD);
    t0 = now();
    await page.click('button[type="submit"]');
    await page.waitForSelector('text=Portfolio balance', { timeout: 120000 });
    out.steps.unlockToDashboardMs = now() - t0;
    t0 = now();
    const c2 = await waitSettled(page, 4, 60000, 'dashboard-after-unlock', t0);
    out.steps.dashboardAfterUnlock = c2;
  } else {
    out.steps.unlockToDashboardMs = null;
    out.steps.dashboardAfterUnlock = { skipped: 'no /lock link after reload' };
  }

  // ---- Standalone PBKDF2 600k cost (dummy password, app origin page) ----
  // Save the main measurements first so a probe failure cannot lose them.
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  const pb = await context.newPage();
  await pb.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 3; i++) {
    try {
      const ms = await pb.evaluate(async () => {
        const t = performance.now();
        const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('dummy-password-for-timing-only'), 'PBKDF2', false, ['deriveKey']);
        await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new Uint8Array(16), iterations: 600000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        return Math.round(performance.now() - t);
      });
      out.pbkdf2Ms.push(ms);
    } catch (e) {
      out.pbkdf2Ms.push(-1);
    }
  }
  // ---- Throttled run (Slow 4G: 1.6 Mbps down, 750 Kbps up, 150 ms RTT):
  // the owner's phone experience, not localhost. Fresh BROWSER (own
  // user-data dir) so no cache survives from the main run.
  try {
    await browser.close();
    const browser2 = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx2 = await browser2.newContext({ viewport: { width: 430, height: 932 } });
    const p2 = await ctx2.newPage();
    const cdp = await ctx2.newCDPSession(p2);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750 });
    let tt0 = now();
    await p2.goto(BASE + '/', { waitUntil: 'commit' });
    await p2.waitForSelector('text=Bawa Web Wallet', { timeout: 120000 });
    const tp = await p2.evaluate(() => {
      const paints = {};
      for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime);
      return paints;
    });
    const throttledLoad = { wallMs: now() - tt0, paints: tp };
    await p2.waitForSelector('text=Create a wallet', { timeout: 120000 });
    throttledLoad.timeToInteractiveMs = now() - tt0;
    await p2.goto(BASE + '/create-wallet', { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#vault-password', { timeout: 120000 });
    await p2.fill('#vault-password', PASSWORD);
    await p2.fill('#vault-password-confirm', PASSWORD);
    tt0 = now();
    await p2.click('button[type="submit"]');
    await p2.waitForSelector('ol[aria-label="Recovery phrase"]', { timeout: 180000 });
    throttledLoad.generateMs = now() - tt0;
    const twasm = await p2.evaluate(() => {
      const r = performance.getEntriesByType('resource').find((e) => e.name.includes('wallet-core.wasm'));
      return r ? { transferKb: Math.round(r.transferSize / 1024), durationMs: Math.round(r.duration) } : null;
    });
    throttledLoad.wasmResource = twasm;
    out.steps.throttledSlow4G = throttledLoad;
    await browser2.close();
  } catch (e) {
    out.steps.throttledSlow4G = { error: String(e && e.message).slice(0, 200) };
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.error('MEASURE FAILED: ' + (e && e.message)); process.exit(1); });
