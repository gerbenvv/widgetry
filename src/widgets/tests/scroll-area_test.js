// Browser tests of the ScrollArea.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Defines a block widget with a fixed natural size, and shows a scroll area with a 1000 by 800
// block in a vertical box of 400 by 300 pixels (with a 20 pixel high block below it).
async function setUp(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Widget, flushLayout } = await import('/src/widgets/widget.js');
        const { defineProperties } = await import('/src/core/instance.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { ScrollArea } = await import('/src/widgets/scroll-area.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.style.cssText = 'background: linear-gradient(#ccc, #888);';

                return element;
            }
        }

        defineProperties(Block, {
            size: {
                value: null,
                changed(size) {
                    this.el.style.minWidth = `${size[0]}px`;
                    this.el.style.minHeight = `${size[1]}px`;
                },
            },
        });

        globalThis.Block = Block;

        document.body.style.margin = '0';
        const host = document.createElement('div');
        host.style.cssText = 'width: 400px; height: 300px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({ orientation: 'vertical' });
        const area = new ScrollArea({ shadowType: 'none', ...properties });
        const content = new Block({ size: [1000, 800] });
        area.addChild(content);
        box.addChild(area);
        box.addChild(new Block({ size: [20, 20] }));
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.area = area;
        globalThis.content = content;
        globalThis.host = host;
        globalThis.flush = flushLayout;
    }, properties);

    // Let the resize observer report the sizes.
    await page.waitForTimeout(50);
}

const adjustments = (page) =>
    page.evaluate(() => {
        const pick = (x) => ({
            value: x.value,
            upper: x.upper,
            pageSize: x.pageSize,
            pageIncrement: x.pageIncrement,
        });

        return { h: pick(globalThis.area.hAdjustment), v: pick(globalThis.area.vAdjustment) };
    });

test.describe('scroll area', () => {
    test('it shrinks in a box while the content keeps its natural size', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const area = globalThis.area.el.getBoundingClientRect();
            const content = globalThis.content.el.getBoundingClientRect();

            return {
                area: [area.width, area.height],
                content: [content.width, content.height],
                expands: [globalThis.area.hExpand, globalThis.area.vExpand],
            };
        });

        expect(errors).toEqual([]);
        expect(result.area).toEqual([400, 280]);
        expect(result.content).toEqual([1000, 800]);
        expect(result.expands).toEqual([true, true]);
    });

    test('the adjustments follow the scrolling and scroll the view', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        expect(await adjustments(page)).toEqual({
            h: { value: 0, upper: 1000, pageSize: 400, pageIncrement: 360 },
            v: { value: 0, upper: 800, pageSize: 280, pageIncrement: 252 },
        });

        // Scrolling with the wheel updates the adjustment.
        await page.mouse.move(200, 150);
        await page.mouse.wheel(0, 100);
        await expect.poll(() => page.evaluate(() => globalThis.area.vAdjustment.value)).toBe(100);

        // Setting the value scrolls, clamped to the page.
        const scrolled = await page.evaluate(() => {
            globalThis.area.hAdjustment.value = 5000;
            globalThis.area.vAdjustment.value = 250;

            return [globalThis.area.el.scrollLeft, globalThis.area.el.scrollTop];
        });
        expect(scrolled).toEqual([600, 250]);

        // A new content size updates the bounds.
        await page.evaluate(() => (globalThis.content.size = [500, 1200]));
        await expect.poll(() => page.evaluate(() => globalThis.area.vAdjustment.upper)).toBe(1200);
        expect(await page.evaluate(() => globalThis.area.hAdjustment.upper)).toBe(500);
    });

    test('scrollToWidget scrolls a descendant into view', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(async () => {
            const { Fixed } = await import('/src/widgets/fixed.js');

            const fixed = new Fixed();
            const target = new globalThis.Block({ size: [50, 40] });
            fixed.addChild(new globalThis.Block({ size: [900, 900] }), 0, 0);
            fixed.addChild(target, 700, 600);
            globalThis.area.child = fixed;
            globalThis.flush();

            globalThis.area.scrollToWidget(target);
            const first = [globalThis.area.el.scrollLeft, globalThis.area.el.scrollTop];

            globalThis.area.scrollTo(0, 0);
            globalThis.area.vAdjustment.value = 620;
            globalThis.area.scrollToWidget(target);
            const second = globalThis.area.el.scrollTop;

            let error = '';
            try {
                globalThis.area.scrollToWidget(new globalThis.Block());
            } catch (e) {
                error = e.message;
            }

            return { first, second, error };
        });

        expect(result.first).toEqual([750 - 400, 640 - 280]);
        expect(result.second).toBe(600);
        expect(result.error).toMatch(/not in this scroll area/);
    });

    test('the minimum content size is the minimum size of the view', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { minContentWidth: 250, minContentHeight: 500, shadowType: 'in' });

        const result = await page.evaluate(() => {
            const area = globalThis.area.el.getBoundingClientRect();

            globalThis.area.minContentHeight = -1;
            const after = globalThis.area.el.getBoundingClientRect();

            return { area: [area.width, area.height], after: after.height };
        });

        // The box is 300 high, but the view is at least 500 high (plus the 1 pixel border).
        expect(result.area).toEqual([400, 502]);
        expect(result.after).toBe(280);
    });

    test('the policies decide about scrolling in each direction', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { hPolicy: 'never', vPolicy: 'always' });

        const result = await page.evaluate(() => {
            const style = getComputedStyle(globalThis.area.el);
            const content = globalThis.content.el.getBoundingClientRect();
            const area = globalThis.area.el.getBoundingClientRect();

            const states = {
                overflow: [style.overflowX, style.overflowY],
                // The content does not fit, so with `never` the area is as wide as the content.
                area: area.width,
                content: content.width,
            };

            globalThis.content.size = [100, 800];
            globalThis.flush();

            let error = '';
            try {
                globalThis.area.hPolicy = 'sometimes';
            } catch (e) {
                error = e.message;
            }

            return { ...states, error };
        });

        expect(result.overflow).toEqual(['hidden', 'scroll']);
        expect(result.area).toBe(1000);
        expect(result.content).toBe(1000);
        expect(result.error).toMatch(/Invalid scroll bar policy/);

        // With a narrower content, the content fits the width of the view.
        await expect
            .poll(() =>
                page.evaluate(() => Math.round(globalThis.content.el.getBoundingClientRect().width))
            )
            .toBe(400);
    });

    test('the natural size can follow the content', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Widget, flushLayout } = await import('/src/widgets/widget.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Box } = await import('/src/widgets/box.js');
            const { ScrollArea } = await import('/src/widgets/scroll-area.js');

            class Block extends Widget {
                _render() {
                    const element = document.createElement('div');
                    element.style.cssText = 'min-width: 120px; min-height: 90px;';

                    return element;
                }
            }

            const host = document.createElement('div');
            host.style.cssText = 'width: 400px; height: 300px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const box = new Box({ hAlign: 'start', vAlign: 'start' });
            const area = new ScrollArea({ shadowType: 'none', hExpand: false, vExpand: false });
            area.addChild(new Block());
            box.addChild(area);
            window.addChild(box);
            window.show();
            flushLayout();

            const size = () => {
                const r = area.el.getBoundingClientRect();
                return [r.width, r.height];
            };

            const before = size();

            area.propagateNaturalWidth = true;
            area.propagateNaturalHeight = true;
            const after = size();

            return { before, after };
        });

        expect(result.before).toEqual([0, 0]);
        expect(result.after).toEqual([120, 90]);
    });

    test('adjustments can be shared, and are checked', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(async () => {
            const { Adjustment } = await import('/src/data/adjustment.js');

            const shared = new Adjustment();
            const changes = [];
            globalThis.area.connect('v-adjustment-change', () => changes.push('v'));
            globalThis.area.vAdjustment = shared;
            shared.value = 42;

            let error = '';
            try {
                globalThis.area.hAdjustment = { value: 1 };
            } catch (e) {
                error = e.message;
            }

            return {
                changes,
                upper: shared.upper,
                scrollTop: globalThis.area.el.scrollTop,
                error,
            };
        });

        expect(result.changes).toEqual(['v']);
        expect(result.upper).toBe(800);
        expect(result.scrollTop).toBe(42);
        expect(result.error).toMatch(/must be an Adjustment/);
    });
});
