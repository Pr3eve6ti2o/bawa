import { Badge } from "../ui/components/badge";
import { Button } from "../ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/components/card";

const networks = [
  { id: "btc", testnet: "Bitcoin testnet4 — default", mainnet: "Bitcoin mainnet" },
  { id: "eth", testnet: "Ethereum Sepolia — default", mainnet: "Ethereum mainnet" },
  { id: "trx", testnet: "TRON Nile testnet — default", mainnet: "TRON mainnet" },
] as const;

export function NetworkSelectionScreen() {
  return (
    <section className="space-y-6" aria-labelledby="networks-heading">
      <header className="space-y-2">
        <h1 id="networks-heading" className="text-2xl font-semibold">
          Networks
        </h1>
        <p className="text-sm text-muted-foreground">
          Testnet only, by repository policy.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Testnet defaults</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {networks.map(({ id, testnet }) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <span>{testnet}</span>
                <Badge>Testnet</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mainnet — unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p id="mainnet-reason" className="text-sm text-muted-foreground">
            Mainnet is out of scope by default and requires separate approval plus applicable gates.
          </p>
          <ul className="space-y-3">
            {networks.map(({ id, mainnet }) => (
              <li key={id}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  disabled
                  aria-describedby="mainnet-reason"
                >
                  {mainnet}
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Network selection changes nothing in this starter yet — no provider is connected.
      </p>
    </section>
  );
}
