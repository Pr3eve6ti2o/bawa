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

  it('shows no developer references', () => {
    // The Create screen is for normal wallet users: no repository links,
    // commit hashes, licence notes or implementation references render.
    const links = Array.from(container.querySelectorAll('a'));

    expect(links).toHaveLength(2);
    links.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/create-wallet');
    });
    expect(container.textContent).not.toContain('github.com');
    expect(container.textContent).not.toContain('References');
  });

  it('states that every coming-soon card is not available yet', () => {
    const briefs = container.querySelectorAll(
      'article[aria-label$=" coming soon"]',
    );

    expect(briefs).toHaveLength(5);
    briefs.forEach((card) => {
      expect(card.textContent).toContain(
        "Coming soon. This isn't available yet.",
      );
    });
  });

  it('shows the separate dashboard note', () => {
    expect(
      elementsWithExactText(
        'Your wallet dashboard stays separate. Creating a wallet here does not replace it.',
      ),
    ).toHaveLength(1);
  });

  it('lays the seven tools out in four columns on desktop widths, with no lone orphan', () => {
    // P6: seven cards in a 3-col grid left a lone orphan card in row
    // 3. Four columns make it 4 + 3 at desktop widths; below xl the
    // grid stays two-wide, so the mobile layout is untouched.
    const list = container.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list?.className).toContain('md:grid-cols-2');
    expect(list?.className).toContain('xl:grid-cols-4');
    expect(list?.className).not.toContain('xl:grid-cols-3');
    expect(list?.querySelectorAll(':scope > li')).toHaveLength(7);
  });
});
