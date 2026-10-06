import { useIsVersionNewer } from '../utils/helpers.js';

/*
 * Options of the `app` store, filled by the `app` section of the bootstrap.
 *
 * Exported as options, not as a store, so a project can extend them and
 * define the store under the same id (its definition then wins the
 * auto-import):
 *
 * export const useAppStore = defineStore('app', {
 *     ...appStore,
 *     state: () => ({ ...appStore.state(), deviceModel: null }),
 * });
 *
 * The Nuxt layer defines the store from these options (nuxt/runtime/stores.js)
 * and wires refreshApp() to its bootstrap.
 */
export const appStore = {
    state() {
        return {
            // True once the first bootstrap answered. Sent by the backend too.
            booted: false,

            // A bootstrap request is running
            loading: false,

            // Runtime switches of the backend (backendEnv section of `app`),
            // read through useBackendEnv(key, default)
            backendEnv: {},

            // Latest version the backend offers for this platform (O12)
            latestVersion: null,

            // Version installed on this device, null on the web
            appVersion: null,

            // web, ios, android, electron..., resolved by the layer on boot
            platform: null,
        };
    },

    actions: {
        /**
         * Fetch the bootstrap again, all sections or only the given ones.
         * Resolves true when it succeeded, which is what Network expects.
         */
        async refreshApp(only = []) {
            if (typeof this.$crud?.bootstrap !== 'function') {
                // prettier-ignore
                console.warn('[@crudadmin/helpers] appStore.refreshApp() needs the bootstrap of the Nuxt layer (crudadmin.bootstrap.enabled).');

                return false;
            }

            return await this.$crud.bootstrap({ only });
        },

        setAppVersion(version) {
            this.appVersion = version || null;
        },
    },

    getters: {
        /**
         * The backend offers a newer version than the installed one. Always
         * false on the web, where appVersion is unknown.
         */
        updateAvailable() {
            if (!this.appVersion || !this.latestVersion) {
                return false;
            }

            return useIsVersionNewer(this.latestVersion, this.appVersion);
        },

        /**
         * Store link of this platform, from backendEnv.APP_STORES.
         */
        updateStoreUrl() {
            const stores = this.backendEnv?.APP_STORES || {};

            return stores[this.platform] || null;
        },
    },
};
