```ts
// TRX
// Anchor: insert immediately before the existing lookupTransaction declaration.
function trackerRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTrxTx(raw: unknown): TrackedTx | null {
  try {
    if (
      !trackerRecord(raw) || typeof raw.txID !== 'string' || !raw.txID ||
      !trackerRecord(raw.raw_data) || !Array.isArray(raw.raw_data.contract) ||
      !Array.isArray(raw.ret) || !trackerRecord(raw.ret[0]) ||
      typeof raw.ret[0].contractRet !== 'string'
    ) return null;

    const contracts: unknown[] = raw.raw_data.contract;
    const transfer = contracts.find((entry) =>
      trackerRecord(entry) && entry.type === 'TransferContract'
    );
    const contract = transfer ?? contracts[0];
    if (
      !trackerRecord(contract) || !trackerRecord(contract.parameter) ||
      !trackerRecord(contract.parameter.value)
    ) return null;

    const value = contract.parameter.value;
    const amount = transfer === undefined ? undefined : value.amount;
    if (
      amount !== undefined &&
      !(typeof amount === 'string' && /^\d+$/.test(amount)) &&
      !(typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 0)
    ) return null;

    const contractRet = raw.ret[0].contractRet;
    return {
      chain: 'trx',
      networkId: 'tron:0x2b6653dc',
      hash: raw.txID,
      from: typeof value.owner_address === 'string' ? value.owner_address : null,
      to: typeof value.to_address === 'string' ? value.to_address : null,
      amountBaseUnits: amount === undefined ? '0' : String(amount),
      feeBaseUnits: null,
      timestamp: typeof raw.raw_data.timestamp === 'number' &&
        Number.isFinite(raw.raw_data.timestamp) ? raw.raw_data.timestamp : null,
      status: contractRet === 'SUCCESS' ? 'confirmed' : 'failed',
      statusLabel: contractRet,
      blockHeight: null,
      confirmations: null,
      source: 'trongrid',
      explorerUrl: `https://tronscan.org/#/transaction/${raw.txID}`,
    };
  } catch {
    return null;
  }
}
```

```ts
// TON
// Anchor: the existing import block at the top of tracker.ts; add:
import { base64ToHex } from './adapters/ton';

// Anchor: insert immediately before the existing lookupTransaction declaration.
function trackerTonHex(hash: unknown): string | null {
  if (typeof hash !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(hash)) return null;
  try {
    return base64ToHex(hash);
  } catch {
    return null;
  }
}

export function parseTonTxEntry(raw: unknown): TrackedTx | null {
  try {
    if (!trackerRecord(raw) || !trackerRecord(raw.transaction_id)) return null;
    const hash = trackerTonHex(raw.transaction_id.hash);
    if (
      !hash ||
      (raw.out_msgs !== undefined && !Array.isArray(raw.out_msgs)) ||
      (raw.in_msg != null && !trackerRecord(raw.in_msg))
    ) return null;

    const messages: unknown[] = Array.isArray(raw.out_msgs) ? raw.out_msgs : [];
    const outgoing = messages.length > 0;
    const message = outgoing ? messages[0] : raw.in_msg;
    if (
      !trackerRecord(message) || typeof message.value !== 'string' ||
      !/^\d+$/.test(message.value) ||
      (outgoing && typeof message.destination !== 'string')
    ) return null;

    const source = trackerRecord(raw.in_msg) ? raw.in_msg.source : null;
    return {
      chain: 'ton',
      networkId: 'ton:-239',
      hash,
      from: typeof source === 'string' ? source : null,
      to: outgoing && typeof message.destination === 'string' ? message.destination : null,
      amountBaseUnits: message.value,
      feeBaseUnits: typeof raw.fee === 'string' ? raw.fee : null,
      timestamp: typeof raw.utime === 'number' && Number.isFinite(raw.utime * 1000)
        ? raw.utime * 1000 : null,
      status: 'confirmed',
      statusLabel: 'confirmed',
      blockHeight: null,
      confirmations: null,
      source: 'toncenter',
      explorerUrl: `https://tonviewer.com/transaction/${hash}`,
    };
  } catch {
    return null;
  }
}

async function lookupTon(hash: string, address: string | undefined): Promise<TrackerLookupResult> {
  if (!address) {
    return {
      status: 'unsupported',
      reason: 'TON lookups need the account address: TonCenter identifies a transaction by account, lt and hash, so paste the account address as well as the hash.',
    };
  }

  try {
    const target = /^[0-9a-f]{64}$/i.test(hash) ? hash.toLowerCase() : trackerTonHex(hash);
    if (!target) return { status: 'error', reason: 'Invalid TON transaction hash format.' };

    const raw: unknown = await fetchJson('https://toncenter.com/api/v2/jsonRPC', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'getTransactions',
        params: { address, limit: 10 },
      }),
    });
    if (!trackerRecord(raw) || raw.ok !== true || !Array.isArray(raw.result)) {
      return { status: 'error', reason: 'Invalid response: expected a transaction list' };
    }

    const entries: unknown[] = raw.result;
    for (const entry of entries) {
      if (
        !trackerRecord(entry) || !trackerRecord(entry.transaction_id) ||
        trackerTonHex(entry.transaction_id.hash) !== target
      ) continue;
      const data = parseTonTxEntry(entry);
      return data ? { status: 'ok', data } : { status: 'not-found' };
    }

    return {
      status: 'not-found',
      note: 'Checked the 10 most recent transactions for this account; the transaction may be older than that.',
    };
  } catch (error: unknown) {
    return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
  }
}
```

```ts
// WIRE
// Anchor: replace the line returning unsupported for trx and ton.
  if (chain === 'trx') {
    if (!/^[0-9a-f]{64}$/i.test(hash)) {
      return { status: 'error', reason: 'Invalid TRON transaction hash format.' };
    }
    try {
      const raw: unknown = await fetchJson('https://api.trongrid.io/wallet/gettransactionbyid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: hash }),
      });
      if (trackerRecord(raw) && Object.keys(raw).length === 0) {
        return { status: 'not-found' };
      }
      const data = parseTrxTx(raw);
      return data
        ? { status: 'ok', data }
        : { status: 'error', reason: 'Invalid response: expected a transaction' };
    } catch (error: unknown) {
      return { status: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  }

  if (chain === 'ton') {
    if (!/^[0-9a-f]{64}$/i.test(hash) && !/^[A-Za-z0-9+/]{43}=$/.test(hash)) {
      return { status: 'error', reason: 'Invalid TON transaction hash format.' };
    }
    return lookupTon(hash, opts?.address);
  }

  return { status: 'unsupported', reason: 'Transaction lookup is not supported for this chain yet.' };
```

```ts
// ACTIVITY
// Anchor: the existing import block at the top of tracker.ts; add these imports
// (merge the type specifiers if either is already imported).
import { getAdapter } from './adapters/index';
import type { AdapterResult, AdapterTx } from './adapters/types';

// Anchor: append at the end of tracker.ts.
export type TrackerActivityResult = AdapterResult<AdapterTx[]>;

// An empty 'ok' list means 'no transactions found', never 'unused address'.
export async function getRecentActivity(
  chain: ChainId,
  address: string,
  limit?: number,
): Promise<TrackerActivityResult> {
  const requested = limit ?? 10;
  limit = Math.max(1, Math.min(20, Math.trunc(Number.isNaN(requested) ? 10 : requested)));
  const adapter = getAdapter(chain);
  if (!adapter) {
    return { status: 'unavailable', reason: 'No history adapter is available for this chain.' };
  }
  return adapter.getHistory(address, limit);
}
```

```ts
// REGISTRY
// Anchor: insert at module scope immediately before lookupTransaction.
export type LookupHandler = (
  hash: string,
  opts: { address?: string },
) => Promise<TrackerLookupResult>;

const trackerLookupHandlers = new Map<string, LookupHandler>();

export function registerLookupHandler(chain: string, handler: LookupHandler): void {
  trackerLookupHandlers.set(chain, handler);
}

// Anchor: in lookupTransaction's signature, replace `chain: ChainId` with
// `chain: string`; leave its existing hash and opts parameters unchanged.
// Anchor: top of lookupTransaction, before hash validation; insert:
  const registered = trackerLookupHandlers.get(chain);
  if (registered) {
    return registered(hash, opts ?? {});
  }
  if (chain !== 'btc' && chain !== 'eth' && chain !== 'trx' && chain !== 'ton') {
    return {
      status: 'unsupported',
      reason: 'Transaction lookup is not supported for this chain yet.',
    };
  }
```