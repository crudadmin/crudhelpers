import $GettextTranslator from 'gettext-translator';
import { ref } from 'vue';

//Nuxt 3 loader fix
const GettextTranslator = $GettextTranslator.default || $GettextTranslator;

export default class Translator {
    constructor(rawTranslates) {
        this.rawTranslates = rawTranslates;
        this.revision = ref(0);

        this.gettextSelectors = [
            '__',
            'Gettext',
            'd__',
            'dgettext',
            'dngettext',
            'dnp__',
            'dnpgettext',
            'dp__',
            'dpgettext',
            'gettext',
            'n__',
            'ngettext',
            'np__',
            'npgettext',
            'p__',
            'pgettext',
        ];

        return this;
    }

    setTranslates(_data, { replace = false } = {}) {
        this.rawTranslates = _data;
        this._translates = null;

        const translates = this.getTranslates(this.rawTranslates);

        if (replace) {
            this._translator = new GettextTranslator(translates);
        } else {
            this.getTranslator().loadTranslations(translates);
        }

        this.revision.value++;
    }

    async install(vueApp) {
        vueApp.use({
            install: async (Vue, options) => {
                var _this = this,
                    getSelector = function (selector) {
                        return function () {
                            let a = _this.getTranslator(_this.rawTranslates);
                            var s = selector in a ? selector : '__';

                            return a[s].apply(a, arguments);
                        };
                    };

                let methods = {};

                for (var i = 0; i < this.gettextSelectors.length; i++) {
                    methods[this.gettextSelectors[i]] = getSelector(
                        this.gettextSelectors[i]
                    );
                }

                Vue.mixin({
                    methods: methods,
                });

                // Bind gettext selectors to window
                if (typeof window !== 'undefined') {
                    window.__ = getSelector('__');
                    window.n__ = getSelector('n__');
                }
            },
        });
    }

    getTranslator(translates) {
        // Vue consumers must update when the installed catalog changes.
        this.revision.value;

        translates = translates || this.rawTranslates;

        if (this._translator) {
            return this._translator;
        }

        //Boot localization
        translates = this.getTranslates(translates);

        this._translator = new GettextTranslator(translates);

        return this._translator;
    }

    getTranslates(translates) {
        if (this._translates) {
            return this._translates;
        }

        if (typeof translates == 'function') {
            translates = translates();
        } else if (typeof translates == 'string') {
            translates = JSON.parse(translates);
        }

        return (this._translates = translates);
    }
}
