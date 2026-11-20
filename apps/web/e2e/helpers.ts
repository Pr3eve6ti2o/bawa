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
 * (page.goto) drops the in-memory vault keys and locks the wallet, so
 * every navigation after creation goes through the app's own nav:
 * the Home / Assets / Receive / Send tabs, or the More menu
 * (Wallets, Transactions, Security, ...).
 */
export async function gotoInApp(page: Page, label: string): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
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
  await page.getByText('Your wallet is ready').waitFor();
}
