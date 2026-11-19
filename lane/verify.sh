#!/bin/bash
export PATH="/home/boxd/.nvm/versions/node/v22.23.4/bin:$PATH"
node --version
cd /home/boxd/workspace/bawa-panel-rebuild/fix-create/apps/web
echo "=== npm ci ==="
npm ci 2>&1 | tail -3
echo "NPM_CI_EXIT=${PIPESTATUS[0]}"
echo "=== tsc --noEmit ==="
npx tsc --noEmit
echo "TSC_EXIT=$?"
echo "=== npm run build ==="
npm run build 2>&1 | tail -8
echo "BUILD_EXIT=${PIPESTATUS[0]}"
echo "=== vitest run (create-wallet only) ==="
npx vitest run src/screens/create-wallet.test.tsx 2>&1 | tail -15
echo "VITEST_CREATE_EXIT=${PIPESTATUS[0]}"
echo "=== vitest run (full suite) ==="
npx vitest run 2>&1 | tail -8
echo "VITEST_FULL_EXIT=${PIPESTATUS[0]}"
echo "=== npm audit ==="
npm audit 2>&1 | tail -5
echo "AUDIT_EXIT=${PIPESTATUS[0]}"
echo "=== DONE ==="
