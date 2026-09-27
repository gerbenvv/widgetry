// Browser tests of ColorChooser and the color parsing that needs a browser.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a color chooser (`globalThis.chooser`) and records its signals.
async function mount(page, properties = {}) {
    const errors = await openHarness(page);

    await page.evaluate(async (properties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');
        const { ColorChooser } = await import('/src/widgets/color-chooser.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const window = new MainWindow();
        const box = new Box({ margin: 20, vAlign: 'start', hAlign: 'start' });
        const chooser = new ColorChooser(properties);

        box.addChild(chooser);
        window.addChild(box);
        window.show();
        flushLayout();

        globalThis.chooser = chooser;
        globalThis.changes = [];
        globalThis.activations = [];
        chooser.connect('color-change', () => globalThis.changes.push(chooser.color));
        chooser.connect('color-activate', (_chooser, color) => globalThis.activations.push(color));
    }, properties);

    return errors;
}

// Returns the center of a swatch of the palette.
function swatchCenter(page, index) {
    return page.evaluate((index) => {
        const swatch = globalThis.chooser.palette.el.children[index];
        const rect = swatch.getBoundingClientRect();

        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, index);
}

test.describe('parseColor in the browser', () => {
    test('resolves named colors and other CSS colors', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { normalizeColor, parseColor } = await import('/src/core/color.js');

            document.documentElement.style.setProperty('--test-color', '#3465a4');

            return {
                red: normalizeColor('red'),
                purple: normalizeColor('RebeccaPurple'),
                transparent: normalizeColor('transparent'),
                mixed: normalizeColor('color-mix(in srgb, white 50%, black)'),
                invalid: parseColor('not-a-color'),
                current: parseColor('currentColor') === null,
                contextual: ['inherit', 'unset', 'initial', 'revert', 'var(--no-such-color)'].map(
                    (x) => parseColor(x)
                ),
                variable: normalizeColor('var(--test-color)'),
                leftover: document.documentElement.querySelectorAll(':scope > span').length,
            };
        });

        expect(result.red).toBe('#ff0000');
        expect(result.purple).toBe('#663399');
        expect(result.transparent).toBe('#00000000');
        expect(['#808080', '#7f7f7f']).toContain(result.mixed);
        expect(result.invalid).toBe(null);
        expect(result.leftover).toBe(0);

        // Values that depend on where they are used are not colors of their own.
        expect(result.current).toBe(true);
        expect(result.contextual).toEqual([null, null, null, null, null]);
        expect(result.variable).toBe('#3465a4');
    });
});

test.describe('ColorChooser', () => {
    test('normalizes the color and shows it in all parts', async ({ page }) => {
        const errors = await mount(page, { color: 'rgb(52, 101, 164)' });

        const result = await page.evaluate(() => {
            const chooser = globalThis.chooser;
            const selected = chooser.palette.el.querySelector('.wy-selected');

            return {
                color: chooser.color,
                rgba: chooser.rgba,
                entry: chooser.entry.text,
                selected: selected?.getAttribute('aria-label'),
                selectedCount: chooser.palette.el.querySelectorAll('[aria-selected="true"]').length,
                swatches: chooser.palette.el.children.length,
                alphaVisible: chooser.el.querySelector('.wy-color-chooser-alpha').hidden,
                hue: Math.round(chooser.el.querySelector('.wy-color-chooser-hue').ariaValueNow),
                plane: chooser.el.querySelector('.wy-color-plane').getAttribute('aria-valuetext'),
            };
        });

        expect(result).toEqual({
            color: '#3465a4',
            rgba: { r: 52, g: 101, b: 164, a: 1 },
            entry: '#3465a4',
            selected: 'Sky Blue',
            selectedCount: 1,
            swatches: 36,
            alphaVisible: true,
            hue: 214,
            plane: 'Saturation 68%, value 64%',
        });

        // Setting a color from code emits color-change, but not color-activate.
        await page.evaluate(() => (globalThis.chooser.color = 'hsl(0, 100%, 50%)'));
        expect(await page.evaluate(() => [globalThis.changes, globalThis.activations])).toEqual([
            ['#ff0000'],
            [],
        ]);

        // Without useAlpha, colors are opaque.
        await page.evaluate(() => (globalThis.chooser.color = '#ff000080'));
        expect(await page.evaluate(() => globalThis.chooser.color)).toBe('#ff0000');

        const invalid = await page.evaluate(() => {
            try {
                globalThis.chooser.color = 'nonsense';

                return null;
            } catch (error) {
                return error.name;
            }
        });
        expect(invalid).toBe('TypeError');
        expect(errors).toEqual([]);
    });

    test('keeps the alpha with useAlpha and shows the alpha slider', async ({ page }) => {
        await mount(page, { color: 'rgba(204, 0, 0, 0.5)', useAlpha: true });

        const result = await page.evaluate(() => {
            const chooser = globalThis.chooser;
            const alpha = chooser.el.querySelector('.wy-color-chooser-alpha');

            return {
                color: chooser.color,
                alpha: chooser.rgba.a,
                hidden: alpha.hidden,
                value: alpha.getAttribute('aria-valuenow'),
                preview: chooser.el
                    .querySelector('.wy-color-chooser-preview')
                    .classList.contains('wy-translucent'),
            };
        });

        expect(result.color).toBe('#cc000080');
        expect(result.alpha).toBeCloseTo(0.5, 2);
        expect(result.hidden).toBe(false);
        expect(result.value).toBe('50');
        expect(result.preview).toBe(true);

        // Turning useAlpha off makes the color opaque.
        await page.evaluate(() => (globalThis.chooser.useAlpha = false));
        expect(await page.evaluate(() => globalThis.chooser.color)).toBe('#cc0000');

        // rgba can be set as well.
        await page.evaluate(() => {
            globalThis.chooser.useAlpha = true;
            globalThis.chooser.rgba = { r: 0, g: 0, b: 255, a: 0.25 };
        });
        expect(await page.evaluate(() => globalThis.chooser.color)).toBe('#0000ff40');
    });

    test('clicking a swatch selects its color and a double click activates it', async ({
        page,
    }) => {
        await mount(page, { color: '#ffffff' });

        const butter = await swatchCenter(page, 11);
        await page.mouse.click(butter.x, butter.y);

        expect(await page.evaluate(() => [globalThis.chooser.color, globalThis.changes])).toEqual([
            '#edd400',
            ['#edd400'],
        ]);
        expect(await page.evaluate(() => globalThis.chooser.palette.hasFocus)).toBe(true);

        const plum = await swatchCenter(page, 5);
        await page.mouse.dblclick(plum.x, plum.y);

        expect(await page.evaluate(() => globalThis.activations)).toEqual(['#ad7fa8']);
        expect(await page.evaluate(() => globalThis.chooser.entry.text)).toBe('#ad7fa8');
    });

    test('the arrow keys move through the palette and Enter activates', async ({ page }) => {
        await mount(page, { color: '#cc0000' });

        await page.evaluate(() => globalThis.chooser.focusChooser());

        const cursor = () =>
            page.evaluate(() => {
                const palette = globalThis.chooser.palette.el;
                const id = palette.getAttribute('aria-activedescendant');

                return [document.getElementById(id)?.dataset.index, globalThis.chooser.color];
            });

        expect(await cursor()).toEqual(['9', '#cc0000']);

        await page.keyboard.press('ArrowRight');
        expect(await cursor()).toEqual(['10', '#f57900']);

        await page.keyboard.press('ArrowDown');
        expect(await cursor()).toEqual(['19', '#ce5c00']);

        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        expect(await cursor()).toEqual(['1', '#fcaf3e']);

        // The cursor stops at the edges.
        await page.keyboard.press('ArrowUp');
        expect(await cursor()).toEqual(['1', '#fcaf3e']);

        await page.keyboard.press('End');
        expect(await cursor()).toEqual(['35', '#ffffff']);

        await page.keyboard.press('Home');
        expect(await cursor()).toEqual(['0', '#ef2929']);

        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => globalThis.activations)).toEqual(['#ef2929']);
    });

    test('the square sets saturation and value by pointer and keyboard', async ({ page }) => {
        await mount(page, { color: '#ff0000' });

        const rect = await page.evaluate(() => {
            const plane = globalThis.chooser.el.querySelector('.wy-color-plane');
            const box = plane.getBoundingClientRect();

            return { x: box.left, y: box.top, width: box.width, height: box.height };
        });

        // The middle of the square is half saturated, at half value, of the red hue.
        await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const middle = await page.evaluate(() => globalThis.chooser.color);
        expect(['#804040', '#7f3f3f', '#803f3f', '#7f4040']).toContain(middle);

        // Dragging to the top right corner (and beyond) gives the pure hue.
        await page.mouse.move(rect.x + 10, rect.y + 10);
        await page.mouse.down();
        await page.mouse.move(rect.x + rect.width + 40, rect.y - 40, { steps: 4 });
        await page.mouse.up();
        expect(await page.evaluate(() => globalThis.chooser.color)).toBe('#ff0000');

        const focused = await page.evaluate(() =>
            document.activeElement.classList.contains('wy-color-plane')
        );
        expect(focused).toBe(true);

        // Down lowers the value by 1%, and Control+Left the saturation by 10%.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Control+ArrowLeft');

        const keyed = await page.evaluate(async () => {
            const { parseColor, rgbToHsv } = await import('/src/core/color.js');
            const color = parseColor(globalThis.chooser.color);

            return rgbToHsv(color.r, color.g, color.b);
        });
        expect(keyed.h).toBeCloseTo(0, 0);
        expect(keyed.s).toBeCloseTo(0.9, 2);
        expect(keyed.v).toBeCloseTo(0.99, 2);

        // The hue of a gray is kept, so the square does not jump to red.
        const gray = await page.evaluate(() => {
            const chooser = globalThis.chooser;
            chooser.color = '#204a87';
            chooser.color = '#808080';

            return chooser.el
                .querySelector('.wy-color-plane')
                .style.getPropertyValue('--wy-plane-hue');
        });
        expect(gray).not.toBe('#ff0000');
    });

    test('the hue and alpha sliders change the color', async ({ page }) => {
        await mount(page, { color: '#ff0000', useAlpha: true });

        await page.evaluate(() => {
            const hue = globalThis.chooser.el.querySelector('.wy-color-chooser-hue');
            hue.focus();
        });

        // Page Down moves the hue by 15 degrees.
        await page.keyboard.press('PageDown');
        await page.keyboard.press('PageDown');
        await page.keyboard.press('PageDown');
        await page.keyboard.press('PageDown');
        expect(await page.evaluate(() => globalThis.chooser.color)).toBe('#ffff00');

        // The end of the hue slider is red again, and the thumb stays there.
        const hue = () =>
            page.evaluate(() => [
                globalThis.chooser.color,
                globalThis.chooser.el.querySelector('.wy-color-chooser-hue').ariaValueNow,
            ]);

        await page.keyboard.press('End');
        expect(await hue()).toEqual(['#ff0000', '360']);

        await page.keyboard.press('ArrowUp');
        expect(await hue()).toEqual(['#ff0004', '359']);

        await page.evaluate(() => {
            globalThis.chooser.el.querySelector('.wy-color-chooser-hue').focus();
        });
        await page.keyboard.press('Home');
        for (let index = 0; index < 4; index++) {
            await page.keyboard.press('PageDown');
        }

        await page.evaluate(() => {
            globalThis.chooser.el.querySelector('.wy-color-chooser-alpha').focus();
        });
        await page.keyboard.press('Home');
        expect(await page.evaluate(() => globalThis.chooser.color)).toBe('#ffff0000');

        await page.keyboard.press('PageUp');
        expect(await page.evaluate(() => globalThis.chooser.color)).toBe('#ffff001a');

        const opaque = await page.evaluate(() =>
            globalThis.chooser.el.style.getPropertyValue('--wy-chooser-opaque')
        );
        expect(opaque).toBe('#ffff00');
    });

    test('typing a color in the entry applies it, and Enter activates it', async ({ page }) => {
        await mount(page, { color: '#000000' });

        await page.click('.wy-color-chooser-entry input');
        await page.keyboard.press('Control+A');
        await page.keyboard.type('rebeccapurple');

        const typed = await page.evaluate(() => ({
            color: globalThis.chooser.color,
            text: globalThis.chooser.entry.text,
            valid: globalThis.chooser.entry.isValid,
        }));
        expect(typed).toEqual({ color: '#663399', text: 'rebeccapurple', valid: true });

        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => globalThis.activations)).toEqual(['#663399']);
        expect(await page.evaluate(() => globalThis.chooser.entry.text)).toBe('#663399');

        // An invalid text is marked, keeps the color, and is reset when the entry loses the focus.
        await page.keyboard.press('Control+A');
        await page.keyboard.type('#12');

        const invalid = await page.evaluate(() => ({
            color: globalThis.chooser.color,
            valid: globalThis.chooser.entry.isValid,
        }));
        expect(invalid).toEqual({ color: '#663399', valid: false });

        await page.keyboard.press('Shift+Tab');
        expect(await page.evaluate(() => globalThis.chooser.entry.text)).toBe('#663399');
    });

    test('Tab moves through the parts, also in a popover', async ({ page }) => {
        await mount(page, { useAlpha: true });

        // A color that is not in the palette focuses the square first.
        const order = await page.evaluate(async () => {
            const { Popover } = await import('/src/widgets/popover.js');
            const { ColorChooser } = await import('/src/widgets/color-chooser.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const popover = new Popover({ owner: globalThis.chooser });
            const chooser = new ColorChooser({ useAlpha: true, color: '#123456' });
            popover.child = chooser;
            flushLayout();
            popover.popup(globalThis.chooser.el);
            chooser.focusChooser();

            globalThis.popupChooser = chooser;

            return document.activeElement.className.split(' ')[0];
        });
        expect(order).toBe('wy-color-plane');

        const classes = [];
        for (let i = 0; i < 5; ++i) {
            await page.keyboard.press('Tab');
            classes.push(
                await page.evaluate(() => {
                    const element = document.activeElement;

                    return element.closest('.wy-slider, .wy-line-edit, .wy-widget').classList[0];
                })
            );
        }

        expect(classes).toEqual([
            'wy-slider',
            'wy-slider',
            'wy-line-edit',
            'wy-color-palette',
            'wy-color-plane',
        ]);

        await page.keyboard.press('Shift+Tab');
        expect(
            await page.evaluate(() => document.activeElement.classList.contains('wy-color-palette'))
        ).toBe(true);
    });

    test('the accessible names follow the language', async ({ page }) => {
        await mount(page, { color: '#3465a4' });

        const result = await page.evaluate(async () => {
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');
            const { ColorButton } = await import('/src/widgets/color-button.js');

            const chooser = globalThis.chooser;
            const button = new ColorButton({ color: '#3465a4' });
            const names = () => [
                chooser.entry.focusElement.getAttribute('aria-label'),
                chooser.el.querySelector('.wy-color-chooser-hue').getAttribute('aria-label'),
                chooser.palette.el.getAttribute('aria-label'),
                button.el.getAttribute('aria-label'),
                chooser.palette.el.querySelector('.wy-selected').getAttribute('aria-label'),
                chooser.palette.el.querySelector('.wy-selected').title,
                chooser.el.querySelector('.wy-color-plane').getAttribute('aria-valuetext'),
            ];

            getLocaleManager().locale = 'en-US';
            const english = names();

            getLocaleManager().locale = 'nl-NL';
            const dutch = names();

            getLocaleManager().locale = 'de-DE';
            const german = names();

            // An accessible name replaces the title of a color button.
            button.accessibleName = 'Text color';
            const named = button.el.getAttribute('aria-label');

            getLocaleManager().locale = 'en-US';
            button.destroy();

            return { english, dutch, german, named };
        });

        expect(result).toEqual({
            english: [
                'Color name',
                'Hue',
                'Palette',
                'Pick a Color: #3465a4',
                'Sky Blue',
                'Sky Blue',
                'Saturation 68%, value 64%',
            ],
            dutch: [
                'Kleurnaam',
                'Tint',
                'Palet',
                'Kies een kleur: #3465a4',
                'Hemelsblauw',
                'Hemelsblauw',
                'Verzadiging 68%, helderheid 64%',
            ],
            german: [
                'Farbname',
                'Farbton',
                'Palette',
                'Farbe wählen: #3465a4',
                'Himmelblau',
                'Himmelblau',
                'Sättigung 68 %, Helligkeit 64 %',
            ],
            named: 'Text color: #3465a4',
        });
    });

    test('custom palettes, hiding the editor and the builder', async ({ page }) => {
        const errors = await mount(page);

        const result = await page.evaluate(async () => {
            const { Builder } = await import('/src/construction/builder.js');
            const chooser = globalThis.chooser;

            chooser.set({
                paletteColors: ['red', { color: '#00ff00', name: 'Lime' }, 'blue'],
                paletteColumns: 3,
                showEditor: false,
            });

            const labels = [...chooser.palette.el.children].map((x) =>
                x.getAttribute('aria-label')
            );
            const editor = chooser.el.querySelector('.wy-color-chooser-editor').hidden;

            chooser.paletteColors = null;
            const restored = chooser.palette.el.children.length;

            const [built] = new Builder().build({
                type: 'color-chooser',
                color: '#4e9a06',
                useAlpha: true,
            });

            return {
                labels,
                columns: chooser.palette.el.style.getPropertyValue('--wy-palette-columns'),
                editor,
                restored,
                built: [built.constructor.name, built.color, built.useAlpha],
            };
        });

        expect(result).toEqual({
            labels: ['#ff0000', 'Lime', '#0000ff'],
            columns: '3',
            editor: true,
            restored: 36,
            built: ['ColorChooser', '#4e9a06', true],
        });
        expect(errors).toEqual([]);
    });
});
