// @vitest-environment jsdom
// Lane F: the review screen renders a human-readable contract call
// when the ERC-7730 snapshot matches, and falls back honestly to the
// raw data when it does not.
import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SendReview, type SendReviewProps } from './send-review';
import { buildErc20TransferData } from '../wallet/send';

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

const baseProps: Omit<SendReviewProps, 'contractCall'> = {
  chainName: 'Ethereum',
  symbol: 'ETH',
  from: '0x27ef5cdbe01777d62438affeb695e33fc2335979',
  recipient: '0x27ef5cdbe01777d62438affeb695e33fc2335979',
  amount: '1.5 USDC',
  fee: '0.002 ETH',
  total: '1.5 USDC + 0.002 ETH',
  feeNote: 'Estimated fee from the live adapter.',
  tokenContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  disabledReason: 'Broadcast is disabled until separately authorised.',
  stage: 'review',
  onBack: () => {},
  onSign: () => {},
};

describe('SendReview contract call', () => {
  it('renders a known ERC-20 transfer as human-readable rows', async () => {
    const { div, cleanup } = await mountReview({
      ...baseProps,
      contractCall: {
        chainId: 1,
        contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        data: buildErc20TransferData(
          '0x27ef5cdbe01777d62438affeb695e33fc2335979',
          '1500000',
        ),
        token: { decimals: 6, symbol: 'USDC' },
      },
    });
    try {
      expect(div.textContent).toContain('Contract call');
      expect(div.textContent).toContain('Send');
      expect(div.textContent).toContain('1.5 USDC');
      expect(div.textContent).toContain('Labels from the ERC-7730 registry snapshot.');
      expect(div.textContent).not.toContain('No clear-signing information');
    } finally {
      await cleanup();
    }
  });

  it('falls back honestly to the raw data for an unknown call', async () => {
    const raw = `0xdeadbeef${'00'.repeat(64)}`;
    const { div, cleanup } = await mountReview({
      ...baseProps,
      contractCall: {
        chainId: 1,
        contract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        data: raw,
      },
    });
    try {
      expect(div.textContent).toContain('Contract call');
      // Lane X (Lane D #80): "No clear-signing info — raw data below.
      // Check carefully."
      expect(div.textContent).toContain('No clear-signing info — raw data below. Check carefully.');
      expect(div.textContent).toContain(raw);
    } finally {
      await cleanup();
    }
  });

  it('shows no contract-call section for a native send', async () => {
    const { div, cleanup } = await mountReview({ ...baseProps });
    try {
      expect(div.textContent).not.toContain('Contract call');
    } finally {
      await cleanup();
    }
  });
});
