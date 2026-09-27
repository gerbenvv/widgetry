// Browser tests of the MessageDialog and the promise helpers.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('message dialog', () => {
    test('it shows an icon for its type, the texts and preset buttons', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MessageDialog } = await import('/src/widgets/message-dialog.js');

            const dialog = new MessageDialog({
                messageType: 'warning',
                text: 'Delete the file?',
                secondaryText: 'It cannot be restored.',
                buttonsType: 'ok-cancel',
            });
            dialog.show();

            const icons = {};
            for (const type of ['info', 'warning', 'question', 'error', 'other']) {
                dialog.messageType = type;
                icons[type] = [dialog.image.icon, dialog.image.visible];
            }

            const labels = dialog.messageArea.el.querySelectorAll('.wy-label');
            const text = dialog.el.querySelector('.wy-message-dialog-text');

            let error = '';
            try {
                dialog.buttonsType = 'yes-no';
            } catch (e) {
                error = e.message;
            }

            return {
                icons,
                texts: [...labels].map((x) => x.textContent),
                bold: getComputedStyle(text).fontWeight,
                buttons: dialog.actionArea.children.map((x) => x.el.textContent),
                defaultResponse: dialog.defaultResponse,
                focus: dialog.focusWidget === dialog.getButton('ok'),
                error,
            };
        });

        expect(errors).toEqual([]);
        expect(result.icons).toEqual({
            info: ['dialog-information', true],
            warning: ['dialog-warning', true],
            question: ['dialog-question', true],
            error: ['dialog-error', true],
            other: ['', false],
        });
        expect(result.texts).toEqual(['Delete the file?', 'It cannot be restored.']);
        expect(result.bold).toBe('700');
        expect(result.buttons).toEqual(['Cancel', 'OK']);
        expect(result.defaultResponse).toBe('ok');
        expect(result.focus).toBe(true);
        expect(result.error).toMatch(/only be set once/);
    });

    test('alert() resolves when the dialog is dismissed', async ({ page }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { alert } = await import('/src/widgets/message-dialog.js');

            globalThis.done = false;
            alert('Saved.', { title: 'Info', secondaryText: 'All good.' }).then(
                () => (globalThis.done = true)
            );
        });

        expect(await page.locator('.wy-window-title', { hasText: 'Info' }).isVisible()).toBe(true);
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => globalThis.done)).toBe(true);
        expect(await page.locator('.wy-message-dialog').count()).toBe(0);
    });

    test('confirm() resolves with the choice', async ({ page }) => {
        await openHarness(page);

        const run = (buttons, key) =>
            page.evaluate(
                async ({ buttons, key }) => {
                    const { confirm } = await import('/src/widgets/message-dialog.js');

                    const promise = confirm('Continue?', { buttonsType: buttons });
                    const dialog = document.querySelector('.wy-message-dialog');
                    const target = document.activeElement || dialog;
                    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

                    return promise;
                },
                { buttons, key }
            );

        expect(await run('ok-cancel', 'Escape')).toBe(false);

        const promise = page.evaluate(async () => {
            const { confirm } = await import('/src/widgets/message-dialog.js');

            globalThis.answer = confirm('Really?', { buttonsType: 'yes-no' });
        });
        await promise;
        await page.getByText('Yes').click();
        expect(await page.evaluate(() => globalThis.answer)).toBe(true);
    });

    test('prompt() resolves with the text, or null when canceled', async ({ page }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { prompt } = await import('/src/widgets/message-dialog.js');

            globalThis.answer = undefined;
            prompt('Your name?', { value: 'Ada', placeholder: 'Name' }).then(
                (x) => (globalThis.answer = x)
            );
        });

        // The text is selected, so typing replaces it.
        await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT');
        await page.keyboard.type('Grace');
        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => globalThis.answer)).toBe('Grace');

        await page.evaluate(async () => {
            const { prompt } = await import('/src/widgets/message-dialog.js');

            globalThis.answer = undefined;
            prompt('Again?').then((x) => (globalThis.answer = x));
        });
        await page.keyboard.press('Escape');
        await expect.poll(() => page.evaluate(() => globalThis.answer)).toBeNull();
    });

    test('the builder accepts a buttons preset', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/construction/builder.js');
            await import('/src/widgets/message-dialog.js');

            const [dialog] = new Builder().build({
                type: 'message-dialog',
                messageType: 'error',
                text: 'Failed',
                buttons: 'close',
            });

            return dialog.actionArea.children.map((x) => x.el.textContent);
        });

        expect(result).toEqual(['Close']);
    });
});
