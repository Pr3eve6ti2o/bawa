import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BawaIcon, type BawaIconName } from '../ui/components/icons';
import { BawaLoading } from '../ui/components/loading';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import { DashboardScreen } from '../screens/dashboard';
import { WelcomeScreen } from '../screens/welcome';
// Hot routes are eager imports (Rabby pattern): the live browser showed
// the first click on /assets/:chain, /security, /create and
// /create-wallet rendering the previous screen while the lazy chunk
// loaded. These four screens ship in the main bundle so the first
// navigation renders immediately; every other route stays code-split
// below.
import { AssetDetailScreen } from '../screens/asset-detail';
import { CreateScreen } from '../screens/create-hub';
import { CreateWalletScreen } from '../screens/create-wallet';
import { SecuritySettingsScreen } from '../screens/security-settings';

const loadImportWallet = () =>
  import('../screens/import-wallet').then((m) => ({
    default: m.ImportWalletScreen,
  }));
const ImportWalletScreen = lazy(loadImportWallet);
const loadMnemonicBackup = () =>
  import('../screens/mnemonic-backup').then((m) => ({
    default: m.MnemonicBackupScreen,
  }));
const MnemonicBackupScreen = lazy(loadMnemonicBackup);
const loadAssetList = () =>
  import('../screens/asset-list').then((m) => ({ default: m.AssetListScreen }));
const AssetListScreen = lazy(loadAssetList);
const loadReceive = () =>
  import('../screens/receive').then((m) => ({ default: m.ReceiveScreen }));
const ReceiveScreen = lazy(loadReceive);
const loadSend = () =>
  import('../screens/send').then((m) => ({ default: m.SendScreen }));
const SendScreen = lazy(loadSend);
const loadTransactionHistory = () =>
  import('../screens/transaction-history').then((m) => ({
    default: m.TransactionHistoryScreen,
  }));
const TransactionHistoryScreen = lazy(loadTransactionHistory);
const loadTransactionDetail = () =>
  import('../screens/transaction-detail').then((m) => ({
    default: m.TransactionDetailScreen,
  }));
const TransactionDetailScreen = lazy(loadTransactionDetail);
const loadTrackTransaction = () =>
  import('../screens/track-transaction').then((m) => ({
    default: m.TrackTransactionScreen,
  }));
const TrackTransactionScreen = lazy(loadTrackTransaction);
const loadNetworkSelection = () =>
  import('../screens/network-selection').then((m) => ({
    default: m.NetworkSelectionScreen,
  }));
const NetworkSelectionScreen = lazy(loadNetworkSelection);
const loadWalletManagement = () =>
  import('../screens/wallet-management').then((m) => ({
    default: m.WalletManagementScreen,
  }));
const WalletManagementScreen = lazy(loadWalletManagement);

// Route-chunk preloading (MetaMask's preload pattern): hovering or
// focusing a nav link starts loading that route's chunk, so the click
// itself renders at once. The desktop sidebar (sidebar-nav.tsx) can
// reuse this export. A failed preload is swallowed — it must never
// break navigation, and the click itself still loads the chunk.
const loadLock = () =>
  import('../screens/lock').then((m) => ({ default: m.LockScreen }));
const LockScreen = lazy(loadLock);

const ROUTE_PRELOADERS: Readonly<Record<string, () => Promise<unknown>>> = {
  '/import-wallet': loadImportWallet,
  '/mnemonic-backup': loadMnemonicBackup,
  '/assets': loadAssetList,
  '/receive': loadReceive,
  '/send': loadSend,
  '/transactions': loadTransactionHistory,
  '/track': loadTrackTransaction,
  '/networks': loadNetworkSelection,
  '/wallets': loadWalletManagement,
  '/lock': loadLock,
};

const preloadedRoutes = new Set<string>();

export function preloadRoute(to: string): void {
  const firstSegment = `/${to.split('/').filter(Boolean)[0] ?? ''}`;
  const loader = ROUTE_PRELOADERS[to] ?? ROUTE_PRELOADERS[firstSegment];
  if (!loader || preloadedRoutes.has(to)) return;
  preloadedRoutes.add(to);
  loader().catch(() => {
    // A failed preload is not fatal: the navigation retries the import,
    // so allow a later hover to try again.
    preloadedRoutes.delete(to);
  });
}
import { WalletProvider, useWallet } from '../state/wallet-context';
import { ErrorBoundary } from './error-boundary';
import { Toaster } from '../ui/components/sonner';
import { MORE_LINKS, SidebarNav } from './sidebar-nav';

const tabs: ReadonlyArray<{ to: string; label: string; icon: BawaIconName }> = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/assets', label: 'Assets', icon: 'coins' },
  { to: '/receive', label: 'Receive', icon: 'receive' },
  { to: '/send', label: 'Send', icon: 'arrow-up-right' },
];

function HomeScreen() {
  const { vaultState } = useWallet();

  return vaultState === 'no-vault' ? <WelcomeScreen /> : <DashboardScreen />;
}

function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { vaultState, devnetEnabled } = useWallet();
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
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const prevVaultState = useRef(vaultState);
  // Lock-with-return-to (Rabby `/unlock?from=`, MetaMask `state.from`).
  // The key is duplicated in lock.tsx; keep the two in sync.
  // Use sessionStorage, not localStorage, so the target dies with the tab.
  useEffect(() => {
    if (location.pathname === '/lock') return;

    try {
      sessionStorage.setItem(
        'bawa-lock-return-to',
        `${location.pathname}${location.search}`,
      );
    } catch {
      // Private mode: the lock screen falls back to `/`.
    }
  }, [location]);

  useEffect(() => {
    const wasUnlocked = prevVaultState.current === 'unlocked';
    prevVaultState.current = vaultState;

    // Focused and restore flows retain state and handle locks themselves.
    if (
      wasUnlocked &&
      vaultState === 'locked' &&
      !['/lock', '/send', '/create-wallet', '/import-wallet'].includes(pathname)
    ) {
      navigate('/lock');
    }
  }, [vaultState, pathname, navigate]);
  // Focused flows hide the navigation chrome (Safe PageLayout pattern):
  // the create-wallet flow and the send flow. Send review is a state
  // inside /send rather than its own route, so the whole /send flow
  // hides the nav; the review step sits inside it. The desktop header
  // stays: it carries the account context and the Mainnet pill, not
  // navigation.
  const isFocusedFlow =
    pathname === '/create-wallet' || pathname === '/send';
  // Narrow task screens get a local 480px cap inside the content frame;
  // /assets itself stays full-width, only /assets/<chain> is narrow.
  // Welcome self-caps in welcome.tsx (it also renders on the home route).
  // /create-wallet and /security keep the 480px cap below lg only:
  // at lg they go full content width so the screens can lay out in two
  // columns (create-wallet, security).
  const isNarrow =
    ['/send', '/receive', '/import-wallet', '/mnemonic-backup'].includes(
      pathname,
    ) || pathname.startsWith('/assets/');
  const isWideAtLg = ['/create-wallet', '/security', '/lock'].includes(pathname);

  return (
    <div className="min-h-screen bg-paper sm:py-6 lg:py-0">
      {/* Desktop shell is full-bleed at lg: below lg the app is a centred
          430px phone frame, but at lg the frame used to cap at 1440px, so
          on a 1919px viewport the content column sat in the left ~1230px
          with dead paper on the right. The content column itself still
          caps for readability (see <main>); it just grows with the
          window now. At 1440px and below nothing changes: the cap never
          bound there. */}
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-paper text-ink sm:min-h-[720px] sm:rounded-bawa sm:border-2 sm:border-ink lg:max-w-none lg:flex-row lg:rounded-none lg:border-0 lg:min-h-screen">
        {!isFocusedFlow && (
          <aside
            className={
              // The shell owns the sidebar width (and its transition);
              // SidebarNav fills it with w-full. No border here:
              // SidebarNav draws the single border-r-2 itself, and a
              // duplicate shell border would shrink this aside's content
              // box by 2px and re-overflow the inner sidebar.
              'hidden shrink-0 transition-[width] duration-200 lg:block lg:bg-paper ' +
              (sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[224px]')
            }
          >
            {/* overflow-x-hidden is the guard: overflow-y-auto alone
                computes overflow-x to auto, so any child a pixel wider
                than the sidebar would bring back the horizontal
                scrollbar. Vertical scrolling is unchanged. */}
            <div className="sticky top-0 flex h-screen flex-col overflow-x-hidden overflow-y-auto">
              <SidebarNav
                collapsed={sidebarCollapsed}
                onToggleCollapse={() =>
                  setSidebarCollapsed((value) => !value)
                }
                onPreloadRoute={preloadRoute}
              />
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="hidden h-[72px] shrink-0 items-center justify-between border-b-2 border-ink px-6 lg:flex xl:px-8">
            <Link
              to="/wallets"
              onMouseEnter={() => preloadRoute('/wallets')}
              onFocus={() => preloadRoute('/wallets')}
              className="truncate text-sm font-medium text-ink hover:underline hover:decoration-wavy hover:decoration-coral hover:underline-offset-4"
            >
              {vaultState === 'no-vault' ? 'No wallet' : 'Account 01'} &#8250;
            </Link>
            <span className="flex h-6 shrink-0 items-center rounded-bawa-sm border-2 border-ink bg-sun px-3 text-[10px] font-bold text-ink">
              {devnetEnabled ? 'Devnet — test mode' : 'Mainnet'}
            </span>
          </header>

          <header className="flex items-center justify-between gap-3 px-5 pb-4 pt-5 lg:hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-paper text-ink">
                <BawaIcon name="wallet" className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-bold leading-tight text-ink">
                  Bawa Web Wallet
                </h1>
                <Link
                  to="/wallets"
                  onMouseEnter={() => preloadRoute('/wallets')}
                  onFocus={() => preloadRoute('/wallets')}
                  className="block truncate text-xs leading-tight text-ink hover:underline hover:decoration-wavy hover:decoration-coral hover:underline-offset-4"
                >
                  {vaultState === 'no-vault' ? 'No wallet' : 'Account 01'} &#8250;
                </Link>
              </div>
            </div>
            <span className="flex h-6 shrink-0 items-center rounded-bawa-sm border-2 border-ink bg-sun px-3 text-[10px] font-bold text-ink">
              {devnetEnabled ? 'Devnet — test mode' : 'Mainnet'}
            </span>
          </header>

          {/* Mobile bottom padding must clear the sticky bottom nav
              (~65px + safe-area): with only pb-6 the last ~40px of a
              long page — e.g. the "Show recent activity" button on
              /track — scrolled under the nav and was half-untappable.
              pb-24 leaves ~30px clear at max scroll. Desktop is
              unchanged: the nav is lg:hidden and lg:py-6 still applies. */}
          {/* Wide-window content cap: the column steps 1024px -> 1152px
              at xl -> 1440px at 2xl, so on a 1919px viewport it uses the
              window instead of freezing at 1152px. 1440px reuses the old
              frame cap as the widest the column ever gets, keeping line
              lengths readable; the narrow task screens keep their own
              480px cap above. */}
          <main className="mx-auto w-full max-w-[1024px] flex-1 px-5 pb-24 lg:px-6 lg:py-6 xl:max-w-[1152px] xl:px-8 2xl:max-w-[1440px]">
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

          {!isFocusedFlow && moreOpen && (
            <div
              role="menu"
              aria-label="More"
              className="rounded-bawa border-2 border-ink bg-paper p-2 max-lg:fixed max-lg:bottom-[76px] max-lg:left-1/2 max-lg:z-20 max-lg:max-h-[60vh] max-lg:w-[calc(100%-2rem)] max-lg:max-w-[398px] max-lg:-translate-x-1/2 max-lg:overflow-y-auto lg:hidden"
            >
              {MORE_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  role="menuitem"
                  onClick={() => setMoreOpen(false)}
                  onMouseEnter={() => preloadRoute(to)}
                  onFocus={() => preloadRoute(to)}
                className="block rounded-bawa-sm px-3 py-2.5 text-sm font-medium text-ink hover:bg-sun"
              >
                {label}
              </Link>
            ))}
          </div>
        )}

          {!isFocusedFlow && (
            <nav
              aria-label="Main navigation"
            className="sticky bottom-0 z-10 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
          >
            <div className="grid grid-cols-5">
              {tabs.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMoreOpen(false)}
                  onMouseEnter={() => preloadRoute(to)}
                  onFocus={() => preloadRoute(to)}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-3 text-[11px] font-semibold ${
                      isActive ? 'text-ink bawa-squiggle-underline' : 'text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`flex size-6 items-center justify-center rounded-bawa-sm border-2 border-ink ${
                          isActive ? 'bg-sun text-ink' : 'bg-paper text-ink'
                        }`}
                      >
                        <BawaIcon name={icon} className="size-4" aria-hidden="true" />
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
                  moreOpen ? 'text-ink bawa-squiggle-underline' : 'text-ink'
                }`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-bawa-sm border-2 border-ink ${
                    moreOpen ? 'bg-sun text-ink' : 'bg-paper text-ink'
                  }`}
                >
                  <BawaIcon name="more" className="size-4" aria-hidden="true" />
                </span>
                More
              </button>
            </div>
            </nav>
          )}
          <Toaster />
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-ink">Page not found</h2>
      <Link to="/" className="text-ink bawa-squiggle-underline">
        Back to dashboard
      </Link>
    </section>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary fallbackTitle="Unable to show your wallet">
        <WalletProvider>
        <Suspense fallback={<BawaLoading />}>
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
      </ErrorBoundary>
    </BrowserRouter>
  );
}
