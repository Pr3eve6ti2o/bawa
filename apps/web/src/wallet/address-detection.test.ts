// Lane 3 (UX-major): every detection rule and every warning condition
// in address-detection.ts fires in a test — a warning that cannot fire
// in a test does not ship. All addresses below are public test vectors
// or synthetic format examples; none holds funds and none is a secret.
import { describe, expect, it } from 'vitest';
import {
  EVM_CHAIN_COUNT,
  describeRecipientDetection,
  detectAddressFormat,
  findVerifiedNamesake,
  shortenAddress,
} from './address-detection';
import { EVM_WATCH_CHAINS } from './watch-only-families';

const ETH_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
const BTC_BECH32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const BTC_LEGACY = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
const SOL_ADDRESS = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const TRX_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const TON_ADDRESS = `UQ${'A'.repeat(46)}`;
const TEST_MNEMONIC = `${'abandon '.repeat(11)}about`;
const PRIVATE_KEY = `0x${'11'.repeat(32)}`;

function onEth(value: string, extra: Record<string, unknown> = {}) {
  return describeRecipientDetection({
    value,
    chain: 'eth',
    chainName: 'Ethereum',
    chainIsEvm: true,
    from: '',
    ...extra,
  });
}

describe('detectAddressFormat', () => {
  it('detects a bare 0x address as EVM', () => {
    expect(detectAddressFormat(ETH_ADDRESS)).toEqual({ kind: 'evm' });
  });

  it('detects Bitcoin bech32 and legacy forms', () => {
    expect(detectAddressFormat(BTC_BECH32)).toEqual({
      kind: 'chain',
      chain: 'btc',
      label: 'Bitcoin',
    });
    expect(detectAddressFormat(BTC_LEGACY)).toEqual({
      kind: 'chain',
      chain: 'btc',
      label: 'Bitcoin',
    });
  });

  it('detects Solana base58, TRON, TON, Litecoin and Dogecoin', () => {
    expect(detectAddressFormat(SOL_ADDRESS)).toEqual({
      kind: 'chain',
      chain: 'sol',
      label: 'Solana',
    });
    expect(detectAddressFormat(TRX_ADDRESS)).toEqual({
      kind: 'chain',
      chain: 'trx',
      label: 'TRON',
    });
    expect(detectAddressFormat(TON_ADDRESS)).toEqual({
      kind: 'chain',
      chain: 'ton',
      label: 'TON',
    });
    expect(detectAddressFormat(`ltc1${'q'.repeat(38)}`)).toEqual({
      kind: 'chain',
      chain: 'ltc',
      label: 'Litecoin',
    });
    expect(detectAddressFormat(`D${'A'.repeat(33)}`)).toEqual({
      kind: 'chain',
      chain: 'doge',
      label: 'Dogecoin',
    });
  });

  it('detects Cosmos-family, XRP, Stellar, Filecoin, Tezos, Hedera, Polkadot and Ronin', () => {
    const cases: Array<[string, string, string]> = [
      [`cosmos1${'a'.repeat(38)}`, 'cosmos', 'Cosmos Hub'],
      [`r${'A'.repeat(28)}`, 'xrp', 'XRP Ledger'],
      [`G${'A'.repeat(55)}`, 'stellar', 'Stellar'],
      [`f1${'a'.repeat(37)}`, 'filecoin', 'Filecoin'],
      [`tz1${'A'.repeat(33)}`, 'tezos', 'Tezos'],
      ['0.0.12345', 'hedera', 'Hedera'],
      [`1${'A'.repeat(47)}`, 'polkadot', 'Polkadot'],
      [`ronin:${'a'.repeat(40)}`, 'ronin', 'Ronin'],
    ];
    for (const [value, chain, label] of cases) {
      expect(detectAddressFormat(value)).toEqual({ kind: 'chain', chain, label });
    }
  });

  it('detects a 12-word recovery phrase, never as an address', () => {
    expect(detectAddressFormat(TEST_MNEMONIC)).toEqual({
      kind: 'secret',
      secret: 'mnemonic',
    });
  });

  it('detects a 64-hex private key, with or without 0x', () => {
    expect(detectAddressFormat(PRIVATE_KEY)).toEqual({
      kind: 'secret',
      secret: 'private-key',
    });
    expect(detectAddressFormat('11'.repeat(32))).toEqual({
      kind: 'secret',
      secret: 'private-key',
    });
  });

  it('returns null for an unknown shape and for empty input', () => {
    expect(detectAddressFormat('hello world')).toBeNull();
    expect(detectAddressFormat('')).toBeNull();
    expect(detectAddressFormat('   ')).toBeNull();
  });

  it('does not mistake 11 words for a phrase', () => {
    expect(detectAddressFormat('abandon '.repeat(11).trim())).toBeNull();
  });
});

describe('describeRecipientDetection', () => {
  it('says a 0x address works on all 59 EVM chains', () => {
    expect(onEth(ETH_ADDRESS)).toEqual({
      tone: 'info',
      text: `Detected: 0x address — the same address on all ${EVM_CHAIN_COUNT} EVM chains.`,
    });
  });

  it('keeps the 59 in step with the watch-only family', () => {
    expect(EVM_WATCH_CHAINS.length).toBe(59);
    expect(EVM_CHAIN_COUNT).toBe(59);
  });

  it('warns when a 0x address is pasted on a non-EVM chain', () => {
    expect(
      describeRecipientDetection({
        value: ETH_ADDRESS,
        chain: 'sol',
        chainName: 'Solana',
        chainIsEvm: false,
        from: '',
      }),
    ).toEqual({
      tone: 'warn',
      text: 'Looks like an Ethereum (0x) address, but this send is on Solana. Check the network before continuing.',
    });
  });

  it('warns on a bare 0x address for Ronin, which uses the ronin: form', () => {
    expect(
      describeRecipientDetection({
        value: ETH_ADDRESS,
        chain: 'ronin',
        chainName: 'Ronin',
        chainIsEvm: true,
        from: '',
      }),
    ).toEqual({
      tone: 'warn',
      text: 'This is a bare 0x address. Ronin addresses start with ronin: — check the address before sending.',
    });
  });

  it('detects a matching one-chain format and warns on a foreign one', () => {
    expect(
      describeRecipientDetection({
        value: BTC_BECH32,
        chain: 'btc',
        chainName: 'Bitcoin',
        chainIsEvm: false,
        from: '',
      }),
    ).toEqual({ tone: 'info', text: 'Detected: Bitcoin address.' });
    expect(onEth(BTC_BECH32)).toEqual({
      tone: 'warn',
      text: 'Looks like a Bitcoin address, but this send is on Ethereum. Check the network before continuing.',
    });
    expect(onEth(SOL_ADDRESS)).toEqual({
      tone: 'warn',
      text: 'Looks like a Solana address, but this send is on Ethereum. Check the network before continuing.',
    });
    expect(
      describeRecipientDetection({
        value: SOL_ADDRESS,
        chain: 'sol',
        chainName: 'Solana',
        chainIsEvm: false,
        from: '',
      }),
    ).toEqual({ tone: 'info', text: 'Detected: Solana address.' });
  });

  it('warns on a pasted recovery phrase and on a pasted private key', () => {
    expect(onEth(TEST_MNEMONIC)).toEqual({
      tone: 'warn',
      text: 'This looks like a recovery phrase. Never paste it here — anyone with it controls your wallet.',
    });
    expect(onEth(PRIVATE_KEY)).toEqual({
      tone: 'warn',
      text: 'This looks like a private key. Never paste a private key here — it is not a recipient address.',
    });
  });

  it('notes a send to your own address, including 0x case and ronin: form', () => {
    expect(onEth(ETH_ADDRESS, { from: ETH_ADDRESS })).toEqual({
      tone: 'info',
      text: 'This is your own address.',
    });
    expect(
      onEth(ETH_ADDRESS.toLowerCase(), { from: ETH_ADDRESS }),
    ).toEqual({ tone: 'info', text: 'This is your own address.' });
    expect(
      describeRecipientDetection({
        value: ETH_ADDRESS,
        chain: 'ronin',
        chainName: 'Ronin',
        chainIsEvm: true,
        from: `ronin:${ETH_ADDRESS}`,
      }),
    ).toEqual({ tone: 'info', text: 'This is your own address.' });
  });

  it('warns when the recipient is the selected token contract', () => {
    const usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    expect(
      onEth(usdc, { tokenContract: usdc, tokenSymbol: 'USDC' }),
    ).toEqual({
      tone: 'warn',
      text: 'This is the USDC contract address, not a wallet. Sending here would lose the tokens.',
    });
    // A different contract is not a warning.
    expect(
      onEth('0x1111111111111111111111111111111111111111', {
        tokenContract: usdc,
        tokenSymbol: 'USDC',
      }),
    ).toEqual({
      tone: 'info',
      text: `Detected: 0x address — the same address on all ${EVM_CHAIN_COUNT} EVM chains.`,
    });
  });

  it('says nothing for empty input or an unrecognised shape', () => {
    expect(onEth('')).toBeNull();
    expect(onEth('not an address')).toBeNull();
  });
});

describe('findVerifiedNamesake', () => {
  const verifiedUsdc = {
    chain: 'eth' as const,
    contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    name: 'USD Coin',
    symbol: 'USDC',
    verifiedSource: 'coingecko' as const,
  };
  const fakeUsdc = {
    chain: 'eth' as const,
    contract: '0x1111111111111111111111111111111111111111',
    name: 'USD Coin',
    symbol: 'USDC',
    verifiedSource: null,
  };

  it('flags an unverified copycat sharing the verified symbol', () => {
    expect(findVerifiedNamesake(fakeUsdc, [verifiedUsdc, fakeUsdc])).toEqual({
      name: 'USD Coin',
      symbol: 'USDC',
    });
  });

  it('flags a namesake sharing only the name', () => {
    const fake = { ...fakeUsdc, symbol: 'USDC2' };
    expect(findVerifiedNamesake(fake, [verifiedUsdc])).toEqual({
      name: 'USD Coin',
      symbol: 'USDC',
    });
  });

  it('stays silent for a verified token, a different chain, or the same contract', () => {
    expect(findVerifiedNamesake(verifiedUsdc, [verifiedUsdc])).toBeNull();
    expect(
      findVerifiedNamesake(
        { ...fakeUsdc, chain: 'bsc' as const },
        [verifiedUsdc],
      ),
    ).toBeNull();
    expect(findVerifiedNamesake(fakeUsdc, [fakeUsdc])).toBeNull();
    expect(
      findVerifiedNamesake(fakeUsdc, [
        { ...verifiedUsdc, contract: fakeUsdc.contract },
      ]),
    ).toBeNull();
  });
});

describe('metamorphic properties (attest E4)', () => {
  it('detection is invariant under surrounding whitespace', () => {
    const bare = onEth(ETH_ADDRESS);
    expect(onEth(`  ${ETH_ADDRESS}  `)).toEqual(bare);
    expect(onEth(`\n${BTC_BECH32}\t`)).toEqual(onEth(BTC_BECH32));
  });

  it('0x detection is invariant under hex case (lowercase 0x prefix)', () => {
    // Note: an uppercase '0X' prefix is non-standard and is not
    // detected — the validator still decides validity. Hex-letter
    // case (checksummed vs lowercase) must not change detection.
    const upperHex = `0x${ETH_ADDRESS.slice(2).toUpperCase()}`;
    expect(onEth(ETH_ADDRESS.toLowerCase())).toEqual(onEth(ETH_ADDRESS));
    expect(onEth(upperHex)).toEqual(onEth(ETH_ADDRESS));
  });

  it('detection is deterministic across repeated calls', () => {
    for (const value of [ETH_ADDRESS, BTC_BECH32, SOL_ADDRESS, TEST_MNEMONIC]) {
      expect(describeRecipientDetection({
        value,
        chain: 'eth',
        chainName: 'Ethereum',
        chainIsEvm: true,
        from: '',
      })).toEqual(
        describeRecipientDetection({
          value,
          chain: 'eth',
          chainName: 'Ethereum',
          chainIsEvm: true,
          from: '',
        }),
      );
    }
  });

  it('never echoes the pasted value in its output', () => {
    // A warning must never repeat a pasted phrase or key back at the
    // user (security-review §8: no secrets in UI output). The output
    // is fixed strings plus chain/token names from the registry.
    const phrase = onEth(TEST_MNEMONIC);
    const key = onEth(PRIVATE_KEY);
    expect(phrase?.text).not.toContain('abandon');
    expect(phrase?.text).not.toContain('about');
    expect(key?.text).not.toContain('11'.repeat(32));
  });
});

describe('shortenAddress', () => {
  it('shortens long addresses 6…4 and leaves short values whole', () => {
    expect(shortenAddress(ETH_ADDRESS)).toBe('0x742d…f44e');
    expect(shortenAddress('short')).toBe('short');
  });
});
