import { Link } from 'react-router';

export function TransactionHistoryScreen() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">Transactions</h1>

      <div className="space-y-3 rounded-[20px] border border-white/10 bg-[#243454] p-6 text-white">
        <h2 className="text-lg font-bold text-white">No transactions yet</h2>
        <p className="text-sm leading-relaxed text-[#aab5d1]">
          No transaction history — no provider is selected, so this starter
          cannot fetch transactions.
        </p>
        <p className="text-sm leading-relaxed text-[#aab5d1]">
          Import a watch-only wallet to see its derived addresses, or open
          Receive to share an address.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            to="/receive"
            className="inline-block rounded-full bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] px-4 py-2 text-sm font-semibold text-white"
          >
            Receive
          </Link>
          <Link
            to="/import-wallet"
            className="inline-block rounded-full border border-white/10 bg-[#263451] px-4 py-2 text-sm font-semibold text-[#eff2fc]"
          >
            Import wallet
          </Link>
        </div>
      </div>
    </div>
  );
}
