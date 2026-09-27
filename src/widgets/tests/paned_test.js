// Browser tests of the Paned.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a paned in a host of 606 by 200 pixels at the top-left of the page (so there are 600
// pixels for the panes), with two blocks whose minimum width is given.
async function setUp(page, { paned = {}, first = {}, second = {}, flags = [] } = {}) {
    await page.evaluate(
        async ({ paned, first, second, flags }) => {
            const { Widget, flushLayout } = await import('/src/widgets/widget.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Paned } = await import('/src/widgets/paned.js');
            const { defineProperties } = await import('/src/core/instance.js');

            class Block extends Widget {
                _render() {
                    const element = document.createElement('div');
                    element.style.cssText = 'background: #ccc;';

                    return element;
                }
            }

            defineProperties(Block, {
                canFocus: { value: true },
                minimum: {
                    value: 0,
                    changed(minimum) {
                        this.el.style.minWidth = `${minimum}px`;
                        this.el.style.minHeight = `${minimum}px`;
                    },
                },
            });

            document.body.style.margin = '0';
            const host = document.createElement('div');
            host.style.cssText = 'width: 606px; height: 200px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const widget = new Paned(paned);
            const a = new Block({ name: 'first', ...first });
            const b = new Block({ name: 'second', ...second });
            widget.addChild(a, ...(flags[0] || []));
            widget.addChild(b, ...(flags[1] || []));
            window.addChild(widget);
            window.show();
            flushLayout();

            globalThis.paned = widget;
            globalThis.panes = [a, b];
            globalThis.host = host;
            globalThis.flush = flushLayout;
            globalThis.changes = 0;
            widget.connect('position-change', () => (globalThis.changes += 1));
            globalThis.sizes = () => {
                const horizontal = widget.orientation === 'horizontal';
                return [a, b].map((x) => {
                    const r = x.el.getBoundingClientRect();
                    return Math.round(horizontal ? r.width : r.height);
                });
            };
        },
        { paned, first, second, flags }
    );
}

const sizes = (page) => page.evaluate(() => globalThis.sizes());

test.describe('paned', () => {
    test('the panes share the space equally until the position is set', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page);

        expect(errors).toEqual([]);
        expect(await sizes(page)).toEqual([300, 300]);

        const result = await page.evaluate(() => {
            const paned = globalThis.paned;
            const splitter = paned.splitterElement.getBoundingClientRect();

            return {
                position: paned.position,
                positionSet: paned.positionSet,
                splitter: [Math.round(splitter.left), Math.round(splitter.width)],
                role: paned.splitterElement.getAttribute('role'),
                orientation: paned.splitterElement.getAttribute('aria-orientation'),
            };
        });

        expect(result).toEqual({
            position: 300,
            positionSet: false,
            splitter: [300, 6],
            role: 'separator',
            orientation: 'vertical',
        });

        await page.evaluate(() => {
            globalThis.paned.position = 120;
            globalThis.flush();
        });

        expect(await sizes(page)).toEqual([120, 480]);
        expect(await page.evaluate(() => globalThis.paned.positionSet)).toBe(true);

        await page.evaluate(() => {
            globalThis.paned.positionSet = false;
            globalThis.flush();
        });
        expect(await sizes(page)).toEqual([300, 300]);
    });

    test('dragging the splitter moves it, within the minimum sizes', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { first: { minimum: 100 }, second: { minimum: 150 } });

        // Grab the middle of the splitter and drag it left.
        await page.mouse.move(303, 100);
        await page.mouse.down();
        await page.mouse.move(203, 100, { steps: 5 });
        expect(await sizes(page)).toEqual([200, 400]);

        // The first child cannot become smaller than its minimum.
        await page.mouse.move(10, 100, { steps: 5 });
        expect(await sizes(page)).toEqual([100, 500]);

        // Nor can the second.
        await page.mouse.move(600, 100, { steps: 5 });
        await page.mouse.up();
        expect(await sizes(page)).toEqual([450, 150]);

        const result = await page.evaluate(() => ({
            position: globalThis.paned.position,
            changes: globalThis.changes,
            cursor: document.documentElement.classList.contains('wy-cursor-override'),
        }));

        expect(result.position).toBe(450);
        expect(result.changes).toBeGreaterThanOrEqual(3);
        expect(result.cursor).toBe(false);
    });

    test('a pane that may shrink can be made smaller than its child', async ({ page }) => {
        await openHarness(page);
        await setUp(page, {
            first: { minimum: 100 },
            flags: [
                [true, true],
                [true, false],
            ],
        });

        await page.evaluate(() => {
            globalThis.paned.position = 30;
            globalThis.flush();
        });

        const result = await page.evaluate(() => {
            const pane = globalThis.panes[0].el.parentElement.getBoundingClientRect();

            return {
                pane: Math.round(pane.width),
                child: Math.round(globalThis.panes[0].el.getBoundingClientRect().width),
                options: globalThis.paned.getChildOptions(globalThis.panes[0]),
            };
        });

        expect(result.pane).toBe(30);
        expect(result.child).toBe(100);
        expect(result.options).toEqual({ resize: true, shrink: true });
    });

    test('the resize flags decide which pane takes size changes', async ({ page }) => {
        await openHarness(page);

        // Both resize: the proportions are kept.
        await setUp(page);
        await page.evaluate(() => {
            globalThis.paned.position = 150;
            globalThis.flush();
            globalThis.host.style.width = '1206px';
        });
        expect(await sizes(page)).toEqual([300, 900]);

        // Only the second pane resizes: the first keeps its size.
        await page.evaluate(() => {
            globalThis.host.style.width = '606px';
            const [first, second] = globalThis.panes;
            globalThis.paned.setChildOptions(first, { resize: false });
            globalThis.paned.position = 150;
            globalThis.flush();
            globalThis.host.style.width = '806px';
            globalThis.paned.setChildOptions(second, { resize: true });
            globalThis.flush();
        });
        expect(await sizes(page)).toEqual([150, 650]);

        // Only the first pane resizes: the second keeps its size.
        await page.evaluate(() => {
            const [first, second] = globalThis.panes;
            globalThis.paned.setChildOptions(first, { resize: true });
            globalThis.paned.setChildOptions(second, { resize: false });
            globalThis.flush();
            globalThis.host.style.width = '406px';
            globalThis.flush();
        });
        expect(await sizes(page)).toEqual([0, 400]);

        await page.evaluate(() => {
            globalThis.host.style.width = '1006px';
            globalThis.flush();
        });
        expect(await sizes(page)).toEqual([350, 650]);
    });

    test('the keyboard moves a focused splitter', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { first: { minimum: 50 }, second: { minimum: 50 } });

        // The splitter is not in the Tab order; F8 focuses it.
        await expect.poll(() => page.evaluate(() => globalThis.panes[0].hasFocus)).toBe(true);
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => globalThis.panes[1].hasFocus)).toBe(true);

        await page.keyboard.press('F8');
        expect(
            await page.evaluate(() => document.activeElement === globalThis.paned.splitterElement)
        ).toBe(true);

        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        expect(await sizes(page)).toEqual([320, 280]);

        await page.keyboard.press('Home');
        expect(await sizes(page)).toEqual([50, 550]);

        await page.keyboard.press('End');
        expect(await sizes(page)).toEqual([550, 50]);

        await page.keyboard.press('PageUp');
        expect(await sizes(page)).toEqual([490, 110]);

        const aria = await page.evaluate(() =>
            globalThis.paned.splitterElement.getAttribute('aria-valuenow')
        );
        expect(aria).toBe('490');

        // Escape gives the focus back.
        await page.keyboard.press('Escape');
        expect(await page.evaluate(() => globalThis.panes[1].hasFocus)).toBe(true);
    });

    test('a hidden pane gives all space to the other one', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            globalThis.panes[0].visible = false;
            globalThis.flush();

            return {
                sizes: globalThis.sizes(),
                splitter: globalThis.paned.splitterElement.hidden,
            };
        });

        expect(result.sizes[1]).toBe(606);
        expect(result.splitter).toBe(true);

        await expect(
            page.evaluate(async () => {
                const { Label } = await import('/src/widgets/label.js');
                globalThis.paned.addChild(new Label());
            })
        ).rejects.toThrow(/at most two children/);
    });

    test('a vertical paned stacks the panes', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { paned: { orientation: 'vertical' } });

        expect(await sizes(page)).toEqual([97, 97]);

        await page.mouse.move(300, 100);
        await page.mouse.down();
        await page.mouse.move(300, 60, { steps: 4 });
        await page.mouse.up();

        expect(await sizes(page)).toEqual([57, 137]);
        expect(
            await page.evaluate(() =>
                globalThis.paned.splitterElement.getAttribute('aria-orientation')
            )
        ).toBe('horizontal');
    });

    test('the builder passes the resize and shrink flags', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/construction/builder.js');
            await import('/src/widgets/paned.js');
            await import('/src/widgets/label.js');

            const builder = new Builder();
            const [paned] = builder.build({
                type: 'paned',
                orientation: 'vertical',
                children: [
                    { type: 'label', id: 'a', text: 'A', resize: false },
                    { type: 'label', id: 'b', text: 'B', shrink: true },
                ],
            });

            return [
                paned.getChildOptions(builder.getObjectById('a')),
                paned.getChildOptions(builder.getObjectById('b')),
                paned.orientation,
            ];
        });

        expect(result).toEqual([
            { resize: false, shrink: false },
            { resize: true, shrink: true },
            'vertical',
        ]);
    });
});
