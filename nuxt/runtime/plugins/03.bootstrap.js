import { markRaw, watch } from 'vue';
import { defineNuxtPlugin } from '#app';
import { useAjaxStore, useAppStore, useAuthStore, useLocaleStore, useNetworkStore, useOtpStore } from '#imports';

import options from '#build/crudadmin/options.mjs';
import { Axios } from '../../../utils/Axios.js';
import { Response } from '../../../utils/Response.js';
import { Network } from '../../../utils/Network.js';
import { runBootstrap } from '../bootstrap.js';
import { isAuthRequest, logout, persistToken, restoreToken } from '../auth.js';
import { resolveStorageType } from '../authStorage.js';
import { platformHeaders, resolveAppVersion, resolvePlatform } from '../platform.js';

/*
 * Request independent callbacks, registered globally under a key. They read
 * the request through the pinia they are handed, so one registration serves
 * every request of a server and the registry never grows.
 */
const authorization = ({ pinia }) => useAuthStore(pinia).bearer;

const locale = ({ pinia }) => useLocaleStore(pinia).locale;

const platform = ({ pinia }) => platformHeaders(pinia);

const unauthorized = ({ nuxtApp, pinia, error }) => {
    if (options.auth?.logoutOnUnauthorized === false) {
        return;
    }

    // A wrong password answers 401 as well
    if (isAuthRequest(error?.config?.url)) {
        return;
    }

    const authStore = useAuthStore(pinia);

    if (!authStore.token) {
        return;
    }

    if (nuxtApp) {
        logout(nuxtApp, { request: false, refresh: false, source: 'unauthorized' });
    } else {
        authStore.flushData();
    }
};

/**
 * Boot of a CrudAdmin app: axios, auth token, bootstrap and its refresh.
 *
 * Runs after the localization plugins (00, 01) and before the plugins of
 * layers extending helpers (eshop 10-19) and of the project, which register
 * their stores and headers in their own plugins. The bootstrap itself is
 * fetched in app:created, after every plugin, so all of them are registered
 * by then.
 */
export default defineNuxtPlugin({
    name: 'crudadmin:bootstrap',

    async setup(nuxtApp) {
        const pinia = nuxtApp.$pinia;

        // refreshApp() and logout() of the stores reach the request through
        // this, instead of a context which is gone after an await.
        pinia.use(({ store }) => {
            if (store.$id !== 'app' && store.$id !== 'auth') {
                return;
            }

            return {
                $crud: markRaw({
                    bootstrap: (params = {}) => runBootstrap(nuxtApp, { source: 'refresh', ...params }),
                    logout: (params = {}) => logout(nuxtApp, params),
                }),
            };
        });

        const appStore = useAppStore(pinia);
        const authStore = useAuthStore(pinia);

        Axios.configure({
            baseURL: options.bootstrap?.baseURL || nuxtApp.$config.public.crudBootstrap?.baseURL || import.meta.env?.VITE_APP_SERVER_URL,
            token: authorization,
            locale: locale,
        });

        // The stores of helpers receive their bootstrap sections. Definitions
        // are static, so adding them on every request keeps one entry each.
        Response.addStores([useAppStore, useAuthStore, useLocaleStore, useNetworkStore, useAjaxStore, useOtpStore]);

        Axios.addHeaders(platform, 'crudadmin.platform');
        Axios.onUnauthorized(unauthorized, 'crudadmin.auth');

        if (import.meta.server) {
            useNetworkStore(pinia).connected = true;
        }

        appStore.platform = resolvePlatform();

        if (import.meta.client && options.ssr !== true) {
            appStore.setAppVersion(await resolveAppVersion(appStore.platform));
        }

        await restoreToken(nuxtApp);

        if (import.meta.server && resolveStorageType() === 'cookie') {
            // The token travels in the cookie, it does not have to be printed
            // into the html payload as well, where a page cache could keep it.
            nuxtApp.hook('app:rendered', () => {
                const state = nuxtApp.payload.pinia;

                if (state?.auth) {
                    state.auth = { ...state.auth, token: null };
                }
            });
        }

        if (import.meta.client) {
            // Anything assigning the token (a response binding the auth
            // section, a project) ends in the storage.
            watch(
                () => authStore.token,
                () => persistToken(nuxtApp)
            );
        }

        if (options.bootstrap?.enabled !== true) {
            return;
        }

        // The first bootstrap starts once: in app:created, or earlier when route middleware
        // awaits useBootstrap().ready(). The router runs the initial navigation in its own
        // app:created hook, registered before this plugin, so a middleware awaiting a promise
        // created in our app:created would wait for a hook that runs after it (a deadlock on the
        // server, a guest on the first page). All plugins are set up by then, the stores and
        // headers of the layers are registered.
        if (import.meta.server) {
            const skip = options.bootstrap.ssr === false || nuxtApp.ssrContext?.noSSR === true;

            if (!skip) {
                nuxtApp._crudBootstrapStart = () => (nuxtApp._crudBootstrap ||= runBootstrap(nuxtApp, { source: 'server' }));

                nuxtApp.hook('app:created', async () => {
                    await nuxtApp._crudBootstrapStart();
                });
            }

            return;
        }

        // The server answered the bootstrap and the stores arrived with the
        // payload, the client does not ask again.
        const hydrated = nuxtApp.payload.serverRendered === true && appStore.booted === true;

        nuxtApp._crudBootstrapStart = () => {
            if (nuxtApp._crudBootstrap) {
                return nuxtApp._crudBootstrap;
            }

            if (hydrated) {
                nuxtApp._crudBootstrap = nuxtApp
                    .callHook('crudadmin:bootstrap', {
                        nuxtApp,
                        source: 'hydration',
                        partial: false,
                        hydrated: true,
                        only: [],
                        response: null,
                        data: null,
                    })
                    .then(() => true);
            } else {
                nuxtApp._crudBootstrap = runBootstrap(nuxtApp, { source: 'client' });
            }

            if (options.bootstrap.refresh !== false && options.capacitor?.enabled !== true) {
                // Started after the first bootstrap settles, otherwise a stale
                // lastUpdateTime would fetch a second one right away.
                nuxtApp._crudBootstrap.finally(() => startBrowserNetwork(nuxtApp));
            }

            return nuxtApp._crudBootstrap;
        };

        nuxtApp.hook('app:created', async () => {
            const bootstrap = nuxtApp._crudBootstrapStart();

            if (hydrated || options.bootstrap.blocking === true) {
                await bootstrap;
            }
        });
    },
});

/**
 * Refresh of the bootstrap in a browser: on reconnect and every
 * refreshSeconds (backendEnv.APP_REFRESH_SECONDS wins). The Capacitor plugin
 * replaces this in the native app.
 */
const startBrowserNetwork = (nuxtApp) => {
    const pinia = nuxtApp.$pinia;

    const network = new Network({
        user: () => useAuthStore(pinia).user,
    });

    network.refresh(
        () => useAppStore(pinia).refreshApp(),
        () => useAppStore(pinia).backendEnv?.APP_REFRESH_SECONDS || options.bootstrap?.refreshSeconds
    );

    window.addEventListener('online', () => network.setConnected(true, true));
    window.addEventListener('offline', () => network.setConnected(false));

    network.setConnected(navigator.onLine !== false);
};
