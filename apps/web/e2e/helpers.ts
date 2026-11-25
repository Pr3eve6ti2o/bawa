import { expect, test, type Page, type TestInfo } from '@playwright/test';

/** Disposable vault password used by every E2E test. Never a real password. */
export const TEST_PASSWORD = 'correct horse battery staple';

/**
 * Registers an afterEach hook that captures a failure screenshot with every
 * secret-bearing region masked. Playwright cannot mask regions in its
 * automatic failure screenshots, so the config sets screenshot 'off' and
 * this helper is the only failure evidence. Masked: the recovery-phrase
 * section (headed "Write down your recovery phrase") and every password
 * input. A locator that matches nothing is left out rather than failing
 * the shot — a useless screenshot beats a leaked phrase.
 */
export function setupMaskedScreenshots(): void {
  test.afterEach(async ({ page }, testInfo: TestInfo) => {
    if (testInfo.status === 'passed') return;
    const candidates = [
      page.locator('section', { hasText: 'Write down your recovery phrase' }),
      page.locator('input[type=password]'),
    ];
    const mask = [];
    for (const locator of candidates) {
      if ((await locator.count()) > 0) mask.push(locator);
    }
    await page.screenshot({ path: testInfo.outputPath('failure.png'), mask });
  });
}

/**
 * Navigates inside the SPA without a full page load. A full load
 * (page.goto) re-boots the app: the vault re-opens via auto-unlock, so
 * nothing locks — but the reboot re-derives addresses and drops SPA
 * state, so every navigation after creation goes through the app's own
 * nav: the Home / Assets / Receive / Send tabs, or the More menu
 * (Wallets, Transactions, Security, ...).
 */
export async function gotoInApp(page: Page, label: string): Promise<void> {
  // Focused flows (/create-wallet, /send) hide the shell nav entirely,
  // so there is no navigation to click from the ready step. A full load
  // to Home lands on a shelled route where the nav renders; the vault
  // re-opens via auto-unlock, so no password prompt appears.
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  if ((await nav.count()) === 0) {
    await page.goto('/');
  }
  const direct = nav.getByRole('link', { name: label, exact: true });
  if ((await direct.count()) > 0) {
    await direct.click();
    return;
  }
  await nav.getByRole('button', { name: 'More' }).click();
  // The More menu renders its links with role="menuitem", not "link".
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}

/**
 * Drives the create flow end to end and returns on the "Your wallet is
 * ready" step. The recovery phrase is read from the page only to answer
 * the confirm step: the words are never printed, logged, or asserted on.
 * The vault password is the disposable TEST_PASSWORD.
 */
export async function createTestWallet(page: Page, password: string = TEST_PASSWORD): Promise<void> {
  await page.goto('/create-wallet');
  await page.getByLabel('Vault password', { exact: true }).fill(password);
  await page.getByLabel('Repeat vault password').fill(password);
  await page.getByRole('button', { name: 'Generate recovery phrase' }).click();
  // CardTitle renders a div, not a heading, and its text also appears
  // in the steps list — so wait on the unique step indicator instead.
  await page.getByText('Step 2 of 4: Write down 24 words').waitFor();

  // The merged create screen gates the phrase behind a risk check
  // (adopt-proper's layout-makeover flow): tick all three boxes, then
  // reveal the phrase. The phrase list renders only after that.
  for (const id of ['#risk-check-0', '#risk-check-1', '#risk-check-2']) {
    await page.locator(id).click();
  }
  await page.getByRole('button', { name: 'I understand — show my recovery phrase' }).click();
  await page.locator('ol[aria-label="Recovery phrase"]').waitFor();

  const words: string[] = [];
  const items = page.locator('ol[aria-label="Recovery phrase"] li');
  const count = await items.count();
  expect(count).toBe(24);
  for (let i = 0; i < count; i++) {
    words.push((await items.nth(i).locator('span').last().innerText()).trim());
  }

  await page.getByRole('button', { name: 'I have written them down' }).click();
  await page.getByText('Step 3 of 4: Confirm 3 words').waitFor();

  const inputs = page.locator('input[id^="confirm-word-"]');
  const inputCount = await inputs.count();
  expect(inputCount).toBe(3);
  for (let i = 0; i < inputCount; i++) {
    const id = (await inputs.nth(i).getAttribute('id')) ?? '';
    const position = Number(id.replace('confirm-word-', ''));
    await inputs.nth(i).fill(words[position] ?? '');
  }
  await page.getByRole('button', { name: 'Confirm and create wallet' }).click();
  // Merge fix: exact match — Lane 5's create-flow disclosure says
  // "…and your wallet is ready" inside its summary paragraph, which
  // a substring getByText also matches (strict-mode violation).
  await page.getByText('Your wallet is ready', { exact: true }).waitFor();
}
