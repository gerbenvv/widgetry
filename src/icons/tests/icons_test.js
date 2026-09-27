// Tests of the built-in icons.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getIcon, getIconNames, registerIcon } from '../icons.js';

describe('icons', () => {
    test('every path of every icon starts with a move-to command', () => {
        for (const name of getIconNames()) {
            for (const [, d] of getIcon(name).matchAll(/ d="([^"]*)"/g)) {
                assert.match(d, /^M[\d.-]/, `${name}: ${d}`);
            }
        }
    });

    test('the dots of the information, question and warning icons are filled circles', () => {
        for (const name of [
            'dialog-information',
            'dialog-question',
            'dialog-warning',
            'help-about',
        ]) {
            assert.match(
                getIcon(name),
                /<path d="M[\d.]+ [\d.]+a0\.95 0\.95 0 1 0 [^"]+z" fill="[^"]+"\/>/,
                name
            );
        }
    });

    test('the settings icon is a gear, not the sun of weather-clear', () => {
        const paths = (name) => [...getIcon(name).matchAll(/ d="([^"]*)"/g)].map((x) => x[1]);

        assert.notDeepEqual(paths('preferences-system'), paths('weather-clear'));

        // A gear has teeth: its outline is one closed path of many points.
        const outline = paths('preferences-system')[0];
        const numbers = outline.match(/-?(?:\d+\.?\d*|\.\d+)/g);
        assert.ok(outline.endsWith('z') && numbers.length >= 40, outline);
    });

    test('the bars of the sort icons grow in the order they sort', () => {
        const barLengths = (name) => {
            const paths = [...getIcon(name).matchAll(/ d="([^"]*)"/g)].map((x) => x[1]);

            return [...paths[1].matchAll(/M[\d.]+ [\d.]+h([\d.]+)/g)].map((x) => Number(x[1]));
        };

        const ascending = barLengths('view-sort-ascending');
        const descending = barLengths('view-sort-descending');

        assert.deepEqual(
            ascending,
            [...ascending].sort((a, b) => a - b)
        );
        assert.deepEqual(
            descending,
            [...descending].sort((a, b) => b - a)
        );
    });

    test('icons can be registered and looked up', () => {
        registerIcon('test-icon', '<svg></svg>');

        assert.equal(getIcon('test-icon'), '<svg></svg>');
        assert.equal(getIcon('no-such-icon'), null);
        assert.ok(getIconNames().includes('test-icon'));
    });
});
