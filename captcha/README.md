# captcha/

A captcha challenge-solving toolkit for any website that asks for a captcha:
reference code plus a working runner that completes (or bypasses) the
challenge and returns the page to a usable state. Point it at any page that
shows a captcha — the target is set with `CAPTCHA_URL`, not hard-coded.

The vendored files are third-party code, copied verbatim with their licences
and credits below. They are reference material and a runnable experiment —
not Bawa code, and not a claim that any particular site's challenge is solved.

## Running it

```sh
cd captcha
npm install
npm run check
# Env: CAPTCHA_URL, CAPTCHA_PROXY (empty = direct egress), CAPTCHA_TIMEOUT_MS
```

Set `CAPTCHA_URL` to any page that shows a captcha. It is required — the
runner has no default target and refuses to run without it. The TronScan
Approval tab (`https://tronscan.org/#/tokenapproval`) is the worked
example in the section below.

The runner is read-only: it only interacts with the captcha challenge
itself; it never submits forms or clicks page action buttons, and never
signs or sends a transaction. It writes
`run-captcha-check/captcha-result.json` +
`run-captcha-check/captcha-result.png`.

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

## Status and limits

The solvers only help when the site serves an interactive Turnstile
challenge. They cannot bypass a flat IP block page: when Cloudflare decides
on IP + fingerprint alone, no solver loop gets a challenge to solve. What
changes that outcome is a different egress IP (the trawl docs note
non-interactive solving wants a residential IP and a non-automation
fingerprint) or a human solving the challenge in a real browser.

## Worked example: TronScan Approval-tab check (audit pointer P22)

The runner was first run against the TronScan Approval tab
(`https://tronscan.org/#/tokenapproval`). It works as code: it launches
headless Chromium, installs the trawl capture hook, loads the page and runs
the challenge loop. It does **not** clear Cloudflare from this network.

Live runs (patchright 1.64.3, headless shell, proxy egress), both with the
same result (verified first-hand, 2026-11-17):

- 2026-11-17 09:26–09:28 UTC, 90 s challenge budget: block page, Ray ID
  `a5bdb1e51c6176d0`, egress IP `104.29.197.209`; solver loop ran its keyboard
  fallback 28 times, then timed out.
- 2026-11-17 09:41–09:42 UTC, 30 s challenge budget, from the final
  repo-layout runner: block page again, Ray ID `a5bdc791385669dc`, egress IP
  `104.29.194.190`; 10 keyboard attempts, then timed out.

Both runs: no `cf_clearance` cookie, no Approval-tab UI. The two different
egress IPs getting the same flat block page means it is not one bad IP — the
datacenter egress class is blocked. Evidence: the run's
`run-captcha-check/captcha-result.json` and
`run-captcha-check/captcha-result.png` (renamed from their original
`tronscan-result.*` names when the tool was generalised; the contents are
unchanged, the record of the 2026-11-17 TronScan run).

P22 stays blocked from here. Its live options remain: retry on
`tronscan.io`, or leave the rendered-UI finding UNVERIFIABLE.

## Contents

- `vendors/trawl/` — Cloudflare/Turnstile solvers from trawl (`dev` branch).
  `solvers/cloudflareCapture.ts`, `solvers/turnstile.ts`,
  `utils/challengeWait.ts`, plus the two utils the solvers import
  (`utils/detect.ts`, `utils/deadline.ts`) and `utils/anubis.ts` (imported by
  `detect.ts`). Needs `patchright` + `linkedom` at runtime (see
  `package.json`).
- `vendors/ytdlnis/` — WebView login + cookie export from YTDLnis (`main`).
  `ui/more/cookies/` (WebViewActivity, incognito variant, CookiesFragment),
  `database/viewmodel/CookieViewModel.kt`, `core/RuntimeManager.kt`,
  `core/packages/` (Python, NodeJS, Deno, QuickJS, FFmpeg, Aria2c, base),
  `assets/yt_dlp_plugins/` (yt-dlp postprocessor plugins).
- `vendors/super-video-downloader/` — WebView challenge handling from Super
  Video Downloader (`master`). `ui/main/home/browser/` (CustomWebViewClient,
  BrowserFragment, CustomWebChromeClient, `webTab/`), `ui/component/widget/`
  (NestedWebView), `util/CookieUtils.kt`.
- `run-captcha-check/` — the general runner (`test-captcha.ts`, dependencies in `package.json`)
  and the evidence from the 2026-11-17 TronScan worked example.
- `licenses/` — full licence texts for the vendored code.
- `guides/fuckcaptcha/` — field guides to 39 CAPTCHA types from FuckCaptcha (referred to as @fcukcaptcha) by @vsmutok (see the Field guides section below).

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

- **FuckCaptcha** (referred to as @fcukcaptcha) — https://github.com/vsmutok/FuckCaptcha (commit 410c4cab). Field guides to 39 CAPTCHA types, imported as documentation under `guides/fuckcaptcha/`. Licence: **CC0 1.0 Universal** (see `guides/fuckcaptcha/LICENSE`).

The three vendored codebases are copyleft licences. The vendored files keep their original
licence headers; the licence texts are reproduced in `licenses/`. Bawa itself
is MIT-licensed; this folder is third-party material kept separate
under its own licences, included on the owner's explicit instruction.

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

## Field guides: FuckCaptcha

`guides/fuckcaptcha/` holds the 39 Markdown guides from FuckCaptcha (referred to as @fcukcaptcha) by @vsmutok — one guide per CAPTCHA type, plus a solvers guide and a resources list. They are documentation only: no code from that project was imported. Licence: CC0 1.0 Universal (see `guides/fuckcaptcha/LICENSE`). The guides header images point at the upstream assets folder and do not render from this copy; see the README in `guides/fuckcaptcha/` for details.
