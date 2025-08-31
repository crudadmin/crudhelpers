import { defineNuxtPlugin } from '#app';
import Translator from '../../utils/Translator';

export default defineNuxtPlugin(async ({ route, redirect, vueApp, hook }) => {
    let translator = new Translator(useLocaleStore().translations);

    await translator.install(vueApp);

    const $translator = translator.getTranslator();

    return {
        provide: {
            translator: $translator,
            __: $translator.__.bind($translator),
            n__: $translator.n__.bind($translator),
        },
    };
});
