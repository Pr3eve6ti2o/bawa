Create ONE new file, apps/web/src/screens/lock.tsx, with a LockScreen component, and register it in apps/web/src/app/app.tsx. Do nothing else.

Current route block in app.tsx (add the lock route after the security route, and the import with the other screen imports):
<Route path="security" element={<SecuritySettingsScreen />} />
<Route path="*" element={<NotFound />} />

LockScreen is the full-screen branded password lock: Bawa Web Wallet branding at the top, a password input (id "lock-password", type password, autocomplete current-password), an Unlock button, and a "Back to dashboard" link to "/". On submit it calls unlockVault(password) from useWallet() ('../state/wallet-context'); on success it navigates to "/" (useNavigate from react-router); on failure it shows the error text ("Wrong password." when the vault rejects the password — unlockVault throws that exact message) and clears the password field. While unlocking, the button is disabled and reads "Unlocking…". If vaultState from useWallet() is 'no-vault', render "No vault exists yet." with links to /create-wallet and /import-wallet instead of the password form.

Use the existing dark-navy panel styling, the Button/Input/Label components from '../ui/components/', and en-GB copy. Return the full lock.tsx file plus the two app.tsx lines (import + route).
