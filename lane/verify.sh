#!/bin/bash
export PATH=/home/boxd/.nvm/versions/node/v22.23.4/bin:$PATH
cd /home/boxd/workspace/bawa-panel-rebuild/fix-landing/apps/web
exec > /home/boxd/workspace/bawa-panel-rebuild/fix-landing/lane/verify.log 2>&1
node --version
npm ci
echo "npm-ci-exit=$?"
npx tsc --noEmit
echo "tsc-exit=$?"
npm run build
echo "build-exit=$?"
npm test
echo "vitest-exit=$?"
npm audit
echo "audit-exit=$?"
echo VERIFY-DONE
