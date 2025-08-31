export * from './utils/Axios';
export * from './utils/Network';
export * from './utils/Modal';
export * from './utils/Toast';
export * from './utils/Response';

import Translator from './utils/Translator';

export const CrudadminVue = {
    install: (app, options) => {
        app.use(new Translator(useLocaleStore().translations));
    },
};

export { Translator };
