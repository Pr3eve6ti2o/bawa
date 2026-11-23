import { useEffect } from "react";
import { Link, NavLink } from "react-router";

import { ChainLogo } from "./token-logo";
import { chainStripDisplay } from "./chain-strip-display";
import { useWallet } from "../state/wallet-context";
import {
  usePrices,
  PRICE_ATTRIBUTION_TEXT,
  type PriceMap,
} from "../wallet/prices";
import { chainConfig } from "../wallet/chains";
import type { ChainId } from "../engine/boundary";
import { BawaIcon } from "../ui/components/icons";
import { BawaLoading } from "../ui/components/loading";

const TILE_CLASS_NAME =
  "flex h-full flex-col items-center gap-2 rounded-bawa-sm border-2 border-ink bg-paper px-4 py-4 text-center text-ink shadow-bawa focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink active:translate-x-1 active:translate-y-1 active:shadow-none";

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

  // Lane G: prices are public — the welcome strip fetches them even
  // with no vault, so the no-vault cards show the live per-unit price
  // instead of a bare dash. (The old gate skipped the fetch with no
  // vault, which is exactly why the cards could only show "—".)
  useEffect(() => {
    if (mode === "welcome" && pricesState.status === "idle") {
      void refreshPrices();
    }
  }, [mode, pricesState.status, refreshPrices]);

  // Popular chains are the four original adapter chains. The full
  // 13-chain registry belongs on /assets and /networks; the strip
  // is a compact horizontal list and stays at five cards (four
  // chains + All networks). availableFor('balance') now returns
  // all 13 (token discovery), so the strip no longer derives
  // its list from it.
  const chains: readonly ChainId[] = ['btc', 'eth', 'trx', 'ton'];

  // The strip sits in a parent grid on both screens (dashboard 2-col,
  // welcome 5-col). lg:col-span-full keeps it on a full-width row so all
  // five cards fit at desktop widths instead of being squeezed into one
  // column and scrolling; below lg the parents are block layout and the
  // class is inert.
  return (
    <section
      aria-labelledby="popular-chains-title"
      className="min-w-0 bg-paper text-ink lg:col-span-full"
    >
      <h2 id="popular-chains-title" className="text-xl font-semibold text-ink">
        Popular chains
      </h2>

      {/* When the strip is narrower than the five cards (mobile, narrow
          desktop) it scrolls; mandatory snap lands every card fully in
          view so a label is never left cut off mid-word. */}
      <ul
        tabIndex={0}
        aria-label="Popular chains"
        className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-1 px-1 py-2"
      >
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
            wallet?.devnetEnabled === true,
          );
          const shownPrimary =
            hideBalance &&
            display.primary !== "Unavailable" &&
            display.primary !== "Locked" &&
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
            <li key={chain} className="min-w-36 flex-1 snap-start">
              <NavLink
                to={`/assets/${chain}`}
                aria-current="page"
                className={TILE_CLASS_NAME}
              >
                {({ isActive }) => (
                  <>
                    {/* Lane G: the real chain mark. The hand-drawn blob
                        with the ticker text inside rendered as a
                        crossed-out logo on the owner's phone; the
                        bordered tile stays (the brand frame), the
                        doodle inside it goes. */}
                    <span
                      aria-hidden="true"
                      className={`inline-flex size-12 shrink-0 -rotate-3 items-center justify-center rounded-bawa-sm border-2 border-ink text-ink ${
                        isActive ? "bg-sun" : "bg-paper"
                      }`}
                    >
                      <ChainLogo chain={chain} size={40} />
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
                      {/* Lane G: no freshness square with no vault —
                          it marks whether a shown balance's price is
                          fresh, and with no wallet the primary IS the
                          price. With no price at all the square
                          rendered as an empty "□" next to the dash. */}
                      {vaultState !== "no-vault" && (
                        <span
                          aria-hidden="true"
                          className={`size-2.5 shrink-0 rounded-bawa-sm border-2 border-ink ${freshnessClassName}`}
                        />
                      )}

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

        <li className="min-w-36 flex-1 snap-start">
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
