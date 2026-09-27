/**
 * @module i18n/locale-aware
 */

import { defineProperties, Instance } from '../core/instance.js';
import { getLocaleManager, LocaleManagerClass } from './locale-manager.js';

/**
 * Base class of the formatters, parsers, validators and the translator. By default they follow the
 * locale manager singleton, so changing `getLocaleManager().locale` changes them all. Setting
 * `locale` gives an object its own fixed locale instead, and `localeManager` makes it follow
 * another locale manager.
 *
 * Signals: `locale-change`, `locale-manager-change`, and `effective-locale-change` whenever the
 * locale the object uses changed, for whatever reason. That last signal is only emitted while
 * handlers are connected to it.
 */
export class LocaleAware extends Instance {
    _initialize() {
        super._initialize();

        /** @type {LocaleManagerClass | null} */
        this._ownLocaleManager = null;

        /** @type {(() => void) | null} */
        this._disconnectLocaleManager = null;
    }

    /**
     * The locale manager this object uses: its own one when `locale` is set, otherwise
     * `localeManager`, otherwise the singleton.
     *
     * @type {LocaleManagerClass}
     */
    get effectiveLocaleManager() {
        return this._ownLocaleManager || this._localeManager || getLocaleManager();
    }

    /**
     * The locale this object uses, e.g. `'en-US'`.
     *
     * @type {string}
     */
    get effectiveLocale() {
        return this.effectiveLocaleManager.locale;
    }

    /**
     * The time zone of the followed locale manager. A fixed `locale` does not fix the time zone.
     *
     * @protected
     * @returns {string}
     */
    _getDefaultTimeZone() {
        return (this._localeManager || getLocaleManager()).timeZone;
    }

    connect(name, method, context) {
        const disconnect = super.connect(name, method, context);

        if (name === 'effective-locale-change') {
            this._watchLocaleManager();
        }

        return disconnect;
    }

    destroy() {
        this._unwatchLocaleManager();

        super.destroy();
    }

    /**
     * Starts listening to the locale changes of the followed locale manager, so
     * `effective-locale-change` is emitted. Subclasses call this when they need the signal
     * themselves.
     *
     * @protected
     */
    _watchLocaleManager() {
        if (this._disconnectLocaleManager) {
            return;
        }

        const manager = this._localeManager || getLocaleManager();
        this._disconnectLocaleManager = manager.connect('locale-change', () => {
            if (!this._ownLocaleManager) {
                this._onEffectiveLocaleChange();
            }
        });
    }

    _unwatchLocaleManager() {
        this._disconnectLocaleManager?.();
        this._disconnectLocaleManager = null;
    }

    /**
     * Called when the locale this object uses changed. Subclasses that override it must call the
     * base implementation, which emits `effective-locale-change`.
     *
     * @protected
     */
    _onEffectiveLocaleChange() {
        this.emit('effective-locale-change', this);
    }
}

defineProperties(LocaleAware, {
    /**
     * A fixed locale as a BCP 47 tag (such as `'nl-NL'`), or `null` (the default) to follow the
     * locale manager.
     */
    locale: {
        value: null,
        coerce(locale) {
            if (locale === null || locale === undefined || locale === '') {
                return null;
            }

            return Intl.getCanonicalLocales(String(locale).replace(/_/g, '-'))[0];
        },
        changed(locale) {
            this._ownLocaleManager = locale ? new LocaleManagerClass({ locale }) : null;

            this._onEffectiveLocaleChange();
        },
    },

    /**
     * The locale manager to follow, or `null` (the default) for the singleton.
     */
    localeManager: {
        value: null,
        coerce(manager) {
            if (manager && !(manager instanceof LocaleManagerClass)) {
                throw new TypeError('The locale manager must be a LocaleManagerClass.');
            }

            return manager || null;
        },
        changed() {
            if (this._disconnectLocaleManager) {
                this._unwatchLocaleManager();
                this._watchLocaleManager();
            }

            if (!this._ownLocaleManager) {
                this._onEffectiveLocaleChange();
            }
        },
    },
});
