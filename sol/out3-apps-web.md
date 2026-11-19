| Current path | Verdict | New name | One-line reason |
|---|---|---|---|
| 1. `src/engine/boundary.ts` | KEEP | | Accurately names the engine integration boundary; the supported-chain list remains distinct in `chains.ts`. |
| 2. `src/wallet/providers.ts` | RENAME | `src/wallet/balance-providers.ts` | Disambiguates the balance/history registry from the app’s `WalletProvider`. |
| 3. `src/wallet/wallet-context.test.tsx` (165 lines)<br>`src/wallet/wallet-context-balances.test.tsx` | RENAME | `src/state/wallet-provider.test.tsx`<br>`src/state/wallet-provider-balances.test.tsx` | Places both tests beside their state implementation and removes the duplicate basename without guessing test scope. |
| 4. `src/app/theme-toggle.tsx` | KEEP | | Accurately names the component; unused status is not a naming defect, and deletion is out of scope. |
| 5. `src/ui/LICENSE-token-ui` | KEEP | | Clearly identifies the vendored token-ui licence; its existing references are consistent. |
| 6. `src/app/app.tsx` | KEEP | | Correctly names the root App component; directory/basename repetition is not misleading. |
| 7. `src/wallet/bip39-oracle.test.ts` | KEEP | | “Oracle” accurately describes the independent cross-check, and `.test.ts` distinguishes it from production handling. |
| 8. `src/wallet/format.ts` | RENAME | `src/wallet/chain-amount-format.ts` | Makes chain decimals/amount formatting explicit, distinguishing it from `money.ts`’s fiat-only display math. |
| 9. `src/screens/asset-rows.tsx` | KEEP | | Accurately names the shared asset-row components; reuse across screens does not make it confusing. |
| 10. `src/engine/confirmation-policy.md` | KEEP | | `.md` distinguishes the document, while the matching basename clearly associates it with the adjacent implementation. |