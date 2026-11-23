// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PopularChainsStrip } from "./chain-strip";
import { chainStripDisplay } from "./chain-strip-display";
import { parsePriceResponse } from "../wallet/prices";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../state/wallet-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../state/wallet-context")>()),
  useWallet: mocks.useWallet,
}));

vi.mock("../wallet/prices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../wallet/prices")>()),
  usePrices: () => ({
    state: { status: "idle", entries: {} },
    refresh: mocks.refresh,
  }),
}));

const balances = {
  btc: { status: "available", value: "100000000" },
  eth: { status: "zero" },
  trx: { status: "unavailable" },
  ton: { status: "error", reason: "no-adapter" },
} as const;

const chains = [
  ["btc", "Bitcoin"],
  ["eth", "Ethereum"],
  ["trx", "TRON"],
  ["ton", "TON"],
] as const;

const actGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe("PopularChainsStrip", () => {
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    previousActEnvironment = actGlobal.IS_REACT_ACT_ENVIRONMENT;
    actGlobal.IS_REACT_ACT_ENVIRONMENT = true;

    vi.clearAllMocks();
    mocks.useWallet.mockReturnValue({
      balances,
      vaultState: "unlocked",
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();

    if (previousActEnvironment === undefined) {
      delete actGlobal.IS_REACT_ACT_ENVIRONMENT;
    } else {
      actGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  async function renderStrip(initialPath = "/") {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[initialPath]}>
          <PopularChainsStrip mode="welcome" />
        </MemoryRouter>,
      );
    });
  }

  function linkTo(href: string): HTMLAnchorElement {
    const link = container.querySelector<HTMLAnchorElement>(
      `a[href="${href}"]`,
    );
    expect(link).not.toBeNull();
    return link!;
  }

  it("keeps the fixed chain order followed by All networks", async () => {
    await renderStrip();

    const hrefs = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a[href]"),
      (link) => link.getAttribute("href"),
    );

    expect(hrefs).toEqual([
      "/assets/btc",
      "/assets/eth",
      "/assets/trx",
      "/assets/ton",
      "/networks",
    ]);
    expect(linkTo("/networks").textContent).toContain("All networks");
  });

  it("spans the full grid row and snaps cards fully into view when scrolling", async () => {
    await renderStrip();

    // Full-width row: without lg:col-span-full the strip lands in one
    // parent-grid column (dashboard 7fr/2fr, welcome 1 of 5) and the
    // "All networks" card is cut off at desktop widths where all five
    // cards would otherwise fit.
    const section = container.querySelector("section");
    expect(section?.className).toContain("lg:col-span-full");

    const list = container.querySelector("ul");
    expect(list).not.toBeNull();
    expect(list?.className).toContain("snap-x");
    expect(list?.className).toContain("snap-mandatory");
    expect(list?.className).toContain("scroll-px-1");
    // Keyboard users can scroll the strip with arrow keys when it overflows.
    expect(list?.getAttribute("tabindex")).toBe("0");

    // Every card is a snap point, so a scroll never rests with a card
    // cut off mid-word.
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item.className).toContain("snap-start");
    }
  });

  it("shows an SVG coin doodle and display name for every chain, without images", async () => {
    await renderStrip();

    for (const [chain, name] of chains) {
      const link = linkTo(`/assets/${chain}`);
      expect(link.querySelector("svg")).not.toBeNull();
      expect(link.textContent).toContain(name);
    }

    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("distinguishes unavailable and zero balances without showing $0.00", async () => {
    await renderStrip();

    expect(linkTo("/assets/trx").textContent).toContain("Unavailable");
    expect(linkTo("/assets/eth").textContent).toContain("Zero balance");

    for (const [chain] of chains) {
      expect(linkTo(`/assets/${chain}`).textContent).not.toContain("$0.00");
    }
  });

  it("shows an em dash for every chain when there is no vault", async () => {
    mocks.useWallet.mockReturnValue({
      balances,
      vaultState: "no-vault",
    });

    await renderStrip();

    for (const [chain] of chains) {
      expect(linkTo(`/assets/${chain}`).textContent).toContain("—");
    }
  });

  it("marks ETH as the current page at /assets/eth", async () => {
    await renderStrip("/assets/eth");

    expect(linkTo("/assets/eth").getAttribute("aria-current")).toBe("page");
  });
});

describe("chainStripDisplay devnet (Round 2, item 6)", () => {
  it("shows the per-unit price, never a fiat value, for a test balance", () => {
    const nowMs = Date.now();
    const entries = parsePriceResponse(
      {
        bitcoin: { usd: 62683, last_updated_at: Math.floor(nowMs / 1000) - 30 },
      },
      nowMs,
    );
    const balance = { status: "available", value: "50000000" } as const;
    // Mainnet: 0.5 BTC is worth $31,341.50 at the live price.
    const mainnet = chainStripDisplay(
      "btc",
      balance,
      entries.btc,
      nowMs,
      "unlocked",
      false,
      "dashboard",
    );
    expect(mainnet.secondary).toBe("$31,341.50");
    // Devnet: the same balance is valueless test BTC — the card shows
    // the live per-unit price instead, never the dollar value.
    const devnet = chainStripDisplay(
      "btc",
      balance,
      entries.btc,
      nowMs,
      "unlocked",
      false,
      "dashboard",
      true,
    );
    expect(devnet.secondary).toBe("$62,683.00 per BTC");
    expect(devnet.secondary).not.toContain("$31,341.50");
  });
});
