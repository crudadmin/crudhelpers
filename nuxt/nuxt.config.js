import { createResolver } from '@nuxt/kit';
const { resolve } = createResolver(import.meta.url);

// Stores, utilities and the app/auth composables are registered as
// auto-imports by the module (addImports), not by scanning ../store: the
// scanner misread the `state() {` shorthand of every defineStore() as an
// export and every project got false "Duplicated imports: state" warnings.
export default {
    modules: [resolve('./module.js')],
};
