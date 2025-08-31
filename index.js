export * from './utils/axios';
export * from './utils/network';

import Translator from './utils/Translator';

export const CrudadminVue = {
    install: (app, options) => {
        app.use(new Translator(useLocaleStore().translations));
    },
};

export { Translator };
