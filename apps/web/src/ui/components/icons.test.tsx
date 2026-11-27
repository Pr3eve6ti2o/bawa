// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import type { ReactElement } from "react";
import { BAWA_ICON_NAMES, BawaIcon, ScanIcon, type BawaIconName } from "./icons";

const EXPECTED_ICON_NAMES: readonly BawaIconName[] = [
  "wallet",
  "home",
  "coins",
  "receive",
  "send",
  "activity",
  "more",
  "search",
  "import",
  "plus",
  "wrench",
  "shield",
  "network",
  "key",
  "book",
  "door",
  "collapse",
  "expand",
  "eye",
  "eye-off",
  "close",
  "check",
  "chevron-down",
  "chevron-up",
  "alert",
  "arrow-up-right",
  "arrow-down",
  "arrow-left",
  "arrow-down-left",
  "arrow-left-right",
  "swap",
  "copy",
  "card",
  "link",
  "clock",
];

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

describe("BawaIcon", () => {
  it("exports every supported name without duplicates", () => {
    expect(new Set(BAWA_ICON_NAMES).size).toBe(BAWA_ICON_NAMES.length);
    expect([...BAWA_ICON_NAMES].sort()).toEqual(
      [...EXPECTED_ICON_NAMES].sort(),
    );
  });

  it.each(BAWA_ICON_NAMES)(
    "renders %s with the shared inline SVG contract",
    async (name) => {
      const container = await mount(<BawaIcon name={name} />);
      const svgs = container.querySelectorAll("svg");

      expect(svgs).toHaveLength(1);

      const svg = svgs.item(0);

      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("stroke-width")).toBe("2");
      expect(svg.getAttribute("stroke-linecap")).toBe("round");
      expect(svg.getAttribute("stroke-linejoin")).toBe("round");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
      expect(svg.outerHTML).not.toContain("#");
    },
  );

  it("forwards className to the SVG", async () => {
    const container = await mount(
      <BawaIcon name="wallet" className="wallet-icon" />,
    );

    expect(container.querySelector("svg")?.getAttribute("class")).toBe(
      "wallet-icon",
    );
  });
});

describe("ScanIcon", () => {
  it("renders the reference glyph: dark disc, white corner brackets and centre line", async () => {
    const container = await mount(
      <ScanIcon className="h-11 w-11 text-ink" />,
    );
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 48 48");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toBe("h-11 w-11 text-ink");

    // The disc takes its colour from the caller's text colour (text-ink).
    const circle = svg?.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("currentColor");

    // Four corner brackets plus the centre scan line, all white.
    const paths = [...(svg?.querySelectorAll("path") ?? [])];
    expect(paths).toHaveLength(5);
    for (const path of paths) {
      expect(path.getAttribute("stroke")).toBe("#fff");
    }
  });
});
