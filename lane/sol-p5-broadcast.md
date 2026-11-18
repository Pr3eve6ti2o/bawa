```typescript
import { BROADCAST_DISABLED_MESSAGE } from './adapters/types';

export async function broadcastSigned(
  chain: 'btc' | 'eth' | 'trx' | 'ton',
  signedTxHex: string,
): Promise<{ status: 'disabled'; reason: string }> {
  void chain;
  void signedTxHex;

  return { status: 'disabled', reason: BROADCAST_DISABLED_MESSAGE };
}

export function markBroadcastUnknown(
  txHash: string,
): { txHash: string; status: 'unknown'; message: string } {
  return {
    txHash,
    status: 'unknown',
    message:
      'Broadcast outcome unknown — the transaction stays unresolved. Do not resend it and do not compose a replacement without independent reconciliation.',
  };
}
```