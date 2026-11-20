/**
 * Wallet error codes are append-only: never reuse or renumber them.
 * Ranges: vault 1000-1099, provider/network 2000-2099,
 * validation 3000-3099, confirmation 4000-4099.
 *
 * `context` must never hold secrets, addresses, balances, mnemonics, keys,
 * or raw payloads. Use only small, non-identifying facts such as operation,
 * chain id, or attempt number.
 */

export const WalletErrorCodes = {
  VAULT_WRONG_PASSWORD: 1001,
  VAULT_CORRUPTED: 1002,
  VAULT_NOT_FOUND: 1003,
  VAULT_LOCKED: 1004,
  VAULT_EXISTS: 1005,
  PROVIDER_NETWORK: 2001,
  PROVIDER_TIMEOUT: 2002,
  PROVIDER_RATE_LIMITED: 2003,
  PROVIDER_INVALID_RESPONSE: 2004,
  PROVIDER_NETWORK_MISMATCH: 2005,
  PROVIDER_NOT_FOUND: 2006,
  PROVIDER_UNAVAILABLE: 2007,
  INVALID_ADDRESS: 3001,
  INVALID_INPUT: 3002,
  CONFIRMATION_VALIDITY_EXPIRED: 4001,
} as const;

export type WalletErrorCode =
  (typeof WalletErrorCodes)[keyof typeof WalletErrorCodes];

export type WalletErrorCategory =
  | 'vault'
  | 'provider'
  | 'validation'
  | 'confirmation';

export const ERROR_MESSAGES: Readonly<Record<WalletErrorCode, string>> = {
  [WalletErrorCodes.VAULT_WRONG_PASSWORD]: 'Incorrect password.',
  [WalletErrorCodes.VAULT_CORRUPTED]: 'Vault is corrupted.',
  [WalletErrorCodes.VAULT_NOT_FOUND]: 'No vault exists.',
  [WalletErrorCodes.VAULT_LOCKED]: 'Vault is locked.',
  [WalletErrorCodes.VAULT_EXISTS]: 'A vault already exists.',
  [WalletErrorCodes.PROVIDER_NETWORK]:
    'Network error: the provider could not be reached.',
  [WalletErrorCodes.PROVIDER_TIMEOUT]: 'Network error: request timed out',
  [WalletErrorCodes.PROVIDER_RATE_LIMITED]: 'Provider rate limit reached.',
  [WalletErrorCodes.PROVIDER_INVALID_RESPONSE]:
    'Invalid response: the provider returned an unexpected shape.',
  [WalletErrorCodes.PROVIDER_NETWORK_MISMATCH]: 'Network identity mismatch.',
  [WalletErrorCodes.PROVIDER_NOT_FOUND]:
    'Provider could not find the requested item.',
  [WalletErrorCodes.PROVIDER_UNAVAILABLE]: 'Provider unavailable.',
  [WalletErrorCodes.INVALID_ADDRESS]: 'Invalid address.',
  [WalletErrorCodes.INVALID_INPUT]: 'Invalid input.',
  [WalletErrorCodes.CONFIRMATION_VALIDITY_EXPIRED]:
    'Validity expired before confirmation.',
};

function categoryForCode(code: WalletErrorCode): WalletErrorCategory {
  if (code >= 1000 && code <= 1099) {
    return 'vault';
  }

  if (code >= 2000 && code <= 2099) {
    return 'provider';
  }

  if (code >= 3000 && code <= 3099) {
    return 'validation';
  }

  // All remaining WalletErrorCode values belong to the confirmation range.
  return 'confirmation';
}

export class BawaError extends Error {
  readonly code: WalletErrorCode;
  readonly category: WalletErrorCategory;
  readonly context: Readonly<Record<string, string | number | boolean>>;
  declare readonly docs?: string;
  declare readonly cause?: unknown;

  constructor(
    code: WalletErrorCode,
    context: Readonly<Record<string, string | number | boolean>> = {},
    options?: { docs?: string; cause?: unknown },
  ) {
    super(ERROR_MESSAGES[code]);
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = 'BawaError';
    this.code = code;
    this.category = categoryForCode(code);
    this.context = Object.freeze({ ...context });

    if (options?.docs !== undefined) {
      this.docs = options.docs;
    }

    if (options !== undefined && 'cause' in options) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  }
}

export function createWalletError(
  code: WalletErrorCode,
  context?: Readonly<Record<string, string | number | boolean>>,
): BawaError {
  return new BawaError(code, context);
}

export function isWalletError(value: unknown): value is BawaError {
  return value instanceof BawaError;
}

export function walletErrorCodeOf(error: unknown): WalletErrorCode | null {
  return isWalletError(error) ? error.code : null;
}

export function toWalletError(
  error: unknown,
  fallbackCode: WalletErrorCode,
): BawaError {
  if (isWalletError(error)) {
    return error;
  }

  return new BawaError(fallbackCode, undefined, { cause: error });
}
