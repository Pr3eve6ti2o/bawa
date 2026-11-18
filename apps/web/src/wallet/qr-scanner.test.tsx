// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { QrScanner } from './qr-scanner';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function mountScanner(props: {
  onScan: (value: string) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  const previousActEnvironment = testGlobal.IS_REACT_ACT_ENVIRONMENT;
  testGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    root.render(<QrScanner {...props} />);
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

const fakeStream = {
  getTracks: () => [{ stop: vi.fn() }],
} as unknown as MediaStream;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
  });
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

describe('QR scanner', () => {
  it('requests the environment camera and renders the preview', async () => {
    const onScan = vi.fn();
    const onCancel = vi.fn();
    const onError = vi.fn();
    const mounted = await mountScanner({ onScan, onCancel, onError });
    try {
      await act(async () => {
        await Promise.resolve();
      });
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
      });
      expect(mounted.div.querySelector('video')).not.toBeNull();
      expect(mounted.div.textContent).toContain('Point the camera at a QR code');
      expect(onError).not.toHaveBeenCalled();
    } finally {
      await mounted.cleanup();
    }
  });

  it('calls onCancel when the cancel button is pressed', async () => {
    const onCancel = vi.fn();
    const mounted = await mountScanner({ onScan: vi.fn(), onCancel, onError: vi.fn() });
    try {
      const button = [...mounted.div.querySelectorAll('button')].find(
        (element) => element.textContent === 'Cancel',
      );
      expect(button).toBeDefined();
      await act(async () => {
        button?.click();
      });
      expect(onCancel).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports an error when camera access is denied', async () => {
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(
      new Error('denied'),
    );
    const onError = vi.fn();
    const mounted = await mountScanner({ onScan: vi.fn(), onCancel: vi.fn(), onError });
    try {
      await act(async () => {
        await Promise.resolve();
      });
      expect(onError).toHaveBeenCalledWith(
        'Camera access was denied or is unavailable.',
      );
    } finally {
      await mounted.cleanup();
    }
  });

  it('reports an error when the browser has no camera API', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    const onError = vi.fn();
    const mounted = await mountScanner({ onScan: vi.fn(), onCancel: vi.fn(), onError });
    try {
      await act(async () => {
        await Promise.resolve();
      });
      expect(onError).toHaveBeenCalledWith(
        'Camera is not available in this browser.',
      );
    } finally {
      await mounted.cleanup();
    }
  });
});
