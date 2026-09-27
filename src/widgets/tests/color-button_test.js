// Browser tests of ColorButton.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a color button (`globalThis.button`) and records its signals.
async function mount(page, properties = {}) {
    const errors = await openHarness(page);

    await page.evaluate(async (properties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { ColorButton } = await import('/src/widgets/color-button.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const window = new MainWindow();
        const box = new Box({ spacing: 8, margin: 20, vAlign: 'start', hAlign: 'start' });
        const button = new ColorButton(properties);

        box.addChild(button);
        box.addChild(new LineEdit());
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.button = button;
        globalThis.sets = [];
        globalThis.changes = [];
        button.connect('color-set', () => globalThis.sets.push(button.color));
        button.connect('color-change', () => globalThis.changes.push(button.color));
    }, properties);

    return errors;
}

// Returns the center of a swatch of the chooser's palette.
function swatchCenter(page, index) {
    return page.evaluate((index) => {
        const swatch = globalThis.button.chooser.palette.el.children[index];
        const rect = swatch.getBoundingClientRect();

        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, index);
}

const isOpen = (page) =>
    page.evaluate(() => [
        globalThis.button.popupOpen,
        globalThis.button.el.getAttribute('aria-expanded'),
    ]);

test.describe('ColorButton', () => {
    test('shows its color in a swatch', async ({ page }) => {
        const errors = await mount(page, { color: 'rgba(52, 101, 164, 0.5)', useAlpha: true });

        const result = await page.evaluate(() => {
            const button = globalThis.button;
            const swatch = button.el.querySelector('.wy-color-swatch');

            return {
                color: button.color,
                rgba: button.rgba,
                swatch: swatch.style.getPropertyValue('--wy-swatch-color'),
                opaque: swatch.style.getPropertyValue('--wy-swatch-opaque'),
                translucent: swatch.classList.contains('wy-translucent'),
                label: button.el.getAttribute('aria-label'),
                haspopup: button.el.getAttribute('aria-haspopup'),
                role: button.el.getAttribute('role'),
            };
        });

        expect(result).toEqual({
            color: '#3465a480',
            rgba: { r: 52, g: 101, b: 164, a: 128 / 255 },
            swatch: '#3465a480',
            opaque: '#3465a4',
            translucent: true,
            label: 'Pick a Color: #3465a480',
            haspopup: 'dialog',
            role: 'button',
        });

        // Turning useAlpha off makes the color opaque.
        await page.evaluate(() => {
            globalThis.button.useAlpha = false;
            globalThis.button.title = 'Background';
        });
        expect(
            await page.evaluate(() => [
                globalThis.button.color,
                globalThis.button.el.getAttribute('aria-label'),
            ])
        ).toEqual(['#3465a4', 'Background: #3465a4']);
        expect(errors).toEqual([]);
    });

    test('opens the chooser in a popover that follows the chosen color', async ({ page }) => {
        const errors = await mount(page, { color: '#cc0000' });

        await page.click('.wy-color-button');
        expect(await isOpen(page)).toEqual([true, 'true']);

        const placement = await page.evaluate(() => {
            const button = globalThis.button;
            const popover = button.popover;
            const rect = popover.el.getBoundingClientRect();
            const anchor = button.el.getBoundingClientRect();

            return {
                below: Math.round(rect.top - anchor.bottom),
                left: Math.round(rect.left - anchor.left),
                layer: popover.el.parentElement.className,
                color: button.chooser.color,
                focus: document.activeElement.classList.contains('wy-color-palette'),
                buttonFocus: button.hasFocus,
            };
        });
        expect(placement).toEqual({
            below: 1,
            left: 0,
            layer: 'wy-screen',
            color: '#cc0000',
            focus: true,
            buttonFocus: true,
        });

        // Choosing a swatch updates the button right away, but color-set waits for the close.
        const blue = await swatchCenter(page, 13);
        await page.mouse.click(blue.x, blue.y);

        expect(await page.evaluate(() => [globalThis.button.color, globalThis.sets])).toEqual([
            '#3465a4',
            [],
        ]);

        // Clicking elsewhere closes the popover and keeps the color.
        await page.mouse.click(600, 500);
        expect(await isOpen(page)).toEqual([false, 'false']);
        expect(await page.evaluate(() => globalThis.sets)).toEqual(['#3465a4']);
        expect(await page.evaluate(() => globalThis.changes)).toEqual(['#3465a4']);
        expect(errors).toEqual([]);
    });

    test('Escape closes the popover and restores the color', async ({ page }) => {
        await mount(page, { color: '#cc0000' });

        await page.evaluate(() => globalThis.button.focus());
        await page.keyboard.press('Space');
        expect(await isOpen(page)).toEqual([true, 'true']);

        await page.keyboard.press('ArrowRight');
        expect(await page.evaluate(() => globalThis.button.color)).toBe('#f57900');

        await page.keyboard.press('Escape');

        const result = await page.evaluate(() => ({
            color: globalThis.button.color,
            sets: globalThis.sets,
            focus: globalThis.button.hasFocus,
        }));
        expect(result).toEqual({ color: '#cc0000', sets: [], focus: true });
        expect(await isOpen(page)).toEqual([false, 'false']);
    });

    test('activating a color closes the popover and emits color-set', async ({ page }) => {
        await mount(page, { color: '#ffffff' });

        await page.click('.wy-color-button');
        const plum = await swatchCenter(page, 14);
        await page.mouse.dblclick(plum.x, plum.y);

        expect(await isOpen(page)).toEqual([false, 'false']);
        expect(await page.evaluate(() => globalThis.sets)).toEqual(['#75507b']);

        // Enter in the entry activates the typed color.
        await page.click('.wy-color-button');
        await page.click('.wy-color-chooser-entry input');
        await page.keyboard.press('Control+A');
        await page.keyboard.type('#4e9a06');
        await page.keyboard.press('Enter');

        expect(await isOpen(page)).toEqual([false, 'false']);
        expect(await page.evaluate(() => globalThis.sets)).toEqual(['#75507b', '#4e9a06']);

        // Clicking the button while the popover is open closes it; an unchanged color is not set.
        await page.click('.wy-color-button');
        expect(await isOpen(page)).toEqual([true, 'true']);
        await page.click('.wy-color-button');
        expect(await isOpen(page)).toEqual([false, 'false']);
        expect(await page.evaluate(() => globalThis.sets)).toEqual(['#75507b', '#4e9a06']);
    });

    test('with modal, opens a dialog with Cancel and Select', async ({ page }) => {
        const errors = await mount(page, { color: '#cc0000', modal: true, title: 'Text Color' });

        await page.click('.wy-color-button');

        const dialog = await page.evaluate(() => {
            const element = document.querySelector('.wy-color-button-dialog');

            return {
                title: element?.querySelector('.wy-window-title').textContent,
                buttons: [...element.querySelectorAll('.wy-dialog-actions .wy-button')].map((x) =>
                    x.textContent.trim()
                ),
                modal: document.querySelectorAll('.wy-overlay').length,
                open: globalThis.button.popupOpen,
            };
        });
        expect(dialog).toEqual({
            title: 'Text Color',
            buttons: ['Cancel', 'Select'],
            modal: 1,
            open: true,
        });

        // The dialog changes nothing until Select.
        await page.keyboard.press('ArrowDown');
        expect(await page.evaluate(() => globalThis.button.color)).toBe('#cc0000');

        await page.click('.wy-color-button-dialog .wy-button:has-text("Cancel")');
        expect(await page.evaluate(() => [globalThis.button.color, globalThis.sets])).toEqual([
            '#cc0000',
            [],
        ]);
        expect(await page.locator('.wy-color-button-dialog').count()).toBe(0);

        await page.click('.wy-color-button');
        await page.keyboard.press('ArrowDown');
        await page.click('.wy-color-button-dialog .wy-button:has-text("Select")');

        expect(await page.evaluate(() => [globalThis.button.color, globalThis.sets])).toEqual([
            '#a40000',
            ['#a40000'],
        ]);
        expect(await page.evaluate(() => globalThis.button.hasFocus)).toBe(true);
        expect(await isOpen(page)).toEqual([false, 'false']);
        expect(errors).toEqual([]);
    });

    test('an insensitive button does not open, and the builder creates it', async ({ page }) => {
        await mount(page, { color: '#cc0000', sensitive: false });

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/construction/builder.js');

            globalThis.button.popup();
            const opened = globalThis.button.popupOpen;

            const [built] = new Builder().build({
                type: 'color-button',
                color: 'rgb(0 0 255 / 50%)',
                'use-alpha': true,
            });

            return { opened, built: [built.constructor.name, built.color] };
        });

        expect(result).toEqual({ opened: false, built: ['ColorButton', '#0000ff80'] });
    });

    test('popupOpen, popup() and popdown() open and close the chooser', async ({ page }) => {
        const errors = await mount(page, { color: '#cc0000' });

        const result = await page.evaluate(() => {
            const button = globalThis.button;
            const states = [];
            button.connect('popup-open-change', () => states.push(button.popupOpen));

            button.popup();
            const shown = button.popover.isOpen;
            button.popdown();
            button.popupOpen = true;
            button.popupOpen = false;

            button.modal = true;
            button.popupOpen = true;
            const dialog = document.querySelectorAll('.wy-color-button-dialog').length;
            button.popdown();

            return { states, shown, dialog, sets: globalThis.sets };
        });

        expect(result).toEqual({
            states: [true, false, true, false, true, false],
            shown: true,
            dialog: 1,
            sets: [],
        });
        expect(errors).toEqual([]);
    });

    test('destroying the button destroys its popover', async ({ page }) => {
        const errors = await mount(page, { color: '#cc0000' });

        const result = await page.evaluate(() => {
            const button = globalThis.button;
            button.popup();

            const popover = button.popover;
            button.destroy();

            return { destroyed: popover.destroyed, attached: popover.el.isConnected };
        });

        expect(result).toEqual({ destroyed: true, attached: false });
        expect(errors).toEqual([]);
    });
});
