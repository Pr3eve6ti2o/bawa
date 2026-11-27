// Lane C, item 15: a small copy button for recovery phrases and
// addresses. The owner had to photograph the phrase because there was
// no way to copy it. Clicking copies the value to the clipboard and the
// button itself confirms with "Copied" (or "Copy failed"), so no
// separate status line is needed. The value is never rendered by this
// component — the caller renders it.
import { useEffect, useState } from 'react';
import { Button } from './button';

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  // A new value is a new thing to copy: drop a stale "Copied".
  useEffect(() => {
    setStatus('idle');
  }, [value]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={label}
      onClick={() => void copy()}
      className={className}
    >
      {status === 'copied'
        ? 'Copied'
        : status === 'failed'
          ? 'Copy failed'
          : 'Copy'}
    </Button>
  );
}
