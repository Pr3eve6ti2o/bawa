/**
 * Compile-time-only public boundary type-contract tests, inspired by the
 * MIT-licensed anza-xyz/kit __typetests__ style (idea only; no source copied).
 *
 * Checked by `npm run typecheck`: tsconfig includes `src`. Vitest never
 * executes this file because its filename is not `*.test.ts`.
 *
 * Vitest's `expectTypeOf` / `toEqualTypeOf` pins exact types; rejections use
 * `// @ts-expect-error`. Widening a type to accept a rejected value leaves an
 * unused directive, which is itself a TypeScript error. A wrong expectation
 * must fail tsc—that is the point.
 *
 * The uncalled function below is fully typechecked but never runs: no runtime
 * tests, test data, or skipped assertions.
 */

import type {
  ExtendedKeyValidation,
  TonAddressValidation,
} from '@bawa/contracts';
import { expectTypeOf } from 'vitest';

import {
  deriveAddress,
  deriveAddresses,
  engineIsReady,
  engineWaitReady,
  isEngineReady,
  loadCore,
  validateAccountKey,
  validateExtendedKey,
  validateTonAddress,
  validateWatchOnlyImport,
  type ChainId,
} from '../boundary';

type ExpectedExtendedKeyFailureReason =
  | 'invalid-base58'
  | 'invalid-length'
  | 'invalid-checksum'
  | 'invalid-depth-metadata'
  | 'private-key'
  | 'version-not-allowed'
  | 'not-account-key'
  | 'invalid-point';

type ExpectedExtendedKeyValidation =
  | { ok: true }
  | {
      ok: false;
      reason: ExpectedExtendedKeyFailureReason;
      message: string;
    };

type ExpectedTonAddressFailureReason =
  | 'empty'
  | 'invalid-length'
  | 'invalid-character'
  | 'invalid-checksum'
  | 'unsupported-version'
  | 'wrong-network'
  | 'invalid-format'
  | 'secret-like';

type ExpectedTonAddressValidation =
  | {
      ok: true;
      form: 'bounceable' | 'non-bounceable' | 'raw';
      workchain: 0 | -1;
    }
  | {
      ok: false;
      reason: ExpectedTonAddressFailureReason;
      message: string;
    };

type ExpectedWatchOnlyImportValidation =
  | { ok: true }
  | { ok: false; reason: string; message: string };

type WatchOnlyImportValidation = Awaited<
  ReturnType<typeof validateWatchOnlyImport>
>;

type ExtendedKeyValidator = (
  xpub: string,
  chain: ChainId,
) => Promise<ExtendedKeyValidation>;

// Infer the SDK core opaquely; do not pin or inspect its shape.
type OpaqueCore = Awaited<ReturnType<typeof loadCore>>;

void function boundaryTypeContracts(
  extended: ExtendedKeyValidation,
  ton: TonAddressValidation,
  watchOnly: WatchOnlyImportValidation,
  chain: ChainId,
  xpub: string,
  index: number,
  stringIndex: string,
) {
  // Merge 1 (Lane B): repo-study pinned the 4-chain ChainId; the merged
  // tree is 13 chains (adopt-proper's registry extension), so the pin
  // and the two 'sol' rejections below are updated to the merged truth.
  // UI/UX fixes item 14 (2026-11-23): nine more EVM chains join the
  // registry, so the pin is 22 chains.
  expectTypeOf<ChainId>().toEqualTypeOf<
    | 'btc'
    | 'eth'
    | 'trx'
    | 'ton'
    | 'sol'
    | 'bsc'
    | 'matic'
    | 'arb'
    | 'op'
    | 'base'
    | 'avax'
    | 'ltc'
    | 'doge'
    | 'gnosis'
    | 'celo'
    | 'linea'
    | 'mantle'
    | 'scroll'
    | 'opbnb'
    | 'metis'
    | 'aurora'
    | 'fantom'
  >();
  expectTypeOf<ChainId>().toEqualTypeOf<import('@bawa/contracts').ChainId>();

  expectTypeOf<'btc'>().toMatchTypeOf<ChainId>();
  expectTypeOf<'eth'>().toMatchTypeOf<ChainId>();
  expectTypeOf<'trx'>().toMatchTypeOf<ChainId>();
  expectTypeOf<'ton'>().toMatchTypeOf<ChainId>();

  // @ts-expect-error -- Unsupported chains must not be assignable to ChainId.
  expectTypeOf<'xrp'>().toMatchTypeOf<ChainId>();

  expectTypeOf<ExtendedKeyValidation>().toEqualTypeOf<
    ExpectedExtendedKeyValidation
  >();
  expectTypeOf<TonAddressValidation>().toEqualTypeOf<
    ExpectedTonAddressValidation
  >();
  expectTypeOf<WatchOnlyImportValidation>().toEqualTypeOf<
    ExpectedWatchOnlyImportValidation
  >();

  // Pin zero arguments and Promise wrapping, without asserting WalletCore shape.
  expectTypeOf<typeof loadCore>().toEqualTypeOf<() => Promise<OpaqueCore>>();

  expectTypeOf<typeof engineIsReady>().toEqualTypeOf<() => boolean>();
  expectTypeOf<typeof isEngineReady>().toEqualTypeOf<() => boolean>();
  expectTypeOf<typeof engineWaitReady>().toEqualTypeOf<
    () => Promise<boolean>
  >();

  // Readiness resolves to a boolean, not the raw SDK core.
  expectTypeOf<Awaited<ReturnType<typeof engineWaitReady>>>().toEqualTypeOf<
    boolean
  >();

  expectTypeOf<typeof validateExtendedKey>().toEqualTypeOf<
    ExtendedKeyValidator
  >();
  expectTypeOf<typeof validateAccountKey>().toEqualTypeOf<
    ExtendedKeyValidator
  >();
  expectTypeOf<typeof validateTonAddress>().toEqualTypeOf<
    (
      address: string,
      options?: { devnet?: boolean },
    ) => TonAddressValidation
  >();
  expectTypeOf<typeof validateWatchOnlyImport>().toEqualTypeOf<
    (chain: ChainId, value: string) => Promise<ExpectedWatchOnlyImportValidation>
  >();

  expectTypeOf<typeof deriveAddress>().toEqualTypeOf<
    (chain: ChainId, xpub: string, index: number) => Promise<string>
  >();
  expectTypeOf<typeof deriveAddresses>().toEqualTypeOf<
    (chain: ChainId, xpub: string, count: number) => Promise<string[]>
  >();

  // @ts-expect-error -- deriveAddress rejects unsupported chains.
  deriveAddress('xrp', xpub, index);

  // @ts-expect-error -- An address index must be a number, not a string.
  deriveAddress(chain, xpub, stringIndex);

  if (extended.ok) {
    // @ts-expect-error -- Extended-key successes have no failure reason.
    void extended.reason;
  } else {
    expectTypeOf(extended.reason).toEqualTypeOf<
      ExpectedExtendedKeyFailureReason
    >();
  }

  if (ton.ok) {
    // @ts-expect-error -- TON-address successes have no failure reason.
    void ton.reason;
  } else {
    expectTypeOf(ton.reason).toEqualTypeOf<ExpectedTonAddressFailureReason>();
  }

  if (watchOnly.ok) {
    // @ts-expect-error -- Watch-only import successes have no failure reason.
    void watchOnly.reason;
  } else {
    // Deliberately widened, unlike the validators' closed reason unions.
    expectTypeOf(watchOnly.reason).toEqualTypeOf<string>();
  }
};
