Write ONE test file for the Bawa web wallet (vitest, jsdom, TypeScript, strict, 2-space indent, single quotes, semicolons). Keep it small and emit the code directly with minimal deliberation.

CREATE: apps/web/src/screens/track-transaction.test.tsx
It tests apps/web/src/screens/track-transaction.tsx, which exports TrackTransactionScreen. The screen imports lookupTransaction and getRecentActivity from ../wallet/tracker, chainConfig and SUPPORTED_CHAINS from ../wallet/chains, CHAIN_DECIMALS and formatNativeWithSymbol from ../wallet/format, and UI components from ../ui/components/*.

Follow the repo's transaction-history.test.tsx mounting pattern exactly: first line `// @vitest-environment jsdom`, imports createRoot from 'react-dom/client' and act from 'react-dom/test-utils', MemoryRouter from 'react-router', a mount helper that creates a div, appends it to document.body, sets globalThis IS_REACT_ACT_ENVIRONMENT = true, renders inside act, and returns { div, cleanup } that unmounts inside act and removes the div. Clean up in afterEach.

Mock ../wallet/tracker with vi.mock, exposing lookupTransaction: vi.fn() and getRecentActivity: vi.fn(). Do NOT mock ../wallet/chains or ../wallet/format (use the real ones).

Test data: a TrackedTx-shaped ok result for the known BTC hash f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16: { hash: that hash, chain: 'btc', networkId: 'bip122:000000000019d6689c085ae165831e93', status: 'confirmed', statusLabel: 'confirmed', confirmations: 976455, blockHeight: 170, from: null, to: null, amountBaseUnits: '5000000000', feeBaseUnits: '0', timestamp: 1231731025 * 1000, explorerUrl: 'https://mempool.space/tx/f4184fc596403b9d638783cf57adfe4c75c605f6356fbc91338530e9831e9e16', source: 'mempool.space', fetchedAt: 1231731025000 }.

Helpers: a function to find a button by its text and an input by its label text within the mounted div (use div.querySelector with text matching; keep it simple: Array.from(div.querySelectorAll('button')).find(b => b.textContent?.includes('Look up')) and div.querySelector('input') for the hash field — the hash input is the first text input on the screen). To type into an input inside act, set the native value setter and dispatch an input event (the standard React controlled-input trick: use Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value), then input.dispatchEvent(new Event('input', { bubbles: true }))).

TESTS:
1. Renders the heading 'Track a transaction' and the four chain names (Bitcoin, Ethereum, TRON, TON).
2. Looking up the known BTC hash: mock lookupTransaction to resolve { status: 'ok', data: <the BTC result above> }; type the hash into the hash input, click 'Look up', await act flushing promises; assert the screen shows the confirmations count '976,455', the amount '50 BTC', and the explorer link with href containing 'mempool.space/tx/f4184fc5'.
3. A missing hash: mock lookupTransaction to resolve { status: 'not-found' }; submit the zero hash ('0' repeated 64 times); assert the screen shows 'Transaction not found' and does NOT show a fabricated amount or explorer link.
4. A forced failure: mock lookupTransaction to resolve { status: 'error', reason: 'Network error: boom' }; submit; assert the screen shows 'Could not look up this transaction' and the reason text, and does NOT show 'Transaction not found'.
5. TON shows the account-address field: click the TON chain button, assert an input labelled for the TON account address is present (find by placeholder text containing 'EQ' or label text containing 'Account address'); assert lookupTransaction is called with the address when submitted (mock it to resolve { status: 'unsupported', reason: 'TON lookups need the account address' } first with an empty address, then fill the address and resubmit with { status: 'not-found', note: 'Checked the 10 most recent transactions' } and assert the note text appears). Keep this test to two submits maximum.
6. Recent activity: mock getRecentActivity to resolve { status: 'ok', data: [], source: 'stub', fetchedAt: 1 }; fill the address field in the recent-activity section (the second text input on the screen) with 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', click 'Show recent activity', flush; assert the screen shows 'No transactions found for this address' and never the words 'unused address'.
7. Recent activity error: mock getRecentActivity to resolve { status: 'error', reason: 'Indexer unavailable' }; submit; assert the screen shows 'could not be loaded' (case-insensitive) and the reason.

Mount the screen inside <MemoryRouter initialEntries={['/track']}>. Aim for about 240 lines. No live network, no new dependencies.

REPLY FORMAT: first a single fenced code block with the COMPLETE file contents (no truncation, no placeholders), then at most 5 lines of summary.
