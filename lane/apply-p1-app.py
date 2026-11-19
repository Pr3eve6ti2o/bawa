"""Lane A perf: apply Sol prompt-1 output (lazy route screens in app.tsx).

Does NOT wholesale replace app.tsx: it applies only the lazy-import block
and the Suspense wrap to the real file, so every other line stays
byte-identical (Sol's full-file rewrite is the pattern, not the patch).
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-p1-app.py
"""
import sys

APP = 'apps/web/src/app/app.tsx'

lazy_block = """const CreateWalletScreen = lazy(() =>
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
"""

static_imports = """import { CreateWalletScreen } from '../screens/create-wallet';
import { ImportWalletScreen } from '../screens/import-wallet';
import { MnemonicBackupScreen } from '../screens/mnemonic-backup';
import { AssetListScreen } from '../screens/asset-list';
import { AssetDetailScreen } from '../screens/asset-detail';
import { ReceiveScreen } from '../screens/receive';
import { SendScreen } from '../screens/send';
import { TransactionHistoryScreen } from '../screens/transaction-history';
import { TransactionDetailScreen } from '../screens/transaction-detail';
import { NetworkSelectionScreen } from '../screens/network-selection';
import { LockScreen } from '../screens/lock';
import { WalletManagementScreen } from '../screens/wallet-management';
import { SecuritySettingsScreen } from '../screens/security-settings';
"""

with open(APP, encoding='utf-8') as f:
    src = f.read()

assert 'lazy(' not in src, 'app.tsx already lazy'
assert src.count(static_imports) == 1, 'static import block not found exactly once'
src = src.replace(static_imports, lazy_block, 1)

old_react = "import { useState } from 'react';"
assert src.count(old_react) == 1
src = src.replace(old_react, "import { lazy, Suspense, useState } from 'react';", 1)

old_open = "      <WalletProvider>\n        <Routes>"
assert src.count(old_open) == 1, 'Routes open not found'
src = src.replace(
    old_open,
    "      <WalletProvider>\n        <Suspense fallback={<p>Loading\u2026</p>}>\n          <Routes>",
    1,
)
old_close = "        </Routes>\n      </WalletProvider>"
assert src.count(old_close) == 1, 'Routes close not found'
src = src.replace(
    old_close,
    "          </Routes>\n        </Suspense>\n      </WalletProvider>",
    1,
)

with open(APP, 'w', encoding='utf-8') as f:
    f.write(src)
print('app.tsx: 13 screens lazy, Suspense around Routes')
print('OK')
