export * from './utils/Axios';
export * from './utils/Network';
export * from './utils/Modal';

import Translator from './utils/Translator';

export const CrudadminVue = {
    install: (app, options) => {
        app.use(new Translator(useLocaleStore().translations));
    },
};

export { Translator };
