// Browser tests of the ComboBox widget.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

const FRUITS = [
    { id: 'apple', label: 'Apple' },
    { id: 'banana', label: 'Banana' },
    { id: 'blueberry', label: 'Blueberry' },
    { id: 'cherry', label: 'Cherry', sensitive: false },
    { id: 'date', label: 'Date' },
];

// Shows a combo box in a main window, as `globalThis.widget`.
async function mount(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { ComboBox } = await import('/src/widgets/combo-box.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');

        const host = document.createElement('div');
        host.style.cssText =
            'position: absolute; inset: 0 auto auto 0; width: 600px; height: 500px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({ orientation: 'vertical', spacing: 8, margin: 20, vAlign: 'start' });
        const widget = new ComboBox({ hAlign: 'start', ...properties });

        box.addChild(widget);
        box.addChild(new LineEdit({ name: 'next' }));
        window.addChild(box);
        window.show();

        globalThis.widget = widget;
        globalThis.changes = [];
        widget.connect('change', () => globalThis.changes.push(widget.activeIndex));
    }, properties);
}

const active = (page) =>
    page.evaluate(() => ({
        index: globalThis.widget.activeIndex,
        id: globalThis.widget.activeId,
        text: globalThis.widget.text,
        open: globalThis.widget.popupOpen,
    }));

test.describe('ComboBox', () => {
    test('the active item can be given before the items', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { ComboBox } = await import('/src/widgets/combo-box.js');
            const { Builder } = await import('/src/construction/builder.js');

            const items = [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
            ];
            const [built] = new Builder().build({ type: 'combo-box', 'active-id': 'b', items });

            return [
                new ComboBox({ activeIndex: 1, items }).activeIndex,
                new ComboBox({ activeId: 'b', items }).activeIndex,
                new ComboBox({ text: 'B', items }).activeIndex,
                new ComboBox({ text: 'B', hasEntry: true, items }).activeIndex,
                built.activeId,
            ];
        });

        expect(result).toEqual([1, 1, 1, 1, 'b']);
    });

    test('has items with an active index and id', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page, { items: FRUITS, activeId: 'banana' });

        const result = await page.evaluate(() => {
            const widget = globalThis.widget;
            const signals = [];
            widget.connect('active-id-change', () => signals.push('id'));
            widget.connect('active-index-change', () => signals.push('index'));

            const states = [widget.activeIndex, 'active' in widget, widget.text];

            widget.activeIndex = 4;
            states.push(widget.activeId, widget.el.querySelector('.wy-combo-box-text').textContent);

            widget.activeId = null;
            states.push(widget.activeIndex, widget.text);

            const errors = [];
            for (const action of [
                () => (widget.activeIndex = 7),
                () => (widget.activeId = 'kiwi'),
            ]) {
                try {
                    action();
                } catch (e) {
                    errors.push(e.name);
                }
            }

            return { states, signals, changes: globalThis.changes, errors };
        });

        expect(errors).toEqual([]);
        expect(result).toEqual({
            states: [1, false, 'Banana', 'date', 'Date', -1, ''],
            signals: ['index', 'id', 'index', 'id'],
            changes: [4, -1],
            errors: ['RangeError', 'Error'],
        });
    });

    test('keeps the active item valid when the items change', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: FRUITS, activeIndex: 2 });

        const result = await page.evaluate(() => {
            const widget = globalThis.widget;
            const states = [];

            widget.prependItem({ id: 'avocado', label: 'Avocado' });
            states.push([widget.activeIndex, widget.activeId]);

            widget.removeItem(0);
            states.push([widget.activeIndex, widget.activeId]);

            widget.items = [...widget.items].reverse();
            states.push([widget.activeIndex, widget.activeId]);

            widget.removeItem(widget.activeIndex);
            states.push([widget.activeIndex, widget.activeId]);

            // Items without ids are matched by label.
            widget.items = ['One', 'Two', 'Three'];
            widget.activeIndex = 1;
            widget.items = ['Zero', 'One', 'Two'];
            states.push([widget.activeIndex, widget.text]);

            widget.removeAllItems();
            states.push([widget.activeIndex, widget.itemsCount]);

            return { states, changes: globalThis.changes };
        });

        expect(result.states).toEqual([
            [3, 'blueberry'],
            [2, 'blueberry'],
            [2, 'blueberry'],
            [-1, null],
            [2, 'Two'],
            [-1, 0],
        ]);
        expect(result.changes).toEqual([-1, 1, -1]);
    });

    test('the keyboard changes the active item while closed', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: FRUITS, activeIndex: 2 });

        await page.focus('.wy-combo-box');
        await page.keyboard.press('ArrowDown');
        expect((await active(page)).index).toBe(4);

        await page.keyboard.press('ArrowDown');
        expect((await active(page)).index).toBe(4);

        await page.keyboard.press('Home');
        expect((await active(page)).index).toBe(0);

        await page.keyboard.press('End');
        await page.keyboard.press('ArrowUp');
        expect((await active(page)).index).toBe(2);

        // Type-ahead: "b" cycles through the items starting with it, "ba" finds Banana.
        await page.keyboard.press('b');
        expect((await active(page)).index).toBe(1);

        await page.keyboard.press('b');
        expect((await active(page)).index).toBe(2);

        await page.waitForTimeout(1100);
        await page.keyboard.type('da');
        expect((await active(page)).id).toBe('date');

        const changes = await page.evaluate(() => globalThis.changes);
        expect(changes).toEqual([4, 0, 4, 2, 1, 2, 4]);
    });

    test('a click opens the list with the active item selected', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: FRUITS, activeIndex: 1 });

        await page.click('.wy-combo-box');

        const open = await page.evaluate(() => {
            const widget = globalThis.widget;
            const list = document.querySelector('.wy-combo-box-list');
            const options = [...list.querySelectorAll('[role="option"]')];
            const popover = list.closest('.wy-popover');

            return {
                open: widget.popupOpen,
                focused: widget.hasFocus,
                expanded: widget.el.getAttribute('aria-expanded'),
                selected: options.map((x) => x.getAttribute('aria-selected')),
                highlighted: options.findIndex((x) => x.classList.contains('wy-highlighted')),
                activeDescendant: widget.el.getAttribute('aria-activedescendant') === options[1].id,
                inLayer: popover.parentElement.classList.contains('wy-screen'),
                below:
                    popover.getBoundingClientRect().top >= widget.el.getBoundingClientRect().bottom,
                wideEnough: popover.offsetWidth >= widget.el.offsetWidth,
            };
        });

        expect(open).toEqual({
            open: true,
            focused: true,
            expanded: 'true',
            selected: ['false', 'true', 'false', 'false', 'false'],
            highlighted: 1,
            activeDescendant: true,
            inLayer: true,
            below: true,
            wideEnough: true,
        });

        // Insensitive items cannot be chosen.
        await page.click('.wy-combo-box-item >> text=Cherry', { force: true });
        expect(await active(page)).toMatchObject({ index: 1, open: true });

        await page.click('.wy-combo-box-item >> text=Date');
        expect(await active(page)).toEqual({ index: 4, id: 'date', text: 'Date', open: false });

        const focused = await page.evaluate(() => globalThis.widget.hasFocus);
        expect(focused).toBe(true);

        // A second click toggles the list closed again.
        await page.click('.wy-combo-box');
        await page.click('.wy-combo-box');
        expect((await active(page)).open).toBe(false);
    });

    test('the keyboard navigates the open list, and Escape closes it', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: FRUITS, activeIndex: 0 });

        await page.focus('.wy-combo-box');
        await page.keyboard.press('Alt+ArrowDown');
        expect((await active(page)).open).toBe(true);

        const highlighted = () =>
            page.evaluate(() =>
                [...document.querySelectorAll('.wy-combo-box-item')].findIndex((x) =>
                    x.classList.contains('wy-highlighted')
                )
            );

        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        expect(await highlighted()).toBe(4);

        // Escape closes without choosing.
        await page.keyboard.press('Escape');
        expect(await active(page)).toMatchObject({ index: 0, open: false });

        await page.keyboard.press('Space');
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowUp');
        expect(await highlighted()).toBe(2);

        await page.keyboard.press('Enter');
        expect(await active(page)).toMatchObject({ index: 2, open: false });

        // Tab chooses the highlighted item and moves the focus on.
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Tab');

        const result = await page.evaluate(() => ({
            index: globalThis.widget.activeIndex,
            open: globalThis.widget.popupOpen,
            focus: globalThis.widget.window.focusWidget.name,
        }));
        expect(result).toEqual({ index: 1, open: false, focus: 'next' });
    });

    test('pressing outside or scrolling closes the list', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: FRUITS, activeIndex: 0 });

        await page.click('.wy-combo-box');
        await page.mouse.click(500, 400);
        expect((await active(page)).open).toBe(false);

        await page.click('.wy-combo-box');
        await page.evaluate(() => {
            const scroller = document.createElement('div');
            scroller.style.cssText =
                'position: absolute; left: 0; top: 460px; width: 50px; height: 20px; overflow: auto;';
            scroller.innerHTML = '<div style="height: 100px"></div>';
            document.body.append(scroller);
            globalThis.scroller = scroller;
        });
        await page.evaluate(() => (globalThis.scroller.scrollTop = 30));
        await expect.poll(async () => (await active(page)).open).toBe(false);

        // Dragging from the combo box and releasing over an item chooses it.
        const box = await page.locator('.wy-combo-box').boundingBox();
        await page.mouse.move(box.x + 10, box.y + 10);
        await page.mouse.down();

        const item = await page.locator('.wy-combo-box-item >> text=Blueberry').boundingBox();
        await page.mouse.move(item.x + 10, item.y + item.height / 2, { steps: 5 });
        await page.mouse.up();

        expect(await active(page)).toMatchObject({ index: 2, open: false });
    });

    test('an entry accepts any text and matches items', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: ['Red', 'Green', 'Blue'], hasEntry: true, activeIndex: 0 });

        const entry = page.locator('.wy-combo-box-entry');
        expect(await entry.inputValue()).toBe('Red');

        await entry.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.type('Purple');
        expect(await active(page)).toMatchObject({ index: -1, text: 'Purple' });

        await page.keyboard.press('Control+A');
        await page.keyboard.type('Blue');
        expect(await active(page)).toMatchObject({ index: 2, text: 'Blue' });

        await page.keyboard.press('ArrowUp');
        expect(await active(page)).toMatchObject({ index: 1, text: 'Green' });
        expect(await entry.inputValue()).toBe('Green');

        await page.click('.wy-combo-box-button');
        await page.click('.wy-combo-box-item >> text=Red');

        const result = await page.evaluate(() => ({
            text: globalThis.widget.text,
            focused: document.activeElement === globalThis.widget.focusElement,
            role: globalThis.widget.focusElement.getAttribute('role'),
        }));
        expect(result).toEqual({ text: 'Red', focused: true, role: 'combobox' });
    });

    test('the text of an entry follows the active item set from code', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: ['Red', 'Green', 'Blue'], hasEntry: true, activeIndex: 0 });

        const result = await page.evaluate(() => {
            const widget = globalThis.widget;
            const texts = [];
            widget.connect('text-change', () => texts.push(widget.text));

            const states = [widget.text];

            widget.activeIndex = 2;
            states.push(widget.text);

            widget.text = 'Purple';
            widget.hasEntry = false;
            widget.activeIndex = 1;
            widget.hasEntry = true;
            states.push(widget.text, widget.focusElement.value);

            return { states, texts };
        });

        expect(result).toEqual({
            states: ['Red', 'Blue', 'Green', 'Green'],
            texts: ['Blue', 'Purple', 'Green'],
        });
    });

    test('keeps the focus when the entry is added or removed', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: ['Red', 'Green', 'Blue'], activeIndex: 0 });

        const focus = () =>
            page.evaluate(() => [
                document.activeElement === globalThis.widget.focusElement,
                globalThis.widget.hasFocus,
            ]);

        await page.evaluate(() => globalThis.widget.focus());
        await page.evaluate(() => (globalThis.widget.hasEntry = true));
        const withEntry = await focus();

        await page.evaluate(() => (globalThis.widget.hasEntry = false));
        const withoutEntry = await focus();

        await page.keyboard.press('Tab');
        const next = await page.evaluate(
            () => document.activeElement.closest('.wy-line-edit') !== null
        );

        expect([withEntry, withoutEntry, next]).toEqual([[true, true], [true, true], true]);
    });

    test('items can come from a model', async ({ page }) => {
        await openHarness(page);
        await mount(page);

        const result = await page.evaluate(async () => {
            const { Instance } = await import('/src/core/instance.js');

            // A minimal model with the interface of the original list model.
            class Model extends Instance {
                _initialize() {
                    super._initialize();

                    this.rows = [
                        { key: 1, name: 'One' },
                        { key: 2, name: 'Two' },
                    ];
                    this.idColumn = 'key';
                }
            }

            const model = new Model();
            const widget = globalThis.widget;

            widget.set({ model, column: 'name' });
            widget.activeId = 2;
            const states = [widget.itemsCount, widget.text];

            model.rows = [
                { key: 2, name: 'Two' },
                { key: 3, name: 'Three' },
            ];
            model.emit('rows-change', model);
            states.push(widget.activeIndex, widget.activeId);

            let error = null;
            try {
                widget.appendItem('Four');
            } catch (e) {
                error = e.message;
            }
            states.push(Boolean(error));

            widget.sensitive = false;
            widget.popup();
            states.push(widget.popupOpen);

            return states;
        });

        expect(result).toEqual([2, 'Two', 0, 2, true, false]);
    });

    test('popup(), popdown() and togglePopup() open and close the list', async ({ page }) => {
        await openHarness(page);
        await mount(page, { items: FRUITS });

        const states = await page.evaluate(() => {
            const widget = globalThis.widget;
            const states = [];
            widget.connect('popup-open-change', () => states.push(widget.popupOpen));

            widget.popup();
            widget.popdown();
            widget.togglePopup();
            widget.togglePopup();

            return states;
        });

        expect(states).toEqual([true, false, true, false]);
    });
});
