Rewrite ONLY the action row in apps/web/src/screens/dashboard.tsx: the ACTIONS array and the grid that renders it. Do not touch the hero, asset list, or lock banners.

Current row has four actions: Send (/send), Receive (/receive), Activity (/transactions), Import (/import-wallet), each a lucide icon in a circle with a text label below.

Per the UI pattern list, the home action row holds Send, Receive and Activity only — all three are real (send signs offline, receive shows a real QR, activity shows real on-chain history). Import is not a home action: it belongs in wallet management, so remove it from this row entirely (do not replace it with Swap or Buy — there is no swap engine or on-ramp, and unimplemented actions must be absent, not shown).

Return the full replacement ACTIONS array and action-row JSX. Keep the existing grid, icon circles, labels and dark-navy styling. Acceptance: exactly three actions — Send, Receive, Activity — each linking to a real screen.
