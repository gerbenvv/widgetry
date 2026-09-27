// Browser tests of tool bars and tool items: activation, toggles, radio groups, styles, the
// overflow menu, keyboard navigation and submenus.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Builds a main window with a tool bar in a host of a given width.
async function setup(page, width = 900) {
    await page.evaluate(async (hostWidth) => {
        const { Box } = await import('/src/widgets/box.js');
        const { ButtonGroup } = await import('/src/widgets/button-group.js');
        const { CheckToolItem } = await import('/src/widgets/check-tool-item.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Menu } = await import('/src/widgets/menu.js');
        const { MenuItem } = await import('/src/widgets/menu-item.js');
        const { RadioToolItem } = await import('/src/widgets/radio-tool-item.js');
        const { SeparatorToolItem } = await import('/src/widgets/separator-tool-item.js');
        const { ToolBar } = await import('/src/widgets/tool-bar.js');
        const { ToolItem } = await import('/src/widgets/tool-item.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const log = [];
        const host = document.createElement('div');
        host.style.cssText = `width: ${hostWidth}px; height: 200px;`;
        document.body.append(host);

        const recent = new Menu();
        const report = new MenuItem({ label: 'report.txt' });
        report.connect('activate', () => log.push('report'));
        recent.addChild(report);

        const toolBar = new ToolBar({ style: 'both-horizontal', iconSize: 16 });
        const add = (item) => {
            toolBar.addChild(item);
            item.connect('activate', () => log.push(item.label || item.tooltipLabel));

            return item;
        };

        const open = add(
            new ToolItem({
                label: 'Open',
                icon: 'document-open',
                isImportant: true,
                submenu: recent,
            })
        );
        const save = add(new ToolItem({ label: 'Save', icon: 'document-save' }));
        const print = add(
            new ToolItem({ label: 'Print', icon: 'document-print', sensitive: false })
        );
        toolBar.addChild(new SeparatorToolItem());
        const bold = add(new CheckToolItem({ label: 'Bold', icon: 'format-text-bold' }));
        toolBar.addChild(new SeparatorToolItem());
        const group = new ButtonGroup();
        const home = add(new RadioToolItem({ label: 'Home', group, active: true }));
        const indicators = add(new RadioToolItem({ label: 'Indicators', group }));
        const longShort = add(new RadioToolItem({ label: 'Long - short', group }));
        const spacer = new SeparatorToolItem({ draw: false, expand: true });
        toolBar.addChild(spacer);
        const discard = add(new ToolItem({ label: 'Discard' }));
        const store = add(new ToolItem({ label: 'Store' }));

        const box = new Box({ orientation: 'vertical' });
        box.addChild(toolBar);

        const window = new MainWindow({ host });
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.t = {
            host,
            window,
            toolBar,
            open,
            save,
            print,
            bold,
            home,
            indicators,
            longShort,
            spacer,
            discard,
            store,
            group,
            log,
        };
    }, width);

    // Let the resize observer run.
    await page.waitForTimeout(50);
}

test.describe('tool bar', () => {
    test('clicking and Enter activate tool items, insensitive ones do not', async ({ page }) => {
        const errors = await openHarness(page);
        await setup(page);

        await page.click('[aria-label="Save"]');
        await page.click('[aria-label="Print"]', { force: true });

        await page.evaluate(() => globalThis.t.save.focus());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);

        const state = await page.evaluate(() => ({
            log: globalThis.t.log,
            role: globalThis.t.toolBar.el.getAttribute('role'),
            focusOnClick: document.activeElement === globalThis.t.save.el,
        }));

        expect(state).toEqual({ log: ['Save', 'Save'], role: 'toolbar', focusOnClick: true });
        expect(errors).toEqual([]);
    });

    test('a press shows the item pressed and a release outside cancels', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const box = await page.locator('[aria-label="Save"]').boundingBox();
        await page.mouse.move(box.x + 5, box.y + 5);
        await page.mouse.down();

        expect(
            await page.evaluate(() => globalThis.t.save.el.classList.contains('wy-pressed'))
        ).toBe(true);

        await page.mouse.move(box.x + 5, box.y + 80);
        await page.mouse.up();

        const state = await page.evaluate(() => ({
            pressed: globalThis.t.save.el.classList.contains('wy-pressed'),
            log: globalThis.t.log,
        }));
        expect(state).toEqual({ pressed: false, log: [] });
    });

    test('check items toggle and radio items stay exclusive', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.click('[aria-label="Bold"]');

        let state = await page.evaluate(() => ({
            bold: globalThis.t.bold.active,
            pressed: globalThis.t.bold.el.getAttribute('aria-pressed'),
            drawn: globalThis.t.bold.el.classList.contains('wy-active'),
        }));
        expect(state).toEqual({ bold: true, pressed: 'true', drawn: true });

        await page.click('[aria-label="Indicators"]');
        await page.click('[aria-label="Indicators"]');

        state = await page.evaluate(() => ({
            home: globalThis.t.home.active,
            indicators: globalThis.t.indicators.active,
            longShort: globalThis.t.longShort.active,
            group: globalThis.t.group.active === globalThis.t.indicators,
            checked: globalThis.t.indicators.el.getAttribute('aria-checked'),
        }));
        expect(state).toEqual({
            home: false,
            indicators: true,
            longShort: false,
            group: true,
            checked: 'true',
        });
    });

    test('the style decides what items show', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const shown = () =>
            page.evaluate(() => {
                const visible = (element) => element.getBoundingClientRect().width > 0;
                const parts = (item) => ({
                    icon: visible(item.el.querySelector('.wy-tool-item-icon')),
                    label: visible(item.el.querySelector('.wy-tool-item-label')),
                });

                return {
                    open: parts(globalThis.t.open),
                    save: parts(globalThis.t.save),
                    home: parts(globalThis.t.home),
                };
            });

        // Both horizontally: only important items show their label next to the icon.
        expect(await shown()).toEqual({
            open: { icon: true, label: true },
            save: { icon: true, label: false },
            home: { icon: false, label: true },
        });

        await page.evaluate(() => {
            globalThis.t.toolBar.style = 'icons';
        });
        expect((await shown()).open).toEqual({ icon: true, label: false });

        await page.evaluate(() => {
            globalThis.t.toolBar.style = 'text';
        });
        expect((await shown()).save).toEqual({ icon: false, label: true });

        await page.evaluate(() => {
            globalThis.t.toolBar.style = 'both';
            globalThis.t.toolBar.iconSize = 24;
        });

        const both = await page.evaluate(() => {
            const icon = globalThis.t.save.el
                .querySelector('.wy-tool-item-icon')
                .getBoundingClientRect();
            const label = globalThis.t.save.el
                .querySelector('.wy-tool-item-label')
                .getBoundingClientRect();

            return { above: icon.bottom <= label.top + 1, size: Math.round(icon.width) };
        });
        expect(both).toEqual({ above: true, size: 24 });
    });

    test('an expanding separator pushes the following items to the end', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const state = await page.evaluate(() => {
            const bar = globalThis.t.toolBar.el.getBoundingClientRect();
            const store = globalThis.t.store.el.getBoundingClientRect();

            return {
                gap: Math.round(bar.right - store.right),
                expands: globalThis.t.spacer.isHExpand,
            };
        });

        expect(state.expands).toBe(true);
        expect(state.gap).toBeLessThanOrEqual(8);
    });

    test('items that do not fit go into the overflow menu', async ({ page }) => {
        await openHarness(page);
        await setup(page, 330);

        const state = await page.evaluate(() => ({
            overflow: globalThis.t.toolBar.overflowItems.map((x) => x.label || 'separator'),
            button: !globalThis.t.toolBar.el.querySelector('.wy-tool-bar-overflow').hidden,
            hidden: getComputedStyle(globalThis.t.store.el).display,
            fits:
                globalThis.t.toolBar.el
                    .querySelector('.wy-tool-bar-overflow')
                    .getBoundingClientRect().right <=
                globalThis.t.host.getBoundingClientRect().right + 0.5,
        }));

        expect(state.button).toBe(true);
        expect(state.hidden).toBe('none');
        expect(state.overflow).toContain('Store');
        expect(state.overflow).toContain('Long - short');
        expect(state.overflow).not.toContain('Open');
        expect(state.fits).toBe(true);

        await page.click('.wy-tool-bar-overflow');

        const labels = await page.evaluate(() =>
            [
                ...document.querySelectorAll(
                    '.wy-screen .wy-menu:not([hidden]) .wy-menu-item-label'
                ),
            ].map((x) => x.textContent)
        );
        expect(labels).toContain('Long - short');
        expect(labels).toContain('Store');

        await page.click('.wy-menu >> text=Long - short');

        let after = await page.evaluate(() => ({
            active: globalThis.t.longShort.active,
            home: globalThis.t.home.active,
            log: globalThis.t.log,
        }));
        expect(after).toEqual({ active: true, home: false, log: ['Long - short'] });

        // Making room shows the items again.
        await page.evaluate(() => {
            globalThis.t.host.style.width = '1000px';
        });
        await page.waitForTimeout(100);

        after = await page.evaluate(() => ({
            overflow: globalThis.t.toolBar.overflowItems.length,
            button: globalThis.t.toolBar.el.querySelector('.wy-tool-bar-overflow').hidden,
        }));
        expect(after).toEqual({ overflow: 0, button: true });
    });

    test('the arrow keys move between items and Tab leaves the tool bar', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.evaluate(() => globalThis.t.open.focus());
        await page.keyboard.press('ArrowRight');

        const focused = () =>
            page.evaluate(() => document.activeElement.getAttribute('aria-label'));

        // Print is insensitive and skipped.
        expect(await focused()).toBe('Save');

        await page.keyboard.press('ArrowRight');
        expect(await focused()).toBe('Bold');

        await page.keyboard.press('End');
        expect(await focused()).toBe('Store');

        await page.keyboard.press('ArrowRight');
        expect(await focused()).toBe('Open');

        await page.keyboard.press('ArrowLeft');
        expect(await focused()).toBe('Store');

        // All items are a single Tab stop.
        const chain = await page.evaluate(() =>
            globalThis.t.toolBar._getFocusChain().map((x) => x.label)
        );
        expect(chain).toEqual(['Store']);
    });

    test('the arrow of an item opens its submenu', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.click('[aria-label="Open"] .wy-tool-item-arrow');

        let state = await page.evaluate(() => ({
            open: globalThis.t.open.submenu.visible,
            log: globalThis.t.log,
            expanded: globalThis.t.open.el.getAttribute('aria-expanded'),
        }));
        expect(state).toEqual({ open: true, log: [], expanded: 'true' });

        await page.click('.wy-menu >> text=report.txt');
        expect(await page.evaluate(() => globalThis.t.log)).toEqual(['report']);

        // With the keyboard: Down opens it with the first item selected.
        await page.evaluate(() => globalThis.t.open.focus());
        await page.keyboard.press('ArrowDown');

        state = await page.evaluate(() => ({
            open: globalThis.t.open.submenu.visible,
            selected: globalThis.t.open.submenu.selected?.label,
        }));
        expect(state).toEqual({ open: true, selected: 'report.txt' });

        await page.keyboard.press('Escape');
        expect(await page.evaluate(() => document.activeElement === globalThis.t.open.el)).toBe(
            true
        );
    });

    test('tool items only go in tool bars', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const message = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const { ToolItem } = await import('/src/widgets/tool-item.js');

            try {
                new Box().addChild(new ToolItem({ label: 'Lost' }));
            } catch (error) {
                return error.message;
            }

            return null;
        });

        expect(message).toBe('A tool item can only be added to a tool bar.');
    });
});
