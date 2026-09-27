// Tests of the integer validator.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getType } from '../../../core/registry.js';
import { LocaleManagerClass } from '../../../i18n/locale-manager.js';
import { IntegerValidator } from '../integer-validator.js';

describe('IntegerValidator', () => {
    test('validates integers in the locale', () => {
        const validator = new IntegerValidator({ locale: 'en-US' });

        assert.equal(validator.validate('42'), true);
        assert.equal(validator.validate('-1,234'), true);
        assert.equal(validator.validate('4.5'), false);
        assert.equal(validator.validate('abc'), false);
        assert.equal(validator.isValid('42'), true);

        const dutch = new IntegerValidator({ locale: 'nl-NL', lenient: false });
        assert.equal(dutch.validate('1.234'), true);
        assert.equal(dutch.validate('1,234'), false);
    });

    test('checks the range', () => {
        const validator = new IntegerValidator({ locale: 'en-US', minimum: 0, maximum: 100 });

        assert.equal(validator.validate('0'), true);
        assert.equal(validator.validate('100'), true);
        assert.equal(validator.validate('101'), false);
        assert.equal(validator.validate('-1'), false);
        assert.equal(validator.parse('50'), 50);
        assert.equal(validator.parse('500'), null);
    });

    test('handles empty texts', () => {
        const validator = new IntegerValidator({ locale: 'en-US' });
        assert.equal(validator.validate(''), false);
        assert.equal(validator.validate('  '), false);

        validator.allowEmpty = true;
        assert.equal(validator.validate(''), true);
        assert.equal(validator.parse(''), null);
        assert.throws(() => validator.validate(42), TypeError);
    });

    test('fixes texts up to the notation and range', () => {
        const validator = new IntegerValidator({ locale: 'en-US', minimum: 0, maximum: 10000 });

        assert.equal(validator.fixup('1234'), '1,234');
        assert.equal(validator.fixup(' 12 '), '12');
        assert.equal(validator.fixup('20000'), '10,000');
        assert.equal(validator.fixup('-5'), '0');
        assert.equal(validator.fixup('abc'), 'abc');

        assert.equal(new IntegerValidator({ locale: 'de-DE' }).fixup('1234567'), '1.234.567');
    });

    test('describes the valid input in the language', () => {
        assert.equal(new IntegerValidator({ locale: 'en-US' }).message, 'Enter a whole number.');
        assert.equal(
            new IntegerValidator({ locale: 'en-US', minimum: 1, maximum: 10000 }).message,
            'Enter a whole number from 1 to 10,000.'
        );
        assert.equal(
            new IntegerValidator({ locale: 'en-US', minimum: 1 }).message,
            'Enter a whole number of at least 1.'
        );
        assert.equal(
            new IntegerValidator({ locale: 'en-US', maximum: 9 }).message,
            'Enter a whole number of at most 9.'
        );

        const validator = new IntegerValidator({ locale: 'en-US', message: 'Enter your age.' });
        assert.equal(validator.message, 'Enter your age.');
        validator.message = null;
        assert.equal(validator.message, 'Enter a whole number.');
    });

    test('emits change when its settings or locale change', () => {
        const manager = new LocaleManagerClass({ locale: 'en-US' });
        const validator = new IntegerValidator({ localeManager: manager });
        let changes = 0;
        validator.connect('change', () => (changes += 1));

        validator.minimum = 5;
        validator.maximum = 10;
        validator.allowEmpty = true;
        manager.locale = 'nl-NL';

        assert.equal(changes, 4);
    });

    test('rejects invalid settings and is registered', () => {
        assert.throws(() => new IntegerValidator({ minimum: '5' }), TypeError);
        assert.throws(() => new IntegerValidator({ message: 5 }), TypeError);
        assert.equal(getType('integer-validator').cls, IntegerValidator);
    });
});
