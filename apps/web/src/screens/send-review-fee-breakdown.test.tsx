// @vitest-environment jsdom
// P2-A, M3: the review fee breakdown — the total stays visible by
// default and the composition opens on expand.
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SendReview, type SendReviewProps } from './send-review';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mountReview(props: SendReviewProps) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<SendReview {...props} />);
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

const baseProps: SendReviewProps = {
  chainName: 'Ethereum',
  symbol: 'ETH',
  from: '0x27ef5cdbe01777d62438affeb695e33fc2335979',
  recipient: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  amount: '0.5 ETH',
  fee: '0.001845 ETH',
  total: '0.501845 ETH',
  feeNote: 'Standard tier at 87.86 Gwei max fee, 21000 gas; not a final fee',
  disabledReason: 'Broadcast is disabled until separately authorised.',
  stage: 'review',
  onBack: () => {},
  onSign: () => {},
};

describe('SendReview fee breakdown', () => {
  it('shows the total by default and the breakdown rows on expand', async () => {
    const { div, cleanup } = await mountReview({
      ...baseProps,
      feeBreakdown: [
        { label: 'Gas limit', value: '21,000' },
        { label: 'Max fee', value: '87.86 Gwei' },
        { label: 'Priority fee', value: '0.000000941 Gwei' },
      ],
    });
    try {
      // The total is visible without expanding anything.
      expect(div.textContent).toContain('0.001845 ETH');
      expect(div.textContent).toContain('Fee breakdown');
      // <details> is closed by default: the rows are in the DOM but
      // the element is not open. (The open/close interaction itself
      // is browser behaviour, covered by the CDP check, not jsdom —
      // jsdom does not toggle <details> on summary click.)
      const details = div.querySelector('details');
      expect(details).not.toBeNull();
      expect(details?.open).toBe(false);
      expect(div.textContent).toContain('Gas limit');
      expect(div.textContent).toContain('21,000');
      expect(div.textContent).toContain('Max fee');
      expect(div.textContent).toContain('87.86 Gwei');
      expect(div.textContent).toContain('Priority fee');
    } finally {
      await cleanup();
    }
  });

  it('shows no breakdown when the fee is unknown', async () => {
    const { div, cleanup } = await mountReview({
      ...baseProps,
      fee: 'Unknown. Charged by the network at broadcast.',
      feeBreakdown: [],
    });
    try {
      expect(div.textContent).not.toContain('Fee breakdown');
    } finally {
      await cleanup();
    }
  });
});
