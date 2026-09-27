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

    test('activation and changes of active emit their signals', async ({ page }) => {
        const errors = await openWindow(page);

        await page.evaluate(() => {
            globalThis.log = [];
            for (const radio of globalThis.radios) {
                for (const name of ['activate', 'toggle', 'active-change']) {
                    radio.connect(name, () =>
                        globalThis.log.push(`${radio.name}:${name}:${radio.active}`)
                    );
                }
            }
        });

        const log = () => page.evaluate(() => globalThis.log.splice(0));

        // Activating one radio button changes two, and only the activated one emits `activate`.
        // The group deactivates the other button when the activated one emits `active-change`.
        await page.evaluate(() => globalThis.radios[0].activate());
        expect(await actives(page)).toEqual([true, false, false]);
        expect(await log()).toEqual([
            'One:toggle:true',
            'Two:toggle:false',
            'Two:active-change:false',
            'One:active-change:true',
            'One:activate:true',
        ]);

        // Activating the active button keeps it active, but still emits `activate`.
        await page.evaluate(() => globalThis.radios[0].activate());
        expect(await actives(page)).toEqual([true, false, false]);
        expect(await log()).toEqual(['One:activate:true']);

        // The arrow keys activate the button they move to.
        await page.evaluate(() => globalThis.radios[0].focus());
        await page.keyboard.press('ArrowDown');
        expect(await log()).toEqual([
            'Two:toggle:true',
            'One:toggle:false',
            'One:active-change:false',
            'Two:active-change:true',
            'Two:activate:true',
        ]);

        // Setting `active` from code does not emit `activate`.
        await page.evaluate(() => (globalThis.radios[2].active = true));
        expect(await log()).toEqual([
            'Three:toggle:true',
            'Two:toggle:false',
            'Two:active-change:false',
            'Three:active-change:true',
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

    test('a shared mnemonic cycles the focus through inactive radio buttons', async ({ page }) => {
        const errors = await openWindow(page);

        await page.evaluate(() => {
            globalThis.radios[0].set({ label: 'On_e', useUnderline: true });
            globalThis.radios[2].set({ label: 'Thr_ee', useUnderline: true });
            globalThis.radios[1].focus();
        });

        // Both mnemonics are E: the focus moves without choosing, as in GTK.
        await page.keyboard.press('Alt+e');
        const first = [await focused(page), await actives(page)];

        await page.keyboard.press('Alt+e');
        const second = [await focused(page), await actives(page)];

        // Once the focus leaves, only the active button is a tab stop again.
        await page.keyboard.press('Tab');
        const tabStops = await page.evaluate(() => globalThis.radios.map((x) => x.el.tabIndex));

        expect(errors).toEqual([]);
        expect(first).toEqual(['One', [false, true, false]]);
        expect(second).toEqual(['Three', [false, true, false]]);
        expect(await focused(page)).toBe('After');
        expect(tabStops).toEqual([-1, 0, -1]);
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

    test('the accessible state is checked or not, also when inconsistent', async ({ page }) => {
        await openWindow(page);

        const states = await page.evaluate(() => {
            const [first, second] = globalThis.radios;
            first.inconsistent = true;
            second.inconsistent = true;

            return [first, second].map((x) => [
                x.el.getAttribute('role'),
                x.el.getAttribute('aria-checked'),
                x.el.classList.contains('wy-inconsistent'),
            ]);
        });

        // Radio buttons have no mixed state for assistive technology.
        expect(states).toEqual([
            ['radio', 'false', true],
            ['radio', 'true', true],
        ]);
    });
});
