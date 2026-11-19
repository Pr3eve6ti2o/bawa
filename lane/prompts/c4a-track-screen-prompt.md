Write ONE React screen file for the Bawa web wallet (TypeScript, strict, React 19, react-router, Tailwind, 2-space indent, single quotes, semicolons, en-GB text). Keep it small and emit the code directly with minimal deliberation.

CREATE: apps/web/src/screens/track-transaction.tsx
It is the transaction tracker screen: hash/signature lookup plus recent-address activity, using apps/web/src/wallet/tracker.ts.

Repo facts (verified, do not re-derive):
- From ../wallet/tracker import lookupTransaction, getRecentActivity, and the types TrackedTx, TrackerLookupResult, TrackerActivityResult.
- ChainId is 'btc' | 'eth' | 'trx' | 'ton'. From ../wallet/chains import chainConfig (config.displayName, config.symbol) and SUPPORTED_CHAINS (['btc','eth','trx','ton']).
- From ../wallet/format import CHAIN_DECIMALS and formatNativeWithSymbol(amountBaseUnits, decimals, symbol).
- UI components exist: ../ui/components/button (Button), ../ui/components/input (Input), ../ui/components/label (Label), ../ui/components/card (Card, CardContent), ../ui/components/alert (Alert, AlertDescription), ../ui/components/skeleton (Skeleton). Follow the receive.tsx screen pattern: useState form fields, Button type submit, Label htmlFor matching Input id.
- Routing uses react-router: useSearchParams to read initial chain and hash from the URL (?chain=btc&hash=...), Link for navigation.
- The wallet dashboard stays a separate workspace: this screen is a tool, not a dashboard replacement. Do not touch wallet-context or any other screen.

Implement exactly:
- export function TrackTransactionScreen()
- Heading 'Track a transaction'. Intro line: 'Look up any transaction by its hash, or see recent activity for an address. Results come from public indexers and may lag behind the chain.'
- Chain selector: four buttons (or a select) for Bitcoin, Ethereum, TRON, TON, from SUPPORTED_CHAINS with chainConfig display names. Changing chain clears the previous result.
- Hash form: a Label 'Transaction hash' and Input (placeholder 'Paste a transaction hash'), a submit Button 'Look up'. On submit, call lookupTransaction(chain, hash.trim(), { address: addressForTon }) where addressForTon is the TON address field value when chain is 'ton'.
- TON address field: shown ONLY when chain is 'ton', Label 'Account address (required for TON)' and Input with placeholder 'EQ… or UQ… address'. Below it the note: 'TonCenter identifies a transaction by account, lt and hash, so a TON lookup needs the account address as well as the hash.'
- Lookup states, each visually distinct, never confused with each other:
  - loading: Skeleton plus text 'Looking up…' with role status.
  - ok: a Card with the transaction: status line showing the indexer's own wording (data.statusLabel) plus confirmations when not null ('6,451,173 confirmations' formatted with en-GB grouping) or 'Confirmations unknown — the indexer reports no block number' when null; a line 'Included transactions are shown with their confirmation count. This is not a finality guarantee.'; rows for Block (data.blockHeight or 'Not in a block yet'), From, To (break-all, truncated visually with title set to the full value), Amount (formatNativeWithSymbol), Fee (formatted the same way, or 'Not reported by the indexer' when null), Time (en-GB date+time or 'Unknown'), Source ('Source: ' + data.source + ', checked at ' + fetchedAt time). An explorer link: 'View on explorer' as an <a href={data.explorerUrl} target _blank rel noreferrer>.
  - not-found: Alert with 'Transaction not found.' plus the result note when present, plus 'Check the hash and chain, or try again later — indexers can lag.'
  - unsupported: Alert with the reason text.
  - error: Alert with 'Could not look up this transaction.' plus the reason, plus a Retry button that re-runs the lookup.
- Recent activity section below the lookup, heading 'Recent activity for an address': an address Input (Label 'Address'), a Button 'Show recent activity' calling getRecentActivity(chain, address.trim(), 10). States: loading Skeleton; ok with an empty list: text 'No transactions found for this address.' plus 'Indexed results may lag behind the chain.'; ok with rows: a list of at most 10, each a Link to /transactions/<hash> showing direction word (Received / Sent / Self transfer), formatted amount, and date (en-GB short); unavailable/error: Alert with the reason and text 'Recent activity could not be loaded.' Never word an empty list as 'unused address'.
- Keep the file under about 330 lines. No new dependencies, no console output, no broadcast, no keys, no secrets.

REPLY FORMAT: first a single fenced code block with the COMPLETE file contents (no truncation, no placeholders), then at most 5 lines of summary.
