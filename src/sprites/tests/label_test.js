// Browser tests of label sprites.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test('LabelSprite shows text at an anchor, in the theme text color', async ({ page }) => {
    await openHarness(page);

    const result = await page.evaluate(async () => {
        const { LabelSprite, LabelAnchor } = await import('/src/sprites/label.js');

        const label = new LabelSprite({ text: '55', position: { x: 4, y: 20 }, title: 'Price' });
        const initial = {
            text: [...label.el.childNodes].find((x) => x.nodeType === 3).data,
            anchor: label.el.getAttribute('text-anchor'),
            fill: label.el.getAttribute('fill'),
            stroke: label.el.getAttribute('stroke'),
            x: label.el.getAttribute('x'),
        };

        label.set({
            text: '50',
            anchor: LabelAnchor.END,
            baseline: 'middle',
            font: 'bold 12px serif',
        });

        const ended = label.el.getAttribute('text-anchor');

        // The anchors are the SVG words.
        label.anchor = 'start';
        const started = { anchor: label.anchor, attribute: label.el.getAttribute('text-anchor') };

        const errors = [];
        for (const anchor of [5, 1, 'left', null]) {
            try {
                label.anchor = anchor;
            } catch (e) {
                errors.push(e.constructor.name);
            }
        }

        return {
            values: { ...LabelAnchor },
            started,
            ended,
            isStart: label.anchor === LabelAnchor.START,
            initial,
            text: [...label.el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.data),
            title: label.el.querySelector('title').textContent,
            baseline: label.el.getAttribute('dominant-baseline'),
            font: label.el.style.fontWeight,
            errors,
        };
    });

    expect(result.initial).toEqual({
        text: '55',
        anchor: 'middle',
        fill: 'currentColor',
        stroke: 'none',
        x: '4',
    });
    expect(result.text).toEqual(['50']);
    expect(result.title).toBe('Price');
    expect(result.values).toEqual({ START: 'start', MIDDLE: 'middle', END: 'end' });
    expect(result.ended).toBe('end');
    expect(result.started).toEqual({ anchor: 'start', attribute: 'start' });
    expect(result.isStart).toBe(true);
    expect(result.baseline).toBe('middle');
    expect(result.font).toBe('bold');
    expect(result.errors).toEqual(['RangeError', 'RangeError', 'RangeError', 'RangeError']);
});
