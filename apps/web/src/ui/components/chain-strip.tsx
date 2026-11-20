import { useEffect } from "react";
import { Link, NavLink } from "react-router";

import { chainStripDisplay } from "./chain-strip-display";
import { useWallet } from "../../state/wallet-context";
import {
  usePrices,
  PRICE_ATTRIBUTION_TEXT,
  type PriceMap,
} from "../../wallet/prices";
import { availableFor, chainConfig } from "../../wallet/chains";
import { BawaIcon } from "./icons";
import { BawaLoading } from "./loading";

const TILE_CLASS_NAME =
  "flex h-full flex-col items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper px-4 py-4 text-center text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink";

export function PopularChainsStrip({
  mode,
  hideBalance = false,
  entries,
  pricesLoading,
  nowMs,
}: {
  mode: "welcome" | "dashboard";
  hideBalance?: boolean;
  entries?: PriceMap;
  pricesLoading?: boolean;
  nowMs?: number;
}) {
  const wallet = useWallet();
  const balances = wallet?.balances;
  const vaultState = wallet?.vaultState ?? "no-vault";
  const { state: pricesState, refresh: refreshPrices } = usePrices();

  useEffect(() => {
    if (
      mode === "welcome" &&
      vaultState !== "no-vault" &&
      pricesState.status === "idle"
    ) {
      void refreshPrices();
    }
  }, [mode, vaultState, pricesState.status, refreshPrices]);

  const chains = availableFor("balance");

  return (
    <section
      aria-labelledby="popular-chains-title"
      className="min-w-0 bg-paper text-ink"
    >
      <h2 id="popular-chains-title" className="text-xl font-semibold text-ink">
        Popular chains
      </h2>

      <ul className="mt-3 flex gap-3 overflow-x-auto px-1 py-2">
        {chains.map((chain) => {
          const config = chainConfig(chain);
          const display = chainStripDisplay(
            chain,
            balances?.[chain] ?? { status: "unavailable" },
            entries?.[chain] ?? pricesState.entries[chain],
            nowMs ?? Date.now(),
            vaultState,
            pricesLoading ?? pricesState.status === "loading",
            mode,
          );
          const shownPrimary =
            hideBalance &&
            display.primary !== "Unavailable" &&
            display.primary !== "—" &&
            display.primary !== "Zero balance"
              ? "••••••"
              : display.primary;
          const shownSecondary = hideBalance ? undefined : display.secondary;

          const freshnessClassName =
            display.freshness === "fresh"
              ? "bg-sun"
              : display.freshness === "expired"
                ? "bg-coral"
                : "bg-paper";

          return (
            <li key={chain} className="min-w-36 flex-1">
              <NavLink
                to={`/assets/${chain}`}
                aria-current="page"
                className={TILE_CLASS_NAME}
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-12 shrink-0 -rotate-3 items-center justify-center rounded-bawa-sm border-2 border-ink text-ink ${
                        isActive ? "bg-sun" : "bg-paper"
                      }`}
                    >
                      <svg
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                        className="size-10 rotate-3"
                      >
                        <path
                          d="M24 4C35 3 44 13 43 24C45 35 34 45 24 43C12 45 3 35 5 24C3 13 13 3 24 4Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                        />
                        <text
                          x="24"
                          y="24"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="currentColor"
                          fontFamily="Caveat, cursive"
                          fontSize={24}
                        >
                          {config.symbol}
                        </text>
                      </svg>
                    </span>

                    <span
                      className={`text-base font-semibold text-ink ${
                        isActive
                          ? "bawa-squiggle-underline decoration-coral"
                          : ""
                      }`}
                    >
                      {config.displayName}
                    </span>

                    <div className="flex min-h-5 items-center justify-center gap-2 text-sm text-ink">
                      <span
                        aria-hidden="true"
                        className={`size-2.5 shrink-0 rounded-bawa-sm border-2 border-ink ${freshnessClassName}`}
                      />

                      {display.loading ? (
                        <BawaLoading />
                      ) : (
                        <span>{shownPrimary}</span>
                      )}
                    </div>

                    {shownSecondary && (
                      <span className="text-xs leading-relaxed text-ink">
                        {shownSecondary}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}

        <li className="min-w-36 flex-1">
          <Link to="/networks" className={TILE_CLASS_NAME}>
            <span
              aria-hidden="true"
              className="inline-flex size-12 shrink-0 -rotate-3 items-center justify-center rounded-bawa-sm border-2 border-ink bg-paper text-ink"
            >
              <BawaIcon name="network" />
            </span>
            <span className="text-base font-semibold text-ink">
              All networks
            </span>
          </Link>
        </li>
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-ink">
        {PRICE_ATTRIBUTION_TEXT}
      </p>
    </section>
  );
}
