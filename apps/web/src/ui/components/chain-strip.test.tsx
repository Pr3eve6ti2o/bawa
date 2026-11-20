// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PopularChainsStrip } from "./chain-strip";

const mocks = vi.hoisted(() => ({
  useWallet: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../state/wallet-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../state/wallet-context")>()),
  useWallet: mocks.useWallet,
}));

vi.mock("../../wallet/prices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../wallet/prices")>()),
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
