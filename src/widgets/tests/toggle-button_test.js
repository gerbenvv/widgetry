// Browser tests of ToggleButton.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a horizontal box, available as `globalThis.box`.
async function openWindow(page) {
    const errors = await openHarness(page);

    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');

        const window = new MainWindow();
        const box = new Box({ spacing: 4, margin: 10, vAlign: 'start', hAlign: 'start' });
        window.addChild(box);
        window.show();

        globalThis.box = box;
        globalThis.log = [];
    });

    return errors;
}

test.describe('ToggleButton', () => {
    test('clicking toggles active with signals and the accessible state', async ({ page }) => {
        const errors = await openWindow(page);

        const box = await page.evaluate(async () => {
            const { ToggleButton } = await import('/src/widgets/toggle-button.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const button = globalThis.box.addChild(new ToggleButton({ label: 'Bold' }));
            for (const name of ['toggle', 'active-change', 'activate', 'clicked', 'deactivate']) {
                button.connect(name, () => globalThis.log.push(`${name}:${button.active}`));
            }

            globalThis.button = button;
            flushLayout();

            const r = button.el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });

        const state = () =>
            page.evaluate(() => [
                globalThis.button.active,
                globalThis.button.hasStyleClass('wy-active'),
                globalThis.button.el.getAttribute('aria-pressed'),
            ]);

        expect(await state()).toEqual([false, false, 'false']);

        // The user's activations toggle and emit `activate`, whichever way they go.
        await page.mouse.click(box.x, box.y);
        expect(await state()).toEqual([true, true, 'true']);
        expect(await page.evaluate(() => globalThis.log.splice(0))).toEqual([
            'toggle:true',
            'active-change:true',
            'activate:true',
            'clicked:true',
        ]);

        await page.keyboard.press(' ');
        expect(await state()).toEqual([false, false, 'false']);
        expect(await page.evaluate(() => globalThis.log.splice(0))).toEqual([
            'toggle:false',
            'active-change:false',
            'activate:false',
            'clicked:false',
        ]);

        // `activate()` does what a click does, without `clicked`.
        await page.evaluate(() => globalThis.button.activate());
        expect(await page.evaluate(() => globalThis.log.splice(0))).toEqual([
            'toggle:true',
            'active-change:true',
            'activate:true',
        ]);

        // Changes from code emit only the change signals.
        await page.evaluate(() => {
            globalThis.button.toggle();
            globalThis.button.active = true;
            globalThis.button.active = true;
        });
        expect(await page.evaluate(() => globalThis.log.splice(0))).toEqual([
            'toggle:false',
            'active-change:false',
            'toggle:true',
            'active-change:true',
        ]);
        expect(await page.evaluate(() => 'deactivate' in globalThis.button)).toBe(false);
        expect(errors).toEqual([]);
    });

    test('a mnemonic and Enter activate a toggle button', async ({ page }) => {
        const errors = await openWindow(page);

        await page.evaluate(async () => {
            const { ToggleButton } = await import('/src/widgets/toggle-button.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const button = globalThis.box.addChild(
                new ToggleButton({ label: '_Bold', useUnderline: true })
            );
            for (const name of ['toggle', 'activate']) {
                button.connect(name, () => globalThis.log.push(`${name}:${button.active}`));
            }

            globalThis.button = button;
            flushLayout();
        });

        await page.keyboard.press('Alt+b');
        await expect.poll(() => page.evaluate(() => globalThis.log.length)).toBe(2);
        expect(await page.evaluate(() => globalThis.log.splice(0))).toEqual([
            'toggle:true',
            'activate:true',
        ]);

        await page.keyboard.press('Enter');
        await expect.poll(() => page.evaluate(() => globalThis.log.length)).toBe(2);
        expect(await page.evaluate(() => globalThis.log.splice(0))).toEqual([
            'toggle:false',
            'activate:false',
        ]);
        expect(errors).toEqual([]);
    });

    test('inconsistent shows the mixed state until clicked', async ({ page }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            const { ToggleButton } = await import('/src/widgets/toggle-button.js');

            const button = globalThis.box.addChild(
                new ToggleButton({ label: 'Mixed', inconsistent: true })
            );
            const before = [
                button.el.getAttribute('aria-pressed'),
                button.hasStyleClass('wy-inconsistent'),
            ];

            button._click();

            return {
                before,
                after: [button.inconsistent, button.active, button.el.getAttribute('aria-pressed')],
            };
        });

        expect(result.before).toEqual(['mixed', true]);
        expect(result.after).toEqual([false, true, 'true']);
    });

    test('the group is lazy and keeps at most one button active', async ({ page }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            const { ToggleButton } = await import('/src/widgets/toggle-button.js');
            const { ButtonGroup } = await import('/src/widgets/button-group.js');

            const [a, b, c] = ['a', 'b', 'c'].map((label) =>
                globalThis.box.addChild(new ToggleButton({ label }))
            );
            const steps = [a.group];

            a.join(b);
            const group = a.group;
            steps.push(group instanceof ButtonGroup && b.group === group && group.buttonsCount);

            c.group = group;
            a.active = true;
            b.active = true;
            steps.push([a.active, b.active, c.active, group.active === b]);

            // A toggle button in a group can still be released: none is active then.
            b._click();
            steps.push([b.active, group.active]);

            c.active = true;
            c.destroy();
            steps.push([group.buttonsCount, group.active]);

            b.group = null;
            steps.push([group.buttons.includes(b), b.group]);

            try {
                a.group = {};
                steps.push('no error');
            } catch (_error) {
                steps.push('error');
            }

            return steps;
        });

        expect(result).toEqual([
            null,
            2,
            [false, true, false, true],
            [false, null],
            [2, null],
            [false, null],
            'error',
        ]);
    });

    test('active toggle buttons look pressed', async ({ page }) => {
        await openWindow(page);

        const colors = await page.evaluate(async () => {
            const { ToggleButton } = await import('/src/widgets/toggle-button.js');

            const off = globalThis.box.addChild(new ToggleButton({ label: 'Off' }));
            const on = globalThis.box.addChild(new ToggleButton({ label: 'On', active: true }));

            return [off, on].map((x) => getComputedStyle(x.el).backgroundImage === 'none');
        });

        expect(colors).toEqual([false, true]);
    });
});
