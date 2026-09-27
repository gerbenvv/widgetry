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

        let error = null;
        try {
            label.anchor = 5;
        } catch (e) {
            error = e.constructor.name;
        }

        return {
            initial,
            text: [...label.el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.data),
            title: label.el.querySelector('title').textContent,
            anchor: label.el.getAttribute('text-anchor'),
            baseline: label.el.getAttribute('dominant-baseline'),
            font: label.el.style.fontWeight,
            error,
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
    expect(result.anchor).toBe('end');
    expect(result.baseline).toBe('middle');
    expect(result.font).toBe('bold');
    expect(result.error).toBe('RangeError');
});
