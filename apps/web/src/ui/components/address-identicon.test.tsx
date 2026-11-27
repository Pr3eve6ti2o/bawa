// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { AddressIdenticon, identiconSpec } from './address-identicon';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const ADDRESS_A = '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
const ADDRESS_B = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

async function mount(address: string, size?: number) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<AddressIdenticon address={address} size={size} />);
  });
  return {
    div,
    cleanup: async () => {
      try {
        await act(async () => {
          root.unmount();
        });
      } finally {
        div.remove();
        if (previousActEnvironment === undefined) {
          delete testGlobal.IS_REACT_ACT_ENVIRONMENT;
        } else {
          testGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }
      }
    },
  };
}

describe('identiconSpec', () => {
  it('is deterministic: the same address always gives the same picture', () => {
    expect(identiconSpec(ADDRESS_A)).toEqual(identiconSpec(ADDRESS_A));
  });

  it('differs between addresses, in colours and in cells', () => {
    const a = identiconSpec(ADDRESS_A);
    const b = identiconSpec(ADDRESS_B);
    expect(
      a.foreground !== b.foreground ||
        a.background !== b.background ||
        JSON.stringify(a.cells) !== JSON.stringify(b.cells),
    ).toBe(true);
  });

  it('mirrors the grid left-right: every cell has its mirror', () => {
    const { cells } = identiconSpec(ADDRESS_A);
    for (const cell of cells) {
      expect(
        cells.some(
          (other) =>
            other.x === 7 - cell.x && other.y === cell.y && other.spot === cell.spot,
        ),
      ).toBe(true);
    }
  });

  it('never throws on an empty address', () => {
    expect(() => identiconSpec('')).not.toThrow();
    expect(identiconSpec('').cells.length).toBeGreaterThan(0);
  });

  it('works for non-EVM formats (base58, bech32, TON)', () => {
    for (const address of [
      'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
      'UQB7z6y4yM8K8t0Z1q2v3w4x5y6z7a8b9c0d1e2f3a4b5',
    ]) {
      expect(() => identiconSpec(address)).not.toThrow();
    }
  });
});

describe('AddressIdenticon', () => {
  it('renders a decorative svg with the address picture', async () => {
    const mounted = await mount(ADDRESS_A);
    try {
      const svg = mounted.div.querySelector(
        'svg[data-testid="address-identicon"]',
      );
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('width')).toBe('32');
      expect(svg?.getAttribute('height')).toBe('32');
      // Background rect + one rect per filled cell.
      const spec = identiconSpec(ADDRESS_A);
      expect(svg?.querySelectorAll('rect').length).toBe(spec.cells.length + 1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('respects the size prop', async () => {
    const mounted = await mount(ADDRESS_A, 24);
    try {
      const svg = mounted.div.querySelector(
        'svg[data-testid="address-identicon"]',
      );
      expect(svg?.getAttribute('width')).toBe('24');
      expect(svg?.getAttribute('height')).toBe('24');
    } finally {
      await mounted.cleanup();
    }
  });
});
