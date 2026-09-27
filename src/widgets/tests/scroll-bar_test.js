// Browser tests of the ScrollBar widget.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a scroll bar in a main window, as `globalThis.widget`.
async function mount(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { ScrollBar } = await import('/src/widgets/scroll-bar.js');

        const host = document.createElement('div');
        host.style.cssText =
            'position: absolute; inset: 0 auto auto 0; width: 600px; height: 500px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({
            orientation: 'vertical',
            margin: 40,
            vAlign: 'start',
            hAlign: 'start',
        });
        const widget = new ScrollBar(properties);

        box.addChild(widget);
        window.addChild(box);
        window.show();

        globalThis.widget = widget;
        globalThis.values = [];
        widget.connect('value-change', () => globalThis.values.push(widget.value));
    }, properties);
}

const geometry = (page) =>
    page.evaluate(() => {
        const rect = (selector) => {
            const r = globalThis.widget.el.querySelector(selector).getBoundingClientRect();

            return { x: r.x, y: r.y, width: r.width, height: r.height };
        };

        return {
            trough: rect('.wy-scroll-bar-trough'),
            thumb: rect('.wy-scroll-bar-thumb'),
            backward: rect('.wy-backward'),
            forward: rect('.wy-forward'),
        };
    });

const value = (page) => page.evaluate(() => globalThis.widget.value);

test.describe('ScrollBar', () => {
    test('the thumb is as long as the page, but not shorter than the minimum', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page, { width: 400, upper: 100, pageSize: 25, value: 75 });

        const { trough, thumb } = await geometry(page);
        const inner = trough.width - 2;

        expect(errors).toEqual([]);
        expect(thumb.width).toBeCloseTo(inner * 0.25, 0);
        expect(thumb.x + thumb.width).toBeCloseTo(trough.x + 1 + inner, 0);

        const small = await page.evaluate(() => {
            const widget = globalThis.widget;
            widget.set({ upper: 100000, pageSize: 10, value: 0 });

            const thumb = widget.el.querySelector('.wy-scroll-bar-thumb');
            const minimum = getComputedStyle(widget.el).getPropertyValue(
                '--wy-scroll-bar-min-thumb'
            );

            const states = [thumb.getBoundingClientRect().width, minimum.trim()];

            widget.set({ upper: 10, pageSize: 20 });
            states.push(
                widget.el.classList.contains('wy-all-visible'),
                getComputedStyle(thumb).visibility
            );

            return states;
        });

        expect(small).toEqual([16, '16px', true, 'hidden']);
    });

    test('the steppers step, repeat while held and look disabled at the ends', async ({ page }) => {
        await openHarness(page);
        await mount(page, { width: 400, upper: 1000, pageSize: 100, value: 0 });

        const { backward, forward } = await geometry(page);

        const disabled = () =>
            page.evaluate(() => [
                globalThis.widget.el
                    .querySelector('.wy-backward')
                    .classList.contains('wy-disabled'),
                globalThis.widget.el.querySelector('.wy-forward').classList.contains('wy-disabled'),
            ]);

        expect(await disabled()).toEqual([true, false]);

        await page.mouse.click(forward.x + 7, forward.y + 7);
        expect(await value(page)).toBe(1);
        expect(await disabled()).toEqual([false, false]);

        await page.mouse.move(forward.x + 7, forward.y + 7);
        await page.mouse.down();
        await page.waitForTimeout(800);
        await page.mouse.up();

        const held = await value(page);
        expect(held).toBeGreaterThan(5);

        // Repeating stops at the release.
        await page.waitForTimeout(200);
        expect(await value(page)).toBe(held);

        await page.mouse.click(backward.x + 7, backward.y + 7);
        expect(await value(page)).toBe(held - 1);

        // Canfocus is off: steppers do not take the focus.
        const focused = await page.evaluate(() => globalThis.widget.hasFocus);
        expect(focused).toBe(false);
    });

    test('pressing the trough pages towards the pointer until the thumb reaches it', async ({
        page,
    }) => {
        await openHarness(page);
        await mount(page, { width: 400, upper: 1000, pageSize: 100, pageIncrement: 50, value: 0 });

        const { trough } = await geometry(page);
        const y = trough.y + trough.height / 2;

        await page.mouse.click(trough.x + trough.width - 5, y);
        expect(await value(page)).toBe(50);

        // Holding pages repeatedly, stopping at the pointer.
        await page.mouse.move(trough.x + trough.width * 0.5, y);
        await page.mouse.down();
        await page.waitForTimeout(1000);
        await page.mouse.up();

        const paged = await value(page);
        const { thumb } = await geometry(page);

        expect(paged % 50).toBe(0);
        expect(paged).toBeGreaterThan(100);
        expect(thumb.x).toBeLessThanOrEqual(trough.x + trough.width * 0.5);
        expect(thumb.x + thumb.width).toBeGreaterThan(trough.x + trough.width * 0.5);

        // Shift moves the thumb to the pointer instead.
        await page.keyboard.down('Shift');
        await page.mouse.click(trough.x + 1 + thumb.width / 2, y);
        await page.keyboard.up('Shift');
        expect(await value(page)).toBe(0);
    });

    test('dragging the thumb and the wheel scroll', async ({ page }) => {
        await openHarness(page);
        await mount(page, { width: 400, upper: 1000, pageSize: 125, value: 0 });

        const { trough, thumb } = await geometry(page);
        const range = trough.width - 2 - thumb.width;

        await page.mouse.move(thumb.x + 10, thumb.y + 5);
        await page.mouse.down();
        await page.mouse.move(thumb.x + 10 + range / 2, thumb.y + 5, { steps: 4 });
        await page.mouse.up();

        expect(await value(page)).toBeCloseTo(437.5, -1);

        await page.evaluate(() => (globalThis.widget.value = 0));
        await page.mouse.wheel(0, 100);
        await expect.poll(() => value(page)).toBeCloseTo(125 ** (2 / 3), 3);

        const vertical = await page.evaluate(() => {
            const widget = globalThis.widget;
            widget.set({ orientation: 'vertical', height: 200, width: -1 });

            const rect = widget.el.getBoundingClientRect();

            return [
                Math.round(rect.width),
                Math.round(rect.height),
                widget.el.getAttribute('role'),
            ];
        });

        expect(vertical).toEqual([15, 200, 'scrollbar']);
    });

    test('a focusable scroll bar handles the keyboard', async ({ page }) => {
        await openHarness(page);
        await mount(page, {
            orientation: 'vertical',
            height: 200,
            canFocus: true,
            upper: 100,
            pageSize: 10,
            value: 50,
        });

        await page.evaluate(() => globalThis.widget.focus());

        await page.keyboard.press('ArrowDown');
        expect(await value(page)).toBe(51);

        await page.keyboard.press('PageUp');
        expect(await value(page)).toBe(41);

        await page.keyboard.press('End');
        expect(await value(page)).toBe(90);
    });
});
