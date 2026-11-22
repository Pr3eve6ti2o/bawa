import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";
import { useWallet } from "../state/wallet-context";
import { DevnetSetting } from "./devnet-setting";

const networks = [
  { id: "btc", mainnet: "Bitcoin mainnet" },
  { id: "eth", mainnet: "Ethereum mainnet" },
  { id: "trx", mainnet: "TRON mainnet" },
  { id: "ton", mainnet: "TON mainnet" },
] as const;

export function NetworkSelectionScreen() {
  const { devnetEnabled } = useWallet();

  return (
    <section className="space-y-6" aria-labelledby="networks-heading">
      <header className="space-y-2">
        <h1 id="networks-heading" className="text-2xl font-semibold">
          Networks
        </h1>
        <p className="text-sm text-muted-foreground">
          {devnetEnabled
            ? "Devnet test mode is on. This wallet connects to test networks with valueless test tokens."
            : "Mainnet only. This wallet never connects to a test network."}
        </p>
      </header>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>Mainnet</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
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

      <DevnetSetting />

      <p className="text-sm text-muted-foreground">
        Your balances and history come from public blockchain networks.
      </p>
    </section>
  );
}
