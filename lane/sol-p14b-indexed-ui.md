```diff
*** Begin Patch
*** Update File: apps/web/src/screens/wallet-management.tsx
@@
+import { useEffect, useState } from "react";
+
@@
+const vaultChainLabels: Record<string, string> = {
+  bitcoin: "Bitcoin",
+  btc: "Bitcoin",
+  ethereum: "Ethereum",
+  eth: "Ethereum",
+  tron: "TRON",
+  trx: "TRON",
+  ton: "TON",
+};
+
 export function WalletManagementScreen() {
-  const { xpubs, removeXpub } = useWallet();
+  const {
+    xpubs,
+    removeXpub,
+    vaultState,
+    vaultAccount,
+    setVaultAccount,
+    vaultAddresses,
+  } = useWallet();
+  const [accountInput, setAccountInput] = useState(
+    () => String(vaultAccount?.account ?? 0),
+  );
+  const [indexInput, setIndexInput] = useState(
+    () => String(vaultAccount?.index ?? 0),
+  );
+  const [isDeriving, setIsDeriving] = useState(false);
+
+  useEffect(() => {
+    if (vaultState !== "unlocked") return;
+    setAccountInput(String(vaultAccount?.account ?? 0));
+    setIndexInput(String(vaultAccount?.index ?? 0));
+  }, [vaultState, vaultAccount?.account, vaultAccount?.index]);
+
+  async function applyVaultAccount() {
+    if (isDeriving) return;
+
+    const clamp = (value: string) => {
+      if (value.trim() === "") return 0;
+      const parsed = Number(value);
+      return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
+    };
+    const account = clamp(accountInput);
+    const index = clamp(indexInput);
+
+    setAccountInput(String(account));
+    setIndexInput(String(index));
+    setIsDeriving(true);
+    try {
+      await setVaultAccount(account, index);
+    } finally {
+      setIsDeriving(false);
+    }
+  }
+
   const hasWallets = chains.some(({ id }) => Boolean(xpubs[id]));
   return (
     <section className="space-y-6" aria-labelledby="wallets-heading">
       <h1 id="wallets-heading" className="text-2xl font-semibold">Wallets</h1>
+
+      {vaultState === "unlocked" && (
+        <section
+          className="space-y-4 rounded-lg border p-4"
+          aria-labelledby="vault-account-heading"
+          aria-busy={isDeriving}
+        >
+          <h2 id="vault-account-heading" className="text-lg font-semibold">
+            Vault account
+          </h2>
+          <div className="flex flex-wrap items-end gap-3">
+            <div className="space-y-1">
+              <label htmlFor="vault-account" className="block text-sm font-medium">
+                Account
+              </label>
+              <input
+                id="vault-account"
+                type="number"
+                min={0}
+                step={1}
+                value={accountInput}
+                onChange={(event) => setAccountInput(event.target.value)}
+                disabled={isDeriving}
+                className="w-28 rounded-md border bg-transparent px-3 py-2"
+              />
+            </div>
+            <div className="space-y-1">
+              <label htmlFor="vault-index" className="block text-sm font-medium">
+                Index
+              </label>
+              <input
+                id="vault-index"
+                type="number"
+                min={0}
+                step={1}
+                value={indexInput}
+                onChange={(event) => setIndexInput(event.target.value)}
+                disabled={isDeriving}
+                className="w-28 rounded-md border bg-transparent px-3 py-2"
+              />
+            </div>
+            <button
+              type="button"
+              onClick={applyVaultAccount}
+              disabled={isDeriving}
+              className="rounded-md border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
+            >
+              {isDeriving ? "Loading…" : "Apply"}
+            </button>
+          </div>
+          <dl className="space-y-2">
+            {chains.map(({ id }) => (
+              <div key={id}>
+                <dt className="text-sm font-medium">
+                  {vaultChainLabels[id.toLowerCase()] ?? id}
+                </dt>
+                <dd className="break-all font-mono text-sm">
+                  {vaultAddresses?.[id] ?? "—"}
+                </dd>
+              </div>
+            ))}
+          </dl>
+          <p className="text-sm opacity-70">
+            TON has one address per wallet — account and index do not change it.
+          </p>
+        </section>
+      )}
*** End Patch
```