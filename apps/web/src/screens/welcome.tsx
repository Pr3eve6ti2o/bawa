import { useEffect } from "react";
import { Link } from "react-router";
import { Network } from "lucide-react";
import { useWallet } from "../state/wallet-context";
import type { BalanceState, VaultState } from "../state/wallet-context";
import {
  availableFor,
  chainConfig,
} from "../wallet/chains";
import {
  CHAIN_DECIMALS,
  formatNativeWithSymbol,
} from "../wallet/chain-amount-format";
import {
  PRICE_ATTRIBUTION_TEXT,
  fiatValueForBalance,
  quoteFreshnessLabel,
  unitPriceForChain,
  usePrices,
} from "../wallet/prices";
import type { PriceEntry } from "../wallet/prices";
import type { ChainId } from "../engine/boundary";
import { Button } from "../ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/components/card";
import { Skeleton } from "../ui/components/skeleton";
import { TokenLogo } from "./token-logo";

type Freshness = "fresh" | "expired" | "none";

// A strip entry with no balance information renders as unavailable;
// this also keeps WelcomeScreen renderable when the wallet context is
// a partial mock (other screens' tests render it that way).
const UNAVAILABLE_BALANCE: BalanceState = { status: "unavailable" };

type ChainStripDisplay = {
  loading: boolean;
  primary: string;
  secondary?: string;
  freshness: Freshness;
  freshnessLabel: string;
};

/**
 * One strip entry, mirroring the asset rows (./asset-rows): a real native
 * balance with its fiat value when a fresh price exists, the per-unit
 * price when the balance is zero or unavailable, and "Unavailable" —
 * never $0.00 — when the balance or the price feed fails. With no vault
 * the strip is navigation only (logo + name + dash), per the Lane C
 * §5 empty state. The vault never locks, so there is no locked state.
 */
function chainStripDisplay(
  chain: ChainId,
  balance: BalanceState,
  entry: PriceEntry | undefined,
  nowMs: number,
  vaultState: VaultState,
): ChainStripDisplay {
  const config = chainConfig(chain);
  if (vaultState === "no-vault") {
    return {
      loading: false,
      primary: "—",
      freshness: "none",
      freshnessLabel: "No wallet yet",
    };
  }
  if (balance.status === "loading") {
    return {
      loading: true,
      primary: "",
      freshness: "none",
      freshnessLabel: "Loading balance",
    };
  }
  const unit =
    entry === undefined ? undefined : unitPriceForChain(entry, nowMs);
  const freshness: Freshness =
    unit === undefined
      ? "none"
      : unit.kind === "fresh"
        ? "fresh"
        : unit.kind === "expired"
          ? "expired"
          : "none";
  const freshnessLabel =
    unit !== undefined &&
    unit.kind === "fresh" &&
    entry !== undefined &&
    entry.status === "fresh"
      ? quoteFreshnessLabel(entry.quote, nowMs)
      : unit !== undefined && unit.kind === "expired"
        ? "Price expired"
        : "Price unavailable";
  const perUnit =
    unit !== undefined && unit.kind === "fresh"
      ? unit.text + " per " + config.symbol
      : undefined;
  if (balance.status === "unavailable" || balance.status === "error") {
    return {
      loading: false,
      primary: "Unavailable",
      secondary: perUnit,
      freshness,
      freshnessLabel,
    };
  }
  if (balance.status === "zero") {
    return {
      loading: false,
      primary: "Zero balance",
      secondary: perUnit,
      freshness,
      freshnessLabel,
    };
  }
  const primary = formatNativeWithSymbol(
    balance.value ?? "0",
    CHAIN_DECIMALS[chain],
    config.symbol,
  );
  if (entry === undefined) {
    return { loading: false, primary, freshness, freshnessLabel };
  }
  const fiat = fiatValueForBalance(chain, balance, entry, nowMs);
  switch (fiat.kind) {
    case "fiat":
      return {
        loading: false,
        primary,
        secondary: fiat.text,
        freshness,
        freshnessLabel,
      };
    case "zero":
    case "balance-unavailable":
      return {
        loading: false,
        primary,
        secondary: perUnit,
        freshness,
        freshnessLabel,
      };
    case "expired":
      return {
        loading: false,
        primary,
        secondary: "Price expired",
        freshness,
        freshnessLabel,
      };
    case "unavailable":
      return {
        loading: false,
        primary,
        secondary: "Price unavailable",
        freshness,
        freshnessLabel,
      };
    case "error":
      return {
        loading: false,
        primary,
        secondary: "Price error",
        freshness,
        freshnessLabel,
      };
    default:
      return { loading: false, primary, freshness, freshnessLabel };
  }
}

/**
 * Freshness dot. Colour is reinforcement only, never the sole signal:
 * a fresh price shows its fiat value, an expired one says
 * "Price expired", a failed feed says "Price unavailable" / "Unavailable"
 * in text. The dot itself is aria-hidden; its label is a hover title.
 */
function FreshnessDot({
  freshness,
  label,
}: {
  freshness: Freshness;
  label: string;
}) {
  const tone =
    freshness === "fresh"
      ? "bg-panel-success-pill-text"
      : freshness === "expired"
        ? "bg-amber-500"
        : "bg-panel-text-muted";
  return (
    <span
      aria-hidden="true"
      title={label}
      className={"size-2 shrink-0 rounded-full " + tone}
    />
  );
}

/**
 * Popular chains strip (Lane C §5): Bawa's four balance chains in the
 * registry's fixed order, generated from availableFor("balance") — never
 * hand-edited — plus a trailing "All networks" tile to /networks. Each
 * entry is a shortcut to /assets/<chain>, not a network mode switch:
 * Bawa has no global network mode. On phones the row scrolls
 * horizontally without wrapping or clipping (min-w-0 + shrink-0);
 * on desktop it is a five-column grid.
 */
export function PopularChainsStrip() {
  const wallet = useWallet();
  // Partial contexts (a mock that only sets history, say) read as
  // no-vault: the strip stays navigation with dashes, never crashes.
  const balances = wallet?.balances;
  const vaultState = wallet?.vaultState ?? "no-vault";
  const { state: pricesState, refresh: refreshPrices } = usePrices();
  const chains = availableFor("balance") ?? [];
  const nowMs = Date.now();

  // The dashboard owns price fetching. Welcome refreshes only when a
  // vault exists, so the no-vault first paint makes no network call and
  // the strip stays pure navigation until a wallet is created.
  useEffect(() => {
    if (vaultState !== "no-vault" && pricesState?.status === "idle") {
      refreshPrices();
    }
  }, [vaultState, pricesState?.status, refreshPrices]);

  return (
    <section
      aria-labelledby="popular-chains-title"
      className="lg:col-span-5 lg:row-start-3"
    >
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2
          id="popular-chains-title"
          className="text-sm font-bold text-panel-text"
        >
          Popular chains
        </h2>
        <Link
          to="/networks"
          className="shrink-0 text-sm font-semibold text-panel-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent"
        >
          All networks <span aria-hidden="true">›</span>
        </Link>
      </div>
      <ul className="mt-3 flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {chains.map((chain) => {
          const config = chainConfig(chain);
          const balance = balances?.[chain] ?? UNAVAILABLE_BALANCE;
          const entry = pricesState?.entries?.[chain];
          const display = chainStripDisplay(
            chain,
            balance,
            entry,
            nowMs,
            vaultState,
          );
          return (
            <li key={chain} className="w-[168px] shrink-0 lg:w-auto lg:min-w-0">
              <Link
                to={"/assets/" + chain}
                className="flex h-full flex-col gap-1.5 rounded-[20px] border border-panel-border bg-panel-surface-raised p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent hover:bg-panel-hover"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <TokenLogo symbol={config.symbol} size={32} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-panel-text">
                    {config.displayName}
                  </span>
                  <FreshnessDot
                    freshness={display.freshness}
                    label={display.freshnessLabel}
                  />
                </span>
                {display.loading ? (
                  <Skeleton className="h-5 w-24" />
                ) : (
                  <span className="truncate text-sm font-semibold text-panel-text">
                    {display.primary}
                  </span>
                )}
                {display.secondary !== undefined && (
                  <span className="truncate text-xs text-panel-text-muted">
                    {display.secondary}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li className="w-[168px] shrink-0 lg:w-auto lg:min-w-0">
          <Link
            to="/networks"
            className="flex h-full flex-col gap-1.5 rounded-[20px] border border-panel-border bg-panel-surface-raised p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent hover:bg-panel-hover"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-panel-surface text-panel-accent">
                <Network className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-panel-text">
                All networks
              </span>
            </span>
            <span className="truncate text-sm font-semibold text-panel-text">
              See every network
            </span>
          </Link>
        </li>
      </ul>
      {vaultState !== "no-vault" && (
        <p className="mt-2 text-right text-[11px] text-panel-text-muted">
          {PRICE_ATTRIBUTION_TEXT}
        </p>
      )}
    </section>
  );
}

export function WelcomeScreen() {
  return (
    <section aria-labelledby="welcome-title" className="mx-auto w-full max-w-[480px] space-y-6 lg:max-w-none lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start lg:space-y-0">
      <div className="rounded-[30px] border border-panel-border bg-panel-surface-raised p-7 text-panel-text sm:p-8 lg:col-span-3 lg:col-start-1 lg:row-start-1">
        <p className="text-sm font-bold tracking-widest text-panel-accent">
          BAWA
        </p>
        <h1
          id="welcome-title"
          className="mt-3 text-title-lg font-bold tracking-tight text-panel-text"
        >
          Welcome to Bawa Web Wallet
        </h1>
        <p className="mt-2 max-w-xl text-body-md text-panel-text-muted">
          A self-custodial multi-chain wallet. Create a wallet in the browser
          — your recovery phrase is encrypted on this device with your vault
          password — or import a watch-only wallet to track addresses without
          holding secrets.
        </p>

        <div className="mt-6 flex h-11 items-center justify-between rounded-xl bg-panel-surface px-4">
          <p className="text-xs font-semibold text-panel-text-soft">Network</p>
          <span className="flex h-6 items-center rounded-xl bg-panel-success-pill-bg px-3 text-[10px] font-bold text-panel-success-pill-text">
            MAINNET
          </span>
        </div>

        <ol className="mt-4 space-y-2 text-body-md">
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-step-pending-text">
              1
            </span>
            {' '}
            <span className="font-semibold text-panel-text">
              Set a vault password
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-step-pending-text">
              2
            </span>
            {' '}
            <span className="font-semibold text-panel-text">
              Write down 24 words
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-step-pending-text">
              3
            </span>
            {' '}
            <span className="font-semibold text-panel-text">
              Confirm 3 words
            </span>
          </li>
          <li className="flex items-center gap-3 rounded-xl p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-blue-dim font-semibold text-step-pending-text">
              4
            </span>
            {' '}
            <span className="font-semibold text-panel-text">
              See your addresses
            </span>
          </li>
        </ol>
      </div>

      <div className="grid gap-4 lg:col-span-2 lg:col-start-4 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-6">
        <Card className="flex flex-col rounded-xl bg-card text-foreground">
          <CardHeader className="px-6 pt-6">
            <CardTitle>Create a wallet</CardTitle>
            <CardDescription>
              Generate a recovery phrase in the browser and encrypt it on this
              device with a vault password. Only you hold the phrase.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto px-6 pb-6">
            <Button asChild className="h-10 w-full">
              <Link to="/create-wallet">Create a wallet</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col rounded-xl bg-card text-foreground">
          <CardHeader className="px-6 pt-6">
            <CardTitle>Import a wallet</CardTitle>
            <CardDescription>
              Restore a wallet from its recovery phrase, or paste an extended
              public key (xpub) to view its derived addresses watch-only.
              Never paste recovery words, seeds or private keys into a
              watch-only import.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto px-6 pb-6">
            <Button asChild variant="outline" className="h-10 w-full">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-2 rounded-[20px] border border-border bg-card p-4 text-sm text-muted-foreground lg:col-span-3 lg:col-start-1 lg:row-start-2">
        <p>Mainnet only — this wallet never connects to a test network.</p>
        <p>
          Your balances come from public blockchain networks. This device signs transactions offline. You can send funds only after separate approval.
        </p>
      </aside>

      <PopularChainsStrip />
    </section>
  );
}
