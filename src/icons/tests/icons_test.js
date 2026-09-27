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

    test('icons can be registered and looked up', () => {
        registerIcon('test-icon', '<svg></svg>');

        assert.equal(getIcon('test-icon'), '<svg></svg>');
        assert.equal(getIcon('no-such-icon'), null);
        assert.ok(getIconNames().includes('test-icon'));
    });
});
