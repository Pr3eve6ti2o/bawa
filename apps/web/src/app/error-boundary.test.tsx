// @vitest-environment jsdom

import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./error-boundary";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function ThrowingChild({ message }: { message: string }): never {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container, {
      onCaughtError: () => {
        // Keep intentional render failures out of React's default error logging.
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();

    if (previousActEnvironment === undefined) {
      delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    } else {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  it("renders children normally", () => {
    const onError = vi.fn();

    act(() => {
      root.render(
        <ErrorBoundary onError={onError}>
          <p>Wallet content</p>
        </ErrorBoundary>,
      );
    });

    expect(container.textContent).toBe("Wallet content");
    expect(container.querySelector("button")).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("shows the fallback and reports one message when a child throws", () => {
    const onError = vi.fn();

    act(() => {
      root.render(
        <ErrorBoundary
          fallbackTitle="Unable to show your wallet"
          onError={onError}
        >
          <ThrowingChild message="Test render failure." />
        </ErrorBoundary>,
      );
    });

    expect(container.querySelector("h2")?.textContent).toBe(
      "Unable to show your wallet",
    );
    expect(container.querySelector("p")?.textContent).toBe(
      "Something went wrong while displaying this page.",
    );
    expect(container.querySelector("button")?.textContent).toBe("Try again");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ message: expect.any(String) });
  });

  it('"Try again" restores the children', () => {
    let shouldThrow = true;

    function RecoverableChild() {
      if (shouldThrow) {
        throw new Error("Test render failure.");
      }
      return <p>Wallet content restored</p>;
    }

    act(() => {
      root.render(
        <ErrorBoundary>
          <RecoverableChild />
        </ErrorBoundary>,
      );
    });

    const retryButton = container.querySelector("button");
    expect(retryButton?.textContent).toBe("Try again");

    act(() => {
      shouldThrow = false;
      retryButton?.click();
    });

    expect(container.textContent).toBe("Wallet content restored");
    expect(container.querySelector("button")).toBeNull();
  });

  it("never renders the thrown error's text verbatim", () => {
    const address = "0x1111111111111111111111111111111111111111";
    const balance = "42.5 BAWA";
    const secret = "test-only-wallet-secret";
    const message = `Address: ${address}; balance: ${balance}; seed: ${secret}.`;
    const onError = vi.fn();

    act(() => {
      root.render(
        <ErrorBoundary onError={onError}>
          <ThrowingChild message={message} />
        </ErrorBoundary>,
      );
    });

    expect(container.querySelector("h2")?.textContent).toBe(
      "Something went wrong",
    );

    const fallbackText = container.textContent ?? "";
    expect(fallbackText).not.toContain(message);
    for (const sensitiveText of [address, balance, secret]) {
      expect(fallbackText).not.toContain(sensitiveText);
    }

    expect(onError).toHaveBeenCalledWith({
      message: "Something went wrong while displaying this page.",
    });
  });
});
