// Browser tests of the menu bar: opening menus with the pointer and the keyboard, switching
// between them, and the accelerators of its items.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Builds a main window with a menu bar (File, Edit, View) and a focusable entry-like widget.
async function setup(page) {
    await page.evaluate(async () => {
        const { Application } = await import('/src/core/application.js');
        const { defineProperties } = await import('/src/core/instance.js');
        const { Box } = await import('/src/widgets/box.js');
        const { CheckMenuItem } = await import('/src/widgets/check-menu-item.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Menu } = await import('/src/widgets/menu.js');
        const { MenuBar } = await import('/src/widgets/menu-bar.js');
        const { MenuItem } = await import('/src/widgets/menu-item.js');
        const { SeparatorMenuItem } = await import('/src/widgets/separator-menu-item.js');
        const { Widget } = await import('/src/widgets/widget.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.className = 'test-block';
                element.style.cssText = 'width: 80px; height: 30px;';

                return element;
            }
        }

        defineProperties(Block, { canFocus: { value: true } });

        Application.submenuDelay = 50;

        const log = [];
        const menu = (items) => {
            const result = new Menu();
            items.forEach((x) => result.addChild(x));

            return result;
        };
        const item = (label, properties = {}) => {
            const result = new MenuItem({ label, ...properties });
            result.connect('activate', () => log.push(label));

            return result;
        };

        const save = item('_Save', { accelerator: 'Ctrl+S' });
        const print = item('_Print', { accelerator: 'Ctrl+P', sensitive: false });
        const undo = item('_Undo', { accelerator: 'Ctrl+Z' });
        const grid = new CheckMenuItem({ label: '_Grid', accelerator: 'Ctrl+G' });

        const file = new MenuItem({
            label: '_File',
            submenu: menu([
                item('_New', { accelerator: 'Ctrl+N' }),
                save,
                print,
                new SeparatorMenuItem(),
                item('_Quit'),
            ]),
        });
        const edit = new MenuItem({
            label: '_Edit',
            submenu: menu([undo, item('_Redo', { accelerator: 'Ctrl+Shift+Z' })]),
        });
        const view = new MenuItem({
            label: '_View',
            submenu: menu([grid, item('_Refresh', { accelerator: 'F5' })]),
        });
        const about = item('_About');

        const bar = new MenuBar();
        [file, edit, view, about].forEach((x) => bar.addChild(x));

        const block = new Block();
        const box = new Box({ orientation: 'vertical' });
        box.addChild(bar);
        box.addChild(block);

        const window = new MainWindow();
        window.addChild(box);
        window.show();
        block.focus();

        globalThis.t = {
            Application,
            window,
            bar,
            file,
            edit,
            view,
            about,
            save,
            print,
            undo,
            grid,
            block,
            log,
        };
    });
}

test.describe('menu bar', () => {
    test('clicking opens a menu, hovering switches and clicking again closes', async ({ page }) => {
        const errors = await openHarness(page);
        await setup(page);

        await page.click('.wy-menu-bar >> text=File');

        let state = await page.evaluate(() => ({
            open: globalThis.t.file.submenu.visible,
            selected: globalThis.t.bar.selected === globalThis.t.file,
            expanded: globalThis.t.file.el.getAttribute('aria-expanded'),
            active: globalThis.t.Application.activeWindow === globalThis.t.window,
        }));
        expect(state).toEqual({ open: true, selected: true, expanded: 'true', active: true });

        // The menu is placed right below the item.
        const [itemBox, menuBox] = await page.evaluate(() => [
            globalThis.t.file.el.getBoundingClientRect().toJSON(),
            globalThis.t.file.submenu.el.getBoundingClientRect().toJSON(),
        ]);
        expect(Math.abs(menuBox.top - itemBox.bottom)).toBeLessThanOrEqual(1);
        expect(Math.abs(menuBox.left - itemBox.left)).toBeLessThanOrEqual(1);

        await page.hover('.wy-menu-bar >> text=Edit');

        state = await page.evaluate(() => ({
            file: globalThis.t.file.submenu.visible,
            edit: globalThis.t.edit.submenu.visible,
        }));
        expect(state).toEqual({ file: false, edit: true });

        await page.click('.wy-menu-bar >> text=Edit');

        state = await page.evaluate(() => ({
            edit: globalThis.t.edit.submenu.visible,
            selected: globalThis.t.bar.selected,
            focus: document.activeElement === globalThis.t.block.el,
        }));
        expect(state).toEqual({ edit: false, selected: null, focus: true });
        expect(errors).toEqual([]);
    });

    test('hovering does not open menus while the bar is inactive', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.hover('.wy-menu-bar >> text=File');
        await page.hover('.wy-menu-bar >> text=Edit');

        expect(await page.evaluate(() => globalThis.t.bar.selected)).toBe(null);
    });

    test('pressing outside closes the menu and gives the focus back', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.click('.wy-menu-bar >> text=File');
        expect(
            await page.evaluate(() => document.activeElement === globalThis.t.file.submenu.el)
        ).toBe(true);

        await page.mouse.click(600, 400);

        const state = await page.evaluate(() => ({
            open: globalThis.t.file.submenu.visible,
            focus: document.activeElement === globalThis.t.block.el,
            active: globalThis.t.Application.activeWindow === globalThis.t.window,
        }));
        expect(state).toEqual({ open: false, focus: true, active: true });
    });

    test('clicking an item activates it and closes the menus', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.click('.wy-menu-bar >> text=File');
        await page.click('.wy-menu >> text=Save');

        const state = await page.evaluate(() => ({
            log: globalThis.t.log,
            open: globalThis.t.file.submenu.visible,
        }));
        expect(state).toEqual({ log: ['_Save'], open: false });

        // An insensitive item does not activate.
        await page.click('.wy-menu-bar >> text=File');
        await page.click('.wy-menu >> text=Print', { force: true });

        expect(await page.evaluate(() => globalThis.t.log)).toEqual(['_Save']);
    });

    test('pressing, dragging onto an item and releasing activates it', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const bar = await page.locator('.wy-menu-bar >> text=File').boundingBox();
        await page.mouse.move(bar.x + 5, bar.y + 5);
        await page.mouse.down();

        const item = await page.locator('.wy-menu >> text=New').boundingBox();
        await page.mouse.move(item.x + 10, item.y + 5, { steps: 4 });
        await page.mouse.up();

        expect(await page.evaluate(() => globalThis.t.log)).toEqual(['_New']);
    });

    test('a menu bar item without a menu activates on click', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.click('.wy-menu-bar >> text=About');

        const state = await page.evaluate(() => ({
            log: globalThis.t.log,
            selected: globalThis.t.bar.selected,
        }));
        expect(state).toEqual({ log: ['_About'], selected: null });
    });

    test('F10 opens the first menu and the arrow keys move between menus', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.keyboard.press('F10');

        let state = await page.evaluate(() => ({
            open: globalThis.t.file.submenu.visible,
            selected: globalThis.t.file.submenu.selected?.label,
            focus: document.activeElement === globalThis.t.file.submenu.el,
        }));
        expect(state).toEqual({ open: true, selected: '_New', focus: true });

        await page.keyboard.press('ArrowRight');

        state = await page.evaluate(() => ({
            file: globalThis.t.file.submenu.visible,
            edit: globalThis.t.edit.submenu.visible,
            selected: globalThis.t.edit.submenu.selected?.label,
        }));
        expect(state).toEqual({ file: false, edit: true, selected: '_Undo' });

        // Left wraps around from the first menu to the last item.
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');

        state = await page.evaluate(() => ({
            selected: globalThis.t.bar.selected?.label,
            focus: document.activeElement === globalThis.t.bar.el,
        }));
        expect(state).toEqual({ selected: '_About', focus: true });

        await page.keyboard.press('ArrowRight');
        expect(await page.evaluate(() => globalThis.t.file.submenu.visible)).toBe(true);

        await page.keyboard.press('Escape');

        state = await page.evaluate(() => ({
            open: globalThis.t.file.submenu.visible,
            selected: globalThis.t.bar.selected,
            focus: document.activeElement === globalThis.t.block.el,
        }));
        expect(state).toEqual({ open: false, selected: null, focus: true });
    });

    test('Alt with a mnemonic opens the matching menu', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.keyboard.press('Alt+e');

        let state = await page.evaluate(() => ({
            open: globalThis.t.edit.submenu.visible,
            selected: globalThis.t.edit.submenu.selected?.label,
        }));
        expect(state).toEqual({ open: true, selected: '_Undo' });

        // In the menu, a mnemonic letter activates its item.
        await page.keyboard.press('r');

        state = await page.evaluate(() => ({
            log: globalThis.t.log,
            open: globalThis.t.edit.submenu.visible,
        }));
        expect(state).toEqual({ log: ['_Redo'], open: false });
    });

    test('accelerators activate items anywhere in the window', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.keyboard.press('Control+s');
        await page.keyboard.press('Control+Shift+z');
        await page.keyboard.press('F5');
        await page.keyboard.press('Control+g');

        let state = await page.evaluate(() => ({
            log: globalThis.t.log,
            grid: globalThis.t.grid.active,
        }));
        expect(state).toEqual({ log: ['_Save', '_Redo', '_Refresh'], grid: true });

        // Insensitive items and items in insensitive menus do not activate.
        await page.keyboard.press('Control+p');
        await page.evaluate(() => {
            globalThis.t.edit.sensitive = false;
        });
        await page.keyboard.press('Control+z');

        expect(await page.evaluate(() => globalThis.t.log)).toEqual(['_Save', '_Redo', '_Refresh']);

        // The accelerator is shown in the item, and exposed to assistive technology.
        state = await page.evaluate(() => ({
            text: globalThis.t.save.el.querySelector('.wy-menu-item-accelerator').textContent,
            aria: globalThis.t.save.el.getAttribute('aria-keyshortcuts'),
        }));
        expect(state).toEqual({ text: 'Ctrl+S', aria: 'Control+S' });
    });

    test('accelerators do not work while a menu is open or when the focus widget handled the key', async ({
        page,
    }) => {
        await openHarness(page);
        await setup(page);

        await page.evaluate(() => {
            globalThis.t.block.el.addEventListener('keydown', (event) => {
                if (event.key === 'n') {
                    event.preventDefault();
                }
            });
        });

        await page.keyboard.press('Control+n');
        expect(await page.evaluate(() => globalThis.t.log)).toEqual([]);

        await page.click('.wy-menu-bar >> text=Edit');
        await page.keyboard.press('Control+s');

        expect(await page.evaluate(() => globalThis.t.log)).toEqual([]);
    });

    test('hiding the bar deselects it and its accelerators stop working', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.click('.wy-menu-bar >> text=File');
        await page.evaluate(() => {
            globalThis.t.bar.visible = false;
        });

        const state = await page.evaluate(() => ({
            open: globalThis.t.file.submenu.visible,
            selected: globalThis.t.bar.selected,
        }));
        expect(state).toEqual({ open: false, selected: null });

        await page.keyboard.press('Control+s');
        expect(await page.evaluate(() => globalThis.t.log)).toEqual([]);
    });
    test('menu bars and tool bars can be built declaratively', async ({ page }) => {
        const errors = await openHarness(page);

        const state = await page.evaluate(async () => {
            const { build } = await import('/src/construction/builder.js');
            await import('/src/widgets/menu-bar.js');
            await import('/src/widgets/menu.js');
            await import('/src/widgets/menu-item.js');
            await import('/src/widgets/check-menu-item.js');
            await import('/src/widgets/separator-menu-item.js');
            await import('/src/widgets/tool-bar.js');
            await import('/src/widgets/tool-item.js');
            await import('/src/widgets/radio-tool-item.js');
            await import('/src/widgets/button-group.js');

            const log = [];
            const [bar, toolBar] = build([
                {
                    type: 'menu-bar',
                    children: [
                        {
                            type: 'menu-item',
                            label: '_File',
                            submenu: {
                                type: 'menu',
                                children: [
                                    {
                                        type: 'menu-item',
                                        label: '_Open',
                                        accelerator: 'Ctrl+O',
                                        handlers: { activate: () => log.push('open') },
                                    },
                                    { type: 'separator-menu-item' },
                                    { type: 'check-menu-item', label: '_Wrap', active: true },
                                ],
                            },
                        },
                    ],
                },
                {
                    type: 'tool-bar',
                    style: 'text',
                    children: [
                        { type: 'radio-tool-item', label: 'Home', group: { id: 'views' } },
                        { type: 'radio-tool-item', label: 'Details', group: { id: 'views' } },
                    ],
                },
                { type: 'button-group', id: 'views' },
            ]);

            const file = bar.getChild(0);
            file.submenu.getChild(0).activate();

            return {
                items: file.submenu.childrenCount,
                accelerator: file.submenu.getChild(0).accelerator,
                wrap: file.submenu.getChild(2).active,
                log,
                shared: toolBar.getChild(0).group === toolBar.getChild(1).group,
                style: toolBar.style,
            };
        });

        expect(state).toEqual({
            items: 3,
            accelerator: 'Ctrl+O',
            wrap: true,
            log: ['open'],
            shared: true,
            style: 'text',
        });
        expect(errors).toEqual([]);
    });
});
