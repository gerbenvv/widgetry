// Tests of the regular expression validator and the validator base class.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getType } from '../../../core/registry.js';
import { RegexpValidator } from '../regexp-validator.js';
import { Validator } from '../validator.js';

describe('RegexpValidator', () => {
    test('matches the whole text', () => {
        const validator = new RegexpValidator({ regexp: /[A-Z]{2}\d{4}/ });

        assert.equal(validator.validate('AB1234'), true);
        assert.equal(validator.validate('xAB1234'), false);
        assert.equal(validator.validate('AB12345'), false);
        assert.equal(validator.validate('AB1234|x'), false);
    });

    test('accepts strings and flags, and ignores global state', () => {
        const validator = new RegexpValidator({ regexp: 'a|b' });
        assert.equal(validator.validate('a'), true);
        assert.equal(validator.validate('ab'), false);

        validator.regexp = /yes/gi;
        assert.equal(validator.validate('YES'), true);
        assert.equal(validator.validate('YES'), true);
    });

    test('has a message, fixes nothing up and requires a regular expression', () => {
        const validator = new RegexpValidator();

        assert.equal(validator.message, 'The text does not have the right format.');
        assert.equal(validator.fixup(' x '), ' x ');
        assert.throws(() => validator.validate('x'), /no regular expression/);
        assert.throws(() => (validator.regexp = 5), TypeError);
        assert.equal(getType('regexp-validator').cls, RegexpValidator);
    });
});

describe('Validator', () => {
    test('must be subclassed', () => {
        const validator = new Validator({ allowEmpty: true });

        assert.equal(validator.validate(''), true);
        assert.throws(() => validator.validate('x'), /does not implement/);
        assert.equal(validator.message, 'The value is not valid.');
        assert.throws(() => validator.fixup(null), TypeError);
    });

    test('supports custom validators', () => {
        class EvenValidator extends Validator {
            _validate(text) {
                return Number(text) % 2 === 0;
            }
        }

        const validator = new EvenValidator();
        assert.equal(validator.validate('4'), true);
        assert.equal(validator.validate('5'), false);
    });
});
