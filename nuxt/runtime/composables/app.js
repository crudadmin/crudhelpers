import { computed } from 'vue';
import { useNuxtApp } from '#app';
import { useAppStore } from '#imports';

import options from '#build/crudadmin/options.mjs';
import { addBootstrapSections, runBootstrap } from '../bootstrap.js';
import { platformHeaders } from '../platform.js';

/**
 * The bootstrap of the app.
 *
 * const bootstrap = useBootstrap();
 * await bootstrap.refresh(['cart']);     // partial refresh
 * bootstrap.addSections(['eshop', 'cart']); // only matters with bootstrap.only
 * await bootstrap.ready();                 // the first bootstrap settled
 */
export const useBootstrap = () => {
    const nuxtApp = useNuxtApp();
    const appStore = useAppStore(nuxtApp.$pinia);

    return {
        path: options.bootstrap?.path,
        booted: computed(() => appStore.booted),
        loading: computed(() => appStore.loading),

        refresh: (only = []) => runBootstrap(nuxtApp, { only, source: 'refresh' }),

        addSections: (sections) => addBootstrapSections(nuxtApp, sections),

        // Starts the first bootstrap when it has not started yet (route middleware runs before
        // app:created of this layer), so it can be awaited on the server as well
        ready: () => nuxtApp._crudBootstrap || nuxtApp._crudBootstrapStart?.() || Promise.resolve(appStore.booted),
    };
};

/**
 * A runtime switch of the backend, from the backendEnv of the `app` section.
 * Without a key the whole map.
 */
export const useBackendEnv = (key, defaultValue = null) => {
    const backendEnv = useAppStore().backendEnv || {};

    if (key === undefined) {
        return backendEnv;
    }

    return key in backendEnv ? backendEnv[key] : defaultValue;
};

/**
 * app-platform, app-version and app-type of this app. Sent with every request
 * by the layer already, this is for anything sent around axios.
 */
export const usePlatformHeaders = () => {
    return platformHeaders(useNuxtApp().$pinia);
};

/**
 * web, ios, android...
 */
export const usePlatform = () => {
    return useAppStore().platform;
};
