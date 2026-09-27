// Browser tests of Label.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a main window with a vertical box, available as `globalThis.box`.
async function openWindow(page) {
    const errors = await openHarness(page);

    await page.evaluate(async () => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Box } = await import('/src/widgets/box.js');

        const window = new MainWindow();
        const box = new Box({ orientation: 'vertical', spacing: 4, margin: 10 });
        window.addChild(box);
        window.show();

        globalThis.testWindow = window;
        globalThis.box = box;
    });

    return errors;
}

test.describe('Label', () => {
    test('shows text, keeps its natural size and is aligned at the start', async ({ page }) => {
        const errors = await openWindow(page);

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const label = globalThis.box.addChild(new Label({ text: 'Hello  world\nline 2' }));
            const changes = [];
            label.connect('text-change', () => changes.push(label.text));

            label.label = 'Hello  world\nline 2!';
            flushLayout();

            return {
                text: label.el.textContent,
                labelAlias: label.label,
                changes,
                width: label.allocation.width,
                boxWidth: globalThis.box.allocation.width,
                left: label.allocation.x - globalThis.box.allocation.x,
                lines: Math.round(
                    label.allocation.height / parseFloat(getComputedStyle(label.el).lineHeight)
                ),
            };
        });

        expect(errors).toEqual([]);
        expect(result.text).toBe('Hello  world\nline 2!');
        expect(result.labelAlias).toBe('Hello  world\nline 2!');
        expect(result.changes).toEqual(['Hello  world\nline 2!']);
        expect(result.width).toBeLessThan(result.boxWidth / 2);
        expect(result.left).toBe(0);
        expect(result.lines).toBe(2);
    });

    test('markup allows a whitelist of tags and shows everything else as text', async ({
        page,
    }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');

            const label = globalThis.box.addChild(
                new Label({
                    useMarkup: true,
                    text:
                        '<b onclick="alert(1)">bold</b> <span class="x-a bad!" style="color:red">s</span>' +
                        '<script>alert(2)</script><img src=x onerror="alert(3)"> &amp; &copy; & <i>open' +
                        '</u>',
                })
            );

            const element = label.el;

            return {
                bold: element.querySelector('b')?.textContent,
                boldAttributes: element.querySelector('b')?.attributes.length,
                spanClass: element.querySelector('span span')?.className,
                spanStyle: element.querySelector('span span')?.getAttribute('style'),
                scripts: element.querySelectorAll('script, img').length,
                italic: element.querySelector('i')?.textContent,
                text: element.textContent,
                enableMarkup: label.enableMarkup,
            };
        });

        expect(result.bold).toBe('bold');
        expect(result.boldAttributes).toBe(0);
        expect(result.spanClass).toBe('x-a');
        expect(result.spanStyle).toBeNull();
        expect(result.scripts).toBe(0);
        expect(result.italic).toBe('open</u>');
        expect(result.text).toContain('<script>alert(2)</script>');
        expect(result.text).toContain('& © & ');
        expect(result.enableMarkup).toBe(true);
    });

    test('styles combine bold, italic, underline and strikethrough', async ({ page }) => {
        await openWindow(page);

        const style = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { LabelStyles } = await import('/src/core/enums.js');

            const label = globalThis.box.addChild(
                new Label({
                    text: 'Styled',
                    styles:
                        LabelStyles.BOLD |
                        LabelStyles.ITALIC |
                        LabelStyles.UNDERLINE |
                        LabelStyles.STRIKETHROUGH,
                })
            );
            const computed = getComputedStyle(label.el);

            return {
                weight: computed.fontWeight,
                fontStyle: computed.fontStyle,
                decoration: computed.textDecorationLine,
            };
        });

        expect(style.weight).toBe('700');
        expect(style.fontStyle).toBe('italic');
        expect(style.decoration).toContain('underline');
        expect(style.decoration).toContain('line-through');
    });

    test('ellipsizes at the start, the middle and the end', async ({ page }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { Box } = await import('/src/widgets/box.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const text = 'The quick brown fox jumps over the lazy dog';
            const labels = ['none', 'start', 'middle', 'end'].map((ellipsize) => {
                const box = globalThis.box.addChild(new Box({ hAlign: 'start', width: 120 }));
                return box.addChild(new Label({ text, ellipsize }));
            });
            flushLayout();

            const middle = labels[2];
            const halves = [...middle.el.children].map((x) => x.getBoundingClientRect().width);

            // A middle-ellipsized label shows the whole text when it fits.
            const wide = globalThis.box.addChild(new Label({ text: 'short', ellipsize: 'middle' }));

            return {
                widths: labels.map((x) => Math.round(x.allocation.width)),
                clipped: labels.map((x) => x.el.scrollWidth > x.el.clientWidth + 1),
                ellipsis: labels.map((x) => getComputedStyle(x.el).textOverflow),
                halves,
                middleText: middle.el.textContent,
                wideText: wide.el.textContent,
                wideClipped: [...wide.el.children].some((x) => x.scrollWidth > x.clientWidth),
            };
        });

        expect(result.widths[0]).toBe(120);
        expect(result.clipped[0]).toBe(true);
        expect(result.widths.slice(1)).toEqual([120, 120, 120]);
        expect(result.ellipsis).toEqual(['clip', 'ellipsis', 'ellipsis', 'ellipsis']);
        expect(result.clipped[1]).toBe(true);
        expect(result.clipped[3]).toBe(true);
        expect(Math.abs(result.halves[0] - result.halves[1])).toBeLessThan(15);
        expect(result.halves[0] + result.halves[1]).toBeLessThanOrEqual(121);
        expect(result.middleText).toBe('The quick brown fox jumps over the lazy dog');
        expect(result.wideText).toBe('short');
        expect(result.wideClipped).toBe(false);
    });

    test('wrapping labels limit their natural width and can be clamped', async ({ page }) => {
        await openWindow(page);

        const result = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');

            const text = 'word '.repeat(80).trim();
            const plain = globalThis.box.addChild(new Label({ text, wrap: true }));
            const narrow = globalThis.box.addChild(
                new Label({ text, wrap: true, maxWidthChars: 20 })
            );
            const clamped = globalThis.box.addChild(
                new Label({ text, wrap: true, maxWidthChars: 20, lines: 2, ellipsize: 'end' })
            );
            const wide = globalThis.box.addChild(new Label({ text: 'x', widthChars: 30 }));
            const lineHeight = parseFloat(getComputedStyle(plain.el).lineHeight);
            const ch = wide.allocation.width / 30;

            return {
                plainWidth: plain.allocation.width,
                plainLines: Math.round(plain.allocation.height / lineHeight),
                narrowChars: narrow.allocation.width / ch,
                clampedLines: Math.round(clamped.allocation.height / lineHeight),
                wideWidth: wide.allocation.width,
            };
        });

        expect(result.plainWidth).toBeLessThan(700);
        expect(result.plainLines).toBeGreaterThan(3);
        expect(result.narrowChars).toBeLessThanOrEqual(20.5);
        expect(result.clampedLines).toBe(2);
        expect(result.wideWidth).toBeGreaterThan(150);
    });

    test('justify aligns the lines of the text', async ({ page }) => {
        await openWindow(page);

        const aligns = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');

            return ['start', 'center', 'end', 'fill'].map((justify) => {
                const label = globalThis.box.addChild(new Label({ text: 'a', justify }));

                return getComputedStyle(label.el).textAlign;
            });
        });

        expect(aligns).toEqual(['start', 'center', 'end', 'justify']);
    });

    test('mnemonics underline a character and activate their widget', async ({ page }) => {
        await openWindow(page);

        await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { CheckBox } = await import('/src/widgets/check-box.js');

            const label = globalThis.box.addChild(
                new Label({ text: 'Show __all _files', useUnderline: true })
            );
            const check = globalThis.box.addChild(new CheckBox());
            label.mnemonicWidget = check;

            globalThis.label = label;
            globalThis.check = check;
        });

        const info = await page.evaluate(() => ({
            key: globalThis.label.mnemonicKey,
            text: globalThis.label.el.textContent,
            underlined: globalThis.label.el.querySelector('u')?.textContent,
            labelledBy:
                globalThis.check.el.getAttribute('aria-labelledby') === globalThis.label.el.id,
        }));

        expect(info).toEqual({
            key: 'f',
            text: 'Show _all files',
            underlined: 'f',
            labelledBy: true,
        });

        await page.keyboard.press('Alt+f');
        await expect.poll(() => page.evaluate(() => globalThis.check.active)).toBe(true);
        expect(await page.evaluate(() => globalThis.check.hasFocus)).toBe(true);

        // Without the modifier, or for an insensitive target, nothing happens.
        await page.keyboard.press('f');
        await page.evaluate(() => (globalThis.check.sensitive = false));
        await page.keyboard.press('Alt+f');
        await page.waitForTimeout(200);
        expect(await page.evaluate(() => globalThis.check.active)).toBe(true);
    });

    test('mnemonics in markup and shared mnemonics cycle the focus', async ({ page }) => {
        await openWindow(page);

        const key = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { Button } = await import('/src/widgets/button.js');

            const label = globalThis.box.addChild(
                new Label({ text: '<b>_Name</b>', useMarkup: true, useUnderline: true })
            );
            globalThis.first = globalThis.box.addChild(
                new Button({ label: '_Next', useUnderline: true })
            );
            globalThis.second = globalThis.box.addChild(
                new Button({ label: 'Ne_xt', useUnderline: true })
            );
            globalThis.third = globalThis.box.addChild(
                new Button({ label: '_No', useUnderline: true })
            );
            globalThis.clicks = 0;
            globalThis.first.connect('activate', () => globalThis.clicks++);

            return [label.mnemonicKey, label.el.querySelector('b > u')?.textContent];
        });

        expect(key).toEqual(['n', 'N']);

        await page.keyboard.press('Alt+x');
        await expect.poll(() => page.evaluate(() => globalThis.second.hasFocus)).toBe(true);

        // Two buttons share "n": each press focuses the next one without clicking.
        await page.keyboard.press('Alt+n');
        expect(await page.evaluate(() => globalThis.first.hasFocus)).toBe(true);

        await page.keyboard.press('Alt+n');
        expect(await page.evaluate(() => globalThis.third.hasFocus)).toBe(true);
        expect(await page.evaluate(() => globalThis.clicks)).toBe(0);
    });

    test('selectable labels allow selecting their text with the mouse', async ({ page }) => {
        await openWindow(page);

        const boxes = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');

            const plain = globalThis.box.addChild(new Label({ text: 'Not selectable text' }));
            const selectable = globalThis.box.addChild(
                new Label({ text: 'Selectable text here', selectable: true })
            );
            const { flushLayout } = await import('/src/widgets/widget.js');
            flushLayout();

            return [plain, selectable].map((x) => {
                const r = x.el.getBoundingClientRect();
                return { x: r.left, y: r.top + r.height / 2, width: r.width };
            });
        });

        const drag = async ({ x, y, width }) => {
            await page.mouse.move(x + 2, y);
            await page.mouse.down();
            await page.mouse.move(x + width - 2, y, { steps: 5 });
            await page.mouse.up();

            return page.evaluate(() => document.getSelection().toString());
        };

        expect(await drag(boxes[0])).toBe('');
        expect(await drag(boxes[1])).toContain('Selectable');
    });

    test('dim labels use the secondary color and insensitive labels are grayed out', async ({
        page,
    }) => {
        await openWindow(page);

        const colors = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');

            const normal = globalThis.box.addChild(new Label({ text: 'a' }));
            const dim = globalThis.box.addChild(new Label({ text: 'b' }));
            dim.addStyleClass('dim-label');
            const insensitive = globalThis.box.addChild(new Label({ text: 'c', sensitive: false }));

            return [normal, dim, insensitive].map((x) => getComputedStyle(x.el).color);
        });

        expect(new Set(colors).size).toBe(3);
    });

    test('invalid values throw', async ({ page }) => {
        await openWindow(page);

        const errors = await page.evaluate(async () => {
            const { Label } = await import('/src/widgets/label.js');
            const { activateMnemonic } = await import('/src/widgets/label.js');
            const label = new Label();
            const attempts = [
                () => (label.justify = 'left'),
                () => (label.ellipsize = 'both'),
                () => (label.styles = -1),
                () => (label.mnemonicWidget = {}),
                () => activateMnemonic(globalThis.testWindow, ''),
            ];

            return attempts.map((attempt) => {
                try {
                    attempt();
                    return false;
                } catch (_error) {
                    return true;
                }
            });
        });

        expect(errors).toEqual([true, true, true, true, true]);
    });

    test('the builder creates labels', async ({ page }) => {
        await openWindow(page);

        const text = await page.evaluate(async () => {
            await import('/src/widgets/label.js');
            const { getType } = await import('/src/core/registry.js');
            const entry = getType('label');

            return new entry.cls({ text: 'Built', 'use-markup': true }).el.textContent;
        });

        expect(text).toBe('Built');
    });
});
