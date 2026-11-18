import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";

const networks = [
  { id: "btc", mainnet: "Bitcoin mainnet" },
  { id: "eth", mainnet: "Ethereum mainnet" },
  { id: "trx", mainnet: "TRON mainnet" },
  { id: "ton", mainnet: "TON mainnet" },
] as const;

export function NetworkSelectionScreen() {
  return (
    <section className="space-y-6" aria-labelledby="networks-heading">
      <header className="space-y-2">
        <h1 id="networks-heading" className="text-2xl font-semibold">
          Networks
        </h1>
        <p className="text-sm text-muted-foreground">
          Mainnet only. This wallet never connects to a test network.
        </p>
      </header>

      <Card className="rounded-[20px] border-[#d6deed]">
        <CardHeader>
          <CardTitle>Mainnet</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {networks.map(({ id, mainnet }) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-[#d6deed] bg-white p-3"
              >
                <span>{mainnet}</span>
                <span className="flex h-6 items-center rounded-[12px] bg-[#224f45] px-3 text-[10px] font-bold text-[#94e1c3]">
                  ACTIVE
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Balances and history come from the Phase 2 mainnet adapters; no
        testnet adapter exists.
      </p>
    </section>
  );
}
