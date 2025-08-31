export * from './utils/axios';
export * from './utils/network';

export * from './store/ajaxStore';
export * from './store/networkStore';
export * from './store/otpStore';
export * from './store/localeStore';

import Translator from './utils/Translator';

export const CrudadminVue = {
    install: (app, options) => {
        app.use(new Translator(useLocaleStore().translations));
    },
};

export { Translator };
