import { useLocaleStore } from './store/localeStore.js';

export * from './utils/Axios.js';
export * from './utils/Network.js';
export * from './utils/Modal.js';
export * from './utils/Toast.js';
export * from './utils/Response.js';

export * from './store/index.js';

import Translator from './utils/Translator.js';

export const CrudadminVue = {
    install: (app, options) => {
        app.use(new Translator(useLocaleStore().translations));
    },
};

export { Translator };
