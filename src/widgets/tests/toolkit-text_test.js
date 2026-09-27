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
});
