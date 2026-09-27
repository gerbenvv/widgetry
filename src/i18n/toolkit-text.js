/**
 * Translations of the toolkit's own texts: dialog button labels, accessible names and the names
 * of the colors of the color chooser's palette.
 *
 * The toolkit's texts are English. They are translated by the application's translator when it
 * has an entry for them (so an application can override them), and otherwise by the built-in
 * dictionaries below, for the current language.
 *
 * @module i18n/toolkit-text
 */

import { getLocaleManager } from './locale-manager.js';
import { formatString } from './string-formatter.js';
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
        'Saturation %d%%, value %d%%': 'Verzadiging %d%%, helderheid %d%%',
        'Light Scarlet Red': 'Licht scharlakenrood',
        'Scarlet Red': 'Scharlakenrood',
        'Dark Scarlet Red': 'Donker scharlakenrood',
        'Light Orange': 'Licht oranje',
        Orange: 'Oranje',
        'Dark Orange': 'Donker oranje',
        'Light Butter': 'Licht botergeel',
        Butter: 'Botergeel',
        'Dark Butter': 'Donker botergeel',
        'Light Chameleon': 'Licht kameleongroen',
        Chameleon: 'Kameleongroen',
        'Dark Chameleon': 'Donker kameleongroen',
        'Light Sky Blue': 'Licht hemelsblauw',
        'Sky Blue': 'Hemelsblauw',
        'Dark Sky Blue': 'Donker hemelsblauw',
        'Light Plum': 'Licht pruimpaars',
        Plum: 'Pruimpaars',
        'Dark Plum': 'Donker pruimpaars',
        'Light Chocolate': 'Licht chocoladebruin',
        Chocolate: 'Chocoladebruin',
        'Dark Chocolate': 'Donker chocoladebruin',
        'Light Aluminium 1': 'Licht aluminium 1',
        'Aluminium 1': 'Aluminium 1',
        'Dark Aluminium 1': 'Donker aluminium 1',
        'Light Aluminium 2': 'Licht aluminium 2',
        'Aluminium 2': 'Aluminium 2',
        'Dark Aluminium 2': 'Donker aluminium 2',
        Black: 'Zwart',
        'Very Dark Gray': 'Zeer donkergrijs',
        'Darker Gray': 'Donkerder grijs',
        'Medium Dark Gray': 'Middeldonker grijs',
        'Medium Gray': 'Middelgrijs',
        'Light Gray': 'Lichtgrijs',
        'Lighter Gray': 'Lichter grijs',
        'Very Light Gray': 'Zeer lichtgrijs',
        White: 'Wit',
    }),
    de: Object.freeze({
        _Select: 'Aus_wählen',
        'Pick a Color': 'Farbe wählen',
        _OK: '_OK',
        _Cancel: '_Abbrechen',
        _Close: '_Schließen',
        _Yes: '_Ja',
        _No: '_Nein',
        _Apply: 'An_wenden',
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
        'Saturation %d%%, value %d%%': 'Sättigung %d %%, Helligkeit %d %%',
        'Light Scarlet Red': 'Helles Scharlachrot',
        'Scarlet Red': 'Scharlachrot',
        'Dark Scarlet Red': 'Dunkles Scharlachrot',
        'Light Orange': 'Helles Orange',
        Orange: 'Orange',
        'Dark Orange': 'Dunkles Orange',
        'Light Butter': 'Helles Buttergelb',
        Butter: 'Buttergelb',
        'Dark Butter': 'Dunkles Buttergelb',
        'Light Chameleon': 'Helles Chamäleongrün',
        Chameleon: 'Chamäleongrün',
        'Dark Chameleon': 'Dunkles Chamäleongrün',
        'Light Sky Blue': 'Helles Himmelblau',
        'Sky Blue': 'Himmelblau',
        'Dark Sky Blue': 'Dunkles Himmelblau',
        'Light Plum': 'Helles Pflaumenlila',
        Plum: 'Pflaumenlila',
        'Dark Plum': 'Dunkles Pflaumenlila',
        'Light Chocolate': 'Helles Schokoladenbraun',
        Chocolate: 'Schokoladenbraun',
        'Dark Chocolate': 'Dunkles Schokoladenbraun',
        'Light Aluminium 1': 'Helles Aluminium 1',
        'Aluminium 1': 'Aluminium 1',
        'Dark Aluminium 1': 'Dunkles Aluminium 1',
        'Light Aluminium 2': 'Helles Aluminium 2',
        'Aluminium 2': 'Aluminium 2',
        'Dark Aluminium 2': 'Dunkles Aluminium 2',
        Black: 'Schwarz',
        'Very Dark Gray': 'Sehr dunkles Grau',
        'Darker Gray': 'Dunkleres Grau',
        'Medium Dark Gray': 'Mitteldunkles Grau',
        'Medium Gray': 'Mittelgrau',
        'Light Gray': 'Hellgrau',
        'Lighter Gray': 'Helleres Grau',
        'Very Light Gray': 'Sehr helles Grau',
        White: 'Weiß',
    }),
    fr: Object.freeze({
        _Select: '_Sélectionner',
        'Pick a Color': 'Choisir une couleur',
        _OK: '_Valider',
        _Cancel: '_Annuler',
        _Close: '_Fermer',
        _Yes: '_Oui',
        _No: '_Non',
        _Apply: 'A_ppliquer',
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
        'Saturation %d%%, value %d%%': 'Saturation %d %%, luminosité %d %%',
        'Light Scarlet Red': 'Rouge écarlate clair',
        'Scarlet Red': 'Rouge écarlate',
        'Dark Scarlet Red': 'Rouge écarlate foncé',
        'Light Orange': 'Orange clair',
        Orange: 'Orange',
        'Dark Orange': 'Orange foncé',
        'Light Butter': 'Beurre clair',
        Butter: 'Beurre',
        'Dark Butter': 'Beurre foncé',
        'Light Chameleon': 'Caméléon clair',
        Chameleon: 'Caméléon',
        'Dark Chameleon': 'Caméléon foncé',
        'Light Sky Blue': 'Bleu ciel clair',
        'Sky Blue': 'Bleu ciel',
        'Dark Sky Blue': 'Bleu ciel foncé',
        'Light Plum': 'Prune clair',
        Plum: 'Prune',
        'Dark Plum': 'Prune foncé',
        'Light Chocolate': 'Chocolat clair',
        Chocolate: 'Chocolat',
        'Dark Chocolate': 'Chocolat foncé',
        'Light Aluminium 1': 'Aluminium 1 clair',
        'Aluminium 1': 'Aluminium 1',
        'Dark Aluminium 1': 'Aluminium 1 foncé',
        'Light Aluminium 2': 'Aluminium 2 clair',
        'Aluminium 2': 'Aluminium 2',
        'Dark Aluminium 2': 'Aluminium 2 foncé',
        Black: 'Noir',
        'Very Dark Gray': 'Gris très foncé',
        'Darker Gray': 'Gris plus foncé',
        'Medium Dark Gray': 'Gris moyennement foncé',
        'Medium Gray': 'Gris moyen',
        'Light Gray': 'Gris clair',
        'Lighter Gray': 'Gris plus clair',
        'Very Light Gray': 'Gris très clair',
        White: 'Blanc',
    }),
    es: Object.freeze({
        _Select: '_Seleccionar',
        'Pick a Color': 'Elegir un color',
        _OK: '_Aceptar',
        _Cancel: '_Cancelar',
        _Close: '_Cerrar',
        _Yes: '_Sí',
        _No: '_No',
        _Apply: 'A_plicar',
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
        'Saturation %d%%, value %d%%': 'Saturación %d %%, brillo %d %%',
        'Light Scarlet Red': 'Rojo escarlata claro',
        'Scarlet Red': 'Rojo escarlata',
        'Dark Scarlet Red': 'Rojo escarlata oscuro',
        'Light Orange': 'Naranja claro',
        Orange: 'Naranja',
        'Dark Orange': 'Naranja oscuro',
        'Light Butter': 'Mantequilla claro',
        Butter: 'Mantequilla',
        'Dark Butter': 'Mantequilla oscuro',
        'Light Chameleon': 'Camaleón claro',
        Chameleon: 'Camaleón',
        'Dark Chameleon': 'Camaleón oscuro',
        'Light Sky Blue': 'Azul cielo claro',
        'Sky Blue': 'Azul cielo',
        'Dark Sky Blue': 'Azul cielo oscuro',
        'Light Plum': 'Ciruela claro',
        Plum: 'Ciruela',
        'Dark Plum': 'Ciruela oscuro',
        'Light Chocolate': 'Chocolate claro',
        Chocolate: 'Chocolate',
        'Dark Chocolate': 'Chocolate oscuro',
        'Light Aluminium 1': 'Aluminio 1 claro',
        'Aluminium 1': 'Aluminio 1',
        'Dark Aluminium 1': 'Aluminio 1 oscuro',
        'Light Aluminium 2': 'Aluminio 2 claro',
        'Aluminium 2': 'Aluminio 2',
        'Dark Aluminium 2': 'Aluminio 2 oscuro',
        Black: 'Negro',
        'Very Dark Gray': 'Gris muy oscuro',
        'Darker Gray': 'Gris más oscuro',
        'Medium Dark Gray': 'Gris medio oscuro',
        'Medium Gray': 'Gris medio',
        'Light Gray': 'Gris claro',
        'Lighter Gray': 'Gris más claro',
        'Very Light Gray': 'Gris muy claro',
        White: 'Blanco',
    }),
});

/**
 * Translates a text of the toolkit to the current language. Texts with arguments have
 * placeholders of the string formatter, which may be reordered in translations (`%2$d`).
 *
 * @example
 * toolkitText('Close'); // 'Sluiten' in Dutch
 * toolkitText('Saturation %d%%, value %d%%', 50, 75); // 'Verzadiging 50%, helderheid 75%'
 *
 * @param {string} text The English text, e.g. `'_Cancel'` or `'Close'`.
 * @param {...unknown} args The arguments of the placeholders.
 * @returns {string}
 */
export function toolkitText(text, ...args) {
    const translator = getTranslator();
    if (translator.hasEntry(text)) {
        return translator.translate(text, ...args);
    }

    const language = getLocaleManager().language;
    const translation = TOOLKIT_TRANSLATIONS[language]?.[text] ?? text;

    // Like gettext, texts without arguments are not formatted.
    return args.length ? formatString(translation, ...args) : translation;
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
