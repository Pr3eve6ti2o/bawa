// TODO (Phase 0.4 — BLOCKS THIS PHASE): demo fixtures EMPTIED, not deleted.
// The fake portfolio total and per-asset values were removed on 2026-11-19:
// no balance in this file is real, so none is shown. The file still exists
// only because dashboard.tsx, asset-list.tsx, asset-detail.tsx and
// wallet-management.tsx (Phase 2/5 screens, out of this lane's scope) import
// it; deleting it mid-migration would break the build. The Phase 2/5 lanes
// must delete this file and remove those imports, wiring the screens to the
// real adapter-backed balances instead. Until then, §6 item 7 is PARTIAL:
// the fake values are gone, but the import path still exists.
export const DEMO_PORTFOLIO = {
  total: 'Unavailable',
  change: '',
} as const;

export interface DemoAsset {
  id: 'btc' | 'eth' | 'trx';
  name: string;
  symbol: string;
  network: string;
  amount: string;
  value: string;
  chip: string;
}

export const DEMO_ASSETS: DemoAsset[] = [];
