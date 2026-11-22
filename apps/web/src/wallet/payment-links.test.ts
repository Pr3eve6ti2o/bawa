// Payment-request URIs (token gaps, item 3) — one format per chain,
// each verified against its real spec, never invented:
// - BTC/LTC/DOGE: BIP-21 (bips.dev/21) — bitcoin:<addr>?amount=<decimal>
// - EVM natives + ERC-20: EIP-681 (eips.ethereum.org/EIPS/eip-681) —
//   ethereum:<target>@<chainId>?value=<wei> (native) or
//   ethereum:<tokenContract>@<chainId>/transfer?address=<to>&uint256=<base>
// - SOL: Solana Pay (solana-foundation/pay SPEC.md) —
//   solana:<recipient>?amount=<decimal SOL>
// - TON: ton://transfer/<address>?amount=<nanotons>
//   (ton-blockchain.github.io deep-links; 1 TON = 10^9 nanotons)
// - TRON: NO bare payment-request URI standard exists (TronLink's
//   transfer deep link is a vendor dApp-callback link, not a payment
//   request), so buildPaymentUri refuses TRON rather than inventing
//   a tron: URI. The Bawa web link below carries TRON amount+address.
// Patterns mined from MetaMask Mobile deeplinking docs (EIP-681 parsed
// -> switch to the requested chain -> open the Send screen) and the
// erc681.org adoption audit (native + ERC-20 transfer only; any other
// function name is rejected) — see WORK-LOG.md.
import { describe, expect, it } from 'vitest';
import {
  buildBawaSendLink,
  buildPaymentUri,
  parseBawaSendLink,
  parsePaymentUri,
} from './payment-links';

describe('buildPaymentUri — BIP-21 (BTC, LTC, DOGE)', () => {
  it('builds a bitcoin: URI with a decimal amount', () => {
    expect(
      buildPaymentUri({ chain: 'btc', address: 'bc1qexample', amount: '0.5' }),
    ).toEqual({ ok: true, uri: 'bitcoin:bc1qexample?amount=0.5' });
  });

  it('builds litecoin: and dogecoin: URIs', () => {
    expect(
      buildPaymentUri({ chain: 'ltc', address: 'ltc1qexample', amount: '2' }),
    ).toEqual({ ok: true, uri: 'litecoin:ltc1qexample?amount=2' });
    expect(
      buildPaymentUri({ chain: 'doge', address: 'DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K', amount: '100' }),
    ).toEqual({
      ok: true,
      uri: 'dogecoin:DU5VEHzdNfQWUnonpHkXVchYqi1mqC3S8K?amount=100',
    });
  });

  it('omits the amount parameter when no amount is given', () => {
    expect(buildPaymentUri({ chain: 'btc', address: 'bc1qexample' })).toEqual({
      ok: true,
      uri: 'bitcoin:bc1qexample',
    });
  });

  it('encodes a label and message', () => {
    const result = buildPaymentUri({
      chain: 'btc',
      address: 'bc1qexample',
      amount: '0.01',
      label: 'Bawa wallet',
      message: 'Payment for order 1',
    });
    expect(result).toEqual({
      ok: true,
      // URLSearchParams encodes spaces as + in a query string.
      uri: 'bitcoin:bc1qexample?amount=0.01&label=Bawa+wallet&message=Payment+for+order+1',
    });
  });
});

describe('buildPaymentUri — EIP-681 (EVM natives + ERC-20)', () => {
  it('builds an ethereum: URI with @chainId and wei value', () => {
    expect(
      buildPaymentUri({
        chain: 'eth',
        address: '0x0000000000000000000000000000000000000001',
        amount: '1.5',
      }),
    ).toEqual({
      ok: true,
      uri: 'ethereum:0x0000000000000000000000000000000000000001@1?value=1500000000000000000',
    });
  });

  it('uses the chain id for other EVM chains', () => {
    const result = buildPaymentUri({
      chain: 'base',
      address: '0x0000000000000000000000000000000000000001',
      amount: '0.25',
    });
    expect(result).toEqual({
      ok: true,
      uri: 'ethereum:0x0000000000000000000000000000000000000001@8453?value=250000000000000000',
    });
  });

  it('builds an ERC-20 transfer URI with the token contract as target', () => {
    const result = buildPaymentUri({
      chain: 'eth',
      address: '0x0000000000000000000000000000000000000001',
      amount: '25',
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tokenDecimals: 6,
    });
    expect(result).toEqual({
      ok: true,
      uri: 'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0x0000000000000000000000000000000000000001&uint256=25000000',
    });
  });

  it('refuses a token payment without decimals', () => {
    const result = buildPaymentUri({
      chain: 'eth',
      address: '0x0000000000000000000000000000000000000001',
      amount: '25',
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    });
    expect(result.ok).toBe(false);
  });
});

describe('buildPaymentUri — Solana Pay and TON', () => {
  it('builds a solana: URI with the amount in SOL, not lamports', () => {
    expect(
      buildPaymentUri({
        chain: 'sol',
        address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        amount: '1.5',
      }),
    ).toEqual({
      ok: true,
      uri: 'solana:4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM?amount=1.5',
    });
  });

  it('builds a ton://transfer URI with the amount in nanotons', () => {
    expect(
      buildPaymentUri({
        chain: 'ton',
        address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        amount: '2.5',
      }),
    ).toEqual({
      ok: true,
      uri: 'ton://transfer/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?amount=2500000000',
    });
  });
});

describe('buildPaymentUri — TRON and invalid input', () => {
  it('refuses TRON rather than inventing a tron: URI', () => {
    const result = buildPaymentUri({
      chain: 'trx',
      address: 'TXYZ',
      amount: '10',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('TRON');
    }
  });

  it('refuses a malformed amount', () => {
    expect(
      buildPaymentUri({ chain: 'btc', address: 'bc1qexample', amount: 'abc' }).ok,
    ).toBe(false);
    expect(
      buildPaymentUri({ chain: 'btc', address: 'bc1qexample', amount: '-1' }).ok,
    ).toBe(false);
    expect(
      buildPaymentUri({ chain: 'btc', address: 'bc1qexample', amount: '0.000000001' }).ok,
    ).toBe(false);
  });

  it('refuses an empty address', () => {
    expect(buildPaymentUri({ chain: 'btc', address: '' }).ok).toBe(false);
  });
});

describe('parsePaymentUri — round-trips and rejection', () => {
  it('round-trips a BIP-21 URI', () => {
    const built = buildPaymentUri({ chain: 'btc', address: 'bc1qexample', amount: '0.5' });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('build failed');
    expect(parsePaymentUri(built.uri)).toEqual({
      ok: true,
      request: { chain: 'btc', address: 'bc1qexample', amount: '0.5' },
    });
  });

  it('round-trips an EIP-681 native URI', () => {
    const built = buildPaymentUri({
      chain: 'base',
      address: '0x0000000000000000000000000000000000000001',
      amount: '0.25',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('build failed');
    expect(parsePaymentUri(built.uri)).toEqual({
      ok: true,
      request: {
        chain: 'base',
        address: '0x0000000000000000000000000000000000000001',
        amount: '0.25',
      },
    });
  });

  it('round-trips an EIP-681 ERC-20 transfer URI', () => {
    const built = buildPaymentUri({
      chain: 'eth',
      address: '0x0000000000000000000000000000000000000001',
      amount: '25',
      tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      tokenDecimals: 6,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error('build failed');
    const parsed = parsePaymentUri(built.uri);
    expect(parsed).toEqual({
      ok: true,
      request: {
        chain: 'eth',
        address: '0x0000000000000000000000000000000000000001',
        amount: '25',
        tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenDecimals: 6,
      },
    });
  });

  it('round-trips a Solana Pay URI and a TON URI', () => {
    const sol = buildPaymentUri({
      chain: 'sol',
      address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
      amount: '1.5',
    });
    expect(sol.ok).toBe(true);
    if (!sol.ok) throw new Error('build failed');
    expect(parsePaymentUri(sol.uri)).toEqual({
      ok: true,
      request: {
        chain: 'sol',
        address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        amount: '1.5',
      },
    });
    const ton = buildPaymentUri({
      chain: 'ton',
      address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      amount: '2.5',
    });
    expect(ton.ok).toBe(true);
    if (!ton.ok) throw new Error('build failed');
    expect(parsePaymentUri(ton.uri)).toEqual({
      ok: true,
      request: {
        chain: 'ton',
        address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        amount: '2.5',
      },
    });
  });

  it('accepts the pay- prefix form of EIP-681', () => {
    const parsed = parsePaymentUri(
      'ethereum:pay-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/transfer?address=0x0000000000000000000000000000000000000001&uint256=25000000',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.request.tokenContract).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      );
      expect(parsed.request.amount).toBe('25');
    }
  });

  it('rejects an unknown scheme', () => {
    expect(parsePaymentUri('tron:TXyz?amount=10').ok).toBe(false);
    expect(parsePaymentUri('not a uri').ok).toBe(false);
  });

  it('rejects an EIP-681 URI with a non-transfer function', () => {
    // erc681.org adoption audit: only native + transfer are supported.
    expect(
      parsePaymentUri(
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@1/approve?address=0x0000000000000000000000000000000000000001&uint256=100',
      ).ok,
    ).toBe(false);
  });

  it('rejects a Solana Pay URI for an SPL token (not supported)', () => {
    expect(
      parsePaymentUri(
        'solana:4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM?amount=1&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ).ok,
    ).toBe(false);
  });

  it('rejects a bad amount in the URI', () => {
    expect(parsePaymentUri('bitcoin:bc1qexample?amount=abc').ok).toBe(false);
  });
});

describe('Bawa web send link', () => {
  it('builds a /send link carrying chain, address, amount and token', () => {
    expect(
      buildBawaSendLink('https://pr3eve6ti2o.github.io/bawa', {
        chain: 'eth',
        to: '0x0000000000000000000000000000000000000001',
        amount: '0.5',
      }),
    ).toBe(
      'https://pr3eve6ti2o.github.io/bawa/send?chain=eth&to=0x0000000000000000000000000000000000000001&amount=0.5',
    );
    expect(
      buildBawaSendLink('https://pr3eve6ti2o.github.io/bawa', {
        chain: 'eth',
        to: '0x0000000000000000000000000000000000000001',
        amount: '25',
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      }),
    ).toBe(
      'https://pr3eve6ti2o.github.io/bawa/send?chain=eth&to=0x0000000000000000000000000000000000000001&amount=25&token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
  });

  it('parses a /send link back into its parameters', () => {
    expect(
      parseBawaSendLink(
        '?chain=trx&to=TXYZ&amount=10',
      ),
    ).toEqual({ chain: 'trx', to: 'TXYZ', amount: '10' });
  });

  it('returns null for a link without a recipient', () => {
    expect(parseBawaSendLink('?chain=eth&amount=1')).toBeNull();
    expect(parseBawaSendLink('')).toBeNull();
  });
});
