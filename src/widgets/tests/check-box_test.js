// Browser tests of CheckBox.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a vertical box, available as `globalThis.box`.
async function openWindow(page) {
    const errors = await openHarness(page);

    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');

        const window = new MainWindow();
        const box = new Box({
            orientation: 'vertical',
            spacing: 4,
            margin: 10,
            vAlign: 'start',
            hAlign: 'start',
        });
        window.addChild(box);
        window.show();

        globalThis.box = box;
    });

    return errors;
}

test.describe('CheckBox', () => {
    test('clicking the box or the label toggles it', async ({ page }) => {
        const errors = await openWindow(page);

        const rects = await page.evaluate(async () => {
            const { CheckBox } = await import('/src/widgets/check-box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const check = globalThis.box.addChild(new CheckBox({ label: 'Show hidden files' }));
            globalThis.check = check;
            flushLayout();

            const indicator = check.el.querySelector('.wy-check-indicator').getBoundingClientRect();
            const label = check.child.el.getBoundingClientRect();

            return {
                indicator: { x: indicator.left + 6, y: indicator.top + 6, size: indicator.width },
                label: { x: label.left + label.width / 2, y: label.top + label.height / 2 },
                labelLeft: label.left - indicator.right,
                height: check.allocation.height,
            };
        });

        const state = () =>
            page.evaluate(() => [
                globalThis.check.active,
                globalThis.check.el.getAttribute('aria-checked'),
                globalThis.check.el.getAttribute('role'),
            ]);

        expect(rects.indicator.size).toBe(13);
        expect(rects.labelLeft).toBeGreaterThanOrEqual(6);
        expect(rects.height).toBeGreaterThanOrEqual(20);
        expect(await state()).toEqual([false, 'false', 'checkbox']);

        await page.mouse.click(rects.indicator.x, rects.indicator.y);
        expect(await state()).toEqual([true, 'true', 'checkbox']);

        await page.mouse.click(rects.label.x, rects.label.y);
        expect(await state()).toEqual([false, 'false', 'checkbox']);

        await page.keyboard.press(' ');
        expect(await state()).toEqual([true, 'true', 'checkbox']);
        expect(errors).toEqual([]);
    });

    test('activation toggles and emits activate, changes from code only toggle', async ({
        page,
    }) => {
        const errors = await openWindow(page);

        const log = await page.evaluate(async () => {
            const { CheckBox } = await import('/src/widgets/check-box.js');

            const check = globalThis.box.addChild(
                new CheckBox({ label: 'Mixed', inconsistent: true })
            );
            const log = [];
            for (const name of ['activate', 'toggle', 'active-change']) {
                check.connect(name, () => log.push(`${name}:${check.active}`));
            }

            check.activate();
            log.push(`inconsistent:${check.inconsistent}`);
            check.activate();
            check.active = true;

            return log;
        });

        expect(log).toEqual([
            'toggle:true',
            'active-change:true',
            'activate:true',
            'inconsistent:false',
            'toggle:false',
            'active-change:false',
            'activate:false',
            'toggle:true',
            'active-change:true',
        ]);
        expect(errors).toEqual([]);
    });

    test('the mark shows only when active or inconsistent', async ({ page }) => {
        await openWindow(page);

        const marks = await page.evaluate(async () => {
            const { CheckBox } = await import('/src/widgets/check-box.js');

            return [{}, { active: true }, { inconsistent: true }].map((properties) => {
                const check = globalThis.box.addChild(new CheckBox({ label: 'x', ...properties }));
                const indicator = check.el.querySelector('.wy-check-indicator');

                return [
                    getComputedStyle(indicator, '::after').visibility,
                    check.el.getAttribute('aria-checked'),
                ];
            });
        });

        expect(marks).toEqual([
            ['hidden', 'false'],
            ['visible', 'true'],
            ['visible', 'mixed'],
        ]);
    });

    test('insensitive check boxes do not toggle and are grayed out', async ({ page }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            const { CheckBox } = await import('/src/widgets/check-box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const normal = globalThis.box.addChild(new CheckBox({ label: 'Normal' }));
            const check = globalThis.box.addChild(new CheckBox({ label: 'Off', sensitive: false }));
            globalThis.check = check;
            flushLayout();

            const r = check.el.getBoundingClientRect();

            return {
                x: r.left + 5,
                y: r.top + r.height / 2,
                colors: [normal, check].map((x) => getComputedStyle(x.child.el).color),
            };
        });

        await page.mouse.click(result.x, result.y);
        expect(await page.evaluate(() => globalThis.check.active)).toBe(false);
        expect(result.colors[0]).not.toBe(result.colors[1]);
    });

    test('the keyboard focus is drawn around the label', async ({ page }) => {
        await openWindow(page);

        await page.evaluate(async () => {
            const { CheckBox } = await import('/src/widgets/check-box.js');
            globalThis.check = globalThis.box.addChild(new CheckBox({ label: 'Focus me' }));
        });

        await page.keyboard.press('Tab');

        const outline = await page.evaluate(() => {
            const check = globalThis.check;
            const body = check.el.querySelector('.wy-check-box-body');

            return [
                check.hasFocus,
                getComputedStyle(check.el).outlineStyle,
                getComputedStyle(body).outlineStyle,
            ];
        });

        expect(outline).toEqual([true, 'none', 'dotted']);
    });
});
