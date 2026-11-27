// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { ReactElement } from "react";

import { BawaLoading } from "./loading";
import { Skeleton } from "./skeleton";

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type MountedEntry = {
  root: ReturnType<typeof createRoot>;
  div: HTMLDivElement;
  previous: boolean | undefined;
};

const mountedEntries: MountedEntry[] = [];

async function mount(node: ReactElement): Promise<HTMLDivElement> {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  const previous = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  mountedEntries.push({ root, div, previous });
  await act(async () => {
    root.render(node);
  });
  return div;
}

afterEach(async () => {
  while (mountedEntries.length > 0) {
    const entry = mountedEntries.pop();
    if (!entry) break;
    try {
      await act(async () => {
        entry.root.unmount();
      });
    } finally {
      entry.div.remove();
      if (entry.previous === undefined) {
        delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
      } else {
        testGlobal.IS_REACT_ACT_ENVIRONMENT = entry.previous;
      }
    }
  }
});

function getByRole(container: HTMLDivElement, role: string): Element {
  const el = container.querySelector(`[role="${role}"]`);
  if (!el) throw new Error(`No element with role ${role}`);
  return el;
}

function getByText(container: HTMLDivElement, text: string): Element {
  const matches = [...container.querySelectorAll("*")].filter(
    (el) => el.textContent === text,
  );
  const deepest = matches.find(
    (el) => ![...el.children].some((child) => child.textContent === text),
  );
  if (!deepest) throw new Error(`No element with text ${text}`);
  return deepest;
}

describe("BawaLoading", () => {
  it("renders a status, the default label, a spinner, and three Ink dots", async () => {
    const container = await mount(<BawaLoading />);

    const status = getByRole(container, "status");
    const label = getByText(container, "Loading…");
    const svg = status.querySelector("svg");

    expect(status.contains(label)).toBe(true);
    expect(label.classList.contains("font-display")).toBe(true);
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 48 48");
    expect(svg?.querySelector("path.bawa-draw-circle")).not.toBeNull();
    expect(status.querySelectorAll("span.bawa-dot")).toHaveLength(3);

    expect(
      container.querySelector('[class*="animate-pulse"]'),
    ).toBeNull();

    const classes = Array.from(
      container.querySelectorAll("[class]"),
    ).flatMap((element) => Array.from(element.classList));

    const hasGreyBackgroundClass = classes.some((name) =>
      /(?:^|:)!?bg-(?:gray|grey|slate|zinc|neutral|stone)(?:-|$)/.test(
        name,
      ),
    );

    expect(hasGreyBackgroundClass).toBe(false);
  });

  it("names the route under the default label, and no route line with an explicit label", async () => {
    // P0-6: the app shell's Suspense fallback renders <BawaLoading />
    // with no label, so a bare "Loading…" never says which screen is
    // coming. The route name rides under the literal label (the
    // 'Loading…' text itself is unchanged, so the app settle loops
    // keep matching). jsdom starts at "/", i.e. Home.
    const home = await mount(<BawaLoading />);
    expect(getByText(home, "Loading…")).not.toBeNull();
    expect(getByText(home, "Home")).not.toBeNull();

    const previous = window.location.pathname;
    window.history.pushState({}, "", "/transactions");
    try {
      const transactions = await mount(<BawaLoading />);
      expect(getByText(transactions, "Transactions")).not.toBeNull();
      expect(getByText(transactions, "Loading…")).not.toBeNull();
    } finally {
      window.history.pushState({}, "", previous);
    }

    const labelled = await mount(
      <BawaLoading label="Finding your wallet…" />,
    );
    expect(getByText(labelled, "Finding your wallet…")).not.toBeNull();
    // An explicit label carries its own words: no route line is added.
    expect(labelled.textContent).not.toContain("Home");
  });

  it("accepts a custom label and className", async () => {
    const container = await mount(
      <BawaLoading label="Finding your wallet…" className="wallet-loading" />,
    );

    expect(getByRole(container, "status").classList.contains("wallet-loading")).toBe(
      true,
    );
    expect(getByText(container, "Finding your wallet…")).not.toBeNull();
  });

  it("renders the full column loader by default, not the compact row", async () => {
    const container = await mount(<BawaLoading />);

    const status = getByRole(container, "status");
    expect(status.classList.contains("bawa-loading-compact")).toBe(false);
    const svg = status.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("48");
    expect(svg?.getAttribute("height")).toBe("48");
  });

  it("renders a compact row loader that fits a fixed-height skeleton", async () => {
    // P2: the full loader (48px spinner + dots + 1.5rem label) is
    // ~110px tall, so inside a fixed 68px skeleton row the "Loading…"
    // label spilled over the container's bottom border, half-clipped.
    // The compact row keeps the same label and dots beside a smaller
    // spinner, so it fits the row it loads in.
    const container = await mount(<BawaLoading compact />);

    const status = getByRole(container, "status");
    expect(status.classList.contains("bawa-loading-compact")).toBe(true);
    expect(getByText(container, "Loading…")).not.toBeNull();
    const svg = status.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
    expect((status as HTMLElement).style.flexDirection).toBe("row");
    expect(status.querySelectorAll("span.bawa-dot")).toHaveLength(3);
  });
});

describe("Skeleton", () => {
  it("keeps its data slot and contains the loading label", async () => {
    const container = await mount(<Skeleton />);

    const skeleton = container.querySelector('[data-slot="skeleton"]');
    const label = getByText(container, "Loading…");

    expect(skeleton).not.toBeNull();
    expect(skeleton?.contains(label)).toBe(true);
    expect(skeleton?.contains(getByRole(container, "status"))).toBe(true);
  });

  it("renders the label visibly as a compact row when one is passed", async () => {
    // P0-6: the wordless pulsing bar left the Transactions screen
    // blank for 10–35 s. A labelled skeleton shows the compact
    // loader — spinner, dots and the label beside them — inside the
    // box, so the loading state has words.
    const container = await mount(
      <Skeleton className="h-24 w-full" label="Loading your activity…" />,
    );

    const skeleton = container.querySelector('[data-slot="skeleton"]');
    expect(skeleton).not.toBeNull();
    expect(getByText(container, "Loading your activity…")).not.toBeNull();
    expect(skeleton?.contains(getByRole(container, "status"))).toBe(true);
    expect(
      getByRole(container, "status").classList.contains(
        "bawa-loading-compact",
      ),
    ).toBe(true);
  });
});
