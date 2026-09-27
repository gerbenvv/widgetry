// Browser tests of Image.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('Image', () => {
    test('is an image for assistive technology only with an alternative text', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Image } = await import('/src/widgets/image.js');

            const image = new Image({ icon: 'document-open' });
            const accessibility = () => ({
                role: image.el.getAttribute('role'),
                label: image.el.getAttribute('aria-label'),
                hidden: image.el.getAttribute('aria-hidden'),
            });

            const states = [accessibility()];

            image.alternativeText = 'Open';
            states.push(accessibility());

            image.alternativeText = '';
            states.push(accessibility());

            return states;
        });

        expect(errors).toEqual([]);
        expect(result).toEqual([
            { role: null, label: null, hidden: 'true' },
            { role: 'img', label: 'Open', hidden: null },
            { role: null, label: null, hidden: 'true' },
        ]);
    });
});
