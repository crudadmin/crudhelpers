import options from '#build/crudadmin/options.mjs';
import { useAuthStore } from '#imports';

import { Response } from '../../utils/Response.js';
import { useAxios } from '../../utils/helpers.js';
import { useAuthStorage } from './authStorage.js';

// bootstrap.js imports this file too. The cycle is safe, both only call each
// other's functions at run time, never while the modules evaluate.
import { runBootstrap } from './bootstrap.js';

/**
 * Backend path of an auth action, from crudadmin.auth.routes.
 */
export const authRoute = (name) => {
    const path = (options.auth?.routes || {})[name];

    if (!path) {
        throw new Error(`[@crudadmin/helpers] crudadmin.auth.routes.${name} is not configured.`);
    }

    return path;
};

/**
 * Write the token of the auth store into the storage of this build.
 */
export const persistToken = async (nuxtApp) => {
    const authStore = useAuthStore(nuxtApp.$pinia);

    await useAuthStorage(nuxtApp).write(authStore.token || null);
};

/**
 * Restore the stored token into the auth store, unless it already has one
 * (hydrated from the server, or persisted with the store).
 */
export const restoreToken = async (nuxtApp) => {
    const authStore = useAuthStore(nuxtApp.$pinia);

    if (authStore.token) {
        return authStore.token;
    }

    const token = await useAuthStorage(nuxtApp).read();

    if (token) {
        authStore.token = token;
    }

    return token;
};

/**
 * The AuthResponse of PHP helpers, wherever the response carries it.
 *
 * A project overriding authorizedResponse() with its AppRequest (scorentino)
 * answers { store: { auth: {...}, cart: {...}, ... } }, the stock helpers
 * controller answers { data: { driver, user, token } }.
 */
const extractAuthResponse = (response) => {
    const data = response?.data;

    if (data && typeof data === 'object' && 'driver' in data && 'user' in data) {
        return data;
    }

    return null;
};

/**
 * Hydrate the stores from an auth response, like a bootstrap does, so every
 * section the backend adds to a login (eshop `cart` after merging the guest
 * cart, O11) reaches its store.
 */
export const applyAuthResponse = async (nuxtApp, response, { source = 'login', toast = true } = {}) => {
    const pinia = nuxtApp.$pinia;
    const authStore = useAuthStore(pinia);

    if (toast) {
        // Binds the `store` sections and shows the message of the response
        Response.get(response, { pinia, scope: nuxtApp });
    } else if (response?.store) {
        Response.bindStores(response.store, { pinia, scope: nuxtApp });
    }

    const auth = extractAuthResponse(response);

    if (auth) {
        authStore.setAuth(auth);
    }

    await persistToken(nuxtApp);

    if (response?.store) {
        await nuxtApp.callHook('crudadmin:bootstrap', {
            nuxtApp,
            source,
            partial: true,
            hydrated: false,
            only: Object.keys(response.store),
            response,
            data: response.store,
        });
    }

    if (authStore.user) {
        await nuxtApp.callHook('crudadmin:auth:login', {
            nuxtApp,
            source,
            response,
            user: authStore.user,
        });
    }

    return response;
};

/**
 * POST to an auth route and hydrate the stores from the answer.
 * Errors (401, 422) are thrown to the caller, forms handle them.
 */
export const authRequest = async (nuxtApp, route, data = {}, requestOptions = {}) => {
    const path = requestOptions.path || authRoute(route);

    const response = await useAxios(nuxtApp).$post(path, data, requestOptions.axios);

    return await applyAuthResponse(nuxtApp, response, {
        source: route,
        toast: requestOptions.toast !== false,
    });
};

/**
 * Log out: revoke the token on the backend (unless request: false), forget
 * the user and the stored token, let the layers react, and fetch a guest
 * bootstrap again (unless refresh: false).
 */
export const logout = async (nuxtApp, logoutOptions = {}) => {
    const authStore = useAuthStore(nuxtApp.$pinia);

    if (logoutOptions.request !== false && authStore.bearer) {
        try {
            await useAxios(nuxtApp).$post(authRoute('logout'));
        } catch (e) {
            console.error(e);
        }
    }

    authStore.flushData();

    await persistToken(nuxtApp);

    await nuxtApp.callHook('crudadmin:auth:logout', {
        nuxtApp,
        source: logoutOptions.source || 'logout',
    });

    if (logoutOptions.refresh !== false && options.bootstrap?.enabled === true) {
        await runBootstrap(nuxtApp, { source: 'logout' });
    }

    return true;
};

/**
 * Is the request one of the auth routes? A 401 of a wrong password must not
 * log out anybody.
 */
export const isAuthRequest = (url) => {
    url = String(url || '').replace(/^\/+/, '');

    return ['login', 'register', 'passwordForgot', 'passwordReset'].some((name) => {
        const path = String((options.auth?.routes || {})[name] || '').replace(/^\/+/, '');

        return path && url.startsWith(path);
    });
};
