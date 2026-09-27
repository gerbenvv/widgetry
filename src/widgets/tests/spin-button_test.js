// Browser tests of the SpinButton widget.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a spin button in a main window, as `globalThis.widget`.
async function mount(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { SpinButton } = await import('/src/widgets/spin-button.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');

        const host = document.createElement('div');
        host.style.cssText =
            'position: absolute; inset: 0 auto auto 0; width: 600px; height: 300px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({ orientation: 'vertical', spacing: 8, margin: 20 });
        const widget = new SpinButton({ hAlign: 'start', ...properties });

        box.addChild(widget);
        box.addChild(new LineEdit());
        window.addChild(box);
        window.show();

        globalThis.widget = widget;
        globalThis.values = [];
        widget.connect('value-change', () => globalThis.values.push(widget.value));
    }, properties);
}

const state = (page) =>
    page.evaluate(() => ({ value: globalThis.widget.value, text: globalThis.widget.text }));

test.describe('SpinButton', () => {
    test('the keyboard steps and pages the value', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page, { value: 10 });

        await page.click('.wy-spin-button input');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        expect(await state(page)).toEqual({ value: 12, text: '12' });

        await page.keyboard.press('PageDown');
        expect(await state(page)).toEqual({ value: 2, text: '2' });

        await page.keyboard.press('PageDown');
        await page.keyboard.press('ArrowDown');
        expect(await state(page)).toEqual({ value: 0, text: '0' });

        const result = await page.evaluate(() => ({
            values: globalThis.values,
            aria: [
                globalThis.widget.focusElement.getAttribute('role'),
                globalThis.widget.focusElement.getAttribute('aria-valuenow'),
                globalThis.widget.focusElement.getAttribute('aria-valuemax'),
            ],
            downDisabled: globalThis.widget.el
                .querySelector('.wy-down')
                .classList.contains('wy-disabled'),
        }));

        expect(errors).toEqual([]);
        expect(result).toEqual({
            values: [11, 12, 2, 0],
            aria: ['spinbutton', '0', '100'],
            downDisabled: true,
        });
    });

    test('typed text is applied on Enter and on blur, and clamped', async ({ page }) => {
        await openHarness(page);
        await mount(page, { value: 5, upper: 50 });

        await page.click('.wy-spin-button input');
        await page.keyboard.press('Control+A');
        await page.keyboard.type('33');
        expect(await state(page)).toEqual({ value: 5, text: '33' });

        await page.keyboard.press('Enter');
        expect(await state(page)).toEqual({ value: 33, text: '33' });

        await page.keyboard.press('Control+A');
        await page.keyboard.type('99');
        await page.keyboard.press('Tab');
        expect(await state(page)).toEqual({ value: 50, text: '50' });

        // Text that is not a number is shown as invalid, and replaced by the value on blur.
        await page.click('.wy-spin-button input');
        await page.keyboard.press('Control+A');
        await page.keyboard.type('abc');

        const invalid = await page.evaluate(() => globalThis.widget.isValid);
        expect(invalid).toBe(false);

        await page.keyboard.press('Tab');
        expect(await state(page)).toEqual({ value: 50, text: '50' });
    });

    test('the value is only changed by text the user typed, and setting it shows it', async ({
        page,
    }) => {
        await openHarness(page);
        await mount(page, { digits: 1, value: 1.26 });

        // Passing through keeps a value with more decimals than shown.
        await page.click('.wy-spin-button input');
        await page.keyboard.press('Tab');
        expect(await state(page)).toEqual({ value: 1.26, text: '1.3' });

        await page.evaluate(() => globalThis.widget.activate());
        expect(await state(page)).toEqual({ value: 1.26, text: '1.3' });

        // Setting the value shows it, also when it did not change.
        await page.click('.wy-spin-button input');
        await page.keyboard.press('Control+A');
        await page.keyboard.type('abc');
        await page.evaluate(() => (globalThis.widget.value = 1.26));
        expect(await state(page)).toEqual({ value: 1.26, text: '1.3' });

        const values = await page.evaluate(() => globalThis.values);
        expect(values).toEqual([]);
    });

    test('formats with the locale decimal separator and digits', async ({ page }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');
            getLocaleManager().locale = 'nl-NL';
        });

        await mount(page, { digits: 2, stepIncrement: 0.25, value: 1.5 });
        expect(await state(page)).toEqual({ value: 1.5, text: '1,50' });

        await page.click('.wy-spin-button input');
        await page.keyboard.press('Control+A');
        await page.keyboard.type('2,125');
        await page.keyboard.press('Enter');
        expect(await state(page)).toEqual({ value: 2.13, text: '2,13' });

        await page.keyboard.press('ArrowUp');
        expect(await state(page)).toEqual({ value: 2.38, text: '2,38' });

        const parsed = await page.evaluate(async () => {
            const { SpinButton } = await import('/src/widgets/spin-button.js');
            const widget = new SpinButton();

            // The spin button reads typed text with the double parser of the locale.
            const values = [
                widget.parseValue('1.234,5'),
                widget.parseValue('-3,5'),
                widget.parseValue('−2,5'),
                widget.parseValue('\u20133,5'),
                widget.parseValue('0.5'),
                widget.parseValue('1,234.5'),
                widget.parseValue('12abc'),
            ];
            widget.destroy();

            return values;
        });

        expect(parsed).toEqual([1234.5, -3.5, -2.5, -3.5, 0.5, 1234.5, null]);
    });

    test('reads back its text in locales with other digits and direction marks', async ({
        page,
    }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');
            const { SpinButton } = await import('/src/widgets/spin-button.js');

            const results = {};
            for (const locale of ['ar-EG', 'fa-IR', 'he-IL', 'bn-BD', 'de-DE']) {
                getLocaleManager().locale = locale;

                const widget = new SpinButton({ lower: -100, upper: 100, digits: 1, value: -12.5 });
                const text = widget.text;

                // Applying the shown text keeps the value, and the text is valid.
                widget.value = 0;
                widget.text = text;
                widget.update();

                results[locale] = [widget.value, widget.isValid];
                widget.destroy();
            }

            getLocaleManager().locale = 'ar-EG';
            const widget = new SpinButton();
            results.typed = [widget.parseValue('٣٫٥'), widget.parseValue('3.5')];
            widget.destroy();

            return results;
        });

        expect(result).toEqual({
            'ar-EG': [-12.5, true],
            'fa-IR': [-12.5, true],
            'he-IL': [-12.5, true],
            'bn-BD': [-12.5, true],
            'de-DE': [-12.5, true],
            typed: [3.5, 3.5],
        });
    });

    test('holding a stepper repeats, faster with a climb rate', async ({ page }) => {
        await openHarness(page);
        await mount(page, { value: 0, upper: 1000, climbRate: 5 });

        const box = await page.locator('.wy-spin-button .wy-up').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

        await page.mouse.down();
        await page.waitForTimeout(1200);
        await page.mouse.up();

        const held = await page.evaluate(() => ({
            value: globalThis.widget.value,
            focused: globalThis.widget.hasFocus,
            steps: globalThis.values.length,
        }));

        // One step on the press, then repeats after the initial delay with a growing step.
        expect(held.focused).toBe(true);
        expect(held.steps).toBeGreaterThan(8);
        expect(held.value).toBeGreaterThan(held.steps + 5);

        // A click steps once.
        const before = held.value;
        const down = await page.locator('.wy-spin-button .wy-down').boundingBox();
        await page.mouse.click(down.x + down.width / 2, down.y + down.height / 2);

        expect((await state(page)).value).toBe(before - 1);
    });

    test('wraps around, and only accepts numbers when numeric', async ({ page }) => {
        await openHarness(page);
        await mount(page, { value: 9, upper: 10, wrap: true, numeric: true });

        await page.evaluate(() => {
            globalThis.wrapped = 0;
            globalThis.widget.connect('wrapped', () => (globalThis.wrapped += 1));
        });

        await page.click('.wy-spin-button input');
        await page.keyboard.press('ArrowUp');
        expect((await state(page)).value).toBe(10);

        await page.keyboard.press('ArrowUp');
        expect((await state(page)).value).toBe(0);

        await page.keyboard.press('ArrowDown');
        expect((await state(page)).value).toBe(10);

        expect(await page.evaluate(() => globalThis.wrapped)).toBe(2);

        await page.keyboard.press('Control+A');
        await page.keyboard.type('4x5');
        expect((await state(page)).text).toBe('45');
    });

    test('the wheel steps the value, and an adjustment can be shared', async ({ page }) => {
        await openHarness(page);
        await mount(page, { value: 5 });

        const box = await page.locator('.wy-spin-button').boundingBox();
        await page.mouse.move(box.x + 20, box.y + box.height / 2);
        await page.mouse.wheel(0, -100);
        await page.mouse.wheel(0, -100);
        await page.mouse.wheel(0, 100);

        await expect.poll(() => state(page)).toEqual({ value: 6, text: '6' });

        const shared = await page.evaluate(async () => {
            const { Adjustment } = await import('/src/data/adjustment.js');
            const adjustment = new Adjustment({ lower: -10, upper: 10, value: -3 });

            globalThis.widget.adjustment = adjustment;
            const states = [globalThis.widget.text];

            adjustment.value = 7;
            states.push(globalThis.widget.text, globalThis.widget.lower);

            globalThis.widget.set({ upper: 200, value: 150 });
            states.push(globalThis.widget.value);

            globalThis.widget.sensitive = false;
            states.push(globalThis.widget.isEditable);

            return states;
        });

        expect(shared).toEqual(['-3', '7', -10, 150, false]);
    });
});
