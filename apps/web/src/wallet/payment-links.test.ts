// @vitest-environment jsdom
// Payment-request URIs (token gaps, item 3) — one format per chain,
// each verified against its real spec, never invented:
// - BTC/LTC/DOGE: BIP-21 (bips.dev/21) — bitcoin:<addr>?amount=<decimal>
// - EVM natives + ERC-20: EIP-681 (eips.ethereum.org/EIPS/eip-681) —
//   ethereum:<target>@<chainId>?value=<wei> (native) or
//   ethereum:<tokenContract>@<chainId>/transfer?address=<to>&uint256=<base>
// - SOL: Solana Pay (solana-foundation/pay SPEC.md) —
//   solana:<recipient>?amount=<decimal SOL>, or
//   solana:<recipient>?amount=<decimal>&spl-token=<mint> for SPL tokens
//   (recipient stays the native SOL account; amount in decimal units).
// - TON: ton://transfer/<address>?amount=<nanotons>
//   (ton-blockchain.github.io deep-links; 1 TON = 10^9 nanotons), or
//   ton://transfer/<address>?jetton=<master>&amount=<base units> for
//   Jettons (docs.ton.org deep links; amount in the Jetton's own units).
// - TRON: NO bare payment-request URI standard exists (TronLink's
//   transfer deep link is a vendor dApp-callback link, not a payment
//   request), so buildPaymentUri refuses TRON rather than inventing
//   a tron: URI. The Bawa web link below carries TRON amount+address.
// Patterns mined from MetaMask Mobile deeplinking docs (EIP-681 parsed
// -> switch to the requested chain -> open the Send screen) and the
// erc681.org adoption audit (native + ERC-20 transfer only; any other
// function name is rejected) — see WORK-LOG.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAINS, SUPPORTED_CHAINS, type ChainId } from './chains';
import { DEFAULT_TOKENS } from './tokens';
import {
  appBasePath,
  buildBawaSendLink,
  buildPaymentUri,
  clearPendingSendLink,
  parseBawaSendLink,
  parsePaymentUri,
  qrCardToPngBlob,
  qrCardToPngFile,
  qrSvgToPngBlob,
  qrSvgToPngFile,
  readPendingSendLink,
  readPendingSendLinkSearch,
  savePendingSendLink,
  wrapCardText,
  type QrCardPngDetails,
  type QrRenderDeps,
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

  // Lane 3 (token Receive): an SPL token payment carries the mint —
  // without spl-token the URL would request native SOL for the token
  // amount. The recipient stays the native SOL account (the wallet
  // derives the associated token account); the amount is decimal.
  it('builds a Solana Pay URI with spl-token for an SPL token payment', () => {
    expect(
      buildPaymentUri({
        chain: 'sol',
        address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        amount: '25',
        tokenContract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenDecimals: 6,
      }),
    ).toEqual({
      ok: true,
      uri: 'solana:4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM?amount=25&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    });
  });

  it('builds a Solana Pay SPL URI without an amount (any amount)', () => {
    expect(
      buildPaymentUri({
        chain: 'sol',
        address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        tokenContract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenDecimals: 6,
      }),
    ).toEqual({
      ok: true,
      uri: 'solana:4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM?spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    });
  });

  it('refuses an SPL amount finer than the token decimals', () => {
    const result = buildPaymentUri({
      chain: 'sol',
      address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
      amount: '1.0000001',
      tokenContract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      tokenDecimals: 6,
    });
    expect(result.ok).toBe(false);
  });

  it('refuses an SPL token payment without decimals', () => {
    const result = buildPaymentUri({
      chain: 'sol',
      address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
      amount: '25',
      tokenContract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    });
    expect(result.ok).toBe(false);
  });

  // Lane 3 (token Receive): a Jetton payment carries the master —
  // without jetton the URL would request native TON for the Jetton
  // amount. The amount is in the Jetton's own smallest units
  // (USDt on TON: 6 decimals, so 25 USDT = 25,000,000 units).
  it('builds a ton://transfer URI with jetton for a Jetton payment', () => {
    expect(
      buildPaymentUri({
        chain: 'ton',
        address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        amount: '25',
        tokenContract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        tokenDecimals: 6,
      }),
    ).toEqual({
      ok: true,
      uri: 'ton://transfer/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs&amount=25000000',
    });
  });

  it('builds a ton://transfer Jetton URI without an amount (any amount)', () => {
    expect(
      buildPaymentUri({
        chain: 'ton',
        address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        tokenContract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        tokenDecimals: 6,
      }),
    ).toEqual({
      ok: true,
      uri: 'ton://transfer/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    });
  });

  it('refuses a Jetton payment without decimals', () => {
    const result = buildPaymentUri({
      chain: 'ton',
      address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      amount: '25',
      tokenContract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    });
    expect(result.ok).toBe(false);
  });

  it('builds an ERC-20 transfer URI on every EVM chain id', () => {
    const evmChains = SUPPORTED_CHAINS.filter(
      (chain) => CHAINS[chain].evmChainId !== null,
    );
    expect(evmChains.length).toBe(61);
    for (const chain of evmChains) {
      const chainId = CHAINS[chain].evmChainId as number;
      const result = buildPaymentUri({
        chain: chain as ChainId,
        address: '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979',
        amount: '1',
        tokenContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenDecimals: 6,
      });
      expect(result).toEqual({
        ok: true,
        uri: `ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48@${chainId}/transfer?address=0x27Ef5cDBe01777D62438AfFeb695e33fC2335979&uint256=1000000`,
      });
    }
  });

  it('round-trips every default token through build + parse', () => {
    for (const token of DEFAULT_TOKENS) {
      if (token.chain === 'trx') continue; // TRON has no payment URI.
      const address =
        token.chain === 'sol'
          ? '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM'
          : token.chain === 'ton'
            ? 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
            : '0x27Ef5cDBe01777D62438AfFeb695e33fC2335979';
      const built = buildPaymentUri({
        chain: token.chain,
        address,
        amount: '25',
        tokenContract: token.contract,
        tokenDecimals: token.decimals,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) throw new Error(`build failed for ${token.symbol} on ${token.chain}`);
      const parsed = parsePaymentUri(built.uri);
      expect(parsed).toEqual({
        ok: true,
        request: {
          chain: token.chain,
          address,
          amount: '25',
          tokenContract: token.contract,
          tokenDecimals: token.decimals,
        },
      });
    }
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

  // Lane 3 (token Receive): SPL token URIs parse — the mint is
  // resolved against the known tokens so the amount is read in the
  // token's decimals, not as SOL.
  it('parses a Solana Pay URI for an SPL token', () => {
    const parsed = parsePaymentUri(
      'solana:4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM?amount=25&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    );
    expect(parsed).toEqual({
      ok: true,
      request: {
        chain: 'sol',
        address: '4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM',
        amount: '25',
        tokenContract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenDecimals: 6,
      },
    });
  });

  it('parses a Solana Pay SPL URI without an amount', () => {
    const parsed = parsePaymentUri(
      'solana:4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM?spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.request.tokenContract).toBe(
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      );
      expect(parsed.request.amount).toBeUndefined();
    }
  });

  it('rejects a Solana Pay URI with an unknown SPL mint', () => {
    expect(
      parsePaymentUri(
        'solana:4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM?amount=1&spl-token=11111111111111111111111111111111',
      ).ok,
    ).toBe(false);
  });

  // Lane 3 (token Receive): Jetton URIs parse — the master is
  // resolved against the known tokens so the amount is read in the
  // Jetton's decimals, not as nanotons.
  it('parses a ton://transfer URI for a Jetton', () => {
    const parsed = parsePaymentUri(
      'ton://transfer/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs&amount=25000000',
    );
    expect(parsed).toEqual({
      ok: true,
      request: {
        chain: 'ton',
        address: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        amount: '25',
        tokenContract: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        tokenDecimals: 6,
      },
    });
  });

  it('parses a ton://transfer Jetton URI without an amount', () => {
    const parsed = parsePaymentUri(
      'ton://transfer/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?jetton=EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.request.tokenContract).toBe(
        'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      );
      expect(parsed.request.amount).toBeUndefined();
    }
  });

  it('rejects a ton://transfer URI with an unknown Jetton master', () => {
    expect(
      parsePaymentUri(
        'ton://transfer/EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA?jetton=EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&amount=1000',
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
      buildBawaSendLink('https://pr3eve6ti2o.github.io', {
        chain: 'eth',
        to: '0x0000000000000000000000000000000000000001',
        amount: '0.5',
      }),
    ).toBe(
      'https://pr3eve6ti2o.github.io/send?chain=eth&to=0x0000000000000000000000000000000000000001&amount=0.5',
    );
    expect(
      buildBawaSendLink('https://pr3eve6ti2o.github.io', {
        chain: 'eth',
        to: '0x0000000000000000000000000000000000000001',
        amount: '25',
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      }),
    ).toBe(
      'https://pr3eve6ti2o.github.io/send?chain=eth&to=0x0000000000000000000000000000000000000001&amount=25&token=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );
  });

  it('keeps the deployment subpath on a subpath build (Pages)', () => {
    // The shared link from the Pages preview used to drop /bawa/:
    // the call site passed window.location.origin alone. The link
    // builder now keeps Vite's base, so the same bare origin builds
    // a link that reaches the app under /bawa/.
    vi.stubEnv('BASE_URL', '/bawa/');
    try {
      expect(
        buildBawaSendLink('https://pr3eve6ti2o.github.io', {
          chain: 'eth',
          to: '0x0000000000000000000000000000000000000001',
          amount: '0.5',
        }),
      ).toBe(
        'https://pr3eve6ti2o.github.io/bawa/send?chain=eth&to=0x0000000000000000000000000000000000000001&amount=0.5',
      );
    } finally {
      vi.unstubAllEnvs();
    }
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

describe('appBasePath — deployment subpath (UI/UX round 2, deep-link fix)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is empty at the domain root', () => {
    vi.stubEnv('BASE_URL', '/');
    expect(appBasePath()).toBe('');
  });

  it('keeps the Pages subpath with or without a trailing slash', () => {
    vi.stubEnv('BASE_URL', '/bawa/');
    expect(appBasePath()).toBe('/bawa');
    vi.stubEnv('BASE_URL', '/bawa');
    expect(appBasePath()).toBe('/bawa');
  });
});

describe('pending send link — survives the cold-start gap (UI/UX round 2, deep-link fix)', () => {
  afterEach(() => {
    clearPendingSendLink();
  });

  it('round-trips a link through session storage', () => {
    savePendingSendLink(
      'chain=eth&to=0x0000000000000000000000000000000000000001&amount=0.5',
    );
    expect(readPendingSendLinkSearch()).toBe(
      'chain=eth&to=0x0000000000000000000000000000000000000001&amount=0.5',
    );
    expect(readPendingSendLink()).toEqual({
      chain: 'eth',
      to: '0x0000000000000000000000000000000000000001',
      amount: '0.5',
    });
    clearPendingSendLink();
    expect(readPendingSendLink()).toBeNull();
    expect(readPendingSendLinkSearch()).toBeNull();
  });

  it('returns null for a stored value that no longer parses', () => {
    savePendingSendLink('chain=eth&amount=1');
    expect(readPendingSendLink()).toBeNull();
  });
});

describe('qrSvgToPngFile — sharing the QR as an image (UI/UX fixes, item 4)', () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" fill="#FFFDF7"/><rect x="10" y="10" width="20" height="20" fill="#2B2B2B"/></svg>';

  // Fake render deps: jsdom has no canvas and its Image never loads, so
  // the tests inject fakes shaped like the browser objects the helper
  // uses. The production call site uses the real browser globals.
  function fakeDeps(overrides: Partial<QrRenderDeps> = {}): {
    deps: QrRenderDeps;
    drawImage: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    toBlob: ReturnType<typeof vi.fn>;
    lastSrc: string;
  } {
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      callback(new Blob(['\x89PNG fake-bytes'], { type: 'image/png' }));
    });
    let lastSrc = '';
    const image = {
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      width: 192,
      height: 192,
      set src(value: string) {
        lastSrc = value;
        // Loading an image URL is async in a browser; fire onload on
        // the next microtask so the helper's promise machinery is
        // exercised.
        queueMicrotask(() => {
          image.onload?.();
        });
      },
    };
    const deps: QrRenderDeps = {
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: '',
          fillRect,
          drawImage,
        }),
        toBlob: (callback: (blob: Blob | null) => void) => {
          toBlob(callback);
        },
      }),
      createImage: () => image,
      ...overrides,
    };
    return { deps, drawImage, fillRect, toBlob, get lastSrc() { return lastSrc; } };
  }

  it('renders the SVG to a PNG file with the requested name', async () => {
    const { deps, drawImage } = fakeDeps();
    const file = await qrSvgToPngFile(SVG, 'bawa-receive-eth.png', 512, deps);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('bawa-receive-eth.png');
    expect(file.type).toBe('image/png');
    expect(file.size).toBeGreaterThan(0);
    expect(drawImage).toHaveBeenCalledTimes(1);
    // The QR is drawn scaled to the requested pixel size.
    const args = drawImage.mock.calls[0]!;
    expect(args[1]).toBe(0);
    expect(args[2]).toBe(0);
    expect(args[3]).toBe(512);
    expect(args[4]).toBe(512);
  });

  it('paints the paper background first so the QR stays scannable', async () => {
    const { deps, fillRect } = fakeDeps();
    await qrSvgToPngBlob(SVG, 256, deps);
    expect(fillRect).toHaveBeenCalledTimes(1);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 256, 256);
  });

  it('rejects a blank SVG instead of sharing an empty image', async () => {
    const { deps } = fakeDeps();
    await expect(qrSvgToPngBlob('   ', 512, deps)).rejects.toThrow(
      'no QR image',
    );
    await expect(qrSvgToPngBlob('<div>not svg</div>', 512, deps)).rejects.toThrow(
      'no QR image',
    );
  });

  it('rejects when the canvas has no 2d context', async () => {
    const { deps } = fakeDeps({
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => null,
        toBlob: () => {},
      }),
    });
    await expect(qrSvgToPngBlob(SVG, 512, deps)).rejects.toThrow(
      'could not be rendered',
    );
  });

  it('loads the SVG from a data URL, not a blob URL', async () => {
    // CDP 2026-11-23: a blob-URL SVG hangs in headless Chromium (neither
    // onload nor onerror), so the helper must load from a data URL.
    const fakes = fakeDeps();
    await qrSvgToPngBlob(SVG, 512, fakes.deps);
    expect(fakes.lastSrc.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(fakes.lastSrc)).toContain('<svg');
  });

  it('rejects when the SVG image fails to load', async () => {
    const { deps } = fakeDeps({
      createImage: () => {
        const image = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          width: 0,
          height: 0,
          set src(_value: string) {
            queueMicrotask(() => {
              image.onerror?.();
            });
          },
        };
        return image;
      },
    });
    await expect(qrSvgToPngBlob(SVG, 512, deps)).rejects.toThrow(
      'could not be loaded',
    );
  });
});

describe('qrCardToPngFile — sharing the QR card (UI/UX Round 2, item 1)', () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" fill="#FFFDF7"/><rect x="10" y="10" width="20" height="20" fill="#2B2B2B"/></svg>';
  const ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const DETAILS: QrCardPngDetails = {
    amountText: '25 USDC',
    address: ADDRESS,
    tokenLabel: 'usdc (base)',
    tokenLogoSrc: 'https://example.invalid/usdc.webp',
    chainLogoSrc: 'https://example.invalid/base.webp',
  };

  // Fake render deps with text support: the card measures and draws
  // text, so the fake context records fillText and measures each
  // character as 10px wide. Images load in call order — the QR
  // first, then the two logos — and logos can be made to fail.
  function cardDeps(options: { failLogos?: boolean } = {}): {
    deps: QrRenderDeps;
    canvas: { width: number; height: number };
    fillRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
  } {
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const fillText = vi.fn();
    const ctx = {
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect,
      drawImage,
      fillText,
      measureText: (text: string) => ({ width: text.length * 10 }),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(new Blob(['\x89PNG fake-bytes'], { type: 'image/png' }));
      },
    };
    let imageCount = 0;
    const deps: QrRenderDeps = {
      createCanvas: () => canvas,
      createImage: () => {
        const index = imageCount++;
        const image = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          width: 192,
          height: 192,
          set src(_value: string) {
            queueMicrotask(() => {
              if (options.failLogos === true && index > 0) {
                image.onerror?.();
              } else {
                image.onload?.();
              }
            });
          },
        };
        return image;
      },
    };
    return { deps, canvas, fillRect, drawImage, fillText };
  }

  it('draws the card — QR, amount, address, token label — in order', async () => {
    const fakes = cardDeps();
    const file = await qrCardToPngFile(SVG, DETAILS, 'bawa-receive-base-usdc.png', fakes.deps);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('bawa-receive-base-usdc.png');
    expect(file.type).toBe('image/png');
    // 640 wide; one address line at 10px a character (42 chars fit
    // the 568px content width): 36 + 392 + 28 + 16 + 44 + 16 + 28 +
    // 20 + 44 + 36 = 660 tall. The QR sits in a 392px tile (360px QR
    // + 16px pad each side) with the token + chain badges overlapping
    // its bottom edge; the badge overhang (28px) is part of the height.
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(660);
    // Paper painted first, over the whole card.
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 0, 640, 660);
    // Lane H (Oishi hard offset shadow): an ink rect offset 8 px
    // down-right behind the tile.
    expect(fakes.fillRect).toHaveBeenCalledWith(132, 44, 392, 392);
    // The QR is drawn 360px wide, centred, inside its tile at the top.
    const qrDraw = fakes.drawImage.mock.calls[0]!;
    expect(qrDraw[1]).toBe(140);
    expect(qrDraw[2]).toBe(52);
    expect(qrDraw[3]).toBe(360);
    expect(qrDraw[4]).toBe(360);
    // The badges overlap the tile's bottom edge: the token mark 44px,
    // the chain mark 28px at its lower right.
    const logoDraws = fakes.drawImage.mock.calls.slice(1);
    expect(logoDraws).toHaveLength(2);
    expect(logoDraws[0]![3]).toBe(44);
    expect(logoDraws[1]![3]).toBe(28);
    // The card's facts, in the on-screen order: amount, address, label.
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual(['25 USDC', ADDRESS, 'usdc (base)']);
  });

  it('wraps a long address onto two lines and grows the card', async () => {
    const fakes = cardDeps();
    // 62 characters at 10px = 620px: 56 on the first line, 6 on the second.
    const longAddress = `bc1q${'a'.repeat(58)}`;
    await qrCardToPngBlob(
      SVG,
      { amountText: '0.5 BTC', address: longAddress, tokenLabel: 'Bitcoin' },
      fakes.deps,
    );
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual(['0.5 BTC', longAddress.slice(0, 56), longAddress.slice(56), 'Bitcoin']);
    expect(fakes.canvas.height).toBe(660 + 28);
  });

  it('still shares the card when both logos fail to load', async () => {
    const fakes = cardDeps({ failLogos: true });
    const file = await qrCardToPngFile(SVG, DETAILS, 'bawa-receive-base-usdc.png', fakes.deps);
    expect(file).toBeInstanceOf(File);
    // Only the QR is drawn; the label is still there, centred alone.
    expect(fakes.drawImage).toHaveBeenCalledTimes(1);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual(['25 USDC', ADDRESS, 'usdc (base)']);
  });

  it('rejects a blank SVG and missing payment details', async () => {
    const fakes = cardDeps();
    await expect(qrCardToPngBlob('   ', DETAILS, fakes.deps)).rejects.toThrow(
      'no QR image',
    );
    await expect(
      qrCardToPngBlob(SVG, { ...DETAILS, address: '  ' }, fakes.deps),
    ).rejects.toThrow('payment details are missing');
    await expect(
      qrCardToPngBlob(SVG, { ...DETAILS, tokenLabel: '' }, fakes.deps),
    ).rejects.toThrow('payment details are missing');
  });
});

describe('wrapCardText — the card address wrap', () => {
  const measure = (text: string): number => text.length * 10;

  it('keeps a short address on one line', () => {
    expect(wrapCardText('0xabc', 568, measure)).toEqual(['0xabc']);
  });

  it('breaks a long address where the line fills', () => {
    expect(wrapCardText('abcdefghij', 30, measure)).toEqual([
      'abc',
      'def',
      'ghi',
      'j',
    ]);
  });

  it('returns no lines for an empty string', () => {
    expect(wrapCardText('', 568, measure)).toEqual([]);
  });
});
