export * from './utils/Axios';
export * from './utils/Network';

import Translator from './utils/Translator';

export const CrudadminVue = {
    install: (app, options) => {
        app.use(new Translator(useLocaleStore().translations));
    },
};

export { Translator };
