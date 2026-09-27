// Shared helpers for the browser tests.

/**
 * Opens the test harness and waits until it is ready.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function openHarness(page) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error));

    await page.goto('/tests/harness.html');
    await page.waitForFunction(() => window.harnessReady === true);

    return errors;
}
