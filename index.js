import { watch } from 'vue';
import { useLocaleStore } from './store/localeStore.js';

export * from './utils/Axios.js';
export * from './utils/Network.js';
export * from './modal/index.js';
export * from './utils/Response.js';

export * from './store/index.js';

import Translator from './utils/Translator.js';

export const CrudadminVue = {
    install: (app, options) => {
        const locale = useLocaleStore();
        const translator = new Translator();
        app.use(translator);

        const stop = watch(
            () => locale.translations,
            (translations) =>
                translator.setTranslates(translations || [], { replace: true }),
            { immediate: true, flush: 'sync' }
        );

        app.onUnmount?.(stop);
    },
};

export { Translator };
