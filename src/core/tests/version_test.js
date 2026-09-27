// Tests that the exported version matches the package.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

import { VERSION } from '../version.js';

describe('VERSION', () => {
    test('equals the version in package.json', () => {
        const packageJson = JSON.parse(
            readFileSync(new URL('../../../package.json', import.meta.url))
        );

        assert.equal(VERSION, packageJson.version);
    });
});
