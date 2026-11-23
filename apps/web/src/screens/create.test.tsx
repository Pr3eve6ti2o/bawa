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

  it('has exactly one button, and it creates the wallet', () => {
    // Finish-product Lane I: one wallet, one button. The old screen
    // offered two cards for the same wallet (Multichain / HD, then
    // Create a wallet / Web wallet); there is one action now.
    const links = Array.from(container.querySelectorAll('a'));

    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/create-wallet');
    expect(links[0]?.getAttribute('aria-label')).toBe('Create your wallet');
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('says on the button card what creating gets you', () => {
    // The message on the single button card: one recovery phrase, one
    // wallet, 22 chains.
    expect(container.textContent).toContain('Create a wallet');
    expect(container.textContent).toContain('One recovery phrase');
    expect(container.textContent).toContain('22 chains');
    expect(container.textContent).toContain('24-word recovery phrase');
  });

  it('presents one wallet identity, honestly', () => {
    // One phrase, one account; the shared EVM address shown once; and
    // the honest limit — no single address works on every chain.
    expect(elementsWithExactText('One wallet, one identity')).toHaveLength(1);
    expect(container.textContent).toContain('One recovery phrase');
    expect(container.textContent).toContain('One account');
    expect(container.textContent).toContain('One shared address');
    expect(container.textContent).toContain(
      'Ethereum, BNB Smart Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Gnosis, Celo, Linea, Mantle, Scroll, opBNB, Metis, Aurora and Fantom all use the same address',
    );
    expect(container.textContent).toContain(
      'There is no single address that works on every chain.',
    );
  });

  it('has no second wallet card and no web-wallet card', () => {
    // The Web wallet is this app — it is not something to create, and
    // the dashboard is reached from the navigation, not this screen.
    expect(container.textContent).not.toContain('Web wallet');
    expect(container.textContent).not.toContain('Open web wallet');
    expect(container.textContent).not.toContain('Multichain wallet');
    expect(container.textContent).not.toContain('HD wallet');
    expect(container.textContent).not.toContain('Same setup as');
    expect(container.querySelector('a[href="/"]')).toBeNull();
    expect(elementsWithExactText('Available')).toHaveLength(0);
  });

  it('lists the four not-yet-available tools as plain text, with no actions', () => {
    const names = [
      'Android wallet',
      'Smart contract creator',
      'Multi-signature wallet',
      'Connect an existing wallet',
    ];
    names.forEach((name) => {
      expect(elementsWithExactText(name)).toHaveLength(1);
    });
    expect(elementsWithExactText('Coming soon')).toHaveLength(1);
    const comingSoon = container.querySelector('#coming-soon');
    expect(comingSoon).not.toBeNull();
    expect(comingSoon?.querySelectorAll('a, button')).toHaveLength(0);
  });

  it('shows no developer references', () => {
    // The Create screen is for normal wallet users: no repository links,
    // commit hashes, licence notes or implementation references render.
    const links = Array.from(container.querySelectorAll('a'));

    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/create-wallet');
    expect(container.textContent).not.toContain('github.com');
    expect(container.textContent).not.toContain('References');
  });

  it('states that creation starts with a risk check', () => {
    expect(container.textContent).toContain(
      'Creating a wallet starts with a short risk check.',
    );
  });
});
