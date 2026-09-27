// Tests of the color helpers: parsing, formatting and conversion.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    formatHex,
    formatRgb,
    getLuminance,
    hslToRgb,
    hsvToRgb,
    normalizeColor,
    parseColor,
    parseColorSyntax,
    rgbToHsl,
    rgbToHsv,
} from '../color.js';

// Rounds the channels of a color, for comparing converted colors.
function rounded(color) {
    const result = {};
    for (const [name, value] of Object.entries(color)) {
        result[name] = name === 'a' ? Math.round(value * 1000) / 1000 : Math.round(value);
    }

    return result;
}

describe('parseColorSyntax', () => {
    test('parses hex colors in all four lengths', () => {
        assert.deepEqual(parseColorSyntax('#fa0'), { r: 255, g: 170, b: 0, a: 1 });
        assert.deepEqual(parseColorSyntax('#fa08'), { r: 255, g: 170, b: 0, a: 0x88 / 255 });
        assert.deepEqual(parseColorSyntax('#3465A4'), { r: 52, g: 101, b: 164, a: 1 });
        assert.deepEqual(parseColorSyntax(' #3465a480 '), {
            r: 52,
            g: 101,
            b: 164,
            a: 128 / 255,
        });
    });

    test('rejects malformed hex colors', () => {
        for (const text of ['#', '#12', '#12345', '#1234567', '#ggg', '3465a4', '#3465a4ff0']) {
            assert.equal(parseColorSyntax(text), null, text);
        }
    });

    test('parses rgb() and rgba() in the legacy and modern syntaxes', () => {
        assert.deepEqual(parseColorSyntax('rgb(52, 101, 164)'), { r: 52, g: 101, b: 164, a: 1 });
        assert.deepEqual(parseColorSyntax('RGBA(52,101,164,0.5)'), {
            r: 52,
            g: 101,
            b: 164,
            a: 0.5,
        });
        assert.deepEqual(parseColorSyntax('rgb(52 101 164 / 25%)'), {
            r: 52,
            g: 101,
            b: 164,
            a: 0.25,
        });
        assert.deepEqual(parseColorSyntax('rgb(100% 50% 0%)'), { r: 255, g: 127.5, b: 0, a: 1 });
        assert.deepEqual(parseColorSyntax('rgba(300, -5, none, 2)'), { r: 255, g: 0, b: 0, a: 1 });
    });

    test('rejects malformed rgb() colors', () => {
        for (const text of [
            'rgb(1, 2)',
            'rgb(1 2 3 4)',
            'rgb(1, 2, 3, 4, 5)',
            'rgb(1 2 3 /)',
            'rgb(1 2 3 / 4 / 5)',
            'rgb(1deg 2 3)',
            'rgb(a, b, c)',
            'rgb 1 2 3',
        ]) {
            assert.equal(parseColorSyntax(text), null, text);
        }
    });

    test('parses hsl() and hsla() with angle units', () => {
        assert.deepEqual(rounded(parseColorSyntax('hsl(0, 100%, 50%)')), {
            r: 255,
            g: 0,
            b: 0,
            a: 1,
        });
        assert.deepEqual(rounded(parseColorSyntax('hsl(120deg 100% 25% / 0.5)')), {
            r: 0,
            g: 128,
            b: 0,
            a: 0.5,
        });
        assert.deepEqual(rounded(parseColorSyntax('hsla(0.5turn, 100%, 50%, 50%)')), {
            r: 0,
            g: 255,
            b: 255,
            a: 0.5,
        });
        assert.deepEqual(rounded(parseColorSyntax('hsl(-120, 100%, 50%)')), {
            r: 0,
            g: 0,
            b: 255,
            a: 1,
        });
        assert.equal(parseColorSyntax('hsl(10%, 100%, 50%)'), null);
    });

    test('parses sRGB color() values and transparent', () => {
        assert.deepEqual(parseColorSyntax('color(srgb 1 0.5 0 / 0.25)'), {
            r: 255,
            g: 127.5,
            b: 0,
            a: 0.25,
        });
        assert.deepEqual(parseColorSyntax('transparent'), { r: 0, g: 0, b: 0, a: 0 });
        assert.equal(parseColorSyntax('color(display-p3 1 0 0)'), null);
    });

    test('leaves named colors and other values to the browser', () => {
        assert.equal(parseColorSyntax('red'), null);
        assert.equal(parseColorSyntax(''), null);
        assert.equal(parseColorSyntax(null), null);

        // Without a browser, parseColor() cannot resolve named colors.
        assert.equal(parseColor('red'), null);
        assert.equal(parseColor('   '), null);
        assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
    });
});

describe('formatting', () => {
    test('formats hex colors with alpha only when needed', () => {
        assert.equal(formatHex({ r: 52, g: 101, b: 164, a: 1 }), '#3465a4');
        assert.equal(formatHex({ r: 52.4, g: 100.6, b: 164, a: 0.5 }), '#3465a480');
        assert.equal(formatHex({ r: 52, g: 101, b: 164, a: 1 }, true), '#3465a4ff');
        assert.equal(formatHex({ r: 52, g: 101, b: 164, a: 0.5 }, false), '#3465a4');
        assert.equal(formatHex({ r: 300, g: -1, b: 0, a: 0.999 }), '#ff0000');
    });

    test('formats rgb() and rgba()', () => {
        assert.equal(formatRgb({ r: 52, g: 101, b: 164, a: 1 }), 'rgb(52, 101, 164)');
        assert.equal(formatRgb({ r: 52, g: 101, b: 164, a: 0.25 }), 'rgba(52, 101, 164, 0.25)');
    });

    test('normalizes colors to hex', () => {
        assert.equal(normalizeColor('rgb(52 101 164)'), '#3465a4');
        assert.equal(normalizeColor('hsla(0, 100%, 50%, 0.5)'), '#ff000080');
        assert.equal(normalizeColor('#ABC'), '#aabbcc');
        assert.equal(normalizeColor('nonsense'), null);
    });
});

describe('conversion', () => {
    test('converts between RGB and HSV', () => {
        assert.deepEqual(rgbToHsv(255, 0, 0), { h: 0, s: 1, v: 1 });
        assert.deepEqual(rgbToHsv(0, 0, 0), { h: 0, s: 0, v: 0 });
        assert.deepEqual(rgbToHsv(255, 255, 255), { h: 0, s: 0, v: 1 });

        const hsv = rgbToHsv(52, 101, 164);
        assert.equal(Math.round(hsv.h), 214);
        assert.deepEqual(rounded(hsvToRgb(hsv.h, hsv.s, hsv.v)), { r: 52, g: 101, b: 164 });

        assert.deepEqual(rounded(hsvToRgb(240, 1, 1)), { r: 0, g: 0, b: 255 });
        assert.deepEqual(rounded(hsvToRgb(420, 1, 0.5)), { r: 128, g: 128, b: 0 });
    });

    test('converts between RGB and HSL', () => {
        assert.deepEqual(rgbToHsl(255, 255, 255), { h: 0, s: 0, l: 1 });

        const hsl = rgbToHsl(204, 0, 0);
        assert.equal(hsl.h, 0);
        assert.equal(Math.round(hsl.s * 100), 100);
        assert.equal(Math.round(hsl.l * 100), 40);
        assert.deepEqual(rounded(hslToRgb(hsl.h, hsl.s, hsl.l)), { r: 204, g: 0, b: 0 });
        assert.deepEqual(rounded(hslToRgb(0, 0, 0.5)), { r: 128, g: 128, b: 128 });
    });

    test('round-trips every hue through HSV', () => {
        for (let h = 0; h < 360; h += 15) {
            const rgb = hsvToRgb(h, 0.8, 0.9);
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

            assert.ok(Math.abs(hsv.h - h) < 1e-6, `hue ${h}`);
            assert.ok(Math.abs(hsv.s - 0.8) < 1e-9);
            assert.ok(Math.abs(hsv.v - 0.9) < 1e-9);
        }
    });

    test('computes the relative luminance', () => {
        assert.equal(getLuminance({ r: 0, g: 0, b: 0 }), 0);
        assert.equal(Math.round(getLuminance({ r: 255, g: 255, b: 255 }) * 1000), 1000);
        assert.ok(getLuminance({ r: 252, g: 233, b: 79 }) > 0.5);
        assert.ok(getLuminance({ r: 32, g: 74, b: 135 }) < 0.1);
    });
});
