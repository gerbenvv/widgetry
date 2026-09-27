// Tests of the double validator.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getType } from '../../../core/registry.js';
import { DoubleValidator } from '../double-validator.js';

describe('DoubleValidator', () => {
    test('validates numbers in the locale', () => {
        const validator = new DoubleValidator({ locale: 'en-US' });

        assert.equal(validator.validate('3.14'), true);
        assert.equal(validator.validate('1,234.5'), true);
        assert.equal(validator.validate('1e-3'), true);
        assert.equal(validator.validate('1.2.3'), false);

        const dutch = new DoubleValidator({ locale: 'nl-NL' });
        assert.equal(dutch.validate('3,14'), true);
        assert.equal(dutch.parse('1.234,5'), 1234.5);
    });

    test('checks the range and the number of decimals', () => {
        const validator = new DoubleValidator({
            locale: 'en-US',
            minimum: -1,
            maximum: 1,
            digits: 2,
        });

        assert.equal(validator.validate('0.25'), true);
        assert.equal(validator.validate('0.250'), true);
        assert.equal(validator.validate('0.255'), false);
        assert.equal(validator.validate('2.5e-1'), true);
        assert.equal(validator.validate('2.55e-1'), false);
        assert.equal(validator.validate('1.01'), false);
        assert.equal(validator.validate('-1'), true);
    });

    test('fixes texts up to the notation, range and decimals', () => {
        const validator = new DoubleValidator({ locale: 'en-US', maximum: 5000, digits: 2 });

        assert.equal(validator.fixup('3.14159'), '3.14');
        assert.equal(validator.fixup('1234.5'), '1,234.5');
        assert.equal(validator.fixup('9999'), '5,000');
        assert.equal(validator.fixup('x'), 'x');

        assert.equal(new DoubleValidator({ locale: 'nl-NL' }).fixup('1234.5'), '1.234,5');
        assert.equal(new DoubleValidator({ locale: 'en-US' }).fixup('0.1'), '0.1');
    });

    test('takes decimals as an alias of digits', () => {
        const validator = new DoubleValidator({ locale: 'en-US', decimals: 1 });
        const changes = [];
        validator.connect('digits-change', () => changes.push(validator.digits));

        assert.equal(validator.digits, 1);
        assert.equal(validator.validate('0.25'), false);

        validator.decimals = 2;
        assert.deepEqual([validator.digits, validator.decimals, changes], [2, 2, [2]]);
        assert.equal(validator.validate('0.25'), true);
    });

    test('describes the valid input', () => {
        assert.equal(new DoubleValidator({ locale: 'en-US' }).message, 'Enter a number.');
        assert.equal(
            new DoubleValidator({ locale: 'en-US', minimum: 0.5, maximum: 1.5, decimals: 1 })
                .message,
            'Enter a number from 0.5 to 1.5. At most 1 decimal is allowed.'
        );
        assert.equal(
            new DoubleValidator({ locale: 'nl-NL', minimum: 0.5 }).message,
            'Enter a number of at least 0,5.'
        );
    });

    test('rejects invalid settings and is registered', () => {
        assert.throws(() => new DoubleValidator({ digits: -1 }), RangeError);
        assert.throws(() => new DoubleValidator({ decimals: -1 }), RangeError);
        assert.throws(() => new DoubleValidator({ decimals: 1.5 }), RangeError);
        assert.throws(() => new DoubleValidator({ maximum: NaN }), TypeError);
        assert.equal(getType('double-validator').cls, DoubleValidator);
    });
});
