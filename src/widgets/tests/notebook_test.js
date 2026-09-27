// Browser tests of the Notebook.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a notebook with three pages (with a focusable block each) in a main window of 500 by
// 300 pixels.
async function setUp(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Widget, flushLayout } = await import('/src/widgets/widget.js');
        const { defineProperties } = await import('/src/core/instance.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Notebook } = await import('/src/widgets/notebook.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.style.cssText = 'min-width: 60px; min-height: 30px; background: #ccc;';

                return element;
            }
        }

        defineProperties(Block, { canFocus: { value: true } });
        globalThis.Block = Block;

        document.body.style.margin = '0';
        const host = document.createElement('div');
        host.style.cssText = 'width: 500px; height: 300px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const notebook = new Notebook(properties);
        const pages = ['One', 'Two', 'Three'].map(
            (name) => new Block({ name, hAlign: 'start', vAlign: 'start' })
        );
        pages.forEach((x) => notebook.appendPage(x, x.name));
        window.addChild(notebook);
        window.show();
        flushLayout();

        globalThis.notebook = notebook;
        globalThis.pages = pages;
        globalThis.window_ = window;
        globalThis.flush = flushLayout;
        globalThis.switches = [];
        notebook.connect('switch-page', (_notebook, child, index) =>
            globalThis.switches.push([child.name, index])
        );
    }, properties);
}

const state = (page) =>
    page.evaluate(() => {
        const notebook = globalThis.notebook;
        const tabs = [...notebook.el.querySelectorAll('.wy-notebook-tab')];
        const panels = [...notebook.el.querySelectorAll('.wy-notebook-page')];

        return {
            current: notebook.currentPage,
            tabs: tabs.map((x) => x.textContent.trim()),
            selected: tabs.map((x) => x.getAttribute('aria-selected')),
            visible: panels.map((x) =>
                getComputedStyle(x).opacity === '1' ? 'visible' : 'hidden'
            ),
            switches: globalThis.switches,
        };
    });

test.describe('notebook', () => {
    test('pages are added with tabs and the first page is shown', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page);

        const result = await state(page);

        expect(errors).toEqual([]);
        expect(result).toEqual({
            current: 0,
            tabs: ['One', 'Two', 'Three'],
            selected: ['true', 'false', 'false'],
            visible: ['visible', 'hidden', 'hidden'],
            switches: [],
        });

        const aria = await page.evaluate(() => {
            const notebook = globalThis.notebook;
            const tablist = notebook.el.querySelector('[role="tablist"]');
            const tab = notebook.el.querySelector('[role="tab"]');
            const panel = notebook.el.querySelector('[role="tabpanel"]');

            return {
                active: tablist.getAttribute('aria-activedescendant') === tab.id,
                controls: tab.getAttribute('aria-controls') === panel.id,
                labelledBy: panel.getAttribute('aria-labelledby') === tab.id,
                inert: [...notebook.el.querySelectorAll('[role="tabpanel"]')].map((x) => x.inert),
                count: notebook.pageCount,
            };
        });

        expect(aria).toEqual({
            active: true,
            controls: true,
            labelledBy: true,
            inert: [false, true, true],
            count: 3,
        });
    });

    test('clicking a tab switches the page', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        await page.locator('.wy-notebook-tab', { hasText: 'Three' }).click();

        const result = await state(page);
        expect(result.current).toBe(2);
        expect(result.visible).toEqual(['hidden', 'hidden', 'visible']);
        expect(result.switches).toEqual([['Three', 2]]);
        expect(await page.evaluate(() => globalThis.notebook.hasFocus)).toBe(true);
    });

    test('the notebook is as large as its largest page', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { hAlign: 'start', vAlign: 'start' });

        const sizes = await page.evaluate(() => {
            globalThis.pages[2].width = 200;
            globalThis.pages[1].height = 120;
            globalThis.flush();

            const size = () => {
                const r = globalThis.notebook.el.querySelector('.wy-notebook-pages');
                return [r.offsetWidth, r.offsetHeight];
            };

            const first = size();
            globalThis.notebook.currentPage = 2;

            return [first, size()];
        });

        expect(sizes[0]).toEqual(sizes[1]);
        expect(sizes[0]).toEqual([202, 122]);
    });

    test('the keyboard switches pages', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        // The tabs have the focus first.
        await expect.poll(() => page.evaluate(() => globalThis.notebook.hasFocus)).toBe(true);

        await page.keyboard.press('ArrowRight');
        expect((await state(page)).current).toBe(1);

        await page.keyboard.press('End');
        expect((await state(page)).current).toBe(2);

        await page.keyboard.press('ArrowRight');
        expect((await state(page)).current).toBe(2);

        await page.keyboard.press('Home');
        expect((await state(page)).current).toBe(0);

        // Ctrl+Page Down and Up work from within the page.
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => globalThis.pages[0].hasFocus)).toBe(true);

        await page.keyboard.press('Control+PageDown');
        expect((await state(page)).current).toBe(1);

        // The focus moved out of the hidden page.
        expect(await page.evaluate(() => globalThis.notebook.hasFocus)).toBe(true);

        await page.keyboard.press('Control+PageUp');
        expect((await state(page)).current).toBe(0);
    });

    test('the focus chain has only the current page', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const chain = await page.evaluate(() => {
            const names = () => globalThis.window_._getFocusChain().map((x) => x.name || 'nb');

            const first = names();
            globalThis.notebook.currentPage = 1;

            return [first, names()];
        });

        expect(chain).toEqual([
            ['nb', 'One'],
            ['nb', 'Two'],
        ]);
    });

    test('pages can be inserted, removed and hidden', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const notebook = globalThis.notebook;
            const events = [];
            notebook.connect('page-add', (_n, child, index) => events.push(['add', index]));
            notebook.connect('page-remove', (_n, child, index) => events.push(['remove', index]));

            const zero = new globalThis.Block({ name: 'Zero' });
            const index = notebook.insertPage(zero, new Label({ text: 'Zero label' }), 0);
            const states = {
                index,
                current: notebook.currentPage,
                label: notebook.getTabLabel(zero).text,
                text: notebook.getTabLabelText(globalThis.pages[0]),
            };

            // Removing the current page shows the next one.
            notebook.currentPage = 1;
            const removed = notebook.removePage(1);
            states.removed = [removed.name, removed.destroyed, notebook.currentPage];
            states.currentName = notebook.getPage(notebook.currentPage).name;

            // Hiding the current page shows another one, and hides its tab.
            globalThis.pages[1].visible = false;
            states.afterHide = notebook.getPage(notebook.currentPage).name;
            states.tabHidden = notebook.el.querySelectorAll('.wy-notebook-tab')[1].hidden;

            notebook.setTabLabelText(globalThis.pages[2], 'Renamed');
            states.renamed = notebook.getTabLabelText(globalThis.pages[2]);

            let error = '';
            try {
                notebook.currentPage = 10;
            } catch (e) {
                error = e.message;
            }
            states.error = error;
            states.events = events;

            return states;
        });

        expect(result).toEqual({
            index: 0,
            current: 1,
            label: 'Zero label',
            text: 'One',
            removed: ['One', false, 1],
            currentName: 'Two',
            afterHide: 'Three',
            tabHidden: true,
            renamed: 'Renamed',
            error: 'Invalid page index: 10.',
            events: [
                ['add', 0],
                ['remove', 1],
            ],
        });
    });

    test('removing the only page signals that there is no current page', async ({ page }) => {
        await openHarness(page);
        await setUp(page);

        const result = await page.evaluate(() => {
            const notebook = globalThis.notebook;
            const events = [];
            notebook.connect('current-page-change', () => events.push(notebook.currentPage));

            notebook.removePage(2);
            notebook.removePage(1);
            notebook.removePage(0);

            return { events, current: notebook.currentPage };
        });

        expect(result).toEqual({ events: [-1], current: -1 });
    });

    test('removing the page whose tab is being dragged ends the drag', async ({ page }) => {
        const errors = await openHarness(page);
        await setUp(page, { reorderable: true });

        const first = await page.locator('.wy-notebook-tab').nth(0).boundingBox();
        const third = await page.locator('.wy-notebook-tab').nth(2).boundingBox();

        await page.mouse.move(first.x + 10, first.y + 10);
        await page.mouse.down();
        await page.mouse.move(first.x + 30, first.y + 10, { steps: 4 });
        await page.evaluate(() => globalThis.notebook.removePage(0));
        await page.mouse.move(third.x + third.width - 5, first.y + 10, { steps: 4 });
        await page.mouse.up();

        const order = await page.evaluate(() => globalThis.notebook.children.map((x) => x.name));

        expect(errors).toEqual([]);
        expect(order).toEqual(['Two', 'Three']);
    });

    test('closable tabs have a close button that destroys the page', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { closable: true });

        await page.evaluate(() => {
            globalThis.closes = [];
            globalThis.notebook.connect('page-close', (_n, child) => {
                globalThis.closes.push(child.name);

                // Keep the first page open.
                return child.name === 'One';
            });
            globalThis.notebook.setTabClosable(globalThis.pages[2], false);
        });

        const buttons = page.locator('.wy-notebook-tab-close');
        expect(await buttons.nth(2).isVisible()).toBe(false);

        await buttons.nth(0).click();
        await buttons.nth(1).click();

        const result = await page.evaluate(() => ({
            closes: globalThis.closes,
            count: globalThis.notebook.pageCount,
            destroyed: globalThis.pages[1].destroyed,
            current: globalThis.notebook.currentPage,
        }));

        expect(result).toEqual({ closes: ['One', 'Two'], count: 2, destroyed: true, current: 0 });

        // Delete closes the current closable page.
        await page.evaluate(() => globalThis.notebook.focus());
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Delete');
        expect(await page.evaluate(() => globalThis.notebook.pageCount)).toBe(2);
    });

    test('tabs can be reordered by dragging', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { reorderable: true });

        const first = await page.locator('.wy-notebook-tab').nth(0).boundingBox();
        const third = await page.locator('.wy-notebook-tab').nth(2).boundingBox();

        await page.mouse.move(first.x + 10, first.y + 10);
        await page.mouse.down();
        await page.mouse.move(third.x + third.width - 5, first.y + 10, { steps: 8 });
        await page.mouse.up();

        const result = await page.evaluate(() => ({
            order: globalThis.notebook.children.map((x) => x.name),
            tabs: [...globalThis.notebook.el.querySelectorAll('.wy-notebook-tab')].map((x) =>
                x.textContent.trim()
            ),
            current: globalThis.notebook.currentPage,
        }));

        expect(result).toEqual({
            order: ['Two', 'Three', 'One'],
            tabs: ['Two', 'Three', 'One'],
            current: 2,
        });
    });

    test('tabs can be at every side, hidden, and scroll', async ({ page }) => {
        await openHarness(page);
        await setUp(page, { scrollable: true });

        const result = await page.evaluate(() => {
            const notebook = globalThis.notebook;
            const header = notebook.el.querySelector('.wy-notebook-header');
            const pages = notebook.el.querySelector('.wy-notebook-pages');
            const where = () => {
                const h = header.getBoundingClientRect();
                const p = pages.getBoundingClientRect();

                if (h.bottom <= p.top + 1) return 'top';
                if (h.top >= p.bottom - 1) return 'bottom';
                if (h.right <= p.left + 1) return 'left';
                return 'right';
            };

            const sides = [];
            for (const position of ['top', 'right', 'bottom', 'left']) {
                notebook.tabPosition = position;
                sides.push(where());
            }

            notebook.tabPosition = 'top';
            for (let i = 0; i < 12; ++i) {
                notebook.appendPage(
                    new globalThis.Block({ name: `Extra ${i}` }),
                    `Extra page ${i}`
                );
            }
            globalThis.flush();

            const overflowing = notebook.el.classList.contains('wy-overflowing');
            const width = notebook.el.getBoundingClientRect().width;

            notebook.currentPage = 14;
            const tabs = notebook.el.querySelector('.wy-notebook-tabs');
            const tab = notebook.el
                .querySelectorAll('.wy-notebook-tab')[14]
                .getBoundingClientRect();
            const strip = tabs.getBoundingClientRect();
            const scrolled = tabs.scrollLeft > 0;

            notebook.showTabs = false;

            return {
                sides,
                overflowing,
                width,
                scrolled,
                inView: tab.right <= strip.right + 1,
                hidden: header.hidden,
            };
        });

        expect(result).toEqual({
            sides: ['top', 'right', 'bottom', 'left'],
            overflowing: true,
            width: 500,
            scrolled: true,
            inView: true,
            hidden: true,
        });
    });
});
