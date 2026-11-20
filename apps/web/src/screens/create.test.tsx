// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { CreateScreen } from './create';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

describe('CreateScreen', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/create']}>
          <CreateScreen />
        </MemoryRouter>,
      );
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (previousActEnvironment === undefined) {
      delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
    } else {
      testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
  });

  function elementsWithExactText(text: string) {
    return Array.from(container.querySelectorAll('*')).filter(
      (element) =>
        element.textContent?.trim() === text &&
        !Array.from(element.children).some(
          (child) => child.textContent?.trim() === text,
        ),
    );
  }

  it('shows Create as an h1', () => {
    const heading = container.querySelector('#create-title');

    expect(heading?.tagName).toBe('H1');
    expect(heading?.textContent).toBe('Create');
  });

  it('lists all seven tool names in order', () => {
    const names = [
      'Multichain wallet',
      'HD wallet',
      'Web wallet',
      'Android wallet',
      'Smart contract creator',
      'Multi-Sig Wallet v2',
      'Web3 Wallet Kit',
    ];
    const cards = Array.from(
      container.querySelectorAll('section > ul > li'),
    );

    expect(cards).toHaveLength(7);
    names.forEach((name, index) => {
      expect(elementsWithExactText(name)).toHaveLength(1);
      expect(cards[index]?.textContent).toContain(name);
    });
  });

  it('shows exactly five Coming soon badges', () => {
    expect(elementsWithExactText('Coming soon')).toHaveLength(5);
  });

  it('shows exactly two Available badges', () => {
    expect(elementsWithExactText('Available')).toHaveLength(2);
  });

  it('links only the two working cards to /create-wallet', () => {
    const links = Array.from(
      container.querySelectorAll('a[href="/create-wallet"]'),
    );

    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Open Multichain wallet creation',
      'Open HD wallet creation',
    ]);

    container.querySelectorAll('article').forEach((card) => {
      expect(
        card.querySelectorAll('a[href="/create-wallet"]'),
      ).toHaveLength(0);
    });
  });

  it('shows no developer references on any card', () => {
    // Lane C finalisation: the build catalogue (repository names, commit
    // hashes, licences, WASM/JNI notes) was removed from this screen.
    // A wallet user sees what each tool does and whether it works yet.
    expect(container.textContent).not.toContain('github.com');
    expect(container.textContent).not.toContain('References');
    expect(container.textContent).not.toContain('build brief');
    expect(container.textContent).not.toContain('WASM');
    expect(container.textContent).not.toContain('JNI');
    expect(container.querySelectorAll('article')).toHaveLength(5);
  });

  it('states that every planned card is not available yet', () => {
    const planned = container.querySelectorAll(
      'article[aria-label$=" coming soon"]',
    );

    expect(planned).toHaveLength(5);
    planned.forEach((card) => {
      expect(card.textContent).toContain(
        'Not available yet — planned for a later version.',
      );
    });
  });

  it('shows the separate dashboard workspace note', () => {
    expect(
      elementsWithExactText(
        "Your wallet dashboard stays separate. Creating a wallet here won't replace it.",
      ),
    ).toHaveLength(1);
  });
});
