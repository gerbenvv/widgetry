// Runs the examples of the README, so they keep working.
import { expect, test } from '@playwright/test';

import { openHarness } from './helpers.js';

test.describe('README examples', () => {
    test('the quick start shows a window with a button that opens an alert', async ({ page }) => {
        const errors = await openHarness(page);

        await page.evaluate(async () => {
            const { Box, Button, Label, MainWindow, Orientation, alert } =
                await import('/src/index.js');

            const window = new MainWindow({ title: 'Hello' });
            const box = new Box({ orientation: Orientation.VERTICAL, spacing: 6, margin: 12 });

            const button = new Button({
                label: '_Say hello',
                useUnderline: true,
                hAlign: 'center',
            });
            button.connect('activate', () => alert('Hello, world!'));

            box.addChild(new Label({ text: 'Widgetry says:' }));
            box.addChild(button);

            window.addChild(box);
            window.show();
        });

        await page.click('text=Say hello');
        await expect(page.locator('.wy-window', { hasText: 'Hello, world!' })).toBeVisible();

        await page.keyboard.press('Enter');
        await expect(page.locator('.wy-window')).toHaveCount(0);
        expect(await page.title()).toBe('Hello');
        expect(errors).toEqual([]);
    });

    test('the concept examples work', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const w = await import('/src/index.js');
            const log = [];

            const main = new w.MainWindow();
            const layout = new w.Box({ orientation: 'vertical' });
            main.addChild(layout);
            main.show();

            // Properties and signals.
            const check = new w.CheckBox({ label: 'Remember me', active: true });
            check.connect('active-change', () => log.push(`active:${check.active}`));
            check.active = false;
            layout.addChild(check);

            // Layout.
            const row = new w.Box({ spacing: 6 });
            row.addChild(new w.Label({ text: 'Name:' }));
            row.addChild(new w.LineEdit({ hExpand: true }));
            row.addChild(new w.Button({ label: 'Save' }));
            layout.addChild(row);

            // Menus.
            const menu = new w.Menu();
            const save = new w.MenuItem({
                label: '_Save',
                icon: 'document-save',
                accelerator: 'Ctrl+S',
            });
            save.connect('activate', () => log.push('save'));
            menu.addChild(save);

            const menuBar = new w.MenuBar();
            menuBar.addChild(new w.MenuItem({ label: '_File', submenu: menu }));
            layout.prependChild(menuBar);

            // Tables.
            const rows = [
                { id: 1, name: 'b.txt', size: 20, modified: new Date(2026, 0, 2), starred: false },
                { id: 2, name: 'a.txt', size: 10, modified: new Date(2026, 0, 1), starred: true },
            ];
            const model = new w.ListModel({ rows, idColumn: 'id', sortColumn: 'name' });
            const table = new w.Table({
                model,
                selectionMode: w.SelectionMode.MULTIPLE,
                vExpand: true,
            });

            table.addColumn(new w.TextColumn({ name: 'name', label: 'Name', expand: true }));
            table.addColumn(new w.NumberColumn({ name: 'size', label: 'Size', digits: 0 }));
            table.addColumn(
                new w.DateColumn({ name: 'modified', label: 'Modified', format: 'date' })
            );
            table.addColumn(
                new w.CheckBoxColumn({ name: 'starred', label: 'Starred', editable: true })
            );
            table.connect('row-activate', (_table, index) =>
                log.push(`open:${model.getRow(index).name}`)
            );
            layout.addChild(table);

            // Events.
            row.events = w.Events.BUTTON_PRESS | w.Events.MOTION;
            row.connect('button-press-event', (_widget, event) => log.push(`press:${event.count}`));

            // Theming.
            w.Application.theme = 'dark';
            w.Application.accentColor = '#4e9a06';

            globalThis.readme = { log, table, model };

            return {
                theme: document.documentElement.dataset.wyTheme,
                accent: document.documentElement.style.getPropertyValue('--wy-accent'),
                first: model.getRow(0).name,
            };
        });

        expect(result).toEqual({ theme: 'dark', accent: '#4e9a06', first: 'a.txt' });

        // The accelerator works anywhere in the window.
        await page.keyboard.press('Control+s');

        // Double clicking a row activates it.
        await page.locator('.wy-table-row', { hasText: 'a.txt' }).dblclick();

        await page.click('text=Name:');

        const log = await page.evaluate(() => globalThis.readme.log);
        expect(log).toEqual(['active:false', 'save', 'open:a.txt', 'press:1']);
        expect(errors).toEqual([]);
    });

    test('the tree example shows a filtered tree that loads lazily', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow, SearchFilter, SelectionMode, Table, TextColumn, TreeModel } =
                await import('/src/index.js');

            const opened = [];
            const loadFolder = async (id) => [{ id: id * 10, name: 'guide.md' }];
            const openFile = (row) => opened.push(row.name);

            const model = new TreeModel({
                rows: [
                    { id: 1, name: 'src', children: [{ id: 2, name: 'index.js' }] },
                    { id: 3, name: 'docs', hasChildren: true },
                ],
                idColumn: 'id',
                sortColumn: 'name',
                loadChildren: (row) => loadFolder(row.id),
            });
            const tree = new Table({ model, selectionMode: SelectionMode.MULTIPLE });

            tree.addColumn(new TextColumn({ name: 'name', label: 'Name', expand: true }));
            tree.connect('row-activate', (_table, _index, row) => openFile(row));

            model.expand(model.getRowById(1));
            const expanded = model.rows.map((x) => x.name);

            model.addFilter(new SearchFilter({ columns: ['name'], query: 'index' }));
            const filtered = model.rows.map((x) => x.name);

            model.removeAllFilters();
            model.expand(model.getRowById(3));
            await Promise.resolve();

            const window = new MainWindow();
            window.addChild(tree);
            window.show();

            tree.activateRow(0);

            return { expanded, filtered, loaded: model.rows.map((x) => x.name), opened };
        });

        expect(result).toEqual({
            expanded: ['docs', 'src', 'index.js'],
            filtered: ['src', 'index.js'],
            loaded: ['docs', 'guide.md', 'src', 'index.js'],
            opened: ['docs'],
        });

        await expect(
            page.locator('.wy-table[role="treegrid"] .wy-table-body > .wy-table-row')
        ).toHaveCount(4);
        expect(errors).toEqual([]);
    });

    test('the dialog example resolves with the response', async ({ page }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { Dialog, Label, Response } = await import('/src/index.js');

            const dialog = new Dialog({ title: 'Delete file?', modal: true });
            dialog.addChild(new Label({ text: 'The file will be deleted permanently.' }));
            dialog.addButton(Response.CANCEL);
            dialog.addButton(Response.OK, '_Delete');

            globalThis.response = dialog.run();
        });

        await page.click('.wy-window .wy-button:has-text("Delete")');

        expect(await page.evaluate(() => globalThis.response)).toBe('ok');
    });

    test('the builder example builds a working window', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/index.js');

            const [window] = new Builder().build({
                type: 'window',
                title: 'Settings',
                child: {
                    type: 'box',
                    orientation: 'vertical',
                    spacing: 6,
                    children: [
                        { type: 'check-box', label: 'Enable sounds', active: true },
                        {
                            type: 'button',
                            label: 'Close',
                            handlers: { activate: () => window.close() },
                        },
                    ],
                },
            });

            window.show();
            globalThis.settingsWindow = window;

            return window.child.children.map((x) => x.constructor.name);
        });

        expect(result).toEqual(['CheckBox', 'Button']);

        await page.click('.wy-window >> text=Close');
        expect(await page.evaluate(() => globalThis.settingsWindow.destroyed)).toBe(true);
    });

    test('the classic script build defines the global widgetry', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error));

        await page.goto('/tests/harness.html');
        await page.addScriptTag({ url: '/dist/widgetry.min.js' });

        const title = await page.evaluate(() => {
            const window = new widgetry.MainWindow({ title: 'Hello' });
            window.addChild(new widgetry.Label({ text: 'Hello, world!' }));
            window.show();

            return document.title;
        });

        expect(title).toBe('Hello');
        await expect(page.locator('.wy-label', { hasText: 'Hello, world!' })).toBeVisible();
        expect(errors).toEqual([]);
    });

    test('the list example binds a list box to a model', async ({ page }) => {
        const errors = await openHarness(page);

        await page.evaluate(async () => {
            const { Box, Label, ListBox, ListModel, MainWindow, SelectionMode, Switch } =
                await import('/src/index.js');

            const opened = [];
            const openSetting = (row) => opened.push(row.name);

            const model = new ListModel({ rows: [{ name: 'Wi-Fi' }, { name: 'Bluetooth' }] });
            const list = new ListBox({ selectionMode: SelectionMode.BROWSE });

            list.bindModel(model, (row) => {
                const box = new Box({ spacing: 6, margin: 6 });
                box.addChild(new Label({ text: row.name, hExpand: true }));
                box.addChild(new Switch({ active: true }));

                return box;
            });
            list.connect('row-activate', (_list, row) => openSetting(model.getRow(row.index)));

            const window = new MainWindow();
            window.addChild(list);
            window.show();

            globalThis.readme = { model, opened };
        });

        await expect(page.locator('.wy-list-box-row')).toHaveCount(2);
        await page.locator('.wy-list-box-row', { hasText: 'Bluetooth' }).click();

        // The list follows the model.
        await page.evaluate(() => globalThis.readme.model.appendRow({ name: 'Sound' }));
        await expect(page.locator('.wy-list-box-row')).toHaveCount(3);

        expect(await page.evaluate(() => globalThis.readme.opened)).toEqual(['Bluetooth']);
        expect(errors).toEqual([]);
    });

    test('the color button example sets the accent color', async ({ page }) => {
        const errors = await openHarness(page);

        await page.evaluate(async () => {
            const { Application, ColorButton, MainWindow } = await import('/src/index.js');

            const button = new ColorButton({ color: '#4e9a06' });
            button.connect('color-set', () => (Application.accentColor = button.color));

            const window = new MainWindow();
            window.addChild(button);
            window.show();

            globalThis.button = button;
        });

        await page.click('.wy-color-button');
        const swatch = await page.evaluate(() => {
            const rect = globalThis.button.chooser.palette.el.children[13].getBoundingClientRect();

            return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
        });
        await page.mouse.dblclick(swatch.x, swatch.y);

        const accent = await page.evaluate(async () => {
            const { Application } = await import('/src/index.js');

            return Application.accentColor;
        });

        expect(accent).toBe('#3465a4');
        expect(errors).toEqual([]);
    });

    test('the smaller examples work', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const w = await import('/src/index.js');

            // Embedding in a host element.
            const host = document.createElement('div');
            host.id = 'app';
            host.style.cssText = 'width: 300px; height: 200px';
            document.body.append(host);

            const window = new w.MainWindow({ host: document.querySelector('#app') });
            const label = new w.Label({ text: 'Embedded' });
            window.addChild(label);
            window.show();

            // A context menu and icons.
            const menu = new w.Menu();
            menu.addChild(new w.MenuItem({ label: 'Copy', icon: 'edit-copy' }));
            w.attachContextMenu(label, menu);

            w.registerIcon(
                'my-icon',
                '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>'
            );

            // Filtering a model.
            const model = new w.ListModel({ rows: [{ name: 'apple' }, { name: 'pear' }] });
            const filtered = new w.FilteredListModel({ model });
            filtered.addFilter(new w.SearchFilter({ columns: ['name'], query: 'pe' }));

            return {
                inHost: host.contains(window.el),
                icons: ['document-open', 'edit-copy', 'my-icon'].every((x) =>
                    w.getIconNames().includes(x)
                ),
                filtered: filtered.rows.map((x) => x.name),
            };
        });

        expect(result).toEqual({ inHost: true, icons: true, filtered: ['pear'] });

        await page.click('text=Embedded', { button: 'right' });
        await expect(page.locator('.wy-menu', { hasText: 'Copy' })).toBeVisible();
        expect(errors).toEqual([]);
    });
});
