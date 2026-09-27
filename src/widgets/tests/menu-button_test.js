// Browser tests of the menu button: opening and closing its menu with the pointer and the keyboard.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Builds a main window with a menu button.
async function setup(page) {
    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Menu } = await import('/src/widgets/menu.js');
        const { MenuButton } = await import('/src/widgets/menu-button.js');
        const { MenuItem } = await import('/src/widgets/menu-item.js');

        const log = [];
        const menu = new Menu();
        for (const label of ['_Rename', '_Duplicate', 'De_lete']) {
            const item = new MenuItem({ label, accelerator: label === 'De_lete' ? 'Delete' : '' });
            item.connect('activate', () => log.push(label));
            menu.addChild(item);
        }

        const button = new MenuButton({
            label: '_Actions',
            icon: 'open-menu',
            menu,
            hAlign: 'start',
            vAlign: 'start',
            margin: 20,
        });

        const window = new MainWindow();
        window.addChild(button);
        window.show();

        globalThis.t = { window, button, menu, log };
    });
}

test.describe('menu button', () => {
    test('pressing opens the menu below and pressing again closes it', async ({ page }) => {
        const errors = await openHarness(page);
        await setup(page);

        await page.click('.wy-menu-button');

        const state = await page.evaluate(() => {
            const button = globalThis.t.button.el.getBoundingClientRect();
            const menu = globalThis.t.menu.el.getBoundingClientRect();

            return {
                open: globalThis.t.menu.visible,
                active: globalThis.t.button.active,
                expanded: globalThis.t.button.el.getAttribute('aria-expanded'),
                below: Math.round(menu.top - button.bottom),
                left: Math.round(menu.left - button.left),
                classes: globalThis.t.button.el.className,
            };
        });

        expect(state.open).toBe(true);
        expect(state.active).toBe(true);
        expect(state.expanded).toBe('true');
        expect(state.below).toBe(0);
        expect(state.left).toBe(0);
        expect(state.classes).toContain('wy-button');
        expect(state.classes).toContain('wy-menu-button');

        await page.click('.wy-menu-button');

        const closed = await page.evaluate(() => ({
            open: globalThis.t.menu.visible,
            active: globalThis.t.button.active,
            focus: document.activeElement === globalThis.t.button.el,
        }));
        expect(closed).toEqual({ open: false, active: false, focus: true });
        expect(errors).toEqual([]);
    });

    test('activating an item closes the menu', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.click('.wy-menu-button');
        await page.click('.wy-menu >> text=Duplicate');

        const state = await page.evaluate(() => ({
            log: globalThis.t.log,
            active: globalThis.t.button.active,
        }));
        expect(state).toEqual({ log: ['_Duplicate'], active: false });
    });

    test('Enter opens the menu with its first item selected', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.evaluate(() => globalThis.t.button.focus());
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);

        const state = await page.evaluate(() => ({
            open: globalThis.t.menu.visible,
            selected: globalThis.t.menu.selected?.label,
        }));
        expect(state).toEqual({ open: true, selected: '_Rename' });

        await page.keyboard.press('Escape');

        const closed = await page.evaluate(() => ({
            open: globalThis.t.menu.visible,
            focus: document.activeElement === globalThis.t.button.el,
        }));
        expect(closed).toEqual({ open: false, focus: true });

        // The menu's accelerators work in the button's window.
        await page.keyboard.press('Delete');
        expect(await page.evaluate(() => globalThis.t.log)).toEqual(['De_lete']);
    });

    test('the direction places the menu and turns the arrow', async ({ page }) => {
        await openHarness(page);
        await setup(page);

        await page.evaluate(() => {
            globalThis.t.button.direction = 'right';
            globalThis.t.button.active = true;
        });

        const state = await page.evaluate(() => {
            const button = globalThis.t.button.el.getBoundingClientRect();
            const menu = globalThis.t.menu.el.getBoundingClientRect();

            return {
                right: menu.left >= button.right - 1,
                direction: globalThis.t.button.el.dataset.direction,
            };
        });
        expect(state).toEqual({ right: true, direction: 'right' });

        const invalid = await page.evaluate(() => {
            try {
                globalThis.t.button.direction = 'sideways';
            } catch (error) {
                return error.constructor.name;
            }

            return null;
        });
        expect(invalid).toBe('RangeError');
    });

    test('an insensitive button does not open and destroying it destroys the menu', async ({
        page,
    }) => {
        await openHarness(page);
        await setup(page);

        await page.evaluate(() => {
            globalThis.t.button.sensitive = false;
        });
        await page.click('.wy-menu-button', { force: true });

        expect(await page.evaluate(() => globalThis.t.menu.visible)).toBe(false);

        const destroyed = await page.evaluate(() => {
            globalThis.t.button.destroy();

            return globalThis.t.menu.destroyed;
        });
        expect(destroyed).toBe(true);
    });
});
