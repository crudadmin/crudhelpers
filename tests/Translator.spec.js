import { describe, it, expect, afterEach } from 'vitest';
import { createApp, defineComponent, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { Translator, CrudadminVue, useLocaleStore } from '../index.js';

// A catalog in the shape gettext-translator loads
const catalog = (messages, domain = '') => ({
    domain,
    'plural-forms': 'nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;',
    messages: { '': messages },
});

afterEach(() => {
    delete window.__;
    delete window.n__;
});

describe('Translator.setTranslates()', () => {
    it('drops the parsed catalog for objects, JSON strings and callbacks', () => {
        const translator = new Translator(catalog({ Login: ['Prihlásiť sa'] }));

        expect(translator.getTranslator().__('Login')).toBe('Prihlásiť sa');

        translator.setTranslates(JSON.stringify(catalog({ Logout: ['Odhlásiť sa'] })));

        expect(translator.getTranslator().__('Logout')).toBe('Odhlásiť sa');

        translator.setTranslates(() => catalog({ Save: ['Uložiť'] }));

        expect(translator.getTranslator().__('Save')).toBe('Uložiť');

        translator.setTranslates(catalog({ Cancel: ['Zrušiť'] }));

        expect(translator.getTranslator().__('Cancel')).toBe('Zrušiť');
        expect(translator.getTranslates()).toEqual(catalog({ Cancel: ['Zrušiť'] }));
    });

    it('merges a default update into the same gettext instance', () => {
        const translator = new Translator(catalog({ Login: ['Prihlásiť sa'], Save: ['Uložiť'] }));
        const gettext = translator.getTranslator();

        translator.setTranslates(catalog({ Save: ['Uložiť zmeny'], Logout: ['Odhlásiť sa'] }));

        expect(translator.getTranslator()).toBe(gettext);

        //Messages which the update does not carry are kept, the others are overwritten or added
        expect(gettext.__('Login')).toBe('Prihlásiť sa');
        expect(gettext.__('Save')).toBe('Uložiť zmeny');
        expect(gettext.__('Logout')).toBe('Odhlásiť sa');
    });

    it('keeps sending default updates to a consumer which retained the gettext instance', () => {
        const translator = new Translator(catalog({}));

        //A Nuxt plugin keeps the instance it got at boot
        const retained = translator.getTranslator();

        translator.setTranslates(catalog({ Login: ['Prihlásiť sa'] }));
        translator.setTranslates(catalog({ Logout: ['Odhlásiť sa'] }));

        expect(retained.__('Login')).toBe('Prihlásiť sa');
        expect(retained.__('Logout')).toBe('Odhlásiť sa');
    });

    it('removes old messages and domains with replace: true', () => {
        const translator = new Translator(catalog({ Login: ['Prihlásiť sa'], Private: ['Súkromné'] }));

        translator.getTranslator().loadTranslations(catalog({ Admin: ['Administrácia'] }, 'admin'));

        const previous = translator.getTranslator();

        expect(previous.d__('admin', 'Admin')).toBe('Administrácia');

        translator.setTranslates(catalog({ Login: ['Login EN'] }), { replace: true });

        const current = translator.getTranslator();

        expect(current).not.toBe(previous);
        expect(current.__('Login')).toBe('Login EN');
        expect(current.__('Private')).toBe('Private');
        expect(current.d__('admin', 'Admin')).toBe('Admin');
    });

    it('resets to the source texts when replaced with an empty catalog', () => {
        const translator = new Translator(catalog({ Login: ['Prihlásiť sa'] }));

        translator.getTranslator();
        translator.setTranslates([], { replace: true });

        expect(translator.getTranslator().__('Login')).toBe('Login');
    });

    it('bumps the revision on every update', () => {
        const translator = new Translator(catalog({}));

        translator.setTranslates(catalog({ A: ['B'] }));
        translator.setTranslates(catalog({ A: ['C'] }), { replace: true });

        expect(translator.revision.value).toBe(2);
    });
});

describe('Translator.install()', () => {
    it('re-renders components and updates the global helpers when the catalog changes', async () => {
        const translator = new Translator(catalog({ Login: ['Prihlásiť sa'] }));

        const Component = defineComponent({
            template: `<span>{{ __('Login') }} / {{ n__('%d file', '%d files', 3, 3) }}</span>`,
        });

        const wrapper = mount(Component, { global: { plugins: [translator] } });

        expect(wrapper.text()).toBe('Prihlásiť sa / 3 files');
        expect(window.__('Login')).toBe('Prihlásiť sa');

        translator.setTranslates(catalog({ Login: ['Login EN'], '%d file': ['%d súbor', '%d súbory', '%d súborov'] }), { replace: true });

        await nextTick();

        expect(wrapper.text()).toBe('Login EN / 3 súbory');
        expect(window.__('Login')).toBe('Login EN');
        expect(window.n__('%d file', '%d files', 5, 5)).toBe('5 súborov');

        wrapper.unmount();
    });
});

describe('CrudadminVue', () => {
    it('follows the translations of the locale store, replacing the whole catalog', async () => {
        const pinia = createPinia();

        setActivePinia(pinia);

        const app = createApp({ template: `<b>{{ __('Login') }}</b>` });

        app.use(pinia);
        app.use(CrudadminVue);

        const root = document.createElement('div');

        document.body.appendChild(root);
        app.mount(root);

        expect(root.textContent).toBe('Login');

        const locale = useLocaleStore();

        //Catalogs arriving after the boot
        locale.translations = catalog({ Login: ['Prihlásiť sa'], Private: ['Súkromné'] });

        await nextTick();

        expect(root.textContent).toBe('Prihlásiť sa');
        expect(window.__('Private')).toBe('Súkromné');

        //A logout resets the store, the private messages must not survive it
        locale.$reset();

        await nextTick();

        expect(root.textContent).toBe('Login');
        expect(window.__('Private')).toBe('Private');

        //A later login without a document reload
        locale.translations = catalog({ Login: ['Anmelden'] });

        await nextTick();

        expect(root.textContent).toBe('Anmelden');

        app.unmount();
        root.remove();
    });
});
