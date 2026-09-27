// Tests of translated texts.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getType } from '../../core/registry.js';
import { LocaleManagerClass } from '../locale-manager.js';
import { __, __n, TranslatedText } from '../translated-text.js';
import { Translator } from '../translator.js';

function createTranslator() {
    const localeManager = new LocaleManagerClass({ locale: 'en-US' });
    const translator = new Translator({ localeManager });
    translator.addEntries(
        {
            'Hello, %s!': 'Hallo, %s!',
            '%d file': { one: '%d bestand', other: '%d bestanden' },
        },
        'nl'
    );

    return { localeManager, translator };
}

describe('TranslatedText', () => {
    test('translates its id with its arguments', () => {
        const { localeManager, translator } = createTranslator();
        const text = new TranslatedText({ id: 'Hello, %s!', arguments: ['Anna'], translator });

        assert.equal(text.text, 'Hello, Anna!');
        assert.equal(String(text), 'Hello, Anna!');
        assert.equal(`${text}`, 'Hello, Anna!');
        assert.equal(JSON.stringify({ text }), '{"text":"Hello, Anna!"}');

        localeManager.locale = 'nl-NL';
        assert.equal(text.text, 'Hallo, Anna!');
    });

    test('emits text-change when the translation changes', () => {
        const { localeManager, translator } = createTranslator();
        const text = new TranslatedText({ id: 'Hello, %s!', arguments: ['Anna'], translator });
        const changes = [];
        const disconnect = text.connect('text-change', () => changes.push(text.text));

        localeManager.locale = 'nl-NL';
        localeManager.locale = 'nl-BE';
        translator.addEntries({ 'Hello, %s!': 'Dag, %s!' }, 'nl-BE');
        localeManager.locale = 'en-US';

        assert.deepEqual(changes, ['Hallo, Anna!', 'Dag, Anna!', 'Hello, Anna!']);

        // Without handlers it stops listening to the translator.
        disconnect();
        assert.equal(translator._signalDispatcher.hasHandlers('change'), false);

        localeManager.locale = 'nl-NL';
        assert.deepEqual(changes.length, 3);
    });

    test('stops listening when disconnected by method or destroyed', () => {
        const { translator } = createTranslator();
        const text = new TranslatedText({ id: 'x', translator });

        function handler() {}

        text.connect('text-change', handler);
        assert.equal(translator._signalDispatcher.hasHandlers('change'), true);

        text.disconnect('text-change', handler);
        assert.equal(translator._signalDispatcher.hasHandlers('change'), false);

        text.connect('text-change', handler);
        text.destroy();
        assert.equal(translator._signalDispatcher.hasHandlers('change'), false);
    });

    test('supports plural forms', () => {
        const { localeManager, translator } = createTranslator();
        const text = new TranslatedText({
            id: '%d file',
            plural: '%d files',
            arguments: [3],
            translator,
        });

        assert.equal(text.text, '3 files');

        localeManager.locale = 'nl-NL';
        assert.equal(text.text, '3 bestanden');
    });

    test('is immutable', () => {
        const text = __('Hello, %s!', 'Anna');

        assert.deepEqual(text.arguments, ['Anna']);
        assert.throws(() => (text.id = 'other'), /cannot be changed/);
        assert.throws(() => (text.arguments = []), /cannot be changed/);
        assert.throws(() => text.arguments.push('x'), TypeError);
        assert.throws(() => new TranslatedText({ id: 5 }), TypeError);
        assert.equal(new TranslatedText().text, '');
    });

    test('has shortcuts and a builder type', () => {
        assert.equal(__('%d%%', 5).text, '5%');
        assert.equal(__n('%d item', '%d items', 1).text, '1 item');
        assert.equal(getType('translated-text').cls, TranslatedText);
    });
});
