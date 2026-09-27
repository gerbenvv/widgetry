// Builds one object of every registered type with the builder, with the builder properties
// (hooks) of the types that have them, and shows the result.
import { expect, test } from '@playwright/test';

import { openHarness } from './helpers.js';

test('the builder builds every registered type', async ({ page }) => {
    const errors = await openHarness(page);
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });

    const result = await page.evaluate(async () => {
        const w = await import('/src/index.js');

        const builder = new w.Builder({ scope: { onActivate() {} } });
        const rows = [
            { id: 1, name: 'Alpha', size: 3, date: Date.UTC(2013, 7, 10), starred: true },
            { id: 2, name: 'Beta', size: 5, date: Date.UTC(2014, 1, 2), starred: false },
        ];

        builder.build([
            { type: 'list-model', id: 'list-model', rows, idColumn: 'id' },
            {
                type: 'filtered-list-model',
                id: 'filtered-list-model',
                model: { id: 'list-model' },
                filters: [{ type: 'search-filter', id: 'search-filter', columns: ['name'] }],
            },
            {
                type: 'tree-model',
                id: 'tree-model',
                rows: [{ id: 1, name: 'Folder', children: [{ id: 2, name: 'File' }] }],
                idColumn: 'id',
                filters: [
                    {
                        type: 'condition-filter',
                        id: 'condition-filter',
                        columns: ['name'],
                        value: 'F',
                    },
                ],
            },
            { type: 'selection', id: 'selection', model: { id: 'list-model' } },
            { type: 'selection-model', id: 'selection-model', model: { id: 'list-model' } },
            { type: 'adjustment', id: 'adjustment', upper: 100, value: 20 },
            { type: 'matrix', id: 'matrix', m11: 2, m22: 2 },
            { type: 'translated-text', arguments: [] },
            { type: 'integer-validator', id: 'integer-validator', minimum: 0 },
            { type: 'double-validator', id: 'double-validator', digits: 2 },
            { type: 'regexp-validator', id: 'regexp-validator', regexp: '[a-z]+' },
            {
                type: 'menu',
                id: 'menu',
                children: [
                    { type: 'menu-item', id: 'menu-item', label: '_Open' },
                    { type: 'check-menu-item', id: 'check-menu-item', label: 'Check' },
                    { type: 'separator-menu-item', id: 'separator-menu-item' },
                    { type: 'radio-menu-item', id: 'radio-menu-item', label: 'Radio' },
                ],
            },
            {
                type: 'main-window',
                id: 'main-window',
                title: 'Every type',
                child: {
                    type: 'box',
                    id: 'box',
                    orientation: 'vertical',
                    children: [
                        {
                            type: 'menu-bar',
                            id: 'menu-bar',
                            children: [
                                { type: 'menu-item', label: '_File', submenu: { id: 'menu' } },
                            ],
                        },
                        {
                            type: 'tool-bar',
                            id: 'tool-bar',
                            children: [
                                { type: 'tool-item', id: 'tool-item', icon: 'document-open' },
                                { type: 'separator-tool-item', id: 'separator-tool-item' },
                                { type: 'check-tool-item', id: 'check-tool-item', label: 'Bold' },
                                { type: 'radio-tool-item', id: 'radio-tool-item', label: 'Left' },
                            ],
                        },
                        {
                            type: 'info-bar',
                            id: 'info-bar',
                            buttons: [['ok'], { response: 'cancel', label: '_Later' }],
                            children: [{ type: 'label', text: 'An info bar' }],
                        },
                        {
                            type: 'notebook',
                            id: 'notebook',
                            children: [
                                {
                                    type: 'grid',
                                    id: 'grid',
                                    tabLabel: 'Grid',
                                    children: [
                                        {
                                            type: 'label',
                                            id: 'label',
                                            text: 'A',
                                            row: 0,
                                            column: 0,
                                        },
                                        {
                                            type: 'line-edit',
                                            id: 'line-edit',
                                            validator: { id: 'integer-validator' },
                                            row: 0,
                                            column: 1,
                                        },
                                        {
                                            type: 'spin-button',
                                            id: 'spin-button',
                                            row: 1,
                                            column: 0,
                                            columnSpan: 2,
                                        },
                                    ],
                                },
                                {
                                    type: 'fixed',
                                    id: 'fixed',
                                    tabLabel: { type: 'label', text: 'Fixed' },
                                    children: [
                                        { type: 'button', id: 'button', label: 'OK', x: 4, y: 8 },
                                    ],
                                },
                                {
                                    type: 'paned',
                                    id: 'paned',
                                    tabLabel: 'Paned',
                                    children: [
                                        { type: 'text-view', id: 'text-view', resize: true },
                                        { type: 'calendar', id: 'calendar', shrink: true },
                                    ],
                                },
                            ],
                        },
                        {
                            type: 'button-box',
                            id: 'button-box',
                            children: [
                                { type: 'toggle-button', id: 'toggle-button', label: 'Toggle' },
                                { type: 'check-box', id: 'check-box', label: 'Check' },
                                { type: 'radio-button', id: 'radio-button', label: 'One' },
                                { type: 'radio-button', id: 'radio-button-2', label: 'Two' },
                                {
                                    type: 'link-button',
                                    id: 'link-button',
                                    uri: 'https://example.com',
                                },
                                {
                                    type: 'menu-button',
                                    id: 'menu-button',
                                    label: 'Menu',
                                    menu: { type: 'menu', children: [{ type: 'menu-item' }] },
                                },
                                { type: 'color-button', id: 'color-button', color: '#4e9a06' },
                                { type: 'switch', id: 'switch', active: true },
                            ],
                        },
                        {
                            type: 'frame',
                            id: 'frame',
                            label: 'Frame',
                            child: {
                                type: 'expander',
                                id: 'expander',
                                label: 'Expander',
                                expanded: true,
                                child: { type: 'color-chooser', id: 'color-chooser' },
                            },
                        },
                        { type: 'color-swatch', id: 'color-swatch', color: '#3465a4' },
                        { type: 'combo-box', id: 'combo-box' },
                        { type: 'date-edit', id: 'date-edit' },
                        { type: 'slider', id: 'slider', adjustment: { id: 'adjustment' } },
                        { type: 'scroll-bar', id: 'scroll-bar' },
                        { type: 'progress-bar', id: 'progress-bar', fraction: 0.5 },
                        { type: 'throbber', id: 'throbber' },
                        { type: 'spinner', id: 'spinner' },
                        { type: 'image', id: 'image', icon: 'edit-copy' },
                        { type: 'separator', id: 'separator' },
                        { type: 'spacer', id: 'spacer' },
                        {
                            type: 'list-box',
                            id: 'list-box',
                            children: [
                                {
                                    type: 'list-box-row',
                                    id: 'list-box-row',
                                    child: { type: 'label', text: 'Row' },
                                },
                            ],
                        },
                        {
                            type: 'scroll-area',
                            id: 'scroll-area',
                            height: 100,
                            child: {
                                type: 'table',
                                id: 'table',
                                model: { id: 'list-model' },
                                columns: [
                                    { type: 'index-column', id: 'index-column' },
                                    { type: 'text-column', id: 'text-column', name: 'name' },
                                    { type: 'number-column', id: 'number-column', name: 'size' },
                                    { type: 'date-column', id: 'date-column', name: 'date' },
                                    {
                                        type: 'check-box-column',
                                        id: 'check-box-column',
                                        name: 'starred',
                                    },
                                ],
                                handlers: { 'row-activate': 'onActivate' },
                            },
                        },
                        {
                            type: 'vector-canvas',
                            id: 'vector-canvas',
                            height: 60,
                            sprites: [
                                { type: 'rectangle-sprite', id: 'rectangle-sprite' },
                                { type: 'circle-sprite', id: 'circle-sprite', radius: 10 },
                                { type: 'path-sprite', id: 'path-sprite', path: 'M 0 0 L 10 10' },
                                { type: 'label-sprite', id: 'label-sprite', text: 'Label' },
                                { type: 'image-sprite', id: 'image-sprite' },
                            ],
                        },
                        { type: 'resizer', id: 'resizer' },
                        { type: 'status-bar', id: 'status-bar' },
                    ],
                },
            },
            {
                type: 'button-group',
                id: 'button-group',
                buttons: [{ id: 'radio-button' }, { id: 'radio-button-2' }],
            },
            {
                type: 'window',
                id: 'window',
                title: 'Window',
                child: { type: 'label', text: 'In a window' },
            },
            {
                type: 'dialog',
                id: 'dialog',
                title: 'Dialog',
                buttons: ['cancel', ['ok', '_Save']],
                children: [{ type: 'label', text: 'In a dialog' }],
            },
            { type: 'message-dialog', id: 'message-dialog', text: 'A message', buttons: 'ok' },
            { type: 'popover', id: 'popover', child: { type: 'label', text: 'In a popover' } },
            { type: 'tooltip', id: 'tooltip', label: 'A tooltip' },
        ]);

        // Every type needs an object with its name as id, except the ones that cannot have one.
        const withoutId = new Set(['translated-text']);
        const missing = w
            .getTypeNames()
            .filter((name) => !withoutId.has(name) && !builder.hasObject(name));

        const wrongClass = w
            .getTypeNames()
            .filter((name) => builder.hasObject(name))
            .filter((name) => !(builder.getObjectById(name) instanceof w.getType(name).cls));

        builder.getObjectById('main-window').show();
        builder.getObjectById('window').show();
        builder.getObjectById('dialog').show();
        builder.getObjectById('message-dialog').show();
        w.flushLayout();

        const table = builder.getObjectById('table');
        const notebook = builder.getObjectById('notebook');
        const infoBar = builder.getObjectById('info-bar');

        return {
            missing,
            wrongClass,
            groupSize: builder.getObjectById('button-group').buttons.length,
            columns: table.columns.length,
            pages: notebook.pageCount ?? notebook.children?.length,
            sprites: builder.getObjectById('vector-canvas').sprites.length,
            gridChildren: builder.getObjectById('grid').children.length,
            infoBarButtons: [...infoBar.el.querySelectorAll('.wy-button')]
                .map((x) => x.textContent.trim())
                .filter(Boolean),
            filters: builder.getObjectById('filtered-list-model').filters.length,
            validator:
                builder.getObjectById('line-edit').validator ===
                builder.getObjectById('integer-validator'),
        };
    });

    expect(result).toEqual({
        missing: [],
        wrongClass: [],
        groupSize: 2,
        columns: 5,
        pages: 3,
        sprites: 5,
        gridChildren: 3,
        infoBarButtons: ['OK', 'Later'],
        filters: 1,
        validator: true,
    });

    await expect(page.locator('.wy-window', { hasText: 'In a dialog' })).toBeVisible();
    await expect(page.locator('.wy-table')).toBeVisible();

    expect(errors).toEqual([]);
});
