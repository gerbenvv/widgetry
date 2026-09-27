// Browser tests of widgets following the language of the toolkit's own texts.
import { expect, test } from '@playwright/test';

import { openHarness } from '../../../tests/helpers.js';

test.describe('toolkit texts', () => {
    test('dialog buttons and window buttons follow the language', async ({ page }) => {
        const errors = await openHarness(page);

        const result = await page.evaluate(async () => {
            const { Dialog } = await import('/src/widgets/dialog.js');
            const { Response } = await import('/src/core/enums.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = 'en-US';

            const dialog = new Dialog({ title: 'Test' });
            const cancel = dialog.addButton(Response.CANCEL);
            const custom = dialog.addButton(Response.OK, '_Save');
            dialog.show();

            const close = () =>
                dialog.el.querySelector('.wy-window-close').getAttribute('aria-label');
            const before = [cancel.label, custom.label, close()];

            getLocaleManager().locale = 'fr-FR';
            const after = [cancel.label, custom.label, close()];

            getLocaleManager().locale = 'en-US';

            return { before, after };
        });

        expect(result.before).toEqual(['_Cancel', '_Save', 'Close']);
        expect(result.after).toEqual(['_Annuler', '_Save', 'Fermer']);
        expect(errors).toEqual([]);
    });

    test('notebook tabs added later get translated names', async ({ page }) => {
        await openHarness(page);

        const label = await page.evaluate(async () => {
            const { Notebook } = await import('/src/widgets/notebook.js');
            const { Label } = await import('/src/widgets/label.js');
            const { getLocaleManager } = await import('/src/i18n/locale-manager.js');

            getLocaleManager().locale = 'de-DE';

            const notebook = new Notebook({ closable: true });
            notebook.appendPage(new Label({ text: 'Page' }), 'Tab');

            const name = notebook.el
                .querySelector('.wy-notebook-tab-close')
                .getAttribute('aria-label');
            getLocaleManager().locale = 'en-US';

            return name;
        });

        expect(label).toBe('Schließen');
    });

    test('every toolkit text of the widgets has translations', async ({ page }) => {
        await openHarness(page);

        const missing = await page.evaluate(async () => {
            const { TOOLKIT_TRANSLATIONS } = await import('/src/i18n/toolkit-text.js');
            const { DEFAULT_PALETTE, ColorChooser } = await import('/src/widgets/color-chooser.js');
            const { DateEdit } = await import('/src/widgets/date-edit.js');
            const { Calendar } = await import('/src/widgets/calendar.js');

            // The palette names, and the texts rendered with `data-wy-label`.
            const texts = new Set(DEFAULT_PALETTE.map((x) => x.name));
            for (const widget of [new ColorChooser(), new DateEdit(), new Calendar()]) {
                for (const element of widget.el.querySelectorAll('[data-wy-label]')) {
                    texts.add(element.dataset.wyLabel);
                }

                widget.destroy();
            }

            const missing = [];
            for (const [language, dictionary] of Object.entries(TOOLKIT_TRANSLATIONS)) {
                missing.push(
                    ...[...texts].filter((x) => !(x in dictionary)).map((x) => `${language}: ${x}`)
                );
            }

            return { missing, count: texts.size };
        });

        expect(missing.missing).toEqual([]);
        expect(missing.count).toBeGreaterThan(40);
    });
});
