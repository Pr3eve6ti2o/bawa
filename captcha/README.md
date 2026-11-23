# captcha/

Challenge-solving reference code plus a working runner that completes (or
bypasses) the captcha challenge on any website that asks for one. The
TronScan Approval-tab check (audit pointer P22) is the worked example. The vendored files are third-party
code, copied verbatim with their licences and credits below. They are
reference material and a runnable experiment — not Bawa code, and not a claim
that the check is solved.

## Status (verified first-hand, 2026-11-17)

The runner works as code: it launches headless Chromium, installs the trawl
capture hook, loads `https://tronscan.org/#/tokenapproval`, and runs the
challenge loop. It does **not** clear Cloudflare from this network.

Live runs (patchright 1.64.3, headless shell, proxy egress), both with the
same result:

- 2026-11-17 09:26–09:28 UTC, 90 s challenge budget: block page, Ray ID
  `a5bdb1e51c6176d0`, egress IP `104.29.197.209`; solver loop ran its keyboard
  fallback 28 times, then timed out.
- 2026-11-17 09:41–09:42 UTC, 30 s challenge budget, from the final
  repo-layout runner: block page again, Ray ID `a5bdc791385669dc`, egress IP
  `104.29.194.190`; 10 keyboard attempts, then timed out.

Both runs: no `cf_clearance` cookie, no Approval-tab UI. The two different
egress IPs getting the same flat block page means it is not one bad IP — the
datacenter egress class is blocked. Evidence: the latest run's
`run-captcha-check/tronscan-result.json` and
`run-captcha-check/tronscan-result.png` (kept under their original names as the record of the 2026-11-17 TronScan run).

What would change the outcome: a different egress IP (Cloudflare's decision
is IP + fingerprint based; the trawl docs note non-interactive solving wants
a residential IP and a non-automation fingerprint) or a human solving the
challenge in a real browser. The solvers only help when Cloudflare serves an
interactive Turnstile challenge; they cannot bypass a flat IP block page.

P22 stays blocked from here. Its live options remain: retry on
`tronscan.io`, or leave the rendered-UI finding UNVERIFIABLE.

## How it can work

Two approaches, from the two Android apps:

1. **Browser-automation solvers (trawl, TypeScript).** A real browser
   (patchright / Playwright fork + headless Chromium) loads the target page.
   `CloudflareCapture` hooks `window.turnstile.render` and captures the
   challenge parameters (sitekey, action, cData, page data) so a token can be
   produced and delivered back to the page callback. `challengeWait`
   (`waitForChallengeResolution`) polls the page title, clicks the Turnstile
   widget (shadow DOM, frame DOM, page coordinates, keyboard fallback) and
   watches for the `cf_clearance` cookie. `turnstile` (`solveTurnstile`)
   polls for the `cf-turnstile-response` token. This is what
   `run-captcha-check/` runs.
2. **WebView cookie reuse (YTDLnis / Super Video Downloader, Android).**
   A human logs in / solves the challenge inside the app's WebView
   (`WebViewActivity`), the app reads the WebView cookie store
   (`CookieViewModel`) and exports the cookies, and the downloader reuses
   them in its own HTTP requests (`CookieUtils`). Same idea in a desktop
   browser: solve once as a human, keep the `cf_clearance` cookie, reuse the
   session. These files are Android-only and cannot run here; they are kept
   as the reference implementation of the technique.

## Contents

- `vendors/trawl/` — Cloudflare/Turnstile solvers from trawl (`dev` branch).
  `solvers/cloudflareCapture.ts`, `solvers/turnstile.ts`,
  `utils/challengeWait.ts`, plus the two utils the solvers import
  (`utils/detect.ts`, `utils/deadline.ts`) and `utils/anubis.ts` (imported by
  `detect.ts`). Needs `patchright` + `linkedom` at runtime (see
  `run-captcha-check/package.json`).
- `vendors/ytdlnis/` — WebView login + cookie export from YTDLnis (`main`).
  `ui/more/cookies/` (WebViewActivity, incognito variant, CookiesFragment),
  `database/viewmodel/CookieViewModel.kt`, `core/RuntimeManager.kt`,
  `core/packages/` (Python, NodeJS, Deno, QuickJS, FFmpeg, Aria2c, base),
  `assets/yt_dlp_plugins/` (yt-dlp postprocessor plugins).
- `vendors/super-video-downloader/` — WebView challenge handling from Super
  Video Downloader (`master`). `ui/main/home/browser/` (CustomWebViewClient,
  BrowserFragment, CustomWebChromeClient, `webTab/`), `ui/component/widget/`
  (NestedWebView), `util/CookieUtils.kt`.
- `run-captcha-check/` — the general runner (`test-captcha.ts`, `package.json`)
  and the evidence from the 2026-11-17 TronScan live run.
- `licenses/` — full licence texts for the vendored code.

## Credits

- **trawl** — https://github.com/germondai/trawl (`dev` branch,
  `packages/tiers/src/solvers/` + `packages/tiers/src/utils/`).
  Licence: **GNU Affero General Public Licence v3.0** (see
  `licenses/AGPL-3.0-TRAWL.txt`).
- **YTDLnis** — https://github.com/deniscerri/ytdlnis (`main` branch).
  Licence: **GNU General Public Licence v3.0** (see
  `licenses/GPL-3.0-YTDLNIS.txt`).
- **Super Video Downloader** — https://github.com/alexch33/super-video-downloader
  (`master` branch). Licence: **GNU General Public Licence v3.0** (see
  `licenses/GPL-3.0-SVD.txt`).

All three are copyleft licences. The vendored files keep their original
licence headers; the licence texts are reproduced in `licenses/`. Bawa itself
is MIT-licensed; this folder is third-party copyleft code kept separate
under its own licences, included on the owner's explicit instruction.

## Running the check

```sh
cd captcha
npm install
npm run check
# Env: CAPTCHA_URL, CAPTCHA_PROXY (empty = direct egress), CAPTCHA_TIMEOUT_MS
```

The check is read-only: it never connects a wallet, never clicks
Cancel/Revoke, and never signs or sends a transaction. It writes
`run-captcha-check/captcha-result.json` +
`run-captcha-check/captcha-result.png`.

## Notes and limits

- The SVD and YTDLnis files are fragments of their apps: they import their
  own ViewModels, resources, database entities and helper classes
  (e.g. `WebTabFragment` alone has 35 own-app imports) and do not compile
  standalone. They are reference code, not a drop-in module.
- Bawa `main` has no Android app, so there is nothing here to wire the
  Kotlin files into. The runnable part of this folder is the TypeScript
  runner only.
- The first YTDLnis location given (`deniscerri/ytdl`) does not exist
  (404); the correct repo is `deniscerri/ytdlnis`.
