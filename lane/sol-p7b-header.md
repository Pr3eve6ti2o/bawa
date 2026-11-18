New imports:

```tsx
import { Wallet } from 'lucide-react';
import { useWallet } from '../state/wallet-context';
```

Inside the existing component, before its `return`:

```tsx
const { vaultState } = useWallet();
```

Replacement header:

```tsx
<header className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
  <div className="flex min-w-0 items-center gap-2.5">
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
```