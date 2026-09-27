// Browser tests of menus and menu items: submenus, keyboard navigation, check and radio items,
// context menus, scrolling and the focus handling of the menu manager.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Builds a main window with a focusable widget that has a context menu with a submenu.
async function setup(page) {
    await page.evaluate(async () => {
        const { Application } = await import('/src/core/application.js');
        const { defineProperties } = await import('/src/core/instance.js');
        const { ButtonGroup } = await import('/src/widgets/button-group.js');
        const { CheckMenuItem } = await import('/src/widgets/check-menu-item.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Menu, attachContextMenu } = await import('/src/widgets/menu.js');
        const { getMenuManager } = await import('/src/widgets/menu-manager.js');
        const { MenuItem } = await import('/src/widgets/menu-item.js');
        const { RadioMenuItem } = await import('/src/widgets/radio-menu-item.js');
        const { SeparatorMenuItem } = await import('/src/widgets/separator-menu-item.js');
        const { Widget } = await import('/src/widgets/widget.js');

        class Block extends Widget {
            _render() {
                const element = document.createElement('div');
                element.className = 'test-block';
                element.style.cssText = 'width: 200px; height: 100px; margin: 50px;';

                return element;
            }
        }

        defineProperties(Block, { canFocus: { value: true } });

        Application.submenuDelay = 150;

        const log = [];
        const item = (label, properties = {}) => {
            const result = new MenuItem({ label, ...properties });
            result.connect('activate', () => log.push(label));

            return result;
        };
        const menu = (items) => {
            const result = new Menu();
            items.forEach((x) => result.addChild(x));

            return result;
        };

        const group = new ButtonGroup();
        const small = new RadioMenuItem({ label: '_Small', group, active: true });
        const large = new RadioMenuItem({ label: '_Large', group });
        const huge = new RadioMenuItem({ label: '_Huge', group, sensitive: false });
        const size = item('Si_ze', { submenu: menu([small, large, huge]) });
        const wrap = new CheckMenuItem({ label: '_Wrap' });
        const cut = item('Cu_t', { icon: 'edit-cut' });
        const copy = item('_Copy', { icon: 'edit-copy' });
        const paste = item('_Paste', { sensitive: false });
        const clear = item('C_lear');

        const contextMenu = menu([cut, copy, paste, new SeparatorMenuItem(), size, wrap, clear]);

        const block = new Block();
        const window = new MainWindow();
        window.addChild(block);
        window.show();
        block.focus();

        const detach = attachContextMenu(block, contextMenu);

        globalThis.t = {
            Application,
            Menu,
            MenuItem,
            getMenuManager,
            attachContextMenu,
            window,
            block,
            contextMenu,
            detach,
            cut,
            copy,
            paste,
            size,
            small,
            large,
            huge,
            wrap,
            clear,
            group,
            log,
        };
    });
}

async function openContextMenu(page) {
    const box = await page.locator('.test-block').boundingBox();
    await page.mouse.click(box.x + 20, box.y + 20, { button: 'right' });
}

test.describe('menu', () => {
    test('a right click pops up the context menu at the pointer', async ({ page }) => {
        const errors = await openHarness(page);
        await setup(page);

        const box = await page.locator('.test-block').boundingBox();
        await page.mouse.click(box.x + 20, box.y + 20, { button: 'right' });

        const state = await page.evaluate(() => {
            const rect = globalThis.t.contextMenu.el.getBoundingClientRect();

            return {
                open: globalThis.t.contextMenu.visible,
                x: rect.left,
                y: rect.top,
                inLayer: globalThis.t.contextMenu.el.parentElement.classList.contains('wy-screen'),
                role: globalThis.t.contextMenu.el.getAttribute('role'),
                focus: document.activeElement === globalThis.t.contextMenu.el,
                active: globalThis.t.Application.activeWindow === globalThis.t.window,
                windowActive: globalThis.t.window.el.classList.contains('wy-active'),
            };
        });

        expect(state.open).toBe(true);
        expect(Math.abs(state.x - (box.x + 20))).toBeLessThanOrEqual(1);
        expect(Math.abs(state.y - (box.y + 20))).toBeLessThanOrEqual(1);
        expect(state.inLayer).toBe(true);
        expect(state.role).toBe('menu');
        expect(state.focus).toBe(true);
        expect(state.active).toBe(true);
        expect(state.windowActive).toBe(true);
        expect(errors).toEqual([]);
    });

    test('the release of the opening press does not activate an item', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        // The menu pops up under the pointer; releasing right away must not activate.
        await page.evaluate(() => {
            const rect = globalThis.t.block.el.getBoundingClientRect();
            globalThis.t.contextMenu.popup({ x: rect.left + 20, y: rect.top + 4 });
        });

        const box = await page.locator('.wy-menu >> text=Cut').boundingBox();
        await page.evaluate(
            ([x, y]) => {
                const target = document.elementFromPoint(x, y);
                target.dispatchEvent(
                    new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y })
                );
            },
            [box.x + 10, box.y + box.height / 2]
        );

        expect(await page.evaluate(() => globalThis.t.log)).toEqual([]);
    });

    test('hovering an item with a submenu opens it after the delay', async ({ page }) => {
        await openHarness(page);
        await setup(page);
        await openContextMenu(page);

        await page.hover('.wy-menu >> text=Size');

        const early = await page.evaluate(() => globalThis.t.size.submenu.visible);
        expect(early).toBe(false);

        await page.waitForTimeout(300);

        const state = await page.evaluate(() => {
            const itemRect = globalThis.t.size.el.getBoundingClientRect();
            const submenuRect = globalThis.t.size.submenu.el.getBoundingClientRect();
            const firstRect = globalThis.t.small.el.getBoundingClientRect();

            return {
                open: globalThis.t.size.submenu.visible,
                right: submenuRect.left >= itemRect.right - 8,
                aligned: Math.abs(firstRect.top - itemRect.top),
                expanded: globalThis.t.size.el.getAttribute('aria-expanded'),
                selected: globalThis.t.size.selected,
            };
        });

        expect(state.open).toBe(true);
        expect(state.right).toBe(true);
        expect(state.aligned).toBeLessThanOrEqual(1);
        expect(state.expanded).toBe('true');
        expect(state.selected).toBe(true);

        // Moving to another item closes the submenu.
        await page.hover('.wy-menu >> text=Copy');

        const closed = await page.evaluate(() => ({
            open: globalThis.t.size.submenu.visible,
            selected: globalThis.t.contextMenu.selected === globalThis.t.copy,
        }));
        expect(closed).toEqual({ open: false, selected: true });
    });

    test('moving diagonally towards an open submenu keeps it open', async ({ page }) => {
        await openHarness(page);
        await setup(page);
        await openContextMenu(page);

        await page.hover('.wy-menu >> text=Size');
        await page.waitForTimeout(300);

        // Move from the item towards the submenu's last item, crossing the item below.
        const from = await page.locator('.wy-menu >> text=Size').boundingBox();
        const to = await page.locator('.wy-menu >> text=Large').boundingBox();
        await page.mouse.move(from.x + from.width - 30, from.y + from.height / 2);
        await page.mouse.move(to.x + 5, to.y + to.height / 2 + 12, { steps: 8 });

        const state = await page.evaluate(() => ({
            open: globalThis.t.size.submenu.visible,
            selected: globalThis.t.contextMenu.selected === globalThis.t.size,
        }));
        expect(state).toEqual({ open: true, selected: true });
    });

    test('clicking an item with a submenu opens it right away', async ({ page }) => {
        await openHarness(page);
        await setup(page);
        await openContextMenu(page);

        await page.click('.wy-menu >> text=Size');
        expect(await page.evaluate(() => globalThis.t.size.submenu.visible)).toBe(true);

        await page.click('.wy-menu >> text=Large');

        const state = await page.evaluate(() => ({
            large: globalThis.t.large.active,
            small: globalThis.t.small.active,
            active: globalThis.t.group.active === globalThis.t.large,
            open: globalThis.t.contextMenu.visible || globalThis.t.size.submenu.visible,
            checked: globalThis.t.large.el.getAttribute('aria-checked'),
            role: globalThis.t.large.el.getAttribute('role'),
        }));
        expect(state).toEqual({
            large: true,
            small: false,
            active: true,
            open: false,
            checked: 'true',
            role: 'menuitemradio',
        });
    });

    test('the keyboard moves the selection, skipping separators and insensitive items', async ({
        page,
    }) => {
        await openHarness(page);
        await setup(page);

        await page.focus('.test-block');
        await page.keyboard.press('Shift+F10');

        const selected = () =>
            page.evaluate(() => globalThis.t.contextMenu.selected?.label ?? null);

        // Opened with the keyboard, the first item is selected.
        expect(await selected()).toBe('Cu_t');

        await page.keyboard.press('ArrowDown');
        expect(await selected()).toBe('_Copy');

        // Paste is insensitive and the separator cannot be selected.
        await page.keyboard.press('ArrowDown');
        expect(await selected()).toBe('Si_ze');

        await page.keyboard.press('End');
        expect(await selected()).toBe('C_lear');

        // Down wraps around to the first item, and Up back to the last.
        await page.keyboard.press('ArrowDown');
        expect(await selected()).toBe('Cu_t');

        await page.keyboard.press('ArrowUp');
        expect(await selected()).toBe('C_lear');

        await page.keyboard.press('Home');
        expect(await selected()).toBe('Cu_t');

        // The menu tells assistive technology which item is selected.
        const descendant = await page.evaluate(
            () =>
                globalThis.t.contextMenu.el.getAttribute('aria-activedescendant') ===
                globalThis.t.cut.el.id
        );
        expect(descendant).toBe(true);

        await page.keyboard.press('Enter');

        const state = await page.evaluate(() => ({
            log: globalThis.t.log,
            open: globalThis.t.contextMenu.visible,
            focus: document.activeElement === globalThis.t.block.el,
        }));
        expect(state).toEqual({ log: ['Cu_t'], open: false, focus: true });
    });

    test('Right opens a submenu, Left and Escape close one level', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        // Shift+F10 opens the context menu like the ContextMenu key, which not every test driver
        // knows.
        await page.focus('.test-block');
        await page.keyboard.press('Shift+F10');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');

        let state = await page.evaluate(() => ({
            open: globalThis.t.size.submenu.visible,
            selected: globalThis.t.size.submenu.selected?.label,
            focus: document.activeElement === globalThis.t.size.submenu.el,
        }));
        expect(state).toEqual({ open: true, selected: '_Small', focus: true });

        await page.keyboard.press('ArrowLeft');

        state = await page.evaluate(() => ({
            open: globalThis.t.size.submenu.visible,
            menu: globalThis.t.contextMenu.visible,
            selected: globalThis.t.contextMenu.selected?.label,
            focus: document.activeElement === globalThis.t.contextMenu.el,
        }));
        expect(state).toEqual({ open: false, menu: true, selected: 'Si_ze', focus: true });

        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => globalThis.t.size.submenu.visible)).toBe(true);

        await page.keyboard.press('Escape');
        state = await page.evaluate(() => ({
            open: globalThis.t.size.submenu.visible,
            menu: globalThis.t.contextMenu.visible,
        }));
        expect(state).toEqual({ open: false, menu: true });

        await page.keyboard.press('Escape');
        state = await page.evaluate(() => ({
            menu: globalThis.t.contextMenu.visible,
            focus: document.activeElement === globalThis.t.block.el,
            open: globalThis.t.getMenuManager().isOpen,
        }));
        expect(state).toEqual({ menu: false, focus: true, open: false });
    });

    test('letters activate mnemonics and select items by their first letter', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        // Two items start with C (Cut, Copy, Clear); without a mnemonic c selects them in turn.
        await page.evaluate(() => {
            globalThis.t.cut.useUnderline = false;
            globalThis.t.cut.label = 'Cut';
            globalThis.t.copy.label = 'Copy';
            globalThis.t.copy.useUnderline = false;
        });

        await page.focus('.test-block');
        await page.keyboard.press('Shift+F10');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('c');

        const selected = await page.evaluate(() => globalThis.t.contextMenu.selected?.label);
        expect(selected).toBe('C_lear');

        // The unique mnemonic W toggles the check item and closes the menu.
        await page.keyboard.press('w');

        const state = await page.evaluate(() => ({
            wrap: globalThis.t.wrap.active,
            open: globalThis.t.contextMenu.visible,
        }));
        expect(state).toEqual({ wrap: true, open: false });
    });

    test('check items toggle and show their state', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const toggles = await page.evaluate(() => {
            const counts = [];
            globalThis.t.wrap.connect('toggle', (item) => counts.push(item.active));

            globalThis.t.wrap.inconsistent = true;
            const mixed = globalThis.t.wrap.el.getAttribute('aria-checked');

            globalThis.t.wrap.activate();

            return {
                counts,
                mixed,
                checked: globalThis.t.wrap.el.getAttribute('aria-checked'),
                inconsistent: globalThis.t.wrap.inconsistent,
                role: globalThis.t.wrap.el.getAttribute('role'),
            };
        });

        expect(toggles).toEqual({
            counts: [true],
            mixed: 'mixed',
            checked: 'true',
            inconsistent: false,
            role: 'menuitemcheckbox',
        });

        await openContextMenu(page);
        await page.click('.wy-menu >> text=Wrap');

        expect(await page.evaluate(() => globalThis.t.wrap.active)).toBe(false);
    });

    test('radio items join groups lazily and exclude each other', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const state = await page.evaluate(async () => {
            const { RadioMenuItem } = await import('/src/widgets/radio-menu-item.js');

            const first = new RadioMenuItem({ label: 'First' });
            const second = new RadioMenuItem({ label: 'Second' });
            const lazy = first.group;

            const menu = new globalThis.t.Menu();
            menu.addChild(first);
            menu.addChild(second);

            first.join(second);
            first.active = true;
            second.activate();

            // Activating the active item keeps it active.
            second.activate();

            return {
                lazy,
                shared: first.group === second.group && first.group !== null,
                first: first.active,
                second: second.active,
            };
        });

        expect(state).toEqual({ lazy: null, shared: true, first: false, second: true });
    });

    test('pressing outside and scrolling outside close the menus', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await openContextMenu(page);
        await page.click('.wy-menu >> text=Size');
        await page.mouse.click(700, 500);

        let state = await page.evaluate(() => ({
            menu: globalThis.t.contextMenu.visible,
            submenu: globalThis.t.size.submenu.visible,
        }));
        expect(state).toEqual({ menu: false, submenu: false });

        await openContextMenu(page);
        await page.mouse.move(700, 500);
        await page.mouse.wheel(0, 100);
        await page.waitForTimeout(50);

        state = await page.evaluate(() => ({ menu: globalThis.t.contextMenu.visible }));
        expect(state).toEqual({ menu: false });
    });

    test('a context menu factory creates a menu each time and destroys it after', async ({
        page,
    }) => {
        await openHarness(page);
        await setup(page);

        await page.evaluate(() => {
            globalThis.t.detach();

            globalThis.created = [];
            globalThis.t.attachContextMenu(globalThis.t.block, () => {
                const menu = new globalThis.t.Menu();
                const item = new globalThis.t.MenuItem({ label: 'Made' });
                item.connect('activate', () => globalThis.t.log.push('made'));
                menu.addChild(item);
                globalThis.created.push(menu);

                return menu;
            });
        });

        await openContextMenu(page);
        await page.click('.wy-menu >> text=Made');
        await page.waitForTimeout(50);

        const state = await page.evaluate(() => ({
            log: globalThis.t.log,
            destroyed: globalThis.created.map((x) => x.destroyed),
            old: globalThis.t.contextMenu.attachWidget,
        }));
        expect(state).toEqual({ log: ['made'], destroyed: [true], old: null });
    });

    test('a menu taller than the screen scrolls with its arrows', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const state = await page.evaluate(async () => {
            const menu = new globalThis.t.Menu();
            for (let i = 0; i < 80; i++) {
                menu.addChild(new globalThis.t.MenuItem({ label: `Item ${i}` }));
            }

            menu.popup({ x: 10, y: 10 });

            const rect = menu.el.getBoundingClientRect();
            globalThis.tall = menu;

            return {
                scrollable: menu.el.classList.contains('wy-scrollable'),
                fits: rect.top >= 0 && rect.bottom <= window.innerHeight,
            };
        });

        expect(state).toEqual({ scrollable: true, fits: true });

        await page.hover('.wy-menu-scroll-down');
        await page.waitForTimeout(300);

        const scrolled = await page.evaluate(
            () => globalThis.tall.el.querySelector('.wy-menu-body').scrollTop
        );
        expect(scrolled).toBeGreaterThan(0);

        // Keyboard selection scrolls the selected item into view.
        await page.keyboard.press('End');

        const visible = await page.evaluate(() => {
            const body = globalThis.tall.el.querySelector('.wy-menu-body').getBoundingClientRect();
            const item = globalThis.tall.selected.el.getBoundingClientRect();

            return item.bottom <= body.bottom + 1 && item.top >= body.top - 1;
        });
        expect(visible).toBe(true);
    });

    test('destroying a menu item destroys its submenu, and removing items works', async ({
        page,
    }) => {
        await openHarness(page);
        await setup(page);

        const state = await page.evaluate(() => {
            const submenu = globalThis.t.size.submenu;
            globalThis.t.size.destroy();

            globalThis.t.contextMenu.removeChild(globalThis.t.clear);

            return {
                destroyed: submenu.destroyed,
                children: globalThis.t.contextMenu.childrenCount,
            };
        });

        expect(state).toEqual({ destroyed: true, children: 5 });
    });

    test('invalid arguments throw', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        const errors = await page.evaluate(async () => {
            const { Box } = await import('/src/widgets/box.js');
            const messages = [];
            const attempt = (method) => {
                try {
                    method();
                } catch (error) {
                    messages.push(error.constructor.name);
                }
            };

            attempt(() => globalThis.t.contextMenu.addChild(new Box()));
            attempt(() => new Box().addChild(new globalThis.t.MenuItem()));
            attempt(() => new globalThis.t.MenuItem({ accelerator: 'Hyper+X' }));
            attempt(() => new globalThis.t.MenuItem({ submenu: new Box() }));
            attempt(() => globalThis.t.contextMenu.popup('nowhere'));

            return messages;
        });

        expect(errors).toEqual(['TypeError', 'Error', 'Error', 'TypeError', 'TypeError']);
    });
});
