// Browser tests of the Resizer.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a resizer at the top-left of the page with a child of at least 50 by 30 pixels.
async function setUp(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Widget, flushLayout } = await import('/src/widgets/widget.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Resizer } = await import('/src/widgets/resizer.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.style.cssText = 'min-width: 50px; min-height: 30px; background: #ccc;';

                return element;
            }
        }

        document.body.style.margin = '0';
        const host = document.createElement('div');
        host.style.cssText = 'width: 800px; height: 600px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const resizer = new Resizer({ hAlign: 'start', vAlign: 'start', ...properties });
        resizer.addChild(new Block());
        window.addChild(resizer);
        window.show();
        flushLayout();

        globalThis.resizer = resizer;
        globalThis.changes = 0;
        resizer.connect('size-change', () => (globalThis.changes += 1));
    }, properties);
}

const childSize = (page) =>
    page.evaluate(() => {
        const r = globalThis.resizer.child.el.getBoundingClientRect();

        return [Math.round(r.width), Math.round(r.height)];
    });

async function drag(page, selector, dx, dy) {
    const box = await page.locator(selector).boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 5 });
    await page.mouse.up();
}

test.describe('resizer', () => {
    test('dragging the handles resizes the child', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page, { size: { width: 200, height: 100 } });

        expect(errors).toEqual([]);
        expect(await childSize(page)).toEqual([200, 100]);

        await drag(page, '.wy-resizer-e', 40, 0);
        expect(await childSize(page)).toEqual([240, 100]);

        await drag(page, '.wy-resizer-s', 0, 25);
        expect(await childSize(page)).toEqual([240, 125]);

        await drag(page, '.wy-resizer-grip', -60, -20);
        expect(await childSize(page)).toEqual([180, 105]);

        const result = await page.evaluate(() => ({
            size: globalThis.resizer.size,
            width: globalThis.resizer.width,
            changes: globalThis.changes,
        }));

        expect(result.size).toEqual({ width: 180, height: 105 });
        expect(result.width).toBe(180);
        expect(result.changes).toBeGreaterThan(3);
    });

    test('the size stays within the limits and the child minimum', async ({ page }) => {
        await openHarness(page);
        await setUp(page, {
            size: { width: 200, height: 100 },
            maxSize: { width: 260, height: -1 },
            minHeight: 80,
        });

        await drag(page, '.wy-resizer-e', 200, 0);
        expect(await childSize(page)).toEqual([260, 100]);

        await drag(page, '.wy-resizer-e', -400, 0);
        expect(await childSize(page)).toEqual([50, 100]);

        await drag(page, '.wy-resizer-s', 0, -200);
        expect(await childSize(page)).toEqual([50, 80]);

        const limits = await page.evaluate(() => [
            globalThis.resizer.maxWidth,
            globalThis.resizer.minSize,
        ]);
        expect(limits).toEqual([260, { width: -1, height: 80 }]);
    });

    test('the resize directions select the handles', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { resizeDirections: 2 });

        const result = await page.evaluate(async () => {
            const { ResizeDirections } = await import('/src/core/enums.js');
            const handles = () =>
                ['e', 's', 'se'].map(
                    (x) => !globalThis.resizer.el.querySelector(`.wy-resizer-${x}`).hidden
                );
            const grip = () => !globalThis.resizer.el.querySelector('.wy-resizer-grip').hidden;

            const states = { horizontal: [...handles(), grip()] };

            globalThis.resizer.directions = ResizeDirections.VERTICAL;
            states.vertical = [...handles(), grip()];

            globalThis.resizer.resizeDirections = ResizeDirections.ALL;
            states.all = [...handles(), grip()];

            globalThis.resizer.hasGrip = false;
            states.noGrip = grip();

            return states;
        });

        expect(result).toEqual({
            horizontal: [true, false, false, false],
            vertical: [false, true, false, false],
            all: [true, true, true, true],
            noGrip: false,
        });
    });

    test('keepRatio keeps the ratio of width and height', async ({ page }) => {
        await openHarness(page);
        await setUp(page, {
            size: { width: 200, height: 100 },
            keepRatio: true,
            useChildRatio: false,
            ratio: 2,
        });

        await drag(page, '.wy-resizer-e', 40, 0);
        expect(await childSize(page)).toEqual([240, 120]);

        await drag(page, '.wy-resizer-s', 0, -20);
        expect(await childSize(page)).toEqual([200, 100]);

        await drag(page, '.wy-resizer-grip', 100, 10);
        expect(await childSize(page)).toEqual([300, 150]);
    });

    test('a focusable resizer resizes with the arrow keys', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { size: { width: 200, height: 100 }, canFocus: true });

        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        document.activeElement ===
                        globalThis.resizer.el.querySelector('.wy-resizer-se')
                )
            )
            .toBe(true);

        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        expect(await childSize(page)).toEqual([210, 120]);

        await page.keyboard.press('ArrowLeft');
        expect(await childSize(page)).toEqual([200, 120]);
    });
});
