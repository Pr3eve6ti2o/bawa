// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router';
import { CreateScreen } from './create-hub';

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
      'Multi-signature wallet',
      'Connect an existing wallet',
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

  it('shows exactly four Coming soon badges', () => {
    expect(elementsWithExactText('Coming soon')).toHaveLength(4);
  });

  it('shows exactly three Available badges', () => {
    expect(elementsWithExactText('Available')).toHaveLength(3);
  });

  it('the web wallet is available and opens the dashboard', () => {
    // Lane C, item 10: the web wallet exists — it is this app — so it
    // is Available, not Coming soon, and it opens the dashboard.
    expect(container.textContent).toContain('Three options are ready today');
    const cards = Array.from(container.querySelectorAll('section > ul > li'));
    const webWallet = cards[2];
    expect(webWallet?.textContent).toContain('Available');
    expect(webWallet?.textContent).not.toContain('Coming soon');
    const link = webWallet?.querySelector('a[href="/"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('aria-label')).toBe('Open web wallet');
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

  it('shows no developer references', () => {
    // The Create screen is for normal wallet users: no repository links,
    // commit hashes, licence notes or implementation references render.
    const links = Array.from(container.querySelectorAll('a'));

    expect(links).toHaveLength(3);
    links.forEach((link) => {
      expect(['/create-wallet', '/']).toContain(link.getAttribute('href'));
    });
    expect(container.textContent).not.toContain('github.com');
    expect(container.textContent).not.toContain('References');
  });

  it('states that every coming-soon card is not available yet', () => {
    const briefs = container.querySelectorAll(
      'article[aria-label$=" coming soon"]',
    );

    expect(briefs).toHaveLength(4);
    briefs.forEach((card) => {
      // The Coming soon badge is the whole notice now; a brief card
      // offers no action to open it.
      expect(card.textContent).toContain('Coming soon');
      expect(card.querySelector('a, button')).toBeNull();
    });
  });

  it('shows the separate dashboard note', () => {
    expect(
      elementsWithExactText(
        'Creating a wallet here does not replace your dashboard.',
      ),
    ).toHaveLength(1);
  });
});
