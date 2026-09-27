// Browser tests of the Frame.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// Shows a frame with a label and a small child in a main window of 400 by 200 pixels.
async function showFrame(page, properties) {
    await page.evaluate(async (properties) => {
        const { MainWindow } = await import('/src/widgets/main-window.js');
        const { Frame } = await import('/src/widgets/frame.js');
        const { Label } = await import('/src/widgets/label.js');
        const { flushLayout } = await import('/src/widgets/widget.js');

        const host = document.createElement('div');
        host.style.cssText = 'width: 400px; height: 200px;';
        document.body.append(host);

        const window = new MainWindow({ host });
        const frame = new Frame({ hAlign: 'start', vAlign: 'start', ...properties });
        frame.addChild(new Label({ text: 'x' }));
        window.addChild(frame);
        window.show();
        flushLayout();

        globalThis.frame = frame;
        globalThis.window_ = window;
    }, properties);
}

function measure(page) {
    return page.evaluate(() => {
        const frame = globalThis.frame;
        const own = frame.el.getBoundingClientRect();
        const label = frame.el.querySelector('.wy-frame-label').getBoundingClientRect();
        const header = frame.el.querySelector('.wy-frame-header').getBoundingClientRect();
        const body = frame.el.querySelector('.wy-frame-body').getBoundingClientRect();

        return {
            width: own.width,
            labelLeft: label.left - own.left,
            labelRight: own.right - label.right,
            labelWidth: label.width,
            headerHeight: header.height,
            labelHeight: label.height,
            bodyTop: body.top - own.top,
            fontWeight: getComputedStyle(frame.el.querySelector('.wy-frame-label')).fontWeight,
        };
    });
}

test.describe('frame', () => {
    test('the label sits on the top border, centered, and the frame fits it', async ({ page }) => {
        const errors = await openHarness(page);
        await showFrame(page, { label: 'A fairly long frame title' });

        const size = await measure(page);

        expect(errors).toEqual([]);
        expect(size.fontWeight).toBe('700');

        // The frame is at least as wide as its label (the "preferred size" of the original TODO),
        // with the label centered between two short border parts.
        expect(size.width).toBeGreaterThanOrEqual(size.labelWidth + 16);
        expect(Math.abs(size.labelLeft - size.labelRight)).toBeLessThanOrEqual(1);

        // The header is the label's height; the border line runs through its middle.
        expect(size.headerHeight).toBeCloseTo(size.labelHeight, 0);
        expect(size.bodyTop).toBeCloseTo(size.headerHeight, 0);
    });

    test('labelXAlign moves the label along the border', async ({ page }) => {
        await openHarness(page);
        await showFrame(page, { label: 'Title', width: 300 });

        const positions = [];
        for (const align of [0, 1]) {
            await page.evaluate((align) => (globalThis.frame.labelXAlign = align), align);
            positions.push(await measure(page));
        }

        expect(positions[0].labelLeft).toBeCloseTo(8, 0);
        expect(positions[1].labelRight).toBeCloseTo(8, 0);

        const alias = await page.evaluate(() => {
            globalThis.frame.labelHAlign = 0.25;

            return [globalThis.frame.labelXAlign, globalThis.frame.labelHAlign];
        });
        expect(alias).toEqual([0.25, 0.25]);

        await expect(
            page.evaluate(() => {
                globalThis.frame.labelXAlign = 'left';
            })
        ).rejects.toThrow(/Invalid label alignment/);
    });

    test('a frame without a label has only the border', async ({ page }) => {
        await openHarness(page);
        await showFrame(page, {});

        const result = await page.evaluate(() => {
            const frame = globalThis.frame;
            const label = frame.el.querySelector('.wy-frame-label');

            return {
                hasLabel: frame.el.classList.contains('wy-has-label'),
                labelDisplay: getComputedStyle(label).display,
                labelledBy: frame.el.getAttribute('aria-labelledby'),
                header: frame.el.querySelector('.wy-frame-header').getBoundingClientRect().height,
                role: frame.el.getAttribute('role'),
            };
        });

        expect(result.hasLabel).toBe(false);
        expect(result.labelDisplay).toBe('none');
        expect(result.labelledBy).toBeNull();
        expect(result.header).toBeLessThan(6);
        expect(result.role).toBe('group');
    });

    test('a label widget replaces the text and belongs to the frame', async ({ page }) => {
        await openHarness(page);
        await showFrame(page, { label: 'Text' });

        const result = await page.evaluate(async () => {
            const { CheckBox } = await import('/src/widgets/check-box.js');
            const frame = globalThis.frame;

            const check = new CheckBox({ label: 'Enable' });
            frame.labelWidget = check;

            const states = {
                label: frame.label,
                parent: check.parent === frame,
                inLabel: frame.el.querySelector('.wy-frame-label').contains(check.el),
                window: check.window === globalThis.window_,
                chain: frame._getFocusChain()[0] === check,
            };

            frame.sensitive = false;
            states.insensitive = check.isSensitive;
            frame.sensitive = true;

            check.destroy();
            states.afterDestroy = [frame.labelWidget, frame.label];

            return states;
        });

        expect(result).toEqual({
            label: null,
            parent: true,
            inLabel: true,
            window: true,
            chain: true,
            insensitive: false,
            afterDestroy: [null, 'Text'],
        });
    });

    test('shadow types set the border style', async ({ page }) => {
        await openHarness(page);
        await showFrame(page, { label: 'Shadow' });

        const result = await page.evaluate(() => {
            const frame = globalThis.frame;
            const body = frame.el.querySelector('.wy-frame-body');
            const styles = {};

            for (const type of ['etched-in', 'in', 'out', 'etched-out', 'none']) {
                frame.shadowType = type;
                const style = getComputedStyle(body);
                styles[type] = [
                    frame.el.classList.contains(`wy-shadow-${type}`),
                    style.borderLeftColor,
                    style.borderRightColor,
                ];
            }

            let error = '';
            try {
                frame.shadowType = 'dotted';
            } catch (e) {
                error = e.message;
            }

            return { styles, error, classes: frame.el.className };
        });

        expect(result.styles['etched-in'][0]).toBe(true);
        expect(result.styles.in[1]).not.toBe(result.styles.in[2]);
        expect(result.styles.none[1]).toBe('rgba(0, 0, 0, 0)');
        expect(result.error).toMatch(/Invalid shadow type/);
        expect(result.classes).toContain('wy-shadow-none');
        expect(result.classes).not.toContain('wy-shadow-in ');
    });

    test('the child fills the frame and the frame expands with it', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { MainWindow } = await import('/src/widgets/main-window.js');
            const { Frame } = await import('/src/widgets/frame.js');
            const { Box } = await import('/src/widgets/box.js');
            const { Label } = await import('/src/widgets/label.js');
            const { flushLayout } = await import('/src/widgets/widget.js');

            const host = document.createElement('div');
            host.style.cssText = 'width: 400px; height: 300px;';
            document.body.append(host);

            const window = new MainWindow({ host });
            const box = new Box({ orientation: 'vertical' });
            const frame = new Frame({ label: 'Grows' });
            const child = new Label({ text: 'content', vExpand: true, vAlign: 'fill' });
            frame.addChild(child);
            box.addChild(frame);
            window.addChild(box);
            window.show();
            flushLayout();

            return {
                expands: frame.isVExpand,
                frame: frame.el.getBoundingClientRect().height,
                child: child.el.getBoundingClientRect().height,
            };
        });

        expect(result.expands).toBe(true);
        expect(result.frame).toBe(300);
        expect(result.child).toBeGreaterThan(250);
    });
});
