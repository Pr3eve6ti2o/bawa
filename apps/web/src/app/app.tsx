import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Coins,
  Ellipsis,
  Home,
  Wallet,
} from 'lucide-react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation } from 'react-router';
import { DashboardScreen } from '../screens/dashboard';
import { WelcomeScreen } from '../screens/welcome';
const CreateWalletScreen = lazy(() =>
  import('../screens/create-wallet').then((m) => ({ default: m.CreateWalletScreen })),
);
const CreateScreen = lazy(() =>
  import('../screens/create').then((m) => ({ default: m.CreateScreen })),
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
const TrackTransactionScreen = lazy(() =>
  import('../screens/track-transaction').then((m) => ({
    default: m.TrackTransactionScreen,
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
import { WalletProvider, useWallet } from '../state/wallet-context';
import { Toaster } from '../ui/components/sonner';
import { MORE_LINKS, SidebarNav } from './sidebar-nav';

const tabs = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/assets', label: 'Assets', icon: Coins },
  { to: '/receive', label: 'Receive', icon: ArrowDownToLine },
  { to: '/send', label: 'Send', icon: ArrowUpRight },
] as const;

function HomeScreen() {
  const { vaultState } = useWallet();

  return vaultState === 'no-vault' ? <WelcomeScreen /> : <DashboardScreen />;
}

function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { vaultState } = useWallet();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  // Escape closes the More menu and returns focus to its trigger.
  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);
  const pathname = useLocation().pathname;
  // Narrow task screens get a local 480px cap inside the content frame;
  // /assets itself stays full-width, only /assets/<chain> is narrow.
  // Welcome self-caps in welcome.tsx (it also renders on the home route).
  // /create-wallet, /lock and /security keep the 480px cap below lg only:
  // at lg they go full content width so the screens can lay out in two
  // columns (create-wallet, security) or as a centred card in the
  // workspace (lock).
  const isNarrow =
    ['/send', '/receive', '/import-wallet', '/mnemonic-backup'].includes(
      pathname,
    ) || pathname.startsWith('/assets/');
  const isWideAtLg = ['/create-wallet', '/lock', '/security'].includes(pathname);

  return (
    <div className="min-h-screen bg-background sm:py-6 lg:py-0">
      <div className="bawa-panel mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-gradient-to-br from-panel-shell-from to-panel-shell-to text-panel-text sm:min-h-[720px] sm:rounded-[30px] sm:border-2 sm:border-border sm:shadow-[var(--shadow-card)] lg:max-w-[1440px] lg:flex-row lg:rounded-none lg:border-0 lg:shadow-none lg:min-h-screen">
        <aside className="hidden shrink-0 lg:block lg:w-[224px] lg:border-r lg:border-panel-border lg:bg-panel-surface">
          <div className="sticky top-0 flex max-h-screen flex-col overflow-y-auto">
            <SidebarNav />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="hidden h-[72px] shrink-0 items-center justify-between border-b border-panel-border px-6 lg:flex xl:px-8">
            <Link
              to="/wallets"
              className="truncate text-sm font-medium text-panel-text-muted hover:text-panel-text"
            >
              {vaultState === 'no-vault' ? 'No wallet' : 'Account 01'} &#8250;
            </Link>
            <span className="flex h-6 shrink-0 items-center rounded-[12px] bg-panel-success-pill-bg px-3 text-[10px] font-bold text-panel-success-pill-text">
              Mainnet
            </span>
          </header>

          <header className="flex items-center justify-between gap-3 px-5 pb-4 pt-5 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-panel-accent-from to-panel-accent-to text-lg font-bold text-primary-foreground">
                <Wallet className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-bold leading-tight text-panel-text">
                  Bawa Web Wallet
                </h1>
                <Link
                  to="/wallets"
                  className="block truncate text-xs leading-tight text-panel-text-muted hover:text-panel-text"
                >
                  {vaultState === 'no-vault' ? 'No wallet' : 'Account 01'} &#8250;
                </Link>
              </div>
            </div>
            <span className="flex h-6 shrink-0 items-center rounded-[12px] bg-panel-success-pill-bg px-3 text-[10px] font-bold text-panel-success-pill-text">
              Mainnet
            </span>
          </header>

          {/* Mobile bottom padding must clear the sticky bottom nav
              (~65px + safe-area): with only pb-6 the last ~40px of a
              long page — e.g. the "Show recent activity" button on
              /track — scrolled under the nav and was half-untappable.
              pb-24 leaves ~30px clear at max scroll. Desktop is
              unchanged: the nav is lg:hidden and lg:py-6 still applies. */}
          <main className="mx-auto w-full max-w-[1024px] flex-1 px-5 pb-24 lg:px-6 lg:py-6 xl:max-w-[1152px] xl:px-8">
            {isNarrow || isWideAtLg ? (
              <div
                className={
                  isWideAtLg
                    ? 'mx-auto w-full max-w-[480px] lg:max-w-none'
                    : 'mx-auto w-full max-w-[480px]'
                }
              >
                <Outlet />
              </div>
            ) : (
              <Outlet />
            )}
          </main>

          {moreOpen && (
            <div
              role="menu"
              aria-label="More"
              className="rounded-[20px] border border-panel-border bg-panel-surface-raised p-2 max-lg:fixed max-lg:bottom-[76px] max-lg:left-1/2 max-lg:z-20 max-lg:max-h-[60vh] max-lg:w-[calc(100%-2rem)] max-lg:max-w-[398px] max-lg:-translate-x-1/2 max-lg:overflow-y-auto lg:hidden"
            >
              {MORE_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  role="menuitem"
                  onClick={() => setMoreOpen(false)}
                className="block rounded-[12px] px-3 py-2.5 text-sm font-medium text-panel-text hover:bg-panel-hover"
              >
                {label}
              </Link>
            ))}
          </div>
        )}

          <nav
            aria-label="Main navigation"
            className="sticky bottom-0 z-10 border-t border-panel-border bg-panel-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
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
                      isActive ? 'text-panel-text' : 'text-panel-text-muted hover:text-panel-text'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex size-6 items-center justify-center rounded-full ${
                          isActive ? 'bg-panel-icon-tile text-panel-accent' : 'bg-panel-hover text-panel-text-muted'
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
                ref={moreButtonRef}
                aria-expanded={moreOpen}
                aria-label="More"
                onClick={() => setMoreOpen((open) => !open)}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                  moreOpen ? 'text-panel-text' : 'text-panel-text-muted hover:text-panel-text'
                }`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full ${
                    moreOpen ? 'bg-panel-icon-tile text-panel-accent' : 'bg-panel-hover text-panel-text-muted'
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
    </div>
  );
}

function NotFound() {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-panel-text">Page not found</h2>
      <Link to="/" className="text-panel-accent underline underline-offset-4">
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
            <Route path="create" element={<CreateScreen />} />
            <Route path="import-wallet" element={<ImportWalletScreen />} />
            <Route path="mnemonic-backup" element={<MnemonicBackupScreen />} />
            <Route path="assets" element={<AssetListScreen />} />
            <Route path="assets/:chain" element={<AssetDetailScreen />} />
            <Route path="receive" element={<ReceiveScreen />} />
            <Route path="send" element={<SendScreen />} />
            <Route path="transactions" element={<TransactionHistoryScreen />} />
            <Route path="transactions/:id" element={<TransactionDetailScreen />} />
            <Route path="track" element={<TrackTransactionScreen />} />
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
