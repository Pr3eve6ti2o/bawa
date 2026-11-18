import { loadCore } from '../engine/boundary';

type ChainId = 'btc' | 'eth' | 'trx' | 'ton';
type RecipientValidation =
  | { ok: true }
  | { ok: false; reason: string };

const CHAIN_NAMES: Record<ChainId, string> = {
  btc: 'Bitcoin',
  eth: 'Ethereum',
  trx: 'TRON',
  ton: 'TON',
};

export async function validateRecipient(
  chain: ChainId,
  address: string,
): Promise<RecipientValidation> {
  const recipient = address.trim();

  if (recipient.length === 0) {
    return { ok: false, reason: 'Recipient address is required.' };
  }

  const invalid: RecipientValidation = {
    ok: false,
    reason: `Invalid ${CHAIN_NAMES[chain]} address.`,
  };

  // EQ/UQ require mainnet; the third Base64 character ensures workchain 0.
  if (chain === 'ton' && !/^(?:EQ|UQ)[A-D]/.test(recipient)) {
    return invalid;
  }

  try {
    const { CoinType, CoinTypeExt } = await loadCore();
    const coinTypes = {
      btc: CoinType.bitcoin,
      eth: CoinType.ethereum,
      trx: CoinType.tron,
      ton: CoinType.ton,
    };

    return CoinTypeExt.validate(coinTypes[chain], recipient)
      ? { ok: true }
      : invalid;
  } catch {
    return invalid;
  }
}