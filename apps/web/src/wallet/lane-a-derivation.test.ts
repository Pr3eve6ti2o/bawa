// Lane A (Finish the Product): SOL multi-address, TON second address, LTC
// zpub import, CELO shared-path pinning. Every expected value below comes
// from the independent Python oracle (bip_utils 2.13.0, SLIP-0010 ed25519
// paths) on the published ripple fixture — never hand-edited. The words
// are public test data, never for funds.
//
// SOL/TON scheme (Lane A): account 0 index 0 keeps the legacy single
// path byte-identical (SOL m/44'/501'/0', TON m/44'/607'/0'), so existing
// users' addresses do not move. New accounts use the account component
// (SOL m/44'/501'/<account>'/0' — the Phantom template already recorded
// in chains.ts SOLANA_PROFILES; TON m/44'/607'/<account>' — the
// Tonkeeper template), and rotation within an account appends a hardened
// index (SOL m/44'/501'/<account>'/0'/<index>', TON
// m/44'/607'/<account>'/<index>'). All components stay hardened
// (SLIP-0010); no (account, index) pair collides with another.
import { describe, expect, it } from 'vitest';
import {
  deriveAddress,
  validateAccountKey,
} from '../engine/boundary';
import {
  accountPathFor,
  canRotateReceiveAddress,
  pathFor,
} from './chains';
import {
  deriveAddressAt,
  deriveAddressesAt,
  deriveFromXpub,
  getAccountExtendedPublicKey,
} from './core';

const RIPPLE_MNEMONIC =
  'ripple scissors kick mammal hire column oak again sun offer wealth tomorrow wagon turn fatal';

// bip_utils 2.13.0 oracle, ripple fixture, empty passphrase.
const SOL_ORACLE: Record<string, string> = {
  '0,0': 'DrKpwo8t8SihRstTGNeeEHu1PAcu6QThyvegqDMXiroF',
  '1,0': 'BZbH77EFbwUfzYhz89qvnQdrx8y1tXxofJNbj7YsjqUj',
  '0,1': 'AU4y4CsLpaVSVSN5q7yxRFVmhyq7aVZYRCJ4FjyVtx6e',
  '0,2': 'FtnuwnUeWYR2YsmXpc278TM4RP1SPBuzvi62F7nxup82',
  '0,5': '6cAMZZRPiC6nWrci1ogUuFDMfP2MTt1uAeSUt5Z8Hb4v',
  '1,2': '7xk6VWVdquTSw63uGYDkCyNDpnYFy7GLZydPxmrkW5H2',
};
const TON_ORACLE: Record<string, string> = {
  '0,0': 'UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn',
  '1,0': 'UQBE_LQuVmQ1Ya6f419kJ57KSmyNuQ5SAtWj73uPei7P-mff',
  '0,1': 'UQCxyaBqitW8KZHU6Q3buXaThb5q_dLacLHFeSx2Id-gJ-qR',
  '0,2': 'UQBZCscMtjcU4EEQ0qpo5i52bbIyNmAxSJkCPqNAFWpTL8B6',
  '0,5': 'UQBK12yq57L4vc3gW3s5b-g1AktxvSM_teNX9Q_I4a9PpnpI',
  '1,2': 'UQAJzCVWtGIOtFmWSHnazmVveb_j4MMnnJu7Guoqv_gysmaH',
};

function oracleValue(
  table: Record<string, string>,
  account: number,
  index: number,
): string {
  const value = table[`${account},${index}`];
  if (value === undefined) {
    throw new Error(`missing oracle value ${account},${index}`);
  }
  return value;
}

describe('Lane A: SOL multi-address (legacy address unmoved)', () => {
  it('keeps account 0 index 0 byte-identical to the legacy address', async () => {
    expect(await deriveAddressAt(RIPPLE_MNEMONIC, '', 'sol', 0, 0)).toBe(
      SOL_ORACLE['0,0'],
    );
    expect((await deriveAddressesAt(RIPPLE_MNEMONIC, '', 0, 0)).sol).toBe(
      SOL_ORACLE['0,0'],
    );
  });

  it('derives distinct addresses for new accounts and rotations, matching the bip_utils oracle', async () => {
    for (const [account, index] of [
      [1, 0],
      [0, 1],
      [0, 2],
      [0, 5],
      [1, 2],
    ] as const) {
      expect(
        await deriveAddressAt(RIPPLE_MNEMONIC, '', 'sol', account, index),
        `sol ${account},${index}`,
      ).toBe(oracleValue(SOL_ORACLE, account, index));
    }
    const rotated = await deriveAddressesAt(RIPPLE_MNEMONIC, '', 0, 1);
    expect(rotated.sol).toBe(SOL_ORACLE['0,1']);
    const account1 = await deriveAddressesAt(RIPPLE_MNEMONIC, '', 1, 0);
    expect(account1.sol).toBe(SOL_ORACLE['1,0']);
  });

  it('pins the SOL path scheme', () => {
    expect(pathFor('sol', 0, 0)).toBe("m/44'/501'/0'");
    expect(pathFor('sol', 1, 0)).toBe("m/44'/501'/1'/0'");
    expect(pathFor('sol', 0, 1)).toBe("m/44'/501'/0'/0'/1'");
    expect(pathFor('sol', 1, 2)).toBe("m/44'/501'/1'/0'/2'");
    expect(accountPathFor('sol', 1)).toBe("m/44'/501'/1'/0'");
  });
});

describe('Lane A: TON second address (legacy address unmoved)', () => {
  it('keeps account 0 index 0 byte-identical to the legacy address', async () => {
    expect(await deriveAddressAt(RIPPLE_MNEMONIC, '', 'ton', 0, 0)).toBe(
      TON_ORACLE['0,0'],
    );
    expect((await deriveAddressesAt(RIPPLE_MNEMONIC, '', 0, 0)).ton).toBe(
      TON_ORACLE['0,0'],
    );
  });

  it('derives distinct addresses for new accounts and rotations, matching the bip_utils oracle', async () => {
    for (const [account, index] of [
      [1, 0],
      [0, 1],
      [0, 2],
      [0, 5],
      [1, 2],
    ] as const) {
      expect(
        await deriveAddressAt(RIPPLE_MNEMONIC, '', 'ton', account, index),
        `ton ${account},${index}`,
      ).toBe(oracleValue(TON_ORACLE, account, index));
    }
    const rotated = await deriveAddressesAt(RIPPLE_MNEMONIC, '', 0, 1);
    expect(rotated.ton).toBe(TON_ORACLE['0,1']);
    const account1 = await deriveAddressesAt(RIPPLE_MNEMONIC, '', 1, 0);
    expect(account1.ton).toBe(TON_ORACLE['1,0']);
  });

  it('pins the TON path scheme', () => {
    expect(pathFor('ton', 0, 0)).toBe("m/44'/607'/0'");
    expect(pathFor('ton', 1, 0)).toBe("m/44'/607'/1'");
    expect(pathFor('ton', 0, 1)).toBe("m/44'/607'/0'/1'");
    expect(pathFor('ton', 1, 2)).toBe("m/44'/607'/1'/2'");
    expect(accountPathFor('ton', 1)).toBe("m/44'/607'/1'");
  });
});

describe('Lane A: SOL and TON rotate like every other chain', () => {
  it('reports a next receive address for SOL and TON', () => {
    expect(canRotateReceiveAddress('sol')).toBe(true);
    expect(canRotateReceiveAddress('ton')).toBe(true);
  });
});

// Lane A: LTC accepts both serialisations of the same account key —
// Ltub (019da462, what this wallet exports) and zpub (04b24746, what
// Trust Wallet lists as Litecoin's segwit xpub and what other LTC
// wallets export). The version prefix alone cannot tell a BTC zpub
// from an LTC zpub; the chain is chosen explicitly at import, exactly
// as for the 0488b21e xpub shared by BTC/ETH/TRX — so accepting zpub
// for LTC is the same accepted semantics, not a new ambiguity.
const rippleLtcLtub =
  'Ltub2YwB7k9sjn5JgCMHzxRYAWdTwJcaxjLSoaCpYjJZ2xN1bh9BdB1y3BXBiSobcrSnHj4WnopzaoK8J5L5nJzeqmJhkeDVCb52cb2WM3UaH4h';
// Same key as rippleLtcLtub, re-versioned to 04b24746 (Python oracle:
// decode, swap the 4 version bytes, recompute the checksum).
const rippleLtcZpub =
  'zpub6rAbGSHg9hrG8RTb5BznipiFCSav6BoJWX3HHSMDRUH4yX8qUUrMTfM2PzCjxGMNWntYhddZf6NqxZC6JojEbJtVCBishiwxfYPTDfyzXSk';
const rippleLtcIndex0 = 'ltc1qrw5czevuyhhgzrz2ca6hd8ulncqwnl8dp6gtca';

describe('Lane A: LTC zpub import', () => {
  it('accepts the wallet-exported Ltub and the zpub of the same key', async () => {
    await expect(validateAccountKey(rippleLtcLtub, 'ltc')).resolves.toEqual({
      ok: true,
    });
    await expect(validateAccountKey(rippleLtcZpub, 'ltc')).resolves.toEqual({
      ok: true,
    });
  });

  it('derives the same LTC addresses from Ltub and zpub (watch-only path)', async () => {
    expect(await deriveAddress('ltc', rippleLtcLtub, 0)).toBe(rippleLtcIndex0);
    expect(await deriveAddress('ltc', rippleLtcZpub, 0)).toBe(rippleLtcIndex0);
    expect(await deriveAddress('ltc', rippleLtcZpub, 1)).not.toBe(
      rippleLtcIndex0,
    );
    expect(await deriveAddress('ltc', rippleLtcZpub, 1)).toBe(
      await deriveAddress('ltc', rippleLtcLtub, 1),
    );
  });

  it('derives the same LTC addresses from Ltub and zpub (xpub path)', async () => {
    expect(await deriveFromXpub('ltc', rippleLtcLtub, 0)).toBe(rippleLtcIndex0);
    expect(await deriveFromXpub('ltc', rippleLtcZpub, 0)).toBe(rippleLtcIndex0);
    expect(await deriveFromXpub('ltc', rippleLtcZpub, 1)).toBe(
      await deriveFromXpub('ltc', rippleLtcLtub, 1),
    );
  });

  it('still rejects a private LTC key and a bad-checksum key', async () => {
    const badChecksum =
      rippleLtcZpub.slice(0, -1) + (rippleLtcZpub.endsWith('k') ? 'm' : 'k');
    await expect(validateAccountKey(badChecksum, 'ltc')).resolves.toMatchObject(
      { ok: false, reason: 'invalid-checksum' },
    );
  });
});

// Lane A: CELO uses the shared m/44'/60' path, not SLIP-44 527, on all
// three surfaces — derivation, xpub export, and the bot-agreement path
// the watch-only derivation uses. The export is the same key bytes as
// Ethereum's (same path), so CELO and ETH addresses agree at every
// account/index.
describe('Lane A: CELO shared m/44\'/60\' path, pinned on all surfaces', () => {
  it('derives the same addresses as ETH at every account/index', async () => {
    for (const [account, index] of [
      [0, 0],
      [0, 1],
      [1, 0],
    ] as const) {
      const got = await deriveAddressesAt(RIPPLE_MNEMONIC, '', account, index);
      expect(got.celo, `celo ${account},${index}`).toBe(got.eth);
    }
  });

  it('exports the same account key as ETH (m/44\'/60\'/0\')', async () => {
    const celo = await getAccountExtendedPublicKey(RIPPLE_MNEMONIC, '', 'celo', 0);
    const eth = await getAccountExtendedPublicKey(RIPPLE_MNEMONIC, '', 'eth', 0);
    expect(celo).toBe(eth);
    expect(accountPathFor('celo', 0)).toBe("m/44'/60'/0'");
    expect(pathFor('celo', 0, 0)).toBe("m/44'/60'/0'/0/0");
  });

  it('round-trips the CELO export to the same addresses via both derivation paths', async () => {
    const exported = await getAccountExtendedPublicKey(
      RIPPLE_MNEMONIC, '', 'celo', 0,
    );
    for (const index of [0, 1, 2, 5]) {
      const expected = (await deriveAddressesAt(RIPPLE_MNEMONIC, '', 0, index))
        .celo;
      expect(await deriveFromXpub('celo', exported, index)).toBe(expected);
      expect(await deriveAddress('celo', exported, index)).toBe(expected);
    }
  });
});
