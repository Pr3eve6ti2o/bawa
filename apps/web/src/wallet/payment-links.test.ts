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
  splitAddressLines,
  wrapCardText,
  QR_CARD_TEMPLATE_QR,
  STARKNET_RECEIVE_ONLY_WARNING,
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

describe('STARKNET_RECEIVE_ONLY_WARNING — one shared warning', () => {
  it('is the Receive details step wording, in full', () => {
    // The constant is the single source for the Receive details
    // step, the in-app QR card and the PNG exporter — the wording
    // cannot drift between the three places, and it is never
    // paraphrased or shortened.
    expect(STARKNET_RECEIVE_ONLY_WARNING).toBe(
      'This Starknet address is a counterfactual Argent account. Funds sent here can only be recovered by deploying that exact Argent account, and this wallet cannot deploy it yet — so this address is receive-only.',
    );
  });
});

describe('qrCardToPngFile — sharing the QR card (UI/UX Round 2, item 1; QR-cards Lane E)', () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" fill="#FFFDF7"/><rect x="10" y="10" width="20" height="20" fill="#2B2B2B"/></svg>';
  const ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const DETAILS: QrCardPngDetails = {
    amountText: '25 USDC',
    address: ADDRESS,
    tokenLabel: 'usdc (base)',
    title: 'Receive USDC',
    subtitle: 'Only Base network assets can be received here.',
    networkName: 'Base',
    subline: 'USD Coin · Base',
    tokenLogoSrc: 'https://example.invalid/usdc.webp',
    chainLogoSrc: 'https://example.invalid/base.webp',
  };

  // Fake render deps with text + path support: the card measures and
  // draws text, so the fake context records fillText and measures
  // each character as 10px wide. Every canvas is a fresh object with
  // its own context — the main canvas is canvases[0]; Template A's
  // white silhouette builds an offscreen canvas of its own, and its
  // calls must not pollute the main canvas's assertions. Images load
  // in call order — the QR first, then the two logos — and logos can
  // be made to fail.
  function cardDeps(options: { failLogos?: boolean } = {}): {
    deps: QrRenderDeps;
    canvases: { width: number; height: number }[];
    contexts: {
      putImageData: ReturnType<typeof vi.fn>;
    }[];
    canvas: { width: number; height: number };
    fillRect: ReturnType<typeof vi.fn>;
    drawImage: ReturnType<typeof vi.fn>;
    fillText: ReturnType<typeof vi.fn>;
    arcTo: ReturnType<typeof vi.fn>;
  } {
    const canvases: { width: number; height: number }[] = [];
    const contexts: {
      putImageData: ReturnType<typeof vi.fn>;
    }[] = [];
    let main: {
      fillRect: ReturnType<typeof vi.fn>;
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
      arcTo: ReturnType<typeof vi.fn>;
    } | null = null;
    let imageCount = 0;
    const deps: QrRenderDeps = {
      createCanvas: () => {
        const fillRect = vi.fn();
        const drawImage = vi.fn();
        const fillText = vi.fn();
        const putImageData = vi.fn();
        const arcTo = vi.fn();
        const ctx = {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          globalCompositeOperation: 'source-over',
          font: '',
          textAlign: '',
          textBaseline: '',
          fillRect,
          drawImage,
          fillText,
          measureText: (text: string) => ({ width: text.length * 10 }),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          arcTo,
          arc: vi.fn(),
          closePath: vi.fn(),
          fill: vi.fn(),
          stroke: vi.fn(),
          save: vi.fn(),
          restore: vi.fn(),
          clip: vi.fn(),
          // Four pixels: dark glyph, light disc background, dark
          // glyph, light disc background — the silhouette threshold
          // must keep the dark two and clear the light two.
          getImageData: () => ({
            data: new Uint8ClampedArray([
              50, 50, 50, 255, 244, 244, 244, 255, 100, 100, 100, 255, 244,
              244, 244, 255,
            ]),
          }),
          putImageData,
        };
        contexts.push({ putImageData });
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ctx,
          toBlob: (callback: (blob: Blob | null) => void) => {
            callback(new Blob(['\x89PNG fake-bytes'], { type: 'image/png' }));
          },
        };
        canvases.push(canvas);
        if (main === null) main = { fillRect, drawImage, fillText, arcTo };
        return canvas;
      },
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
    return {
      deps,
      canvases,
      contexts,
      get canvas() {
        return canvases[0]!;
      },
      get fillRect() {
        return main!.fillRect;
      },
      get drawImage() {
        return main!.drawImage;
      },
      get fillText() {
        return main!.fillText;
      },
      get arcTo() {
        return main!.arcTo;
      },
    };
  }

  it('draws the full B card — header, title, subtitle, tile, amount, address, subline, footer, brand — in order', async () => {
    const fakes = cardDeps();
    const file = await qrCardToPngFile(SVG, DETAILS, 'bawa-receive-base-usdc.png', fakes.deps);
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('bawa-receive-base-usdc.png');
    expect(file.type).toBe('image/png');
    // 640 wide; the layout is the DESIGN.md B geometry at scale
    // 640/390 (px(v) = round(v * 640/390)): card 25/39, 591 wide,
    // cardH 1192 with the subline (tile 252: code 216 + 16 px padding
    // a side + 4 border — UX-major Lane 1), canvas 1270 tall.
    // One address line at 10px a character (42 chars fit the 499px
    // address width); one subtitle line (50 chars fit the 525px
    // subtitle width).
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(1270);
    // Paper painted first, over the whole card.
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 0, 640, 1270);
    // Lane B (2026-11-28): no hard offset shadow any more — the
    // tile is a flat white round rect, 20 px radius, 1 px hairline.
    // Its top-right corner arc sits at the tile position (113.5,
    // 344, size 414, radius 33): arcTo(527.5, 344, 527.5, 377, 33).
    expect(fakes.fillRect).not.toHaveBeenCalledWith(120.5, 351, 414, 414);
    expect(fakes.arcTo).toHaveBeenCalledWith(527.5, 344, 527.5, 377, 33);
    // The QR is drawn 216 design px wide (354 canvas px), centred,
    // inside its tile at the top. It is the third draw — the header
    // token and chain badge are drawn first — so it is found by its
    // width, not by call order.
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 354)!;
    expect(qrDraw[1]).toBe(143.5);
    expect(qrDraw[2]).toBe(374);
    expect(qrDraw[3]).toBe(354);
    expect(qrDraw[4]).toBe(354);
    // The header carries the token mark (52 design px) with the chain
    // mark as its badge (20 design px); the centre mark (44 design
    // px) sits in the code over its excavation hole.
    const logoDraws = fakes.drawImage.mock.calls.filter((call) => call !== qrDraw);
    expect(logoDraws).toHaveLength(3);
    expect(logoDraws[0]!.slice(1)).toEqual([277, 82, 85, 85]);
    expect(logoDraws[1]!.slice(1)).toEqual([342, 147, 33, 33]);
    expect(logoDraws[2]!.slice(1)).toEqual([284.5, 515, 72, 72]);
    // The card's facts, in the on-screen order: title, subtitle
    // (network bolded, one fillText per word), amount, label, Copy,
    // address, subline, footer, brand mark, wordmark.
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive USDC',
      'Only',
      'Base',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '25 USDC',
      'Receiving address',
      'Copy',
      ADDRESS,
      'USD Coin · Base',
      'Share the card, keep the keys.',
      'B',
      'Bawa Wallet',
    ]);
  });

  it('draws the same B card at 1080 px — same layout, scaled', async () => {
    const fakes = cardDeps();
    await qrCardToPngBlob(
      SVG,
      {
        amountText: '0.5 ETH',
        address: ADDRESS,
        tokenLabel: 'Ethereum',
        title: 'Receive ETH',
        subtitle: 'Only Ethereum network assets can be received here.',
        networkName: 'Ethereum',
        width: 1080,
      },
      fakes.deps,
    );
    expect(fakes.canvas.width).toBe(1080);
    expect(fakes.canvas.height).toBe(2065);
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 0, 1080, 2065);
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 598)!;
    expect(qrDraw.slice(1)).toEqual([241.5, 631, 598, 598]);
  });

  it('draws Template A — dark teal, inverted code, brand bar', async () => {
    const fakes = cardDeps();
    await qrCardToPngBlob(
      SVG,
      {
        amountText: '0.5 ETH',
        address: ADDRESS,
        tokenLabel: 'Ethereum',
        title: 'Receive ETH',
        subtitle: 'Only Ethereum network assets can be received here.',
        networkName: 'Ethereum',
        template: 'a',
        tokenLogoSrc: 'https://example.invalid/eth.webp',
        chainLogoSrc: 'https://example.invalid/eth.webp',
      },
      fakes.deps,
    );
    // A at 640: card at 394, band 535 + footer 187 = 722, footer
    // tagline 30 (Lane B), link 22, brand bar 84 — 1411 tall (the
    // regrouped px() sums round 1 px shorter than the old 1412;
    // the design-px total is unchanged). The address splits
    // balanced 21 + 21 (Lane B), not the greedy 41 + 1.
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(1411);
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 0, 640, 1411);
    // The brand bar is full-bleed at the bottom.
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 1273, 640, 138);
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 358)!;
    expect(qrDraw.slice(1)).toEqual([141, 453, 358, 358]);
    // QR, header token, chain badge, white-silhouette centre mark.
    expect(fakes.drawImage).toHaveBeenCalledTimes(4);
    const centreDraw = fakes.drawImage.mock.calls[3]!;
    expect(centreDraw[3]).toBeCloseTo(29.44, 1);
    // The silhouette threshold ran on the offscreen canvas (the
    // second canvas created): the light disc-background pixels were
    // cleared to transparent, the dark glyph pixels kept.
    const silhouetteCtx = fakes.contexts[1]!;
    expect(silhouetteCtx.putImageData).toHaveBeenCalledTimes(1);
    const thresholded = silhouetteCtx.putImageData.mock.calls[0]![0].data;
    expect([...thresholded]).toEqual([
      50, 50, 50, 255, 244, 244, 244, 0, 100, 100, 100, 255, 244, 244, 244, 0,
    ]);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive ETH',
      'Only',
      'Ethereum',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '0.5 ETH',
      'Receiving address',
      ADDRESS.slice(0, 21),
      ADDRESS.slice(21),
      'Share the card, keep the keys.',
      'Open the Bawa link ›',
      'B',
      'Bawa Wallet',
    ]);
  });

  it('draws Template C — minimal, no tile, no footer band', async () => {
    const fakes = cardDeps();
    await qrCardToPngBlob(
      SVG,
      {
        amountText: '0.5 ETH',
        address: ADDRESS,
        tokenLabel: 'Ethereum',
        title: 'Receive ETH',
        subtitle: 'Only Ethereum network assets can be received here.',
        networkName: 'Ethereum',
        template: 'c',
        tokenLogoSrc: 'https://example.invalid/eth.webp',
        chainLogoSrc: 'https://example.invalid/eth.webp',
      },
      fakes.deps,
    );
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(1135);
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 368)!;
    expect(qrDraw.slice(1)).toEqual([136, 308, 368, 368]);
    // QR, top logo, centre mark — no tile badges, no brand bar.
    expect(fakes.drawImage).toHaveBeenCalledTimes(3);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive ETH',
      'Only',
      'Ethereum',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      'Scan or share this QR code to receive crypto.',
      '0.5 ETH',
      ADDRESS,
      'Copy',
      'Share the card, keep the keys.',
      'Bawa',
    ]);
  });

  it('draws Template D — coral poster, white tile, ink address strip', async () => {
    const fakes = cardDeps();
    await qrCardToPngBlob(
      SVG,
      {
        amountText: '0.5 ETH',
        address: ADDRESS,
        tokenLabel: 'Ethereum',
        title: 'Receive ETH',
        subtitle: 'Only Ethereum network assets can be received here.',
        networkName: 'Ethereum',
        template: 'd',
        tokenLogoSrc: 'https://example.invalid/eth.webp',
        chainLogoSrc: 'https://example.invalid/eth.webp',
      },
      fakes.deps,
    );
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(1170);
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 364)!;
    expect(qrDraw.slice(1)).toEqual([139, 329, 364, 364]);
    // QR, header disc logo, centre mark.
    expect(fakes.drawImage).toHaveBeenCalledTimes(3);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive ETH',
      'Only',
      'Ethereum',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '0.5 ETH',
      ADDRESS,
      'Share the card, keep the keys.',
      'B',
      'Bawa Wallet',
    ]);
  });

  it('wraps a long address onto two lines and grows the card', async () => {
    const fakes = cardDeps();
    // 62 characters at 10px = 620px: balanced 31 + 31 (Lane B —
    // the greedy wrap's 49 + 13 left a 13-char orphan line).
    const longAddress = `bc1q${'a'.repeat(58)}`;
    await qrCardToPngBlob(
      SVG,
      {
        amountText: '0.5 BTC',
        address: longAddress,
        tokenLabel: 'Bitcoin',
        title: 'Receive BTC',
        subtitle: 'Only Bitcoin network assets can be received here.',
        networkName: 'Bitcoin',
      },
      fakes.deps,
    );
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive BTC',
      'Only',
      'Bitcoin',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '0.5 BTC',
      'Receiving address',
      'Copy',
      longAddress.slice(0, 31),
      longAddress.slice(31),
      'Share the card, keep the keys.',
      'B',
      'Bawa Wallet',
    ]);
    // 1201 before (two address lines), +53 for the bigger B tile
    // (code 216 + 16 px padding a side — UX-major Lane 1).
    expect(fakes.canvas.height).toBe(1171 + 30 + 53);
  });

  it('still shares the card when both logos fail to load', async () => {
    const fakes = cardDeps({ failLogos: true });
    const file = await qrCardToPngFile(SVG, DETAILS, 'bawa-receive-base-usdc.png', fakes.deps);
    expect(file).toBeInstanceOf(File);
    // Only the QR is drawn; the header and centre marks are skipped,
    // and every line of copy is still there.
    expect(fakes.drawImage).toHaveBeenCalledTimes(1);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive USDC',
      'Only',
      'Base',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '25 USDC',
      'Receiving address',
      'Copy',
      ADDRESS,
      'USD Coin · Base',
      'Share the card, keep the keys.',
      'B',
      'Bawa Wallet',
    ]);
  });

  it('rejects a blank SVG, missing payment details and a bad width', async () => {
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
    await expect(
      qrCardToPngBlob(SVG, { ...DETAILS, title: '' }, fakes.deps),
    ).rejects.toThrow('payment details are missing');
    await expect(
      qrCardToPngBlob(SVG, { ...DETAILS, width: 100 }, fakes.deps),
    ).rejects.toThrow('invalid image size');
  });
  it('draws the E Sun card at 640 px — sun field, white tile, ink strip', async () => {
    const fakes = cardDeps();
    await qrCardToPngBlob(
      SVG,
      { ...DETAILS, template: 'e' },
      fakes.deps,
    );
    // px(v) = round(v * 640/390): logo 53, title 243, subtitle 318,
    // tile 437 wide at (102, 393), QR 358 at (141, 432), amount 869,
    // strip (39, 977, 561, 85) inset, brand 1170, canvas 1268 tall.
    // One subtitle line (460 px fits the 558 px width); one address
    // line (420 px fits the 430 px strip width). Lane B: the tile
    // has no offset shadow any more, the strip is an inset rounded
    // panel (not full-bleed), and the footer tagline sits between
    // the strip and the brand row (+69 canvas px).
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(1268);
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 0, 640, 1268);
    // The tile is flat now: its own top-right corner arc at the
    // tile position (102, 393, size 437, radius 39) — and no shadow
    // arc at the old offset position.
    expect(fakes.fillRect).not.toHaveBeenCalledWith(116, 400, 423, 423);
    expect(fakes.arcTo).toHaveBeenCalledWith(539, 393, 539, 432, 39);
    expect(fakes.arcTo).not.toHaveBeenCalledWith(546, 400, 546, 439, 39);
    expect(fakes.fillRect).toHaveBeenCalledWith(281, 931, 79, 7);
    // The strip is an inset rounded panel now, not a full-bleed
    // rect: its top-right corner arc sits at (39, 977, 561 wide,
    // radius 26): arcTo(600, 977, 600, 1003, 26).
    expect(fakes.fillRect).not.toHaveBeenCalledWith(0, 977, 640, 85);
    expect(fakes.arcTo).toHaveBeenCalledWith(600, 977, 600, 1003, 26);
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 358)!;
    expect(qrDraw.slice(1)).toEqual([141, 432, 358, 358]);
    const logoDraws = fakes.drawImage.mock.calls.filter((call) => call !== qrDraw);
    expect(logoDraws).toHaveLength(3);
    expect(logoDraws[0]!.slice(1)).toEqual([267, 79, 105, 105]);
    expect(logoDraws[1]!.slice(1)).toEqual([360, 172, 33, 33]);
    expect(logoDraws[2]!.slice(1)).toEqual([285.5, 576.5, 69, 69]);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive USDC',
      'Only',
      'Base',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '25 USDC',
      ADDRESS,
      'Share the card, keep the keys.',
      'B',
      'Bawa Wallet',
    ]);
  });

  it('draws the F Ink card at 640 px — ink field, white tile, paper strip', async () => {
    const fakes = cardDeps();
    await qrCardToPngBlob(
      SVG,
      { ...DETAILS, template: 'f' },
      fakes.deps,
    );
    // px(v) = round(v * 640/390): tile 433 wide at (104, 393), QR 354
    // at (143, 432), amount 865, strip (39, 973, 561, 85), brand 1166,
    // canvas 1264 tall. One subtitle line; one address line (420 px
    // fits the 430 px strip width). Tile +13 canvas px vs before
    // (code 216 — UX-major Lane 1). Lane B: the footer tagline sits
    // between the strip and the brand row (+69 canvas px).
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(1264);
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 0, 640, 1264);
    expect(fakes.fillRect).toHaveBeenCalledWith(281, 927, 79, 7);
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 354)!;
    expect(qrDraw.slice(1)).toEqual([143, 432, 354, 354]);
    const logoDraws = fakes.drawImage.mock.calls.filter((call) => call !== qrDraw);
    expect(logoDraws).toHaveLength(3);
    expect(logoDraws[0]!.slice(1)).toEqual([267, 79, 105, 105]);
    expect(logoDraws[1]!.slice(1)).toEqual([360, 172, 33, 33]);
    expect(logoDraws[2]!.slice(1)).toEqual([287, 576, 66, 66]);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive USDC',
      'Only',
      'Base',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '25 USDC',
      ADDRESS,
      'Share the card, keep the keys.',
      'B',
      'Bawa Wallet',
    ]);
  });

  it('draws the G Ticket card at 640 px — paper top, sun bottom, tear line', async () => {
    const fakes = cardDeps();
    await qrCardToPngBlob(
      SVG,
      { ...DETAILS, template: 'g' },
      fakes.deps,
    );
    // px(v) = round(v * 640/390): card (25, 39, 591, 1114), tile 414
    // at (114, 345), QR 354 at (144, 375), tear 798, amount 831,
    // copy 953, brand 1081, canvas 1192 tall. One subtitle line (460 px
    // fits the 525 px width); one address line (420 px fits 525 px).
    // Tile +53 canvas px vs before (code 216 + 16 px padding a side
    // — UX-major Lane 1). Lane B: the tile has no offset shadow any
    // more, and the footer tagline sits under the Copy pill (+56).
    expect(fakes.canvas.width).toBe(640);
    expect(fakes.canvas.height).toBe(1192);
    expect(fakes.fillRect).toHaveBeenCalledWith(0, 0, 640, 1192);
    // The tile is a flat white round rect now: its top-right corner
    // arc at (114, 345, size 414, radius 33): arcTo(528, 345, 528,
    // 378, 33) — and no shadow rect at the old offset position.
    expect(fakes.fillRect).not.toHaveBeenCalledWith(121, 352, 414, 414);
    expect(fakes.arcTo).toHaveBeenCalledWith(528, 345, 528, 378, 33);
    const qrDraw = fakes.drawImage.mock.calls.find((call) => call[3] === 354)!;
    expect(qrDraw.slice(1)).toEqual([144, 375, 354, 354]);
    const logoDraws = fakes.drawImage.mock.calls.filter((call) => call !== qrDraw);
    expect(logoDraws).toHaveLength(3);
    expect(logoDraws[0]!.slice(1)).toEqual([277, 82, 85, 85]);
    expect(logoDraws[1]!.slice(1)).toEqual([342, 147, 33, 33]);
    expect(logoDraws[2]!.slice(1)).toEqual([285, 516, 72, 72]);
    const texts = fakes.fillText.mock.calls.map((call) => call[0]);
    expect(texts).toEqual([
      'Receive USDC',
      'Only',
      'Base',
      'network',
      'assets',
      'can',
      'be',
      'received',
      'here.',
      '25 USDC',
      ADDRESS,
      'Copy',
      'Share the card, keep the keys.',
      'B',
      'Bawa Wallet',
    ]);
  });

  it('draws the Starknet warning in every template — after the subtitle, before the QR — and grows the card by the warning alone', async () => {
    const warningWords = STARKNET_RECEIVE_ONLY_WARNING.split(' ');
    for (const template of ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const) {
      const plain = cardDeps();
      await qrCardToPngBlob(SVG, { ...DETAILS, template }, plain.deps);
      const warned = cardDeps();
      await qrCardToPngBlob(
        SVG,
        { ...DETAILS, template, warning: STARKNET_RECEIVE_ONLY_WARNING },
        warned.deps,
      );
      // The card grows by the warning block alone, and the QR moves
      // down by exactly the same amount — nothing below the warning
      // is reflowed, and a card with no warning is laid out exactly
      // as before.
      const heightDelta = warned.canvas.height - plain.canvas.height;
      expect(heightDelta).toBeGreaterThan(0);
      const qrWidth = Math.round(
        QR_CARD_TEMPLATE_QR[template].size * (640 / 390),
      );
      const plainQr = plain.drawImage.mock.calls.find(
        (call) => call[3] === qrWidth,
      )!;
      const warnedQr = warned.drawImage.mock.calls.find(
        (call) => call[3] === qrWidth,
      )!;
      expect(warnedQr[2] - plainQr[2]).toBe(heightDelta);
      // The warning words are drawn in order, after the subtitle
      // ('here.') and before the amount ('25 USDC') — the same place
      // the in-app card shows them.
      const texts = warned.fillText.mock.calls.map((call) => call[0]);
      let cursor = texts.lastIndexOf('here.');
      expect(cursor).toBeGreaterThanOrEqual(0);
      for (const word of warningWords) {
        const at = texts.indexOf(word, cursor + 1);
        expect(at).toBeGreaterThan(cursor);
        cursor = at;
      }
      expect(texts.indexOf('25 USDC')).toBeGreaterThan(cursor);
    }
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

describe('splitAddressLines — the balanced card address split (Lane B)', () => {
  const measure = (text: string): number => text.length * 10;

  it('splits a 42-char address into two balanced 21-char lines', () => {
    expect(
      splitAddressLines(
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        414,
        measure,
      ),
    ).toEqual(['0x742d35Cc6634C053292', '5a3b844Bc454e4438f44e']);
  });

  it('keeps a short address on one line when it fits', () => {
    expect(splitAddressLines('0xabc', 568, measure)).toEqual(['0xabc']);
  });

  it('balances lines instead of filling the first to the brim', () => {
    // Greedy would give 5 + 5 + 2; the balanced split gives 4 + 4 + 4.
    expect(splitAddressLines('abcdefghijkl', 50, measure)).toEqual([
      'abcd',
      'efgh',
      'ijkl',
    ]);
  });

  it('returns no lines for an empty string', () => {
    expect(splitAddressLines('', 568, measure)).toEqual([]);
  });
});
