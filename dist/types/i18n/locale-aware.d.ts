/**
 * @module i18n/locale-aware
 */
import { Instance } from '../core/instance.js';
import { LocaleManagerClass } from './locale-manager.js';
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
export declare class LocaleAware extends Instance {
    /** @type {LocaleManagerClass | null} */
    _ownLocaleManager: LocaleManagerClass | null;
    /** @type {(() => void) | null} */
    _disconnectLocaleManager: (() => void) | null;
    _initialize(): void;
    /**
     * The locale manager this object uses: its own one when `locale` is set, otherwise
     * `localeManager`, otherwise the singleton.
     *
     * @type {LocaleManagerClass}
     */
    get effectiveLocaleManager(): LocaleManagerClass;
    /**
     * The locale this object uses, e.g. `'en-US'`.
     *
     * @type {string}
     */
    get effectiveLocale(): string;
    /**
     * The time zone of the followed locale manager. A fixed `locale` does not fix the time zone.
     *
     * @protected
     * @returns {string}
     */
    protected _getDefaultTimeZone(): string;
    connect(name: any, method: any, context: any): () => void;
    destroy(): void;
    /**
     * Starts listening to the locale changes of the followed locale manager, so
     * `effective-locale-change` is emitted. Subclasses call this when they need the signal
     * themselves.
     *
     * @protected
     */
    protected _watchLocaleManager(): void;
    _unwatchLocaleManager(): void;
    /**
     * Called when the locale this object uses changed. Subclasses that override it must call the
     * base implementation, which emits `effective-locale-change`.
     *
     * @protected
     */
    protected _onEffectiveLocaleChange(): void;
}

/** The declared properties of {@link LocaleAware}. */
export interface LocaleAware {
    /**
     * A fixed locale as a BCP 47 tag (such as `'nl-NL'`), or `null` (the default) to follow the
     * locale manager.
     */
    locale: any;
    /**
     * The locale manager to follow, or `null` (the default) for the singleton.
     */
    localeManager: any;
}
