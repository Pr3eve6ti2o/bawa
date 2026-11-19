Reword ONE user-facing line in apps/web/src/screens/security-settings.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-copy, branch panel-rebuild/fix-copy). Use plain user language, en-GB. Change NOTHING else in the file.

Current line (exact text):
"Signing happens offline on this device, with disposable test keys during development."

It sits in a "What this wallet does" list alongside these neighbouring bullets (do NOT change them, and do NOT repeat what they already say):
- "Your recovery phrase is generated in this browser and stored encrypted in the vault (AES-GCM-256, PBKDF2 600,000 rounds)."
- "Private keys are held in memory only while the vault is unlocked — never in plaintext storage, logs or requests."
- "Broadcast is disabled until separately authorised — signing never sends funds."

Rewrite the signing line so it no longer says "disposable test keys" or "during development" or anything developer-sounding. Keep it honest: signing happens offline on this device. Do not claim anything that is not true, and do not duplicate the broadcast bullet.

Return ONLY the single replacement <li>...</li> line. No explanation, no other changes.

Acceptance: the replacement contains no "disposable", no "test keys", no "development", no "build", and no "repo".
