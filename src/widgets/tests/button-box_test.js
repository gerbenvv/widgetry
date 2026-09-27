// Browser tests of the ButtonBox.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a button box of 500 pixels wide with a Help (secondary), a Cancel and an OK button.
async function setUp(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { flushLayout } = await import('/src/widgets/widget.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { ButtonBox } = await import('/src/widgets/button-box.js');
        const { Button } = await import('/src/widgets/button.js');

        const host = document.createElement('div');
        host.style.cssText = 'width: 500px; height: 100px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new ButtonBox({ vAlign: 'start', ...properties });
        const help = box.addChild(new Button({ label: 'Help' }));
        box.addChild(new Button({ label: 'Cancel' }));
        box.addChild(new Button({ label: 'A much longer label' }));
        box.setChildSecondary(help, true);
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.box = box;
        globalThis.flush = flushLayout;
    }, properties);
}

const layout = (page) =>
    page.evaluate(() => {
        globalThis.flush();

        const own = globalThis.box.el.getBoundingClientRect();
        return globalThis.box.children.map((x) => {
            const r = x.el.getBoundingClientRect();
            return [Math.round(r.left - own.left), Math.round(r.width)];
        });
    });

test.describe('button box', () => {
    test('buttons get the same width, at least the minimum child width', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page, { layoutStyle: 'end' });

        const result = await layout(page);
        const widths = result.map((x) => x[1]);

        expect(errors).toEqual([]);
        expect(new Set(widths).size).toBe(1);
        expect(widths[0]).toBeGreaterThan(85);

        // Not homogeneous: the natural widths, but at least 85 pixels.
        await page.evaluate(() => (globalThis.box.homogeneous = false));
        const natural = (await layout(page)).map((x) => x[1]);
        expect(natural[0]).toBe(85);
        // The homogeneous width is the natural width rounded up to whole pixels.
        expect(widths[0] - natural[2]).toBeGreaterThanOrEqual(0);
        expect(widths[0] - natural[2]).toBeLessThanOrEqual(1);

        await page.evaluate(() => (globalThis.box.minChildWidth = 0));
        const small = (await layout(page)).map((x) => x[1]);
        expect(small[0]).toBeLessThan(85);
    });

    test('the end style packs at the end, with the secondary child at the start', async ({
        page,
    }) => {
        await openHarness(page);
        await setUp(page, { layoutStyle: 'end', spacing: 6 });

        const [help, cancel, ok] = await layout(page);
        const width = help[1];

        expect(help[0]).toBe(0);
        expect(ok[0]).toBe(500 - width);
        expect(cancel[0]).toBe(500 - 2 * width - 6);
    });

    test('the start style packs at the start, with the secondary child at the end', async ({
        page,
    }) => {
        await openHarness(page);
        await setUp(page, { layoutStyle: 'start', spacing: 6 });

        const [help, cancel, ok] = await layout(page);
        const width = help[1];

        expect(cancel[0]).toBe(0);
        expect(ok[0]).toBe(width + 6);
        expect(help[0]).toBe(500 - width);
    });

    test('the edge and spread styles distribute the space', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { layoutStyle: 'edge', spacing: 6 });

        const edge = await layout(page);
        const width = edge[0][1];

        // Edge: the secondary child first, the first and last at the ends, equal gaps.
        expect(edge[0][0]).toBe(0);
        expect(edge[2][0]).toBe(500 - width);
        expect(edge[1][0]).toBe(Math.round((500 - width) / 2));

        await page.evaluate(() => (globalThis.box.layoutStyle = 'spread'));
        const spread = await layout(page);
        const gap = (500 - 3 * width) / 4;
        expect(spread[0][0]).toBe(Math.round(gap));
        expect(spread[2][0]).toBe(Math.round(500 - gap - width));
    });

    test('the center style centers the buttons', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { layoutStyle: 'center', spacing: 6 });

        const result = await page.evaluate(() => {
            globalThis.box.setChildSecondary(globalThis.box.children[0], false);
            globalThis.flush();

            const own = globalThis.box.el.getBoundingClientRect();
            const first = globalThis.box.children[0].el.getBoundingClientRect();
            const last = globalThis.box.children[2].el.getBoundingClientRect();

            return [first.left - own.left, own.right - last.right];
        });

        expect(Math.abs(result[0] - result[1])).toBeLessThanOrEqual(1);
    });

    test('the spread style includes the spacing in the natural size', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { layoutStyle: 'spread', spacing: 10, hAlign: 'start' });

        const result = await page.evaluate(() => {
            globalThis.flush();

            const width = globalThis.box.el.getBoundingClientRect().width;
            const button = globalThis.box.children[0].el.getBoundingClientRect().width;

            let error = '';
            try {
                globalThis.box.layoutStyle = 'justified';
            } catch (e) {
                error = e.message;
            }

            return { width, button, error };
        });

        expect(result.width).toBeCloseTo(3 * result.button + 4 * 10, 0);
        expect(result.error).toMatch(/Invalid button box style/);
    });

    test('a vertical button box stacks the buttons with equal heights', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { orientation: 'vertical', layoutStyle: 'start', hAlign: 'start' });

        const result = await page.evaluate(() => {
            globalThis.flush();

            return globalThis.box.children.map((x) => {
                const r = x.el.getBoundingClientRect();
                return [Math.round(r.width), Math.round(r.height)];
            });
        });

        expect(new Set(result.map((x) => x[0])).size).toBe(1);
        expect(new Set(result.map((x) => x[1])).size).toBe(1);
        expect(result[0][0]).toBeGreaterThanOrEqual(85);
    });
});
