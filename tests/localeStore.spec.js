import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from 'vue';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { useLocaleStore } from '../store/localeStore.js';

/*
 * The shared locale store of the helpers. Applications extend it on their side,
 * the store itself carries only the bootstrap locale data.
 */
beforeEach(() => {
    setActivePinia(createPinia());
});

describe('useLocaleStore', () => {
    it('holds only the locale, the languages and the translations', () => {
        const locale = useLocaleStore();

        expect(locale.$id).toBe('locale');
        expect(locale.$state).toEqual({ locale: null, languages: [], translations: null });
    });

    it('asks the persistence plugin of the application to keep it', () => {
        const pinia = createPinia();
        const persisted = {};

        //What pinia-plugin-persistedstate reads from the definition of a store
        pinia.use(({ store, options }) => {
            persisted[store.$id] = options.persist;
        });

        //Plugins of pinia run once it is installed into an application
        createApp({}).use(pinia);

        setActivePinia(pinia);

        useLocaleStore();

        expect(persisted.locale).toBe(true);
    });

    it('returns the same instance to every caller of one pinia', () => {
        expect(useLocaleStore()).toBe(useLocaleStore());
    });

    it('resets the shared locale data', () => {
        const locale = useLocaleStore();

        locale.locale = 'sk';
        locale.languages = [{ slug: 'sk' }, { slug: 'en' }];
        locale.translations = { messages: {} };

        const { languages } = storeToRefs(locale);

        expect(languages.value).toHaveLength(2);

        locale.$reset();

        expect(locale.$state).toEqual({ locale: null, languages: [], translations: null });
        expect(languages.value).toEqual([]);
    });
});
