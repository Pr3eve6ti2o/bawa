```typescript
export async function signEthOffline(
  mnemonic: string,
  passphrase: string,
  to: string,
  amountBaseUnits: string,
  nonce: string,
  gasPriceBaseUnits: string,
): Promise<
  | { ok: true; signedTxHex: string; txHash: string; from: string }
  | { ok: false; reason: string }
> {
  try {
    if (
      ![amountBaseUnits, nonce, gasPriceBaseUnits].every(
        (value) => typeof value === "string" && /^[0-9]+$/.test(value),
      )
    ) {
      return {
        ok: false,
        reason: "Amount, nonce and gas price must be unsigned decimal integer strings.",
      };
    }

    const minimalBigEndian = (decimal: string): Uint8Array => {
      let value = BigInt(decimal);
      const bytes: number[] = [];

      while (value > 0n) {
        bytes.push(Number(value & 0xffn));
        value >>= 8n;
      }

      // Zero is represented by an empty byte array.
      return Uint8Array.from(bytes.reverse());
    };

    const [
      { withSigningKey, deriveAddresses },
      { TW },
      { loadCore },
      { bytesToHex, keccak256 },
    ] = await Promise.all([
      import("./core"),
      import("@trustwallet/wallet-core"),
      import("../engine/boundary"),
      import("viem"),
    ]);

    const core = await loadCore();
    const { CoinType } = core;
    const from = (await deriveAddresses(mnemonic, passphrase)).eth;

    return await withSigningKey(
      mnemonic,
      passphrase,
      CoinType.ethereum,
      "m/44'/60'/0'/0/0",
      async (key) => {
        const keyBytes = key.data();
        if (keyBytes.length !== 32) {
          return {
            ok: false as const,
            reason: "Invalid Ethereum signing key length.",
          };
        }

        const input = TW.Ethereum.Proto.SigningInput.create({
          chainId: new Uint8Array([1]),
          nonce: minimalBigEndian(nonce),
          gasPrice: minimalBigEndian(gasPriceBaseUnits),
          gasLimit: minimalBigEndian("21000"),
          toAddress: to,
          transaction: {
            transfer: {
              amount: minimalBigEndian(amountBaseUnits),
            },
          },
          privateKey: keyBytes,
        });

        const encoded = TW.Ethereum.Proto.SigningInput.encode(input).finish();

        try {
          const output = TW.Ethereum.Proto.SigningOutput.decode(
            core.AnySigner.sign(encoded, CoinType.ethereum),
          );

          if (output.error !== TW.Common.Proto.SigningError.OK) {
            return {
              ok: false as const,
              reason: output.errorMessage,
            };
          }

          const signedBytes = output.encoded;
          if (signedBytes.length === 0) {
            return {
              ok: false as const,
              reason: "Signer returned an empty transaction.",
            };
          }

          // Finish all byte access before the disposable key is freed.
          return {
            ok: true as const,
            signedTxHex: bytesToHex(signedBytes),
            txHash: keccak256(signedBytes),
            from,
          };
        } finally {
          // The protobuf input contains a copy of the private key.
          encoded.fill(0);
        }
      },
    );
  } catch {
    return {
      ok: false,
      reason: "Failed to sign ETH transaction offline.",
    };
  }
}
```