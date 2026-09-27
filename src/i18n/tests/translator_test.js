// Tests of the translator.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { LocaleManagerClass } from '../locale-manager.js';
import { getTranslator, tr, translate, Translator, trn } from '../translator.js';

function createTranslator(locale = 'en-US', properties = {}) {
    const localeManager = new LocaleManagerClass({ locale });
    const translator = new Translator({ localeManager, ...properties });

    return { localeManager, translator };
}

describe('Translator', () => {
    test('falls back to the identifier with its placeholders replaced', () => {
        const { translator } = createTranslator();

        assert.equal(translator.getEntry('Hello, %s!', ['Anna']), 'Hello, Anna!');
        assert.equal(translator.translate('Plain'), 'Plain');
        assert.equal(translator.hasEntry('Plain'), false);
    });

    test('translates per language and follows the locale', () => {
        const { localeManager, translator } = createTranslator();
        translator.addEntries({ Open: 'Openen', 'Hello, %s!': 'Hallo, %s!' }, 'nl');
        translator.addEntries({ Open: 'Öffnen' }, 'de');

        assert.equal(translator.translate('Open'), 'Open');

        localeManager.locale = 'nl-NL';
        assert.equal(translator.translate('Open'), 'Openen');
        assert.equal(translator.translate('Hello, %s!', 'Anna'), 'Hallo, Anna!');
        assert.equal(translator.hasEntry('Open'), true);

        localeManager.locale = 'de-AT';
        assert.equal(translator.translate('Open'), 'Öffnen');
        assert.deepEqual(translator.languages.sort(), ['de', 'nl']);
    });

    test('prefers the most specific locale, then the fallback language', () => {
        const { translator } = createTranslator('pt-BR', { fallbackLanguage: 'en' });
        translator.addEntries({ color: 'cor', bus: 'autocarro' }, 'pt');
        translator.addEntries({ bus: 'ônibus' }, 'pt-BR');
        translator.addEntries({ color: 'Color', 'file.open': 'Open file' }, 'en');

        assert.equal(translator.translate('bus'), 'ônibus');
        assert.equal(translator.translate('color'), 'cor');
        assert.equal(translator.translate('file.open'), 'Open file');
        assert.equal(translator.translate('missing.key'), 'missing.key');
    });

    test('reorders arguments and formats numbers in the locale', () => {
        const { translator } = createTranslator('nl-NL');
        translator.addEntries({ '%s of %s': '%2$s van %1$s', 'Total: %.2F': 'Totaal: %.2F' });

        assert.equal(translator.translate('%s of %s', 'page', 'book'), 'book van page');
        assert.equal(translator.translate('Total: %.2F', 1234.5), 'Totaal: 1.234,50');
    });

    test('chooses plural forms with the plural rules of the language', () => {
        const { localeManager, translator } = createTranslator('nl-NL');
        translator.addEntries({
            '%d files': { '=0': 'Geen bestanden', one: '%d bestand', other: '%d bestanden' },
        });
        translator.addEntries(
            {
                '%d files': {
                    one: '%d файл',
                    few: '%d файла',
                    many: '%d файлов',
                    other: '%d файла',
                },
            },
            'ru'
        );

        assert.equal(translator.translate('%d files', 0), 'Geen bestanden');
        assert.equal(translator.translate('%d files', 1), '1 bestand');
        assert.equal(translator.translate('%d files', 7), '7 bestanden');
        assert.equal(translator.translate('%d files', '7'), '7 bestanden');

        localeManager.locale = 'ru-RU';
        assert.deepEqual(
            [1, 2, 5, 21, 22, 25, 1.5].map((x) => translator.translate('%d files', x)),
            ['1 файл', '2 файла', '5 файлов', '21 файл', '22 файла', '25 файлов', '1 файла']
        );
    });

    test('translates singular and plural source texts', () => {
        const { localeManager, translator } = createTranslator();
        translator.addEntries({ '%d file': { one: '%d bestand', other: '%d bestanden' } }, 'nl');

        assert.equal(translator.translatePlural('%d file', '%d files', 1), '1 file');
        assert.equal(translator.translatePlural('%d file', '%d files', 3), '3 files');
        assert.equal(
            translator.translatePlural('%d file in %s', '%d files in %s', 2, 'map'),
            '2 files in map'
        );

        localeManager.locale = 'nl';
        assert.equal(translator.translatePlural('%d file', '%d files', 3), '3 bestanden');
        assert.throws(() => translator.translatePlural('%d file', '%d files', '3'), TypeError);
    });

    test('emits signals when the language or the entries change', () => {
        const { localeManager, translator } = createTranslator();
        const events = [];
        translator.connect('language-change', () => events.push('language'));
        translator.connect('entries-change', (_translator, language) => events.push(language));
        translator.connect('change', () => events.push('change'));

        localeManager.locale = 'fr-FR';
        translator.addEntries({ Open: 'Ouvrir' });
        translator.removeEntries('fr');
        translator.removeEntries('fr');

        assert.deepEqual(events, ['language', 'change', 'fr', 'change', 'fr', 'change']);
    });

    test('gets and replaces the entries of the current language', () => {
        const { translator } = createTranslator('nl-NL');
        translator.entries = { Open: 'Openen' };

        assert.deepEqual(translator.entries, { Open: 'Openen' });

        translator.entries = { Close: 'Sluiten' };
        assert.deepEqual(translator.entries, { Close: 'Sluiten' });
        assert.equal(translator.translate('Open'), 'Open');
    });

    test('loads dictionaries on demand, synchronously or asynchronously', async () => {
        const requested = [];
        const { localeManager, translator } = createTranslator('en-US', {
            loader: (language) => {
                requested.push(language);

                if (language === 'nl') {
                    return { Open: 'Openen' };
                }

                if (language === 'de') {
                    return Promise.resolve({ Open: 'Öffnen' });
                }

                if (language === 'fr') {
                    return Promise.reject(new Error('offline'));
                }

                return null;
            },
        });

        assert.equal(translator.translate('Open'), 'Open');

        localeManager.locale = 'nl-NL';
        assert.equal(translator.translate('Open'), 'Openen');

        localeManager.locale = 'de-DE';
        assert.equal(translator.translate('Open'), 'Open');
        await translator.whenLoaded();
        assert.equal(translator.translate('Open'), 'Öffnen');

        const errors = [];
        translator.connect('load-error', (_translator, language, error) =>
            errors.push([language, error.message])
        );
        localeManager.locale = 'fr-FR';
        await assert.rejects(translator.whenLoaded(), /offline/);
        assert.deepEqual(errors, [['fr', 'offline']]);

        // A failed language is requested again on the next lookup.
        assert.equal(translator.translate('Open'), 'Open');
        await assert.rejects(translator.whenLoaded(), /offline/);

        assert.deepEqual(requested, [
            'en-US',
            'en',
            'nl-NL',
            'nl',
            'de-DE',
            'de',
            'fr-FR',
            'fr',
            'fr',
        ]);
    });

    test('rejects malformed entries', () => {
        const { translator } = createTranslator();

        assert.throws(() => translator.addEntries(null), TypeError);
        assert.throws(() => translator.addEntries({ a: 5 }), TypeError);
        assert.throws(() => translator.addEntries({ a: { one: 'x' } }), /no 'other'/);
        assert.throws(
            () => translator.addEntries({ a: { some: 'x', other: 'y' } }),
            /Invalid plural/
        );
        assert.throws(() => translator.addEntries({ a: 'x' }, ''), TypeError);
        assert.throws(() => translator.getEntry(5), TypeError);
        assert.throws(() => translator.getEntry('a', 'b'), TypeError);
        assert.throws(() => (translator.loader = 'x'), TypeError);
    });

    test('provides convenience functions on the singleton', () => {
        assert.equal(getTranslator(), getTranslator());
        assert.equal(tr, translate);
        assert.equal(translate('%d%%', 5), '5%');
        assert.equal(trn('%d item', '%d items', 2), '2 items');
    });
});
