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

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Mainnet</CardTitle>
        </CardHeader>
        <CardContent>
          {/* P7: one sparse list stretched full-width left ~55% of a
              1919x1080 viewport empty. Two columns at lg make it a
              compact 2x2. Below lg it stays a single-column list, so
              the mobile layout is untouched. */}
          <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {networks.map(({ id, mainnet }) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-border bg-card p-3"
              >
                <span>{mainnet}</span>
                <span className="flex h-6 items-center rounded-[12px] bg-panel-success-pill-bg px-3 text-[10px] font-bold text-panel-success-pill-text">
                  ACTIVE
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Your balances and history come from public blockchain networks.
      </p>
    </section>
  );
}
