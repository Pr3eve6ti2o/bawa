// Lane F: ERC-7730 clear signing + CAIP helpers.
// The 1inch values below come from the registry's own test vectors
// (registry/1inch/testsv2/calldata-AggregationRouterV6.tests.json,
// "1inch: AggregationRouterV6: unoswapTo"): the expected Amount to
// Send is 4303.000000000000262144 $MBG (18 decimals), i.e.
// 4303000000000000262144 base units, beneficiary
// 0x4E5B17cF6393ecb5c0295f80ef9a79D6233fEdb8, minimum to receive
// 2105045649, last pool 0x53Ead11073fc0651dce70572666f0eD0752abfeA.
import { describe, expect, it } from 'vitest';
import {
  formatAccountId,
  formatAccountWithChain,
  formatChainId,
  getAddressFromAccount,
  getChainFromAccount,
  parseAccountId,
  parseChainId,
} from './caip';
import {
  decodeCalldata,
  formatBaseUnits,
  resolveContractCall,
} from './clear-signing';
import { buildErc20TransferData } from './send';

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const RECIPIENT = '0x27ef5cdbe01777d62438affeb695e33fc2335979';

function pad32(hex: string): string {
  return hex.replace(/^0x/, '').padStart(64, '0');
}

// unoswapTo calldata for the registry vector above, built from the
// expected values: selector 0xe2c95c82 is keccak256 of the signature
// (it also opens the rawTx in the registry test file).
function unoswapToData(): string {
  return (
    '0xe2c95c82' +
    pad32('0x4e5b17cf6393ecb5c0295f80ef9a79d6233fedb8') +
    pad32('0x45e02bc2875a2914c4f585bbf92a6f28bc07cb70') +
    pad32('0xe9441ef5ba99e00000') +
    pad32('0x7d787291') +
    pad32('0x53ead11073fc0651dce70572666f0ed0752abfea')
  );
}

describe('CAIP-2 / CAIP-10 helpers', () => {
  it('formats and parses a chain id', () => {
    expect(formatChainId({ namespace: 'eip155', reference: '1' })).toBe(
      'eip155:1',
    );
    expect(parseChainId('eip155:42161')).toEqual({
      namespace: 'eip155',
      reference: '42161',
    });
  });

  it('formats and parses an account id, and reads its parts', () => {
    const account = formatAccountId({
      namespace: 'eip155',
      reference: '1',
      address: USDC,
    });
    expect(account).toBe(`eip155:1:${USDC}`);
    expect(parseAccountId(account)).toEqual({
      namespace: 'eip155',
      reference: '1',
      address: USDC,
    });
    expect(getAddressFromAccount(account)).toBe(USDC);
    expect(getChainFromAccount(account)).toBe('eip155:1');
    expect(formatAccountWithChain(USDC, 'eip155:1')).toBe(account);
  });

  it('rejects malformed ids', () => {
    expect(() => parseChainId('eip155')).toThrow();
    expect(() => parseChainId('eip155:1:extra')).toThrow();
    expect(() => parseChainId('EIP155:1')).toThrow();
    expect(() => parseAccountId('eip155:1')).toThrow();
    expect(() => parseAccountId('eip155:1:0xabc:extra')).toThrow();
    expect(() => formatAccountId({ namespace: 'eip155', reference: '1', address: '' })).toThrow();
  });
});

describe('clear signing', () => {
  it('decodes the wallet’s own ERC-20 transfer as Send with labelled rows', () => {
    const data = buildErc20TransferData(RECIPIENT, '1500000');
    const resolved = resolveContractCall({
      chainId: 1,
      contract: USDC,
      data,
      token: { decimals: 6, symbol: 'USDC' },
    });
    expect(resolved).not.toBeNull();
    expect(resolved?.contractName).toBeNull();
    expect(resolved?.intent).toBe('Send');
    expect(resolved?.functionName).toBe('transfer');
    expect(resolved?.rows).toEqual([
      { label: 'To', value: RECIPIENT.toLowerCase() },
      { label: 'Amount', value: '1.5 USDC' },
    ]);
  });

  it('decodes approve as Approve, and a transfer to an unlisted contract still resolves as generic ERC-20', () => {
    const selector = '0x095ea7b3';
    const data = `${selector}${pad32(RECIPIENT)}${pad32('0x2a')}`;
    const resolved = resolveContractCall({
      chainId: 137,
      contract: '0x1234567890123456789012345678901234567890',
      data,
    });
    expect(resolved?.intent).toBe('Approve');
    expect(resolved?.rows).toEqual([
      { label: 'Spender', value: RECIPIENT.toLowerCase() },
      { label: 'Amount', value: '42' },
    ]);
  });

  it('decodes the registry 1inch unoswapTo vector as Swap with registry labels', () => {
    const data = unoswapToData();
    const decoded = decodeCalldata(
      data,
      'unoswapTo(uint256 to, uint256 token, uint256 amount, uint256 minReturn, uint256 dex)',
    );
    expect(decoded).toHaveLength(5);
    expect(decoded?.[2]).toBe('4303000000000000262144');
    expect(decoded?.[3]).toBe('2105045649');
    const resolved = resolveContractCall({
      chainId: 1,
      contract: '0x111111125421ca6dc452d289314280a0f8842a65',
      data,
    });
    expect(resolved?.contractName).toBe('1inch AggregationRouterV6');
    expect(resolved?.intent).toBe('Swap');
    expect(resolved?.rows).toEqual([
      { label: 'Beneficiary', value: '0x4e5b17cf6393ecb5c0295f80ef9a79d6233fedb8' },
      { label: 'token', value: '0x45e02bc2875a2914c4f585bbf92a6f28bc07cb70' },
      { label: 'Amount to Send', value: '4303000000000000262144' },
      { label: 'Minimum to Receive', value: '2105045649' },
      { label: 'Last pool', value: '0x53ead11073fc0651dce70572666f0ed0752abfea' },
    ]);
  });

  it('returns null for types the decoder does not support', () => {
    const transfer = buildErc20TransferData(RECIPIENT, '100');
    // Dynamic bytes (Safe execTransaction needs this) and tuples.
    expect(
      decodeCalldata(
        transfer,
        'execTransaction(address to, uint256 value, bytes data)',
      ),
    ).toBeNull();
    expect(
      decodeCalldata(
        transfer,
        'swap(address executor, (address srcToken) desc, bytes data)',
      ),
    ).toBeNull();
    // Signed ints and bools are not in the snapshot either.
    expect(decodeCalldata(transfer, 'vote(int256 amount)')).toBeNull();
    expect(decodeCalldata(transfer, 'setFlag(bool enabled)')).toBeNull();
  });

  it('falls back honestly: unknown selector, unlisted chain and malformed data return null', () => {
    const unknown = `0xdeadbeef${pad32(RECIPIENT)}${pad32('0x1')}`;
    expect(
      resolveContractCall({ chainId: 1, contract: USDC, data: unknown }),
    ).toBeNull();
    const transfer = buildErc20TransferData(RECIPIENT, '100');
    // The same 1inch call on a chain the contract is not deployed on
    // (per the registry deployments) does not resolve.
    expect(
      resolveContractCall({
        chainId: 9999,
        contract: '0x111111125421ca6dc452d289314280a0f8842a65',
        data: unoswapToData(),
      }),
    ).toBeNull();
    expect(
      resolveContractCall({ chainId: 1, contract: USDC, data: '0xzz' }),
    ).toBeNull();
    expect(
      resolveContractCall({ chainId: 1, contract: USDC, data: '0x123' }),
    ).toBeNull();
    expect(
      resolveContractCall({ chainId: 1, contract: 'not-an-address', data: transfer }),
    ).toBeNull();
    expect(
      resolveContractCall({ chainId: 0, contract: USDC, data: transfer }),
    ).toBeNull();
    expect(
      decodeCalldata(
        transfer,
        'swap(address executor, (address srcToken) desc, bytes data)',
      ),
    ).toBeNull();
  });

  it('formats base units with a decimal point', () => {
    expect(formatBaseUnits('1500000', 6)).toBe('1.5');
    expect(formatBaseUnits('1000000', 6)).toBe('1');
    expect(formatBaseUnits('5', 6)).toBe('0.000005');
    expect(formatBaseUnits('42', 0)).toBe('42');
  });
});
