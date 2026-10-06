import { useCookie } from '#app';

import options from '#build/crudadmin/options.mjs';
import { Preferences } from '#build/crudadmin/preferences.mjs';
import { runInScope } from '../../utils/Registry.js';

const STORAGE_KEY = 'crudadmin.auth.token';

/**
 * Where the token of this build is kept.
 *
 * auto: a cookie on the web build, so the server renders the logged in state
 * (the server cannot read localStorage), and localStorage in the SPA build.
 */
export const resolveStorageType = () => {
    const type = options.auth?.storage;

    if (type === 'auto' || type === undefined || type === null) {
        return options.ssr === true ? 'cookie' : 'local';
    }

    return type;
};

const cookieStorage = (nuxtApp) => {
    const config = options.auth?.cookie || {};

    // Created once per request while the Nuxt context is there. The ref reads
    // the request cookie on the server and writes Set-Cookie when it changes.
    const cookie = runInScope(nuxtApp, () =>
        useCookie(config.name || 'auth_token', {
            path: '/',
            maxAge: config.maxAge ?? 60 * 60 * 24 * 365,
            sameSite: config.sameSite || 'lax',
            secure: config.secure ?? !import.meta.dev,
            default: () => null,
        })
    );

    return {
        type: 'cookie',
        read: async () => cookie.value || null,
        write: async (token) => {
            cookie.value = token || null;
        },
    };
};

const localStorageStorage = () => {
    const storage = () => {
        try {
            return import.meta.client ? window.localStorage : null;
        } catch (e) {
            return null;
        }
    };

    return {
        type: 'local',
        read: async () => {
            try {
                const value = storage()?.getItem(STORAGE_KEY);

                return value ? JSON.parse(value) : null;
            } catch (e) {
                return null;
            }
        },
        write: async (token) => {
            try {
                if (token) {
                    storage()?.setItem(STORAGE_KEY, JSON.stringify(token));
                } else {
                    storage()?.removeItem(STORAGE_KEY);
                }
            } catch (e) {
                console.error(e);
            }
        },
    };
};

const preferencesStorage = () => {
    if (!Preferences) {
        // prettier-ignore
        console.warn('[@crudadmin/helpers] auth.storage is preferences, but @capacitor/preferences was not found at build time. The token is not kept.');

        return noStorage();
    }

    return {
        type: 'preferences',
        read: async () => {
            if (import.meta.server) {
                return null;
            }

            try {
                const { value } = await Preferences.get({ key: STORAGE_KEY });

                return value ? JSON.parse(value) : null;
            } catch (e) {
                return null;
            }
        },
        write: async (token) => {
            if (import.meta.server) {
                return;
            }

            if (token) {
                await Preferences.set({
                    key: STORAGE_KEY,
                    value: JSON.stringify(token),
                });
            } else {
                await Preferences.remove({ key: STORAGE_KEY });
            }
        },
    };
};

const noStorage = () => ({
    type: false,
    read: async () => null,
    write: async () => {},
});

/**
 * Token storage of this request (server) or app (client). Kept on the nuxtApp,
 * never on the module, so nothing of one request survives into another.
 */
export const useAuthStorage = (nuxtApp) => {
    if (!nuxtApp._crudAuthStorage) {
        const type = resolveStorageType();

        nuxtApp._crudAuthStorage =
            type === 'cookie'
                ? cookieStorage(nuxtApp)
                : type === 'local'
                  ? localStorageStorage()
                  : type === 'preferences'
                    ? preferencesStorage()
                    : noStorage();
    }

    return nuxtApp._crudAuthStorage;
};
