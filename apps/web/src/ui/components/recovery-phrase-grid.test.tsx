// @vitest-environment jsdom
// P3-A (style B): the phrase tiles are flat, numbered and mono —
// the contract the recovery-phrase screen is verified against.
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { RecoveryPhraseGrid } from './recovery-phrase-grid';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// Disposable test words — never a real secret.
const WORDS = [...Array(23).fill('abandon'), 'about'];

async function mount(words: readonly string[]) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<RecoveryPhraseGrid words={words} />);
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

describe('RecoveryPhraseGrid', () => {
  it('renders 24 flat numbered mono tiles, in order', async () => {
    const mounted = await mount(WORDS);
    try {
      const list = mounted.div.querySelector('ol[aria-label="Recovery phrase"]');
      expect(list).not.toBeNull();
      // Three columns at desktop, not four: in the backup reveal's
      // half-width column a fourth column squeezes 8-letter words to
      // an ellipsis — a recovery word must never be visually cut.
      expect(list?.className).toContain('sm:grid-cols-3');
      expect(list?.className).not.toContain('lg:grid-cols-4');
      const tiles = [...mounted.div.querySelectorAll('li')];
      expect(tiles).toHaveLength(24);
      tiles.forEach((tile, index) => {
        // Flat: uniform radius + 1px hairline border, never the wobbly
        // radius or the 2px ink border.
        expect(tile.className).toContain('rounded-flat-sm');
        expect(tile.className).toContain('border');
        expect(tile.className).not.toContain('rounded-bawa');
        expect(tile.className).not.toContain('border-2');
        // Numbered, in order.
        expect(tile.textContent).toContain(`${index + 1}.`);
        expect(tile.textContent).toContain(WORDS[index] as string);
        // Mono words, never the display face.
        const word = tile.querySelectorAll('span')[1] as HTMLElement;
        expect(word.className).toContain('font-mono');
        expect(word.className).not.toContain('font-display');
      });
    } finally {
      await mounted.cleanup();
    }
  });
});
