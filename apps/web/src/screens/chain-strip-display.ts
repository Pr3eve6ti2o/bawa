import type { ChainId } from "../engine/boundary";
import type { BalanceState } from "../state/wallet-context";
import { chainConfig } from "../wallet/chains";
import {
  CHAIN_DECIMALS,
  formatNativeWithSymbol,
} from "../wallet/chain-amount-format";
import {
  fiatValueForBalance,
  unitPriceForChain,
  type PriceEntry,
} from "../wallet/prices";

type ChainStripDisplayResult = {
  loading: boolean;
  primary: string;
  secondary?: string;
  freshness: "fresh" | "expired" | "unavailable";
  freshnessLabel: string;
};

export function chainStripDisplay(
  chain: ChainId,
  balance: BalanceState,
  entry: PriceEntry | undefined,
  nowMs: number,
  vaultState: "no-vault" | "locked" | "unlocked",
  pricesLoading: boolean,
  mode: "welcome" | "dashboard",
  // Round 2, item 6: in devnet mode no fiat value is ever shown for a
  // test balance — the secondary falls back to the live per-unit price.
  devnet = false,
): ChainStripDisplayResult {
  const unitPrice = unitPriceForChain(entry, nowMs);
  const freshness: ChainStripDisplayResult["freshness"] =
    entry?.status === "fresh"
      ? "fresh"
      : unitPrice.kind === "expired"
        ? "expired"
        : "unavailable";

  const metadata = {
    freshness,
    freshnessLabel: freshness === 'fresh' ? 'Fresh' : freshness === 'expired' ? 'Price expired' : 'Price unavailable',
  };

  const { symbol } = chainConfig(chain);

  // Lane G: with no wallet there is no balance to show — but the live
  // per-unit price is public data, so the card shows the price, never
  // a bare "—" (the owner saw "□ —" on every card). While the first
  // price fetch is still in flight the card shows the loader, not a
  // premature failure; a failed feed says so in words.
  if (vaultState === "no-vault") {
    if (pricesLoading && unitPrice.kind === "unavailable") {
      return { loading: true, primary: "—", ...metadata };
    }
    if (unitPrice.kind === "fresh") {
      return {
        loading: false,
        primary: unitPrice.text,
        secondary: `per ${symbol}`,
        ...metadata,
      };
    }
    if (unitPrice.kind === "expired") {
      return { loading: false, primary: "Price expired", ...metadata };
    }
    if (unitPrice.kind === "error") {
      return { loading: false, primary: "Price error", ...metadata };
    }
    return { loading: false, primary: "Price unavailable", ...metadata };
  }

  if (vaultState === "locked") {
    return { loading: false, primary: "Locked", ...metadata };
  }

  if (balance.status === "loading") {
    return { loading: true, primary: "—", ...metadata };
  }

  if (balance.status === "unavailable" || balance.status === "error") {
    return { loading: false, primary: "Unavailable", ...metadata };
  }

  const decimals = CHAIN_DECIMALS[chain];

  const hasFreshPrice =
    entry?.status === "fresh" && unitPrice.kind === "fresh";

  const perUnitPrice = hasFreshPrice
    ? `${unitPrice.text} per ${symbol}`
    : undefined;

  const priceStateLabel =
    unitPrice.kind === "expired"
      ? "Price expired"
      : unitPrice.kind === "error"
        ? "Price error"
        : unitPrice.kind === "unavailable"
          ? "Price unavailable"
          : undefined;

  // An initial fetch has not established an unavailable price state yet.
  const priceIsMissing =
    pricesLoading && unitPrice.kind === "unavailable";

  const priceSecondary = priceIsMissing
    ? undefined
    : perUnitPrice ?? priceStateLabel;

  if (balance.status === "zero") {
    return {
      loading: false,
      primary: mode === "dashboard" ? `0 ${symbol}` : "Zero balance",
      ...(priceSecondary === undefined ? {} : { secondary: priceSecondary }),
      ...metadata,
    };
  }

  if (balance.value === undefined) {
    return { loading: false, primary: "Unavailable", ...metadata };
  }

  const fiatValue =
    hasFreshPrice && entry !== undefined && !devnet
      ? fiatValueForBalance(chain, balance, entry, nowMs)
      : undefined;
  const fiatText = fiatValue?.kind === "fiat" ? fiatValue.text : undefined;

  const secondary = priceIsMissing
    ? undefined
    : fiatText ?? priceSecondary;

  return {
    loading: false,
    primary: formatNativeWithSymbol(balance.value, decimals, symbol),
    ...(secondary === undefined ? {} : { secondary }),
    ...metadata,
  };
}
