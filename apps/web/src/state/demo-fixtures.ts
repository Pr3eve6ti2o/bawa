// Demo portfolio fixtures for the Bawa Balanced preview.
//
// Figures are the demo numbers from the UI catalogue's Direction 04
// (Bawa Balanced) mock — docs/UI-UX-CATALOGUE.md, supplied as
// BAWA_UI_UX_CATALOGUE_REPO_PACKAGE.zip. They are TESTNET FIXTURES for
// presentation only: the starter fetches no live balances, prices or
// history, and these numbers must never be presented as a real balance.
export const DEMO_PORTFOLIO = {
  total: '$12,480.62',
  change: '+2.4% this week',
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

export const DEMO_ASSETS: DemoAsset[] = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'Testnet4',
    amount: '0.084 BTC',
    value: '$5,180',
    chip: '#f4aa3d',
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'Sepolia',
    amount: '1.42 ETH',
    value: '$4,240',
    chip: '#9daeff',
  },
  {
    id: 'trx',
    name: 'TRON',
    symbol: 'TRX',
    network: 'Nile',
    amount: '1,200 TRX',
    value: '$2,060',
    chip: '#ed777c',
  },
];
