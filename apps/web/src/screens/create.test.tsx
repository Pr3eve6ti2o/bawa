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

  it('shows exactly five Build brief badges', () => {
    expect(elementsWithExactText('Build brief')).toHaveLength(5);
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

  it('shows the required SDK references and the GPLv3 restriction', () => {
    const referenceNames = [
      'BitGo eth-multisig-v2',
      'Safe Core SDK',
      'RabbyKit',
      'OpenZeppelin Contracts',
      'Via web3-wallets',
      'Rabby Mobile',
    ];
    const links = Array.from(container.querySelectorAll('a'));

    referenceNames.forEach((name) => {
      expect(
        links.some((link) =>
          (link.textContent ?? '').startsWith(`${name} (`),
        ),
      ).toBe(true);
    });

    const kitBrief = container.querySelector(
      'article[aria-label="Web3 Wallet Kit build brief"]',
    );
    const safeWalletReference = Array.from(
      kitBrief?.querySelectorAll('a') ?? [],
    ).find((link) =>
      (link.textContent ?? '').startsWith('Safe Wallet monorepo ('),
    );

    expect(safeWalletReference).toBeDefined();
    expect(safeWalletReference?.closest('li')?.textContent).toContain(
      'GPLv3: no copying into this MIT app.',
    );
  });

  it('states that every brief card is not implemented yet', () => {
    const briefs = container.querySelectorAll(
      'article[aria-label$=" build brief"]',
    );

    expect(briefs).toHaveLength(5);
    briefs.forEach((card) => {
      expect(card.textContent).toContain(
        'Not implemented yet. This is a build brief, not a working feature.',
      );
    });
  });

  it('shows the separate dashboard workspace note', () => {
    expect(
      elementsWithExactText(
        'The wallet dashboard stays a separate workspace. Creating a wallet here does not replace it.',
      ),
    ).toHaveLength(1);
  });
});
