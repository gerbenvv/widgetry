// Browser tests of image sprites.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

// A 4 by 3 pixel PNG.
const PICTURE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAEUlEQVR42mP8z8DwnwEJMOIQAACoCQMAgSZ6jwAAAABJRU5ErkJggg==';

test.describe('ImageSprite', () => {
    test('loads an image with its natural size', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async (source) => {
            const { ImageSprite } = await import('/src/sprites/image.js');

            const image = new ImageSprite({ position: { x: 1, y: 2 } });
            const loaded = new Promise((resolve) => image.connect('load', resolve));
            image.source = source;
            await loaded;

            const natural = [
                image.el.getAttribute('width'),
                image.el.getAttribute('height'),
                image.el.getAttribute('href') === source,
            ];

            image.width = 40;
            const sized = [image.el.getAttribute('width'), image.el.getAttribute('height')];

            return { natural, sized, failed: image.failed, naturalSize: image.naturalSize };
        }, PICTURE);

        expect(result.natural).toEqual(['4', '3', true]);
        expect(result.sized).toEqual(['40', '3']);
        expect(result.failed).toBe(false);
        expect(result.naturalSize).toEqual({ width: 4, height: 3 });
    });

    test('shows a placeholder when the image cannot be loaded', async ({ page }) => {
        await openHarness(page);

        const result = await page.evaluate(async () => {
            const { ImageSprite, MISSING_IMAGE } = await import('/src/sprites/image.js');

            const image = new ImageSprite();
            const failed = new Promise((resolve) => image.connect('error', resolve));
            image.source = '/does-not-exist.png';
            await failed;

            return {
                failed: image.failed,
                placeholder: image.el.getAttribute('href') === MISSING_IMAGE,
                missing: image.hasStyleClass('wy-image-missing'),
                size: [image.el.getAttribute('width'), image.el.getAttribute('height')],
            };
        });

        expect(result).toEqual({
            failed: true,
            placeholder: true,
            missing: true,
            size: ['16', '16'],
        });
    });
});
