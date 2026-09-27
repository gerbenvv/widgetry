// Tests of the translations of the toolkit's own texts.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getLocaleManager } from '../locale-manager.js';
import { TOOLKIT_TRANSLATIONS, toolkitText } from '../toolkit-text.js';
import { getTranslator } from '../translator.js';

describe('toolkitText', () => {
    test('translates to the current language, falling back to English', () => {
        const manager = getLocaleManager();

        manager.locale = 'nl-NL';
        assert.equal(toolkitText('_Cancel'), '_Annuleren');
        assert.equal(toolkitText('Close'), 'Sluiten');

        manager.locale = 'de-AT';
        assert.equal(toolkitText('_Cancel'), '_Abbrechen');

        manager.locale = 'ja-JP';
        assert.equal(toolkitText('_Cancel'), '_Cancel');
        assert.equal(toolkitText('Something else'), 'Something else');
    });

    test('lets the application override the built-in translations', () => {
        getLocaleManager().locale = 'nl-NL';
        getTranslator().addEntries({ _Cancel: '_Stoppen' }, 'nl');

        assert.equal(toolkitText('_Cancel'), '_Stoppen');

        getTranslator().removeEntries('nl');
        assert.equal(toolkitText('_Cancel'), '_Annuleren');
    });

    test('every language translates every text, keeping one mnemonic in labels', () => {
        const texts = Object.keys(TOOLKIT_TRANSLATIONS.nl);

        for (const [language, dictionary] of Object.entries(TOOLKIT_TRANSLATIONS)) {
            assert.deepEqual(Object.keys(dictionary).sort(), [...texts].sort(), language);

            for (const [text, translation] of Object.entries(dictionary)) {
                const underscores = (translation.match(/_/g) || []).length;
                assert.equal(
                    underscores,
                    text.startsWith('_') ? 1 : 0,
                    `${language}: ${translation}`
                );
            }
        }
    });
});
