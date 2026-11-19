```ts
describe('fiatValueForBalance', () => {
  const fresh = parsePriceResponse(freshPayload(), NOW_MS);
  const expired = parsePriceResponse(freshPayload(11 * 60 * 1000), NOW_MS);
  const btc = { status: 'available', value: '100000000' } as const;

  it('values 1 BTC using a fresh quote', () => {
    expect(fiatValueForBalance('btc', btc, fresh.btc, NOW_MS)).toMatchObject({
      kind: 'fiat', text: '$62,683.00',
    });
  });

  it('returns zero for a zero balance', () => {
    expect(fiatValueForBalance('btc', { status: 'zero' }, fresh.btc, NOW_MS)).toEqual({ kind: 'zero' });
  });

  it('returns zero for an available balance of 0', () => {
    expect(fiatValueForBalance('btc', { status: 'available', value: '0' }, fresh.btc, NOW_MS))
      .toEqual({ kind: 'zero' });
  });

  it('returns expired for an expired entry', () => {
    expect(fiatValueForBalance('btc', btc, expired.btc, NOW_MS)).toEqual({ kind: 'expired' });
  });

  it('returns unavailable when the coin is absent', () => {
    const payload: Record<string, unknown> = { ...freshPayload() };
    delete payload.bitcoin;
    const entries = parsePriceResponse(payload, NOW_MS);
    expect(fiatValueForBalance('btc', btc, entries.btc, NOW_MS)).toEqual({ kind: 'unavailable' });
  });

  it('preserves a rate-limited error', () => {
    expect(fiatValueForBalance('btc', btc, { status: 'error', reason: 'rate-limited' }, NOW_MS))
      .toEqual({ kind: 'error', reason: 'rate-limited' });
  });

  it('returns balance-unavailable for an error balance', () => {
    expect(fiatValueForBalance('btc', { status: 'error' }, fresh.btc, NOW_MS))
      .toEqual({ kind: 'balance-unavailable' });
  });

  it('returns balance-unavailable when an available balance has no value', () => {
    expect(fiatValueForBalance('btc', { status: 'available' }, fresh.btc, NOW_MS))
      .toEqual({ kind: 'balance-unavailable' });
  });

  it('expires a fresh entry as time advances', () => {
    expect(fresh.btc.status).toBe('fresh');
    expect(fiatValueForBalance('btc', btc, fresh.btc, NOW_MS + 11 * 60 * 1000))
      .toEqual({ kind: 'expired' });
  });
});

describe('portfolioTotal', () => {
  const fresh = parsePriceResponse(freshPayload(), NOW_MS);
  const expired = parsePriceResponse(freshPayload(11 * 60 * 1000), NOW_MS);
  const zero = { status: 'zero' } as const;
  const zeros = { btc: zero, eth: zero, trx: zero, ton: zero };
  const btc = { status: 'available', value: '100000000' } as const;
  const eth = { status: 'available', value: '1500000000000000000' } as const;

  it('returns zero when all four balances are zero', () => {
    expect(portfolioTotal(zeros, fresh, NOW_MS)).toEqual({
      status: 'zero', text: '$0.00', partial: false,
    });
  });

  it('totals 1 BTC alongside three zero balances', () => {
    expect(portfolioTotal({ ...zeros, btc }, fresh, NOW_MS)).toMatchObject({
      status: 'total', text: '$62,683.00',
    });
  });

  it('excludes expired ETH from the partial subtotal', () => {
    const entries = { ...fresh, eth: expired.eth };
    expect(portfolioTotal({ ...zeros, btc, eth }, entries, NOW_MS)).toEqual({
      status: 'partial', text: '$62,683.00', partial: true,
    });
  });

  it('returns unavailable when all nonzero balances have expired quotes', () => {
    const balances = {
      btc, eth,
      trx: { status: 'available', value: '1000000' },
      ton: { status: 'available', value: '1000000000' },
    } as const;
    expect(portfolioTotal(balances, expired, NOW_MS)).toMatchObject({
      status: 'unavailable', text: 'Unavailable',
    });
  });

  it('never produces a partial total over an unavailable balance', () => {
    const balances = { ...zeros, btc, eth: { status: 'unavailable' } } as const;
    expect(portfolioTotal(balances, fresh, NOW_MS)).toMatchObject({
      status: 'unavailable', text: 'Unavailable',
    });
  });

  it('returns unavailable while any balance is loading', () => {
    const balances = { ...zeros, btc, eth: { status: 'loading' } } as const;
    expect(portfolioTotal(balances, fresh, NOW_MS).status).toBe('unavailable');
  });
});

describe('quoteFreshnessLabel', () => {
  function freshQuote() {
    const entry = parsePriceResponse(freshPayload(), NOW_MS).btc;
    expect(entry.status).toBe('fresh');
    if (entry.status !== 'fresh') throw new Error('Expected a fresh BTC quote');
    return entry.quote;
  }

  it('labels a 10-second-old quote as just updated', () => {
    const quote = { ...freshQuote(), providerUpdatedAtMs: NOW_MS - 10_000 };
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe('Updated just now');
  });

  it('labels a two-minute-old quote in minutes', () => {
    const quote = { ...freshQuote(), providerUpdatedAtMs: NOW_MS - 2 * 60 * 1000 };
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe('Updated 2 min ago');
  });

  it('labels a 90-minute-old quote with its provider time', () => {
    const providerUpdatedAtMs = NOW_MS - 90 * 60 * 1000;
    const quote = { ...freshQuote(), providerUpdatedAtMs };
    const time = new Date(providerUpdatedAtMs).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe(`Updated ${time}`);
  });

  it('labels a provider timestamp 30 seconds in the future as just updated', () => {
    const quote = { ...freshQuote(), providerUpdatedAtMs: NOW_MS + 30_000 };
    expect(quoteFreshnessLabel(quote, NOW_MS)).toBe('Updated just now');
  });
});
```