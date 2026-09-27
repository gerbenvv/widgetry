// Browser tests of the LineEdit widget.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a line edit in a main window, as `globalThis.widget`.
async function mount(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { LineEdit } = await import('/src/widgets/line-edit.js');

        const host = document.createElement('div');
        host.style.cssText =
            'position: absolute; inset: 0 auto auto 0; width: 600px; height: 300px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({ orientation: 'vertical', spacing: 8, margin: 20 });
        const widget = new LineEdit(properties);
        const other = new LineEdit({ name: 'other' });

        box.addChild(widget);
        box.addChild(other);
        window.addChild(box);
        window.show();

        globalThis.widget = widget;
        globalThis.other = other;
        globalThis.events = [];

        for (const name of ['change', 'text-change', 'activate', 'is-valid-change']) {
            widget.connect(name, () => globalThis.events.push(name));
        }
    }, properties);
}

test.describe('LineEdit', () => {
    test('typing changes the text and Enter activates', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page);

        await page.click('.wy-line-edit-input >> nth=0');
        await page.keyboard.type('Hello');
        await page.keyboard.press('Enter');

        const result = await page.evaluate(() => ({
            text: globalThis.widget.text,
            hasFocus: globalThis.widget.hasFocus,
            changes: globalThis.events.filter((x) => x === 'change').length,
            textChanges: globalThis.events.filter((x) => x === 'text-change').length,
            activated: globalThis.events.includes('activate'),
            registered: Boolean(globalThis.widget.constructor.name === 'LineEdit'),
        }));

        expect(errors).toEqual([]);
        expect(result).toEqual({
            text: 'Hello',
            hasFocus: true,
            changes: 5,
            textChanges: 5,
            activated: true,
            registered: true,
        });

        const type = await page.evaluate(async () => {
            const { getType } = await import('/src/core/registry.js');

            return getType('line-edit')?.cls.name;
        });
        expect(type).toBe('LineEdit');
    });

    test('setting the text keeps the focus and the selection', async ({ page }) => {
        await openHarness(page);
        await mount(page, { text: 'Hello world' });

        await page.click('.wy-line-edit-input >> nth=0');

        const result = await page.evaluate(() => {
            const widget = globalThis.widget;
            const input = widget.focusElement;
            const states = [];

            // A cursor at the end stays at the end.
            widget.cursorPosition = 11;
            widget.text = 'Hello world, again';
            states.push([
                input.selectionStart,
                input.selectionEnd,
                document.activeElement === input,
            ]);

            // A selection is kept, and clamped to the new text.
            widget.selectRegion(6, 11);
            states.push(widget.getSelectedText());
            widget.text = 'Hello there';
            states.push([input.selectionStart, input.selectionEnd, widget.hasFocus]);

            widget.selectRegion(8, 2);
            states.push([input.selectionStart, input.selectionEnd, input.selectionDirection]);

            widget.selectAll();
            states.push(widget.getSelectionBounds());

            // Inserting and deleting text.
            widget.cursorPosition = 5;
            states.push(widget.insertText(','));
            widget.deleteText(0, 7);
            states.push(widget.text);

            return states;
        });

        expect(result).toEqual([
            [18, 18, true],
            'world',
            [6, 11, true],
            [2, 8, 'backward'],
            { start: 0, end: 11 },
            6,
            'there',
        ]);
    });

    test('limits the length and hides the text in password mode', async ({ page }) => {
        await openHarness(page);
        await mount(page, { maxLength: 5 });

        await page.click('.wy-line-edit-input >> nth=0');
        await page.keyboard.type('abcdefgh');

        const result = await page.evaluate(() => {
            const widget = globalThis.widget;
            const input = widget.focusElement;
            const states = [widget.text];

            widget.text = '123456789';
            states.push(widget.text);

            widget.maxLength = 3;
            states.push(widget.text);

            // Switching to password mode keeps the element, the focus and the selection.
            widget.maxLength = 0;
            widget.text = 'secret';
            widget.selectRegion(1, 4);
            widget.visibility = false;
            states.push([input.type, document.activeElement === input, widget.getSelectedText()]);

            widget.visibility = true;
            states.push(input.type);

            return states;
        });

        expect(result).toEqual(['abcde', '12345', '123', ['password', true, 'ecr'], 'text']);
    });

    test('a non-editable or insensitive line edit cannot be changed', async ({ page }) => {
        await openHarness(page);
        await mount(page, { text: 'fixed', editable: false });

        await page.click('.wy-line-edit-input >> nth=0');
        await page.keyboard.type('xyz');

        const readOnly = await page.evaluate(() => {
            const widget = globalThis.widget;

            return {
                text: widget.text,
                focused: widget.hasFocus,
                isEditable: widget.isEditable,
                styled: widget.el.classList.contains('wy-read-only'),
                aria: widget.focusElement.getAttribute('aria-readonly'),
            };
        });

        expect(readOnly).toEqual({
            text: 'fixed',
            focused: true,
            isEditable: false,
            styled: true,
            aria: 'true',
        });

        const insensitive = await page.evaluate(() => {
            const widget = globalThis.widget;
            const changes = [];
            widget.connect('is-editable-change', () => changes.push(widget.isEditable));

            widget.editable = true;
            const editable = widget.isEditable;

            widget.sensitive = false;
            const states = [widget.isEditable, widget.focusElement.readOnly, widget.el.inert];

            widget.sensitive = true;

            return { editable, states, after: widget.isEditable, changes };
        });

        expect(insensitive).toEqual({
            editable: true,
            states: [false, true, true],
            after: true,
            changes: [true, false, true],
        });
    });

    test('validates the text and fixes it up on activation', async ({ page }) => {
        await openHarness(page);
        await mount(page);

        await page.evaluate(() => {
            globalThis.widget.validator = {
                validate: (text) => /^\d*$/.test(text),
                fixup: (text) => text.replace(/\D/g, ''),
            };
        });

        await page.click('.wy-line-edit-input >> nth=0');
        await page.keyboard.type('12a');

        const invalid = await page.evaluate(() => ({
            isValid: globalThis.widget.isValid,
            value: globalThis.widget.value,
            styled: globalThis.widget.el.classList.contains('wy-invalid'),
            aria: globalThis.widget.focusElement.getAttribute('aria-invalid'),
        }));

        expect(invalid).toEqual({ isValid: false, value: null, styled: true, aria: 'true' });

        await page.keyboard.press('Enter');

        const fixed = await page.evaluate(() => ({
            text: globalThis.widget.text,
            isValid: globalThis.widget.isValid,
            value: globalThis.widget.value,
            styled: globalThis.widget.el.classList.contains('wy-invalid'),
            validChanges: globalThis.events.filter((x) => x === 'is-valid-change').length,
        }));

        expect(fixed).toEqual({
            text: '12',
            isValid: true,
            value: '12',
            styled: false,
            validChanges: 2,
        });

        const other = await page.evaluate(() => {
            const widget = globalThis.widget;
            widget.validator = (text) => text.length <= 3;
            widget.text = 'long text';

            let error = null;
            try {
                widget.validator = 42;
            } catch (e) {
                error = e.name;
            }

            return [widget.isValid, error];
        });

        expect(other).toEqual([false, 'TypeError']);
    });

    test('icons emit icon-press, for example to clear the text', async ({ page }) => {
        await openHarness(page);
        await mount(page, {
            text: 'search terms',
            primaryIcon: 'edit-find',
            primaryIconActivatable: false,
            secondaryIcon: 'edit-clear',
            secondaryIconTooltip: 'Clear',
        });

        await page.evaluate(() => {
            globalThis.presses = [];
            globalThis.widget.connect('icon-press', (widget, position) => {
                globalThis.presses.push(position);

                if (position === 'secondary') {
                    widget.text = '';
                }
            });
        });

        const icons = await page.evaluate(() => {
            const el = globalThis.widget.el;

            return {
                primary: Boolean(el.querySelector('.wy-primary svg')),
                secondary: Boolean(el.querySelector('.wy-secondary svg')),
                label: el.querySelector('.wy-secondary').getAttribute('aria-label'),
                role: el.querySelector('.wy-secondary').getAttribute('role'),
            };
        });

        expect(icons).toEqual({ primary: true, secondary: true, label: 'Clear', role: 'button' });

        await page.click('.wy-line-edit >> nth=0 >> .wy-primary');
        await page.click('.wy-line-edit >> nth=0 >> .wy-secondary');

        const result = await page.evaluate(() => [globalThis.presses, globalThis.widget.text]);
        expect(result).toEqual([['secondary'], '']);

        const hidden = await page.evaluate(() => {
            globalThis.widget.secondaryIcon = '';

            return globalThis.widget.el.querySelector('.wy-secondary').hidden;
        });
        expect(hidden).toBe(true);
    });

    test('aligns the text and sizes itself in characters', async ({ page }) => {
        await openHarness(page);
        await mount(page, { hAlign: 'start', placeholder: 'Name' });

        const result = await page.evaluate(async () => {
            const { flushLayout } = await import('/src/widgets/widget.js');
            const widget = globalThis.widget;
            const input = widget.focusElement;

            flushLayout();
            const defaultWidth = widget.allocation.width;

            widget.widthChars = 40;
            const wideWidth = widget.allocation.width;

            widget.alignment = 'center';
            const center = [input.style.textAlign, widget.xAlign];

            widget.xAlign = 1;
            const end = [input.style.textAlign, widget.alignment];

            let error = null;
            try {
                widget.alignment = 'middle';
            } catch (e) {
                error = e.name;
            }

            return { defaultWidth, wideWidth, center, end, error, placeholder: input.placeholder };
        });

        expect(result.defaultWidth).toBeGreaterThan(140);
        expect(result.wideWidth).toBeGreaterThan(result.defaultWidth + 100);
        expect(result.center).toEqual(['center', 0.5]);
        expect(result.end).toEqual(['end', 'end']);
        expect(result.error).toBe('RangeError');
        expect(result.placeholder).toBe('Name');
    });

    test('Tab moves the focus between line edits', async ({ page }) => {
        await openHarness(page);
        await mount(page);

        await page.click('.wy-line-edit-input >> nth=0');
        await page.keyboard.press('Tab');

        const focused = await page.evaluate(() => [
            globalThis.other.hasFocus,
            globalThis.widget.hasFocus,
            globalThis.other.el.classList.contains('wy-focus'),
        ]);
        expect(focused).toEqual([true, false, true]);
    });
});
