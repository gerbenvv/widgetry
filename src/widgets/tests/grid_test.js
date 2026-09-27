// Browser tests of the Grid.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Defines a block widget with a natural size given by `width`/`height` requests (default 40 by
// 20) in the page, and shows a grid in a main window of 500 by 300 pixels.
async function setUp(page, gridProperties = {}) {
    await page.evaluate(async (gridProperties) => {
        const { Widget, flushLayout } = await import('/src/widgets/widget.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Grid } = await import('/src/widgets/grid.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.style.cssText = 'min-width: 40px; min-height: 20px; background: #ccc;';

                return element;
            }
        }

        globalThis.Block = Block;

        const host = document.createElement('div');
        host.style.cssText = 'width: 500px; height: 300px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const grid = new Grid(gridProperties);
        window.addChild(grid);
        window.show();

        globalThis.grid = grid;
        globalThis.flush = flushLayout;
        globalThis.rect = (widget) => {
            const own = grid.el.getBoundingClientRect();
            const r = widget.el.getBoundingClientRect();

            return {
                x: Math.round(r.left - own.left),
                y: Math.round(r.top - own.top),
                width: Math.round(r.width),
                height: Math.round(r.height),
            };
        };
    }, gridProperties);
}

test.describe('grid', () => {
    test('children are placed by row and column, with spans and spacing', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page, { rowSpacing: 4, columnSpacing: 6 });

        const rects = await page.evaluate(() => {
            const grid = globalThis.grid;
            const a = grid.addChild(new globalThis.Block({ width: 50 }), 0, 0);
            const b = grid.addChild(new globalThis.Block({ width: 70 }), 0, 1);
            const c = grid.addChild(new globalThis.Block({ height: 30 }), 1, 0, 1, 2);
            const d = grid.addChild(new globalThis.Block(), 0, 2, 2, 1);
            globalThis.flush();

            return [a, b, c, d].map((x) => globalThis.rect(x));
        });

        expect(errors).toEqual([]);

        // The original argument order: addChild(widget, row, column, rowSpan, columnSpan).
        expect(rects[0]).toEqual({ x: 0, y: 0, width: 50, height: 20 });
        expect(rects[1]).toEqual({ x: 56, y: 0, width: 70, height: 20 });
        expect(rects[2]).toEqual({ x: 0, y: 24, width: 126, height: 30 });
        expect(rects[3]).toEqual({ x: 132, y: 0, width: 40, height: 54 });
    });

    test('a column expands when a child in it expands', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { columnSpacing: 10 });

        const result = await page.evaluate(() => {
            const grid = globalThis.grid;
            const label = grid.addChild(new globalThis.Block({ width: 60 }), 0, 0);
            const field = grid.addChild(new globalThis.Block({ hExpand: true }), 0, 1);
            const button = grid.addChild(new globalThis.Block({ width: 30 }), 0, 2);
            const below = grid.addChild(new globalThis.Block({ hAlign: 'end' }), 1, 1);
            globalThis.flush();

            return {
                expands: grid.isHExpand,
                rects: [label, field, button, below].map((x) => globalThis.rect(x)),
            };
        });

        expect(result.expands).toBe(true);
        expect(result.rects[0].width).toBe(60);
        expect(result.rects[1].width).toBe(500 - 60 - 30 - 20);
        expect(result.rects[2]).toMatchObject({ x: 470, width: 30 });

        // Alignment within the cell.
        expect(result.rects[3]).toMatchObject({ x: 70 + 390 - 40, width: 40 });
    });

    test('a spanning child that expands makes its columns expand', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const rects = await page.evaluate(() => {
            const grid = globalThis.grid;
            const a = grid.addChild(new globalThis.Block({ width: 50 }), 0, 0);
            const b = grid.addChild(new globalThis.Block({ width: 50 }), 0, 1);
            grid.addChild(new globalThis.Block({ hExpand: true }), 1, 0, 1, 2);
            globalThis.flush();

            return [a, b].map((x) => globalThis.rect(x));
        });

        expect(rects[0].width).toBe(250);
        expect(rects[1]).toMatchObject({ x: 250, width: 250 });
    });

    test('homogeneous rows and columns get equal sizes', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { columnHomogeneous: true, rowHomogeneous: true, hAlign: 'start' });

        const rects = await page.evaluate(() => {
            const grid = globalThis.grid;
            grid.vAlign = 'start';
            const a = grid.addChild(new globalThis.Block({ width: 30 }), 0, 0);
            const b = grid.addChild(new globalThis.Block({ width: 90, height: 40 }), 1, 1);
            const c = grid.addChild(new globalThis.Block(), 0, 2);
            globalThis.flush();

            return [a, b, c].map((x) => globalThis.rect(x));
        });

        expect(rects.map((x) => x.width)).toEqual([90, 90, 90]);
        expect(rects[0].height).toBe(40);
        expect(rects[2].x).toBe(180);
    });

    test('rows and columns without visible children take no space', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { rowSpacing: 5, columnSpacing: 5 });

        const result = await page.evaluate(() => {
            const grid = globalThis.grid;
            grid.addChild(new globalThis.Block(), 0, 0);
            const hidden = grid.addChild(new globalThis.Block({ visible: false }), 1, 1);
            const far = grid.addChild(new globalThis.Block(), 4, 4);
            globalThis.flush();

            const before = globalThis.rect(far);
            hidden.visible = true;
            globalThis.flush();

            return { before, after: globalThis.rect(far) };
        });

        expect(result.before).toMatchObject({ x: 45, y: 25 });
        expect(result.after).toMatchObject({ x: 90, y: 50 });
    });

    test('position queries and inserting and removing rows and columns', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const grid = globalThis.grid;
            const a = grid.addChild(new globalThis.Block({ name: 'a' }), 0, 0);
            const wide = grid.addChild(new globalThis.Block({ name: 'wide' }), 1, 0, 1, 3);
            const c = grid.addChild(new globalThis.Block({ name: 'c' }), 2, 2);
            const appended = grid.addChild(new globalThis.Block({ name: 'appended' }));

            const states = {
                at: [
                    grid.getChildAt(1, 2)?.name,
                    grid.getChildAt(0, 1),
                    grid.getChildAt(2, 2).name,
                ],
                appended: grid.getChildPosition(appended),
                counts: [grid.rowCount, grid.columnCount],
            };

            grid.insertRow(1);
            grid.insertColumn(1);
            states.afterInsert = [a, wide, c].map((x) => grid.getChildPosition(x));

            grid.removeColumn(1);
            grid.removeRow(0);
            states.afterRemove = {
                destroyed: a.destroyed,
                wide: grid.getChildPosition(wide),
                c: grid.getChildPosition(c),
            };

            grid.setChildPosition(c, 5, 5, 2, 2);
            states.moved = grid.getChildAt(6, 6) === c;

            let error = '';
            try {
                grid.addChild(new globalThis.Block(), -1, 0);
            } catch (e) {
                error = e.message;
            }
            states.error = error;

            return states;
        });

        expect(result.at).toEqual(['wide', null, 'c']);
        expect(result.appended).toEqual({ row: 3, column: 0, rowSpan: 1, columnSpan: 1 });
        expect(result.counts).toEqual([4, 3]);
        expect(result.afterInsert).toEqual([
            { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
            { row: 2, column: 0, rowSpan: 1, columnSpan: 4 },
            { row: 3, column: 3, rowSpan: 1, columnSpan: 1 },
        ]);
        expect(result.afterRemove).toEqual({
            destroyed: true,
            wide: { row: 1, column: 0, rowSpan: 1, columnSpan: 3 },
            c: { row: 2, column: 2, rowSpan: 1, columnSpan: 1 },
        });
        expect(result.moved).toBe(true);
        expect(result.error).toMatch(/Invalid grid row/);
    });

    test('the builder places children by their row and column', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/construction/builder.js');
            await import('/src/widgets/grid.js');
            await import('/src/widgets/label.js');

            const builder = new Builder();
            const [grid] = builder.build({
                type: 'grid',
                rowSpacing: 3,
                children: [
                    { type: 'label', id: 'name', text: 'Name', row: 0, column: 0 },
                    { type: 'label', id: 'wide', text: 'Wide', row: 1, column: 0, 'col-span': 2 },
                    { type: 'label', id: 'tall', text: 'Tall', row: 0, column: 2, rowSpan: 2 },
                ],
            });

            return {
                spacing: grid.rowSpacing,
                name: grid.getChildPosition(builder.getObjectById('name')),
                wide: grid.getChildPosition(builder.getObjectById('wide')),
                tall: grid.getChildPosition(builder.getObjectById('tall')),
                text: builder.getObjectById('wide').text,
            };
        });

        expect(result).toEqual({
            spacing: 3,
            name: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
            wide: { row: 1, column: 0, rowSpan: 1, columnSpan: 2 },
            tall: { row: 0, column: 2, rowSpan: 2, columnSpan: 1 },
            text: 'Wide',
        });
    });
});
