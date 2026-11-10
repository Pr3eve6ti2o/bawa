import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from 'react-router';
import { DashboardScreen } from '../screens/dashboard';
import { WelcomeScreen } from '../screens/welcome';
import { CreateWalletScreen } from '../screens/create-wallet';
import { ImportWalletScreen } from '../screens/import-wallet';
import { MnemonicBackupScreen } from '../screens/mnemonic-backup';
import { AssetListScreen } from '../screens/asset-list';
import { AssetDetailScreen } from '../screens/asset-detail';
import { ReceiveScreen } from '../screens/receive';
import { SendScreen } from '../screens/send';
import { TransactionHistoryScreen } from '../screens/transaction-history';
import { TransactionDetailScreen } from '../screens/transaction-detail';
import { NetworkSelectionScreen } from '../screens/network-selection';
import { WalletManagementScreen } from '../screens/wallet-management';
import { SecuritySettingsScreen } from '../screens/security-settings';
import { WalletProvider } from '../state/wallet-context';
import { Toaster } from '../ui/components/sonner';
import { ThemeToggle } from './theme-toggle';

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/assets', label: 'Assets' },
  { to: '/receive', label: 'Receive' },
  { to: '/send', label: 'Send' },
  { to: '/wallets', label: 'Wallets' },
  { to: '/security', label: 'Security' },
] as const;

function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <h1 className="text-xl font-semibold">Bawa Web Wallet</h1>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-1">
            {navigation.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}

function NotFound() {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <Link to="/" className="text-primary underline underline-offset-4">
        Back to dashboard
      </Link>
    </section>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardScreen />} />
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
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  );
}
