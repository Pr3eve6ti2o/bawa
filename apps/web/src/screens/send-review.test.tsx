// @vitest-environment jsdom
// Lane 3 (UX-major): the review screen's transparency additions —
// shortened recipient with the full address on tap, the self-send
// note, and the copycat token warning. No signing or broadcast is
// exercised here: the Sign button is never clicked.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { SendReview, type SendReviewProps } from './send-review';

const RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

function baseProps(extra: Partial<SendReviewProps> = {}): SendReviewProps {
  return {
    chainName: 'Ethereum',
    symbol: 'ETH',
    from: '0x0000000000000000000000000000000000000001',
    recipient: RECIPIENT,
    amount: '0.001 ETH',
    fee: '0.0001 ETH',
    total: '0.0011 ETH',
    feeNote: 'Estimated fee.',
    disabledReason: 'Sending is switched off.',
    stage: 'review',
    onBack: () => {},
    onSign: () => {},
    ...extra,
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(props: SendReviewProps): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<SendReview {...props} />);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  vi.restoreAllMocks();
});

describe('SendReview transparency (Lane 3)', () => {
  it('shows the recipient shortened, with the full address on tap', () => {
    render(baseProps());
    const summary = container?.querySelector('summary');
    expect(summary?.textContent).toBe('0x742d…f44e');
    // The full address is in the disclosure, with Copy beside it.
    expect(container?.textContent).toContain(RECIPIENT);
    expect(
      container?.querySelector('[aria-label="Copy recipient address"]'),
    ).not.toBeNull();
  });

  it('notes a send to your own address, and stays silent otherwise', () => {
    render(baseProps({ from: RECIPIENT }));
    expect(container?.textContent).toContain(
      'You are sending to your own address.',
    );
    render(baseProps());
    expect(container?.textContent).not.toContain(
      'You are sending to your own address.',
    );
  });

  it('shows the copycat token warning when given, and hides it otherwise', () => {
    const warning =
      'Unverified USDC — a verified USDC exists on Ethereum. Check the contract address before signing.';
    render(baseProps({ tokenWarning: warning }));
    expect(container?.textContent).toContain('Check the token');
    expect(container?.textContent).toContain(warning);
    render(baseProps());
    expect(container?.textContent).not.toContain('Check the token');
  });

  it('still shows network, amount, fee and total rows', () => {
    render(baseProps());
    const text = container?.textContent ?? '';
    expect(text).toContain('Ethereum · ETH');
    expect(text).toContain('0.001 ETH');
    expect(text).toContain('0.0001 ETH');
    expect(text).toContain('0.0011 ETH');
  });
});
