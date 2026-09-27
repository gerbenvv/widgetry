// Browser tests of the Slider widget (and the AbstractSlider behavior it shares).
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a slider in a main window, as `globalThis.widget`.
async function mount(page, properties = {}) {
    await page.evaluate(async (properties) => {
        const { Box } = await import('/src/widgets/box.js');
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Slider } = await import('/src/widgets/slider.js');

        const host = document.createElement('div');
        host.style.cssText =
            'position: absolute; inset: 0 auto auto 0; width: 600px; height: 500px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const box = new Box({
            orientation: 'vertical',
            margin: 40,
            vAlign: 'start',
            hAlign: 'start',
        });
        const widget = new Slider(properties);

        box.addChild(widget);
        window.addChild(box);
        window.show();

        globalThis.widget = widget;
        globalThis.values = [];
        widget.connect('value-change', () => globalThis.values.push(widget.value));
    }, properties);
}

// The trough and thumb geometry in page coordinates.
const geometry = (page) =>
    page.evaluate(() => {
        const trough = globalThis.widget.el
            .querySelector('.wy-slider-trough')
            .getBoundingClientRect();
        const thumb = globalThis.widget.el
            .querySelector('.wy-slider-thumb')
            .getBoundingClientRect();

        return {
            trough: { x: trough.x, y: trough.y, width: trough.width, height: trough.height },
            thumb: { x: thumb.x, y: thumb.y, width: thumb.width, height: thumb.height },
        };
    });

const value = (page) => page.evaluate(() => globalThis.widget.value);

test.describe('Slider', () => {
    test('dragging the thumb changes the value', async ({ page }) => {
        const errors = await openHarness(page);
        await mount(page, { width: 300 });

        const { trough, thumb } = await geometry(page);
        const range = trough.width - thumb.width;

        expect(thumb.x).toBeCloseTo(trough.x, 0);

        await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
        await page.mouse.down();
        await page.mouse.move(thumb.x + thumb.width / 2 + range / 2, thumb.y + 40, { steps: 5 });

        expect(await value(page)).toBeCloseTo(50, 0);

        // The drag continues outside the widget and is clamped.
        await page.mouse.move(thumb.x + 1000, thumb.y, { steps: 3 });
        await page.mouse.up();

        expect(await value(page)).toBe(100);

        const after = await geometry(page);
        expect(after.thumb.x + after.thumb.width).toBeCloseTo(trough.x + trough.width, 0);

        const result = await page.evaluate(() => ({
            focused: globalThis.widget.hasFocus,
            pressed: globalThis.widget.el.querySelector('.wy-pressed') !== null,
            aria: globalThis.widget.el.getAttribute('aria-valuenow'),
            label: globalThis.widget.el.querySelector('.wy-slider-value').textContent,
            roundedValues: globalThis.values.every((x) => Math.round(x * 10) === x * 10),
        }));

        expect(errors).toEqual([]);
        expect(result).toEqual({
            focused: true,
            pressed: false,
            aria: '100',
            label: '100.0',
            roundedValues: true,
        });
    });

    test('pressing the trough moves the thumb there, or pages with Shift', async ({ page }) => {
        await openHarness(page);
        await mount(page, { width: 300, digits: 0 });

        const { trough, thumb } = await geometry(page);
        const range = trough.width - thumb.width;
        const y = trough.y + trough.height / 2;

        await page.mouse.click(trough.x + thumb.width / 2 + range * 0.75, y);
        expect(await value(page)).toBe(75);

        await page.keyboard.down('Shift');
        await page.mouse.click(trough.x + 5, y);
        await page.keyboard.up('Shift');
        expect(await value(page)).toBe(65);

        // The middle button always moves the thumb.
        await page.mouse.click(trough.x + thumb.width / 2 + range * 0.2, y, { button: 'middle' });
        expect(await value(page)).toBe(20);
    });

    test('the keyboard and the wheel change the value', async ({ page }) => {
        await openHarness(page);
        await mount(page, { width: 300, value: 50, digits: 0 });

        await page.evaluate(() => globalThis.widget.focus());

        const keys = async (...names) => {
            for (const name of names) {
                await page.keyboard.press(name);
            }

            return value(page);
        };

        expect(await keys('ArrowRight', 'ArrowRight')).toBe(52);
        expect(await keys('ArrowLeft')).toBe(51);
        expect(await keys('ArrowUp')).toBe(52);
        expect(await keys('PageUp')).toBe(62);
        expect(await keys('PageDown', 'PageDown')).toBe(42);
        expect(await keys('Control+ArrowRight')).toBe(52);
        expect(await keys('End')).toBe(100);
        expect(await keys('Home')).toBe(0);
        expect(await keys('+', '+', '-')).toBe(1);

        // Inverted: right moves the thumb right, which now decreases the value.
        await page.evaluate(() => (globalThis.widget.inverted = true));
        expect(await keys('End', 'ArrowRight')).toBe(99);

        const { trough } = await geometry(page);
        await page.mouse.move(trough.x + 10, trough.y + 5);
        await page.evaluate(() => (globalThis.widget.inverted = false));
        await page.mouse.wheel(0, 100);
        await page.mouse.wheel(0, 100);
        await page.mouse.wheel(0, -100);
        await expect.poll(() => value(page)).toBe(99);

        await page.mouse.wheel(0, -100);
        await expect.poll(() => value(page)).toBe(98);
    });

    test('vertical sliders increase downwards unless inverted', async ({ page }) => {
        await openHarness(page);
        await mount(page, { orientation: 'vertical', height: 250, value: 50, digits: 0 });

        await page.evaluate(() => globalThis.widget.focus());
        await page.keyboard.press('ArrowDown');
        expect(await value(page)).toBe(51);

        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        expect(await value(page)).toBe(49);

        const { trough, thumb } = await geometry(page);
        const range = trough.height - thumb.height;

        await page.mouse.click(
            trough.x + trough.width / 2,
            trough.y + thumb.height / 2 + range * 0.3
        );
        expect(await value(page)).toBe(30);

        await page.evaluate(() => (globalThis.widget.inverted = true));
        const inverted = await geometry(page);

        // Inverted, 30 is near the bottom.
        expect(inverted.thumb.y - inverted.trough.y).toBeCloseTo(range * 0.7, 0);

        const aria = await page.evaluate(() =>
            globalThis.widget.el.getAttribute('aria-orientation')
        );
        expect(aria).toBe('vertical');
    });

    test('shows the value with its digits, and marks along the trough', async ({ page }) => {
        await openHarness(page);
        await mount(page, { width: 300, lower: -10, upper: 10, value: 2.345, digits: 2 });

        const result = await page.evaluate(() => {
            const widget = globalThis.widget;
            const el = widget.el;

            widget.addMark(0, 'bottom', 'Zero');
            widget.addMark(10, 'top');

            const trough = el.querySelector('.wy-slider-trough').getBoundingClientRect();
            const marks = [...el.querySelectorAll('.wy-slider-mark')].map((x) => {
                const rect = x.getBoundingClientRect();

                return Math.round(rect.x + rect.width / 2 - trough.x);
            });

            const texts = [
                el.querySelector('.wy-slider-value').textContent,
                el.getAttribute('aria-valuetext'),
            ];

            widget.digits = 0;
            texts.push(el.querySelector('.wy-slider-value').textContent);

            widget.drawValue = false;
            const hidden = el.querySelector('.wy-slider-value-area').hidden;

            const states = {
                texts,
                hidden,
                marks,
                width: Math.round(trough.width),
                label: el.querySelector('.wy-slider-mark-label').textContent,
                count: widget.marks.length,
            };

            widget.clearMarks();
            states.cleared = el.querySelectorAll('.wy-slider-mark').length;

            return states;
        });

        // Marks are at the center of the thumb for their value.
        expect(result.texts).toEqual(['2.35', '2.35', '2']);
        expect(result.hidden).toBe(true);
        expect(result.label).toBe('Zero');
        expect(result.count).toBe(2);
        expect(result.cleared).toBe(0);
        // The mark at the top comes first in the document.
        expect(result.marks[0]).toBeCloseTo(result.width - 15, -1);
        expect(result.marks[1]).toBeCloseTo(result.width / 2, -1);
    });

    test('insensitive sliders ignore input, and adjustments can be shared', async ({ page }) => {
        await openHarness(page);
        await mount(page, { width: 300, value: 40, sensitive: false });

        const { trough } = await geometry(page);
        await page.mouse.click(trough.x + trough.width - 5, trough.y + 5);
        await page.keyboard.press('End');

        expect(await value(page)).toBe(40);

        const result = await page.evaluate(async () => {
            const { Adjustment } = await import('/src/data/adjustment.js');
            const widget = globalThis.widget;
            const adjustment = new Adjustment({ lower: 0, upper: 10, value: 5 });

            widget.adjustment = adjustment;
            adjustment.value = 7;

            const states = [widget.value, widget.upper, globalThis.values];

            widget.set({ upper: 500, value: 300 });
            states.push(adjustment.value);

            let error = null;
            try {
                widget.adjustment = {};
            } catch (e) {
                error = e.name;
            }
            states.push(error);

            return states;
        });

        expect(result).toEqual([7, 10, [5, 7, 300], 300, 'TypeError']);
    });
});
