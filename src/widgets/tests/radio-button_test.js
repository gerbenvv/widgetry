// Browser tests of RadioButton.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows three radio buttons in a group between two buttons, as `globalThis.radios`.
async function openWindow(page) {
    const errors = await openHarness(page);

    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { Button } = await import('/src/widgets/button.js');
        const { RadioButton } = await import('/src/widgets/radio-button.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const window = new MainWindow();
        const box = new Box({
            orientation: 'vertical',
            spacing: 4,
            margin: 10,
            vAlign: 'start',
            hAlign: 'start',
        });
        window.addChild(box);

        globalThis.before = box.addChild(new Button({ label: 'Before' }));
        globalThis.radios = ['One', 'Two', 'Three'].map((label) =>
            box.addChild(new RadioButton({ label, name: label }))
        );
        globalThis.after = box.addChild(new Button({ label: 'After' }));

        globalThis.radios[0].join(globalThis.radios[1]);
        globalThis.radios[0].join(globalThis.radios[2]);
        globalThis.radios[1].active = true;

        globalThis.testWindow = window;
        window.show();
        flushLayout();
    });

    return errors;
}

const actives = (page) => page.evaluate(() => globalThis.radios.map((x) => x.active));
const focused = (page) =>
    page.evaluate(
        () => globalThis.testWindow.focusWidget?.name || globalThis.testWindow.focusWidget?.label
    );

test.describe('RadioButton', () => {
    test('clicking activates a radio button, and never deactivates it', async ({ page }) => {
        const errors = await openWindow(page);

        const point = (index) =>
            page.evaluate((index) => {
                const r = globalThis.radios[index].el.getBoundingClientRect();
                return { x: r.left + 6, y: r.top + r.height / 2 };
            }, index);

        let p = await point(2);
        await page.mouse.click(p.x, p.y);
        expect(await actives(page)).toEqual([false, false, true]);
        expect(await focused(page)).toBe('Three');

        await page.mouse.click(p.x, p.y);
        expect(await actives(page)).toEqual([false, false, true]);

        p = await point(0);
        await page.mouse.click(p.x, p.y);
        expect(await actives(page)).toEqual([true, false, false]);
        expect(await focused(page)).toBe('One');

        const roles = await page.evaluate(() =>
            globalThis.radios.map((x) => [
                x.el.getAttribute('role'),
                x.el.getAttribute('aria-checked'),
            ])
        );
        expect(roles).toEqual([
            ['radio', 'true'],
            ['radio', 'false'],
            ['radio', 'false'],
        ]);
        expect(errors).toEqual([]);
    });

    test('the group is one tab stop, and arrow keys move within it', async ({ page }) => {
        await openWindow(page);
        await page.evaluate(() => globalThis.before.focus());

        await page.keyboard.press('Tab');
        expect(await focused(page)).toBe('Two');

        await page.keyboard.press('Tab');
        expect(await focused(page)).toBe('After');

        await page.keyboard.press('Shift+Tab');
        expect(await focused(page)).toBe('Two');

        await page.keyboard.press('ArrowDown');
        expect(await focused(page)).toBe('Three');
        expect(await actives(page)).toEqual([false, false, true]);

        // Moving wraps around at the ends.
        await page.keyboard.press('ArrowRight');
        expect(await focused(page)).toBe('One');
        expect(await actives(page)).toEqual([true, false, false]);

        await page.keyboard.press('ArrowUp');
        expect(await focused(page)).toBe('Three');

        // Insensitive buttons are skipped.
        await page.evaluate(() => (globalThis.radios[0].sensitive = false));
        await page.keyboard.press('ArrowDown');
        expect(await focused(page)).toBe('Two');

        await page.keyboard.press('Space');
        expect(await actives(page)).toEqual([false, true, false]);
    });

    test('every radio button is a tab stop while none is active', async ({ page }) => {
        await openWindow(page);

        const tabIndexes = await page.evaluate(() => {
            const before = globalThis.radios.map((x) => x.el.tabIndex);

            globalThis.radios[1].active = false;
            const after = globalThis.radios.map((x) => x.el.tabIndex);

            return { before, after };
        });

        expect(tabIndexes.before).toEqual([-1, 0, -1]);
        expect(tabIndexes.after).toEqual([0, 0, 0]);
    });

    test('a radio button draws a round indicator with a dot', async ({ page }) => {
        await openWindow(page);

        const look = await page.evaluate(() =>
            globalThis.radios.map((x) => {
                const indicator = x.el.querySelector('.wy-check-indicator');

                return [
                    getComputedStyle(indicator).borderTopLeftRadius,
                    getComputedStyle(indicator, '::after').visibility,
                ];
            })
        );

        expect(look).toEqual([
            ['50%', 'hidden'],
            ['50%', 'visible'],
            ['50%', 'hidden'],
        ]);
    });
});
