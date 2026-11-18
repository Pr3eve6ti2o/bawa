Rewrite ONLY this header block from apps/web/src/app/app.tsx. Return the full replacement header JSX plus any new imports. The app is mainnet-only; there is no testnet anywhere.

Current header:
<header className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
  <div className="flex min-w-0 items-center gap-2.5">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b7cff] to-[#4f7cff] text-lg font-bold text-white">B</span>
    <div className="min-w-0">
      <h1 className="truncate text-[15px] font-bold leading-tight text-white">Bawa Web Wallet</h1>
      <Link to="/wallets" className="block truncate text-xs leading-tight text-[#aab5d1] hover:text-white">Account 01 &#8250;</Link>
    </div>
  </div>
  <span className="flex h-6 shrink-0 items-center rounded-[12px] bg-[#224f45] px-3 text-[10px] font-bold text-[#94e1c3]">TESTNET · ACTIVE</span>
</header>

Changes: (1) delete the TESTNET chip, show a "Mainnet" chip instead; (2) replace the "B" letter tile with the lucide Wallet icon; (3) use useWallet() from '../state/wallet-context' (add the import): when vaultState is 'no-vault' the account label reads "No wallet", otherwise "Account 01", still linking to /wallets; (4) add no chain switcher. Keep all Tailwind classes and the dark-navy styling.
