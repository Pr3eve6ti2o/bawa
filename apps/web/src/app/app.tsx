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
const loadBackupShares = () =>
  import('../screens/backup-shares').then((m) => ({
    default: m.BackupSharesScreen,
  }));
const BackupSharesScreen = lazy(loadBackupShares);
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
const loadAddressBook = () =>
  import('../screens/address-book').then((m) => ({
    default: m.AddressBookScreen,
  }));
const AddressBookScreen = lazy(loadAddressBook);
// Lane 6 (UX-major programme): the Swap screen is a lazy route like
// the others — its own chunk, never in the main bundle. Quotes only;
// nothing in it signs or broadcasts.
const loadSwap = () =>
  import('../screens/swap').then((m) => ({ default: m.SwapScreen }));
const SwapScreen = lazy(loadSwap);

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
  '/backup-shares': loadBackupShares,
  '/assets': loadAssetList,
  '/receive': loadReceive,
  '/send': loadSend,
  '/transactions': loadTransactionHistory,
  '/track': loadTrackTransaction,
  '/networks': loadNetworkSelection,
  '/wallets': loadWalletManagement,
  '/address-book': loadAddressBook,
  '/swap': loadSwap,
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
import { useDevnetToggle } from '../state/use-devnet-toggle';
import { appBasePath } from '../wallet/payment-links';
import { accountName } from '../wallet/vault';
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

// The header network pill (UI/UX fixes, item 2): the Mainnet/Devnet
// indicator in the app header is a button, not a label. Tapping it
// switches the wallet between mainnet and devnet — the same mode flag
// the Networks screen's DevnetSetting switch flips — and back again.
// Same pill look, same place, no restyle: the button keeps the exact
// classes the old span had. Used in both headers (desktop + mobile).
//
// Disabled with no vault (the DevnetSetting rule: there is nothing to
// re-derive). A failed toggle is announced to assistive technology and
// kept on the button's title; the visible error copy lives on the
// Networks screen's DevnetSetting, which shows the same failure.
export function NetworkModePill() {
  // Fix-all Lane H, item 12: the toggle state lives in
  // useDevnetToggle, shared with the Networks screen's DevnetSetting.
  const { devnetEnabled, disabled, actionError, toggle } = useDevnetToggle();

  async function handleToggle() {
    await toggle(!devnetEnabled);
  }

  // UX-major Lane 2 (DESIGN-SYSTEM §2.5): the pill is a thumb-sized
  // 44 px control now (it was 24 px with a 10 px label — below both the
  // touch rule and the 11 px readability floor). Same sun fill, 2 px ink
  // border and bold label; text-xs (12 px) is the smallest token at or
  // above the floor. The header is 72 px, so a 44 px pill fits as built.
  return (
    <>
      <button
        type="button"
        aria-pressed={devnetEnabled}
        aria-label={devnetEnabled ? 'Switch to mainnet' : 'Switch to devnet'}
        title={
          actionError ??
          (devnetEnabled
            ? 'Devnet test mode. Tap to switch back to mainnet'
            : 'Mainnet. Tap to switch to devnet test mode.')
        }
        disabled={disabled}
        onClick={() => {
          void handleToggle();
        }}
        className="flex h-11 shrink-0 items-center rounded-bawa-sm border-2 border-ink bg-sun px-3 text-xs font-bold text-ink disabled:opacity-60"
      >
        {devnetEnabled ? 'Devnet test mode' : 'Mainnet'}
      </button>
      {actionError !== null && (
        <span role="alert" className="sr-only">
          {actionError}
        </span>
      )}
    </>
  );
}

function AppLayout() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { vaultState, vaultAccount } = useWallet();
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
  // the create-wallet flow, the send flow, and the mnemonic-backup
  // flow (Lane 5, redesign: the backup screen is a focused flow —
  // DESIGN-SYSTEM §6 — the phrase is revealed there, and the bottom
  // nav is one accidental tap away from leaving mid-reveal). Send
  // review is a state inside /send rather than its own route, so the
  // whole /send flow hides the nav; the review step sits inside it.
  // The desktop header stays: it carries the account context and the
  // Mainnet pill, not navigation.
  const isFocusedFlow =
    pathname === '/create-wallet' ||
    pathname === '/send' ||
    pathname === '/mnemonic-backup';
  // Narrow task screens get a local 480px cap inside the content frame;
  // /assets itself stays full-width, only /assets/<chain> is narrow.
  // Welcome self-caps in welcome.tsx (it also renders on the home route).
  // /create-wallet and /security keep the 480px cap below desktop:
  // only: at desktop: they go full content width so the screens can
  // lay out in two columns (create-wallet, security).
  const isNarrow =
    ['/send', '/receive', '/swap', '/import-wallet', '/mnemonic-backup', '/backup-shares'].includes(
      pathname,
    ) || pathname.startsWith('/assets/');
  const isWideAtDesktop = ['/create-wallet', '/security', '/lock'].includes(pathname);

  return (
    <div className="min-h-dvh bg-paper sm:py-6 desktop:py-0">
      {/* UX-major Lane 2: skip link (WCAG 2.4.1) — first focusable
          element, visible on focus, jumps to #main-content below. The
          focus classes are minimal on purpose: the global :focus-visible
          rule supplies the 2 px ink outline + wavy coral underline, and
          the text inherits ink on paper. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:py-3"
      >
        Skip to content
      </a>
      {/* Desktop shell is full-bleed at desktop: (980px): below desktop: the app is a centred
          430px phone frame, but at desktop: the frame used to cap at 1440px, so
          on a 1919px viewport the content column sat in the left ~1230px
          with dead paper on the right. The content column itself still
          caps for readability (see <main>); it just grows with the
          window now. At 1440px and below nothing changes: the cap never
          bound there. */}
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-paper text-ink sm:min-h-[720px] sm:rounded-bawa sm:border-2 sm:border-ink desktop:max-w-none desktop:flex-row desktop:rounded-none desktop:border-0 desktop:min-h-dvh">
        {!isFocusedFlow && (
          <aside
            className={
              // The shell owns the sidebar width (and its transition);
              // SidebarNav fills it with w-full. No border here:
              // SidebarNav draws the single border-r-2 itself, and a
              // duplicate shell border would shrink this aside's content
              // box by 2px and re-overflow the inner sidebar.
              'hidden shrink-0 transition-[width] duration-200 desktop:block desktop:bg-paper ' +
              (sidebarCollapsed ? 'desktop:w-[72px]' : 'desktop:w-[224px]')
            }
          >
            {/* overflow-x-hidden is the guard: overflow-y-auto alone
                computes overflow-x to auto, so any child a pixel wider
                than the sidebar would bring back the horizontal
                scrollbar. Vertical scrolling is unchanged. */}
            <div className="sticky top-0 flex h-dvh flex-col overflow-x-hidden overflow-y-auto">
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
          <header className="hidden h-[72px] shrink-0 items-center justify-between border-b-2 border-ink px-6 desktop:flex xl:px-8">
            <Link
              to="/wallets"
              onMouseEnter={() => preloadRoute('/wallets')}
              onFocus={() => preloadRoute('/wallets')}
              className="truncate text-sm font-medium text-ink hover:underline hover:decoration-wavy hover:decoration-coral hover:underline-offset-4"
            >
              {vaultState === 'no-vault' ? 'No wallet' : accountName(vaultAccount.account)} &#8250;
            </Link>
            <NetworkModePill />
          </header>

          {/* Mobile header (mobile-native §7): viewport-fit=cover is
              live in index.html, so the page extends under the notch /
              Dynamic Island — the header pads down by the safe-area
              inset (20 px where there is none, so non-notched phones
              render exactly as before). */}
          <header className="flex items-center justify-between gap-3 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] desktop:hidden">
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
                  {vaultState === 'no-vault' ? 'No wallet' : accountName(vaultAccount.account)} &#8250;
                </Link>
              </div>
            </div>
            <NetworkModePill />
          </header>

          {/* Mobile bottom padding must clear the sticky bottom nav
              (~65px + safe-area): with only pb-6 the last ~40px of a
              long page — e.g. the "Show recent activity" button on
              /track — scrolled under the nav and was half-untappable.
              pb-24 leaves ~30px clear at max scroll. Desktop is
              unchanged: the nav is desktop:hidden and desktop:py-6 still applies.
              Focused flows (/send, /create-wallet) hide the bottom nav,
              so they take pb-0 instead: with pb-24 the /send chain step
              scrolled 92px into empty space (deep audit, Lane A). */}
          {/* Wide-window content cap: the column steps 1024px -> 1152px
              at xl -> 1440px at 2xl, so on a 1919px viewport it uses the
              window instead of freezing at 1152px. 1440px reuses the old
              frame cap as the widest the column ever gets, keeping line
              lengths readable; the narrow task screens keep their own
              480px cap above. */}
          <main
            id="main-content"
            tabIndex={-1}
            className={`mx-auto w-full max-w-[1024px] flex-1 px-5 desktop:px-6 desktop:py-6 xl:max-w-[1152px] xl:px-8 2xl:max-w-[1440px] ${
              isFocusedFlow ? 'pb-0' : 'pb-24'
            }`}
          >
            {isNarrow || isWideAtDesktop ? (
              <div
                className={
                  isWideAtDesktop
                    ? 'mx-auto w-full max-w-[480px] desktop:max-w-none'
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
              // Mobile sheet (mobile-native §7): bottom clears the bottom
              // nav PLUS the home-indicator inset — the nav grows by the
              // inset (its pb-[env(safe-area-inset-bottom)]), so a fixed
              // 76 px offset would overlap it on notched phones.
              // overscroll-contain keeps the sheet's own scroll from
              // chaining to the page behind it (§6).
              className="overscroll-contain rounded-bawa border-2 border-ink bg-paper p-2 max-desktop:fixed max-desktop:bottom-[calc(76px+env(safe-area-inset-bottom))] max-desktop:left-1/2 max-desktop:z-20 max-desktop:max-h-[60vh] max-desktop:w-[calc(100%-2rem)] max-desktop:max-w-[398px] max-desktop:-translate-x-1/2 max-desktop:overflow-y-auto desktop:hidden"
            >
              {MORE_LINKS.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  role="menuitem"
                  onClick={() => setMoreOpen(false)}
                  onMouseEnter={() => preloadRoute(to)}
                  onFocus={() => preloadRoute(to)}
                className="block rounded-bawa-sm px-3 py-3 text-sm font-medium text-ink hover:bg-sun"
              >
                {label}
              </Link>
            ))}
          </div>
        )}

          {!isFocusedFlow && (
            <nav
              aria-label="Main navigation"
            className="sticky bottom-0 z-10 border-t-2 border-ink bg-paper pb-[env(safe-area-inset-bottom)] desktop:hidden"
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
  // Subpath deployments (UI/UX round 2, deep-link fix): Vite `base`
  // controls asset paths, BrowserRouter `basename` controls routing
  // paths, and both must match — the mined SPA-on-Pages pattern. With
  // no basename, /bawa/send?... boots the app through the 404.html
  // fallback but the router sees /bawa/send, matches nothing, and
  // renders the app's own "Page not found" instead of the Send screen.
  // Read at render time so tests can stub import.meta.env.BASE_URL.
  // useLocation() returns the basename-stripped path and navigate()
  // re-adds it, so the lock-return-to round trip is unaffected.
  const base = appBasePath();
  return (
    <BrowserRouter basename={base === '' ? undefined : base}>
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
            <Route path="backup-shares" element={<BackupSharesScreen />} />
            <Route path="assets" element={<AssetListScreen />} />
            <Route path="assets/:chain" element={<AssetDetailScreen />} />
            <Route path="assets/:chain/:token" element={<AssetDetailScreen />} />
            <Route path="receive" element={<ReceiveScreen />} />
            <Route path="send" element={<SendScreen />} />
            <Route path="swap" element={<SwapScreen />} />
            <Route path="transactions" element={<TransactionHistoryScreen />} />
            <Route path="transactions/:id" element={<TransactionDetailScreen />} />
            <Route path="track" element={<TrackTransactionScreen />} />
            <Route path="networks" element={<NetworkSelectionScreen />} />
            <Route path="wallets" element={<WalletManagementScreen />} />
            <Route path="address-book" element={<AddressBookScreen />} />
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
