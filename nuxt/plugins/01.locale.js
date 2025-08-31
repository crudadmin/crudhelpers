import { defineNuxtPlugin } from '#app';
import Translator from '../../utils/Translator';

export default defineNuxtPlugin(async ({ vueApp, $pinia }) => {
    let translator = new Translator(useLocaleStore($pinia).translations);

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
