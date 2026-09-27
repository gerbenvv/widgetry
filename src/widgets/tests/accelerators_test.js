// Browser tests of accelerator and mnemonic parsing, formatting and matching, and of the
// accelerator group of a window.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('accelerators', () => {
    test('accelerators are parsed, formatted and matched', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { formatAccelerator, matchesAccelerator, parseAccelerator, toAriaKeyShortcuts } =
                await import('/src/widgets/accelerators.js');

            const key = (key, options = {}) => new KeyboardEvent('keydown', { key, ...options });
            const undo = parseAccelerator('Ctrl+Shift+Z');
            const plus = parseAccelerator('Ctrl++');
            const errors = [];
            for (const text of ['', 'Ctrl+', 'Hyper+A']) {
                try {
                    parseAccelerator(text);
                } catch (error) {
                    errors.push(error.message);
                }
            }

            return {
                undo,
                plus: plus.key,
                f5: parseAccelerator('f5').key,
                escape: parseAccelerator('Esc').key,
                formatted: formatAccelerator(undo, { mac: false }),
                mac: formatAccelerator(undo, { mac: true }),
                delete: formatAccelerator('Delete', { mac: false }),
                aria: toAriaKeyShortcuts('Ctrl+Plus'),
                matches: matchesAccelerator(undo, key('Z', { ctrlKey: true, shiftKey: true })),
                layout: matchesAccelerator(
                    undo,
                    key('y', { ctrlKey: true, shiftKey: true, code: 'KeyZ' })
                ),
                noShift: matchesAccelerator(undo, key('z', { ctrlKey: true })),
                shiftedPlus: matchesAccelerator(plus, key('+', { ctrlKey: true, shiftKey: true })),
                errors: errors.length,
            };
        });

        expect(result).toEqual({
            undo: { key: 'z', ctrl: true, shift: true, alt: false, meta: false },
            plus: '+',
            f5: 'F5',
            escape: 'Escape',
            formatted: 'Ctrl+Shift+Z',
            mac: '⌃⇧Z',
            delete: 'Delete',
            aria: 'Control+Plus',
            matches: true,
            layout: true,
            noShift: false,
            shiftedPlus: true,
            errors: 3,
        });
    });

    test('mnemonics are parsed from underscores', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { parseMnemonic } = await import('/src/widgets/accelerators.js');

            return [
                parseMnemonic('_File'),
                parseMnemonic('Save _As'),
                parseMnemonic('snake__case _x'),
                parseMnemonic('_File', false),
            ];
        });

        expect(result).toEqual([
            { text: 'File', mnemonic: 'f', index: 0 },
            { text: 'Save As', mnemonic: 'a', index: 5 },
            { text: 'snake_case x', mnemonic: 'x', index: 11 },
            { text: '_File', mnemonic: '', index: -1 },
        ]);
    });

    test('a window accelerator group runs handlers but leaves editing keys to entries', async ({
        page,
    }) => {
        await openHarness(page);

        await page.evaluate(async () => {
            const { getAcceleratorGroup } = await import('/src/widgets/accelerators.js');
            const { MainWindow } = await import('/src/widgets/main-window.js');

            const window = new MainWindow();
            window.show();

            const input = document.createElement('input');
            window.el.append(input);

            globalThis.log = [];
            const group = getAcceleratorGroup(window);
            group.add('Ctrl+K', () => globalThis.log.push('k'));
            group.add('Ctrl+C', () => globalThis.log.push('c'));
            globalThis.remove = group.add('Ctrl+J', () => globalThis.log.push('j'));
            globalThis.input = input;
        });

        await page.keyboard.press('Control+k');
        await page.keyboard.press('Control+c');
        await page.evaluate(() => globalThis.remove());
        await page.keyboard.press('Control+j');

        await page.focus('input');
        await page.keyboard.press('Control+c');
        await page.keyboard.press('Control+k');

        expect(await page.evaluate(() => globalThis.log)).toEqual(['k', 'c', 'k']);
    });
});
