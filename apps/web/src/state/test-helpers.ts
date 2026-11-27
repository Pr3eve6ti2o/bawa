// Single source for the four vault profile IDs used across wallet tests (test data only).
// Order: BTC, EVM, TRX, TON.

export const BTC_PROFILE_ID = 'bawa-btc-bip84-v1';
export const EVM_PROFILE_ID = 'bawa-evm-bip44-v1';
const TRX_PROFILE_ID = 'bawa-trx-bip44-v1';
const TON_PROFILE_ID = 'bawa-ton-v4r2-v1';

export const TEST_VAULT_PROFILE_IDS: string[] = [
  BTC_PROFILE_ID,
  EVM_PROFILE_ID,
  TRX_PROFILE_ID,
  TON_PROFILE_ID,
];
