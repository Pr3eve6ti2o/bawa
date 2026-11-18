# Fix Lane 2 — one-function prompt re-split (owner 500s rule, 2026-11-19 ~02:41 IST)

Every Sol prompt must complete in UNDER 500 seconds. The original lane prompts
(p2–p6, 284–300 words, whole adapter / whole screen) were too big: p1 failed
in 45s (no filesystem access) and p1b has run 42+ minutes with no output.
Each prompt below asks for ONE function in ONE file, with the exact acceptance
check. Body word counts are the prompt text itself (the `> STATUS` header is
lane bookkeeping, not prompt text).

STATUS: all of the work these prompts describe is ALREADY COMPLETE hands-on
and committed on branch `panel-rebuild/fix-adapters` (see commits). No split
prompt has been launched and none will be unless rework of that function is
ordered. If rework is ordered, launch the small prompt, never the original.

## Mapping

| Original | Split prompts (body words) | Status |
|---|---|---|
| p2 ETH adapter (299w) | p2a balance (137), p2b history (117), p2c fee (94), p2d broadcast stub (77) | Done hands-on, `d87139c` |
| p3 TRX adapter (284w) | p3a balance (149), p3b history (122), p3c fee (88), p3d broadcast stub (77) | Done hands-on, `d87139c` |
| p4 TON adapter (294w) | p4a balance (141), p4b history (121), p4c fee (87), p4d broadcast stub (77) | Done hands-on, `d87139c` |
| p5 BTC adapter (300w) | p5a balance+UTXO (148), p5b history (133), p5c fee (83), p5d broadcast stub (77) | Done hands-on, `d87139c` |
| p6 dashboard+asset-list (300w) | p6a AssetRows (140), p6b asset-list (114) | Done hands-on, `4e607c2` |
| p7 history (split 274w/283w) | p7a context-history, p7b screens-history (already one-piece splits) | Done hands-on, `48bc995` |
| p8 receive+scanner (264w/253w) | p8a receive, p8b qr-scanner (already one-piece splits) | Done hands-on, `fbc0b9a` |
| p9 capabilities+cleanup (181w/251w) | p9a capabilities, p9b cleanup (already one-piece splits) | Done hands-on, `faf68da` / `87c4ab2` |

The sub-100-word bodies (fee prompts, broadcast stubs) are proportionate: the
functions are 3–10 lines. Nothing here is near the 300-word cap.

## Further split if rework is ever ordered (not files, just the split)

- p7a (274w) → refreshBalances rewrite / refreshHistory / lock-reset — one each.
- p7b (283w) → asset-detail / transaction-history / transaction-detail — one each.
- p8a (264w) → address + QR display / amount payment-URI — one each.
- p9a (181w) → capability-status update only (already one piece; trim to ≤150w first).
- p9b (251w) → delete demo-fixtures + imports only (hands-on, needs no Sol call).

## Sol call durations (this lane, actual)

- lane2-1 (p1 adapter types, 299w): 45s, FAILED — refusal (runner has no filesystem/shell).
- lane2-1b (p1b adapter types, 299w): launched ~02:01 IST 2026-11-19, STILL RUNNING at 02:42 IST, 42+ min, no output file. Never killed (lane rule). Hands-on P1 stands as the verified version.
- No other Sol calls were launched in this lane. P2–P9b were written hands-on from the prompt specs and verified first-hand (tsc + vitest + live mainnet checks). Sol tally: 2 calls made, 0 landed as code.
