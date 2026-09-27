/**
 * Translations of the toolkit's own texts: dialog button labels and accessible names.
 *
 * The toolkit's texts are English. They are translated by the application's translator when it
 * has an entry for them (so an application can override them), and otherwise by the built-in
 * dictionaries below, for the current language.
 *
 * @module i18n/toolkit-text
 */

import { getLocaleManager } from './locale-manager.js';
import { getTranslator } from './translator.js';

/**
 * The built-in translations of the toolkit's texts, by language. Underscores mark mnemonics.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const TOOLKIT_TRANSLATIONS = Object.freeze({
    nl: Object.freeze({
        _Select: '_Selecteren',
        'Pick a Color': 'Kies een kleur',
        _OK: '_OK',
        _Cancel: '_Annuleren',
        _Close: '_Sluiten',
        _Yes: '_Ja',
        _No: '_Nee',
        _Apply: '_Toepassen',
        _Help: '_Hulp',
        Close: 'Sluiten',
        Maximize: 'Maximaliseren',
        Restore: 'Herstellen',
        More: 'Meer',
        'Choose date': 'Kies een datum',
        'Previous month': 'Vorige maand',
        'Next month': 'Volgende maand',
        'Previous year': 'Vorig jaar',
        'Next year': 'Volgend jaar',
        Palette: 'Palet',
        'Saturation and value': 'Verzadiging en helderheid',
        Hue: 'Tint',
        Alpha: 'Dekking',
        'Color name': 'Kleurnaam',
    }),
    de: Object.freeze({
        _Select: '_Auswählen',
        'Pick a Color': 'Farbe wählen',
        _OK: '_OK',
        _Cancel: '_Abbrechen',
        _Close: '_Schließen',
        _Yes: '_Ja',
        _No: '_Nein',
        _Apply: '_Anwenden',
        _Help: '_Hilfe',
        Close: 'Schließen',
        Maximize: 'Maximieren',
        Restore: 'Wiederherstellen',
        More: 'Mehr',
        'Choose date': 'Datum wählen',
        'Previous month': 'Vorheriger Monat',
        'Next month': 'Nächster Monat',
        'Previous year': 'Vorheriges Jahr',
        'Next year': 'Nächstes Jahr',
        Palette: 'Palette',
        'Saturation and value': 'Sättigung und Helligkeit',
        Hue: 'Farbton',
        Alpha: 'Deckkraft',
        'Color name': 'Farbname',
    }),
    fr: Object.freeze({
        _Select: '_Sélectionner',
        'Pick a Color': 'Choisir une couleur',
        _OK: '_Valider',
        _Cancel: '_Annuler',
        _Close: '_Fermer',
        _Yes: '_Oui',
        _No: '_Non',
        _Apply: '_Appliquer',
        _Help: 'Ai_de',
        Close: 'Fermer',
        Maximize: 'Agrandir',
        Restore: 'Restaurer',
        More: 'Plus',
        'Choose date': 'Choisir une date',
        'Previous month': 'Mois précédent',
        'Next month': 'Mois suivant',
        'Previous year': 'Année précédente',
        'Next year': 'Année suivante',
        Palette: 'Palette',
        'Saturation and value': 'Saturation et luminosité',
        Hue: 'Teinte',
        Alpha: 'Opacité',
        'Color name': 'Nom de la couleur',
    }),
    es: Object.freeze({
        _Select: '_Seleccionar',
        'Pick a Color': 'Elegir un color',
        _OK: '_Aceptar',
        _Cancel: '_Cancelar',
        _Close: '_Cerrar',
        _Yes: '_Sí',
        _No: '_No',
        _Apply: '_Aplicar',
        _Help: 'Ay_uda',
        Close: 'Cerrar',
        Maximize: 'Maximizar',
        Restore: 'Restaurar',
        More: 'Más',
        'Choose date': 'Elegir fecha',
        'Previous month': 'Mes anterior',
        'Next month': 'Mes siguiente',
        'Previous year': 'Año anterior',
        'Next year': 'Año siguiente',
        Palette: 'Paleta',
        'Saturation and value': 'Saturación y brillo',
        Hue: 'Tono',
        Alpha: 'Opacidad',
        'Color name': 'Nombre del color',
    }),
});

/**
 * Translates a text of the toolkit to the current language.
 *
 * @param {string} text The English text, e.g. `'_Cancel'` or `'Close'`.
 * @returns {string}
 */
export function toolkitText(text) {
    const translator = getTranslator();
    if (translator.hasEntry(text)) {
        return translator.translate(text);
    }

    const language = getLocaleManager().language;

    return TOOLKIT_TRANSLATIONS[language]?.[text] ?? text;
}

/**
 * Calls `update` now and whenever the translations may have changed (the locale or the
 * application's dictionaries), until `owner` is destroyed. Widgets use it to keep their texts in
 * the current language.
 *
 * @param {import('../core/instance.js').Instance} owner
 * @param {() => void} update
 * @returns {() => void} A function that stops the updates.
 */
export function bindToolkitText(owner, update) {
    const translator = getTranslator();

    update();

    const disconnect = translator.connect('change', update);
    owner.connect('destroy', disconnect);

    return disconnect;
}

/**
 * Sets the translated accessible name (`aria-label`) of an element and its descendants that have
 * a `data-wy-label` attribute with the English text.
 *
 * @param {Element} root
 */
export function translateLabels(root) {
    const elements = root.matches('[data-wy-label]') ? [root] : [];
    elements.push(...root.querySelectorAll('[data-wy-label]'));

    for (const element of elements) {
        element.setAttribute('aria-label', toolkitText(element.dataset.wyLabel));
    }
}
