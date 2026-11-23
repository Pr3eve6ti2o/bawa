// General captcha challenge-solving runner: completes (or bypasses) the captcha
// challenge on any website that asks for one (Cloudflare Turnstile and similar),
// using the vendored trawl Cloudflare solvers (../vendors/trawl/...) under patchright
// (a Playwright fork) + headless Chromium. It is read-only: it only interacts
// with the captcha challenge itself, never submits forms or clicks page action
// buttons, and never signs or sends a transaction.
//
// Run from captcha/:  npm install && npm run check
// Env:  CAPTCHA_URL     (required — the page that shows the captcha challenge;
//                     no default; the runner refuses to run without it)
//       CAPTCHA_PROXY   (default http://127.0.0.1:3129; empty = direct egress)
//       CAPTCHA_TIMEOUT_MS (challenge wait budget, default 90000)
//
// Writes captcha-result.json + captcha-result.png next to this file.
// Exit 0 = ran to completion (outcome is in the JSON, not the exit code);
// exit 1 = CAPTCHA_URL is not set;
// exit 2 = the browser never reached the target (network failure, no challenge seen).

import { chromium } from "patchright";
import { CloudflareCapture } from "../vendors/trawl/packages/tiers/src/solvers/cloudflareCapture";
import { waitForChallengeResolution } from "../vendors/trawl/packages/tiers/src/utils/challengeWait";
import { solveTurnstile } from "../vendors/trawl/packages/tiers/src/solvers/turnstile";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Results go next to this script, wherever the command is run from.
const OUT_DIR = fileURLToPath(new URL(".", import.meta.url));

const TARGET = process.env.CAPTCHA_URL;
if (!TARGET) {
  console.error(
    "CAPTCHA_URL is not set. Set CAPTCHA_URL to the page that shows the captcha challenge, e.g. CAPTCHA_URL=https://example.com/page-with-captcha npm run check",
  );
  process.exit(1);
}
const PROXY = process.env.CAPTCHA_PROXY ?? "http://127.0.0.1:3129";
const TIMEOUT_MS = Number(process.env.CAPTCHA_TIMEOUT_MS ?? 90000);
const START = new Date().toISOString();
const log = (...a: unknown[]) => console.log(`[${new Date().toISOString()}]`, ...a);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  log("browser launched");
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ...(PROXY ? { proxy: { server: PROXY } } : {}),
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const capture = new CloudflareCapture();
    await capture.install(page);
    log("capture installed, goto", TARGET);
    await page
      .goto(TARGET, { waitUntil: "domcontentloaded", timeout: 60000 })
      .catch((e) => log("goto error:", String(e).slice(0, 200)));
    if (!page.url().startsWith(new URL(TARGET).origin)) {
      log(
        "NETWORK FAILURE: page did not reach target, url=",
        page.url(),
        "- aborting before solver runs (no challenge was observed)",
      );
      fs.writeFileSync(
        path.join(OUT_DIR, "captcha-result.json"),
        JSON.stringify(
          {
            started: START,
            finished: new Date().toISOString(),
            outcome: "network-failed",
            title: await page.title().catch(() => "?"),
            url: page.url(),
            cfClearance: false,
          },
          null,
          2,
        ),
      );
      process.exitCode = 2;
      return;
    }
    log("after goto: title=", JSON.stringify(await page.title().catch(() => "?")), "url=", page.url());
    const outcome = await waitForChallengeResolution(page, TIMEOUT_MS, TARGET);
    log("waitForChallengeResolution ->", outcome);
    const cookies = await context.cookies().catch(() => []);
    const clearance = cookies.find((c) => c.name === "cf_clearance");
    log("cf_clearance present:", !!clearance, clearance ? `domain=${clearance.domain}` : "");
    log("now: title=", JSON.stringify(await page.title().catch(() => "?")), "url=", page.url());
    if (outcome !== "ok") {
      const solved = await solveTurnstile(page, 30000).catch(() => false);
      log("solveTurnstile ->", solved);
      log("after turnstile: title=", JSON.stringify(await page.title().catch(() => "?")), "url=", page.url());
    }
    await page
      .screenshot({ path: path.join(OUT_DIR, "captcha-result.png"), fullPage: false })
      .catch((e) => log("screenshot error:", String(e).slice(0, 200)));
    fs.writeFileSync(
      path.join(OUT_DIR, "captcha-result.json"),
      JSON.stringify(
        {
          started: START,
          finished: new Date().toISOString(),
          outcome,
          title: await page.title().catch(() => "?"),
          url: page.url(),
          cfClearance: !!clearance,
        },
        null,
        2,
      ),
    );
    log("done. result written to captcha-result.json + captcha-result.png");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
