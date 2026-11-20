// Probe: measure the first three Create card heights + button positions.
import http from "node:http";
const get = (p) =>
  new Promise((res, rej) =>
    http
      .get({ host: "127.0.0.1", port: 9222, path: p }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => res(JSON.parse(d)));
      })
      .on("error", rej),
  );
(async () => {
  const targets = await get("/json/list");
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const j = JSON.parse(ev.data);
    if (j.id && pending.has(j.id)) {
      pending.get(j.id)(j.result);
      pending.delete(j.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const m = ++id;
      pending.set(m, res);
      ws.send(JSON.stringify({ id: m, method, params }));
    });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: "http://127.0.0.1:8087/create" });
  await new Promise((r) => setTimeout(r, 5000));
  const expr =
    "[...document.querySelectorAll('section > ul.grid > li')].slice(0,3).map(el => { const b = el.getBoundingClientRect(); const btn = el.querySelector('a,button'); const bb = btn ? btn.getBoundingClientRect() : null; return { h: Math.round(b.height), btnBottom: bb ? Math.round(bb.bottom) : null, cardBottom: Math.round(b.bottom), display: getComputedStyle(el).display, alignSelf: getComputedStyle(el).alignSelf }; })";
  const r = await send("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
  });
  console.log(JSON.stringify(r.result.value, null, 1));
  const g = await send("Runtime.evaluate", {
    expression:
      "(() => { const grid = document.querySelector('section > ul.grid'); const cs = getComputedStyle(grid); return { display: cs.display, alignItems: cs.alignItems, cols: cs.gridTemplateColumns }; })()",
    returnByValue: true,
  });
  console.log(JSON.stringify(g.result.value));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
