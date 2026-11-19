```tsx
import { lazy, Suspense, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Coins,
  Ellipsis,
  Home,
  Wallet,
} from 'lucide-react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from 'react-router';
import { DashboardScreen } from '../screens/dashboard';
import { WelcomeScreen } from '../screens/welcome';
import { WalletProvider, useWallet } from '../state/wallet-context';
import { Toaster } from '../ui/components/sonner';

const CreateWalletScreen = lazy(() =>
  import('../screens/create-wallet').then((m) => ({ default: m.CreateWalletScreen })),
);
const ImportWalletScreen = lazy(() =>
  import('../screens/import-wallet').then((m) => ({ default: m.ImportWalletScreen })),
);
const MnemonicBackupScreen = lazy(() =>
  import('../screens/mnemonic-backup').then((m) => ({ default: m.MnemonicBackupScreen })),
);
const AssetListScreen = lazy(() =>
  import('../screens/asset-list').then((m) => ({ default: m.AssetListScreen })),
);
const AssetDetailScreen = lazy(() =>
  import('../screens/asset-detail').then((m) => ({ default: m.AssetDetailScreen })),
);
const ReceiveScreen = lazy(() =>
  import('../screens/receive').then((m) => ({ default: m.ReceiveScreen })),
);
const SendScreen = lazy(() =>
  import('../screens/send').then((m) => ({ default: m.SendScreen })),
);
const TransactionHistoryScreen = lazy(() =>
  import('../screens/transaction-history').then((m) => ({
    default: m.TransactionHistoryScreen,
  })),
);
const TransactionDetailScreen = lazy(() =>
  import('../screens/transaction-detail').then((m) => ({
    default: m.TransactionDetailScreen,
  })),
);
const NetworkSelectionScreen = lazy(() =>
  import('../screens/network-selection').then((m) => ({
    default: m.NetworkSelectionScreen,
  })),
);
const LockScreen = lazy(() =>
  import('../screens/lock').then((m) => ({ default: m.LockScreen })),
);
const WalletManagementScreen = lazy(() =>
  import('../screens/wallet-management').then((m) => ({
    default: m.WalletManagementScreen,
  })),
);
const SecuritySettingsScreen = lazy(() =>
  import('../screens/security-settings').then((m) => ({
    default: m.SecuritySettingsScreen,
  })),
);

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/assets', label: 'Assets', icon: Coins },
  { to: '/receive', label: 'Receive', icon: ArrowDownToLine },
  { to: '/send', label: 'Send', icon: ArrowUpRight },
] as const;

const moreLinks = [
  { to: '/wallets', label: 'Wallets' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/import-wallet', label: 'Import wallet' },
  { to: '/create-wallet', label: 'Create wallet' },
  { to: '/security', label: 'Security' },
  { to: '/networks', label: 'Networks' },
  { to: '/mnemonic-backup', label: 'Mnemonic backup' },
  { to: '/welcome', label: 'Welcome' },
] as const;

function HomeScreen() {
  const { vaultState } = useWallet();

  return vaultState === 'no-vault' ? <WelcomeScreen /> : <DashboardScreen />;
}

function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { vaultState } = useWallet();

  return (
    <div className="min-h-screen bg-[#f4f6fb] sm:py-6">
      <div className="bawa-panel mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-gradient-to-br from-[#11172b] to-[#18264a] text-white sm:min-h-[720px] sm:rounded-[30px] sm:border-2 sm:border-[#d6deed] sm:shadow-[0_8px_20px_rgba(11,16,32,0.22)]">
        <header className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div className="min-w-0 flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b7cff] to-[#4f7cff] text-lg font-bold text-white">
              <Wallet className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold leading-tight text-white">
                Bawa Web Wallet
              </h1>
              <Link
                to="/wallets"
                className="block truncate text-xs leading-tight text-[#aab5d1] hover:text-white"
              >
                {vaultState === 'no-vault' ? 'No wallet' : 'Account 01'} &#8250;
              </Link>
            </div>
          </div>
          <span className="flex h-6 shrink-0 items-center rounded-[12px] bg-[#224f45] px-3 text-[10px] font-bold text-[#94e1c3]">
            Mainnet
          </span>
        </header>

        <main className="flex-1 px-5 pb-6">
          <Outlet />
        </main>

        {moreOpen && (
          <div
            role="menu"
            aria-label="More"
            className="mx-4 mb-2 rounded-[20px] border border-white/10 bg-[#243454] p-2"
          >
            {moreLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className="block rounded-[12px] px-3 py-2.5 text-sm font-medium text-[#eff2fc] hover:bg-white/10"
              >
                {label}
              </Link>
            ))}
          </div>
        )}

        <nav
          aria-label="Main navigation"
          className="sticky bottom-0 z-10 border-t border-white/10 bg-[#141d34]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        >
          <div className="grid grid-cols-5">
            {tabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                    isActive ? 'text-white' : 'text-[#aab5d1] hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex size-6 items-center justify-center rounded-full ${
                        isActive ? 'bg-[#263451] text-[#b4aaff]' : 'bg-white/5 text-[#aab5d1]'
                      }`}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            ))}
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-label="More"
              onClick={() => setMoreOpen((open) => !open)}
              className={`flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                moreOpen ? 'text-white' : 'text-[#aab5d1] hover:text-white'
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full ${
                  moreOpen ? 'bg-[#263451] text-[#b4aaff]' : 'bg-white/5 text-[#aab5d1]'
                }`}
              >
                <Ellipsis className="size-4" aria-hidden="true" />
              </span>
              More
            </button>
          </div>
        </nav>
        <Toaster />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-white">Page not found</h2>
      <Link to="/welcome" className="text-[#b4aaff] underline underline-offset-4">
        Back to dashboard
      </Link>
    </section>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Suspense fallback={<p>Loading…</p>}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<HomeScreen />} />
              <Route path="welcome" element={<WelcomeScreen />} />
              <Route path="create-wallet" element={<CreateWalletScreen />} />
              <Route path="import-wallet" element={<ImportWalletScreen />} />
              <Route path="mnemonic-backup" element={<MnemonicBackupScreen />} />
              <Route path="assets" element={<AssetListScreen />} />
              <Route path="assets/:chain" element={<AssetDetailScreen />} />
              <Route path="receive" element={<ReceiveScreen />} />
              <Route path="send" element={<SendScreen />} />
              <Route path="transactions" element={<TransactionHistoryScreen />} />
              <Route path="transactions/:id" element={<TransactionDetailScreen />} />
              <Route path="networks" element={<NetworkSelectionScreen />} />
              <Route path="wallets" element={<WalletManagementScreen />} />
              <Route path="security" element={<SecuritySettingsScreen />} />
              <Route path="lock" element={<LockScreen />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </WalletProvider>
    </BrowserRouter>
  );
}
```