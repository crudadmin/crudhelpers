import { defineNuxtPlugin, tryUseNuxtApp } from '#app';

import { Axios } from '../../utils/Axios.js';

/**
 * Let Axios and Response find the request they serve.
 *
 * They are module singletons shared by every request of a server, so
 * everything a layer registers from a plugin (headers, unauthorized
 * handlers) is kept per nuxtApp, and the stores of a response are resolved
 * with its pinia. Setting the same resolver on every request is not state.
 */
export default defineNuxtPlugin({
    name: 'crudadmin:axios',

    setup() {
        Axios.setScopeResolver(tryUseNuxtApp);
    },
});
