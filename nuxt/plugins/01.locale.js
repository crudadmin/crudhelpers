import { watch } from 'vue';
import { defineNuxtPlugin } from '#app';
import Translator from '../../utils/Translator';

export default defineNuxtPlugin(async ({ vueApp, $pinia }) => {
    // We need pass pinia store to the translator
    // Because this plugin may be loaded before NUXT pinia state is ready.
    // And nuxt is using different store than classic vue apps.
    const localeStore = useLocaleStore($pinia);

    let translator = new Translator();

    await translator.install(vueApp);

    const $translator = translator.getTranslator();

    // When translations are set, we need to update the translator
    watch(
        () => localeStore.translations,
        (newVal, oldVal) => {
            if (!newVal) {
                return;
            }

            translator.setTranslates(useLocaleStore().translations);
        },
        { immediate: true }
    );

    return {
        provide: {
            translator: $translator,
            __: $translator.__.bind($translator),
            n__: $translator.n__.bind($translator),
        },
    };
});
