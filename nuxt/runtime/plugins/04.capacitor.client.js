import { defineNuxtPlugin } from '#app';
import { useAppStore, useAuthStore } from '#imports';

import options from '#build/crudadmin/options.mjs';
import { Capacitor } from '../../../capacitor/index.js';

/**
 * Native app boot (crudadmin.capacitor.enabled): network listener with the
 * bootstrap refresher, keyboard state and the Ionic toast opener. Added only
 * when enabled, so web projects need none of the Capacitor packages.
 */
export default defineNuxtPlugin({
    name: 'crudadmin:capacitor',

    setup(nuxtApp) {
        const pinia = nuxtApp.$pinia;

        nuxtApp.hook('app:created', () => {
            const boot = nuxtApp._crudBootstrap || Promise.resolve();

            // After the first bootstrap, so the refresher does not fetch a
            // second one while it runs.
            boot.finally(() => {
                new Capacitor({
                    user: () => useAuthStore(pinia).user,
                    refresh: options.bootstrap?.enabled ? () => useAppStore(pinia).refreshApp() : null,
                    refreshSeconds: () => useAppStore(pinia).backendEnv?.APP_REFRESH_SECONDS || options.bootstrap?.refreshSeconds,
                }).ready(() => nuxtApp.callHook('crudadmin:capacitor:ready', { nuxtApp }));
            });
        });
    },
});
