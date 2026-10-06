import options from '#build/crudadmin/options.mjs';
import { useAppStore, useAuthStore } from '#imports';

import { Response } from '../../utils/Response.js';
import { useAxios } from '../../utils/helpers.js';
import { useNetworkStore } from '../../store/networkStore.js';
import { persistToken } from './auth.js';

const SECTIONS = '_crudBootstrapSections';

/**
 * Sections other layers want in a restricted bootstrap (bootstrap.only).
 * Kept on the nuxtApp, so they are registered per request on a server.
 * An empty `only` asks for every section, then nothing has to be added.
 */
export const addBootstrapSections = (nuxtApp, sections) => {
    const list = nuxtApp[SECTIONS] || [];

    for (const section of [].concat(sections || [])) {
        if (section && list.includes(section) === false) {
            list.push(section);
        }
    }

    nuxtApp[SECTIONS] = list;

    return list;
};

/**
 * Sections of one request. A partial refresh (refreshApp(['event'])) asks
 * for exactly what it names, the boot asks for the configured ones plus the
 * sections of the layers.
 */
const resolveSections = (nuxtApp, only) => {
    only = [].concat(only || []).filter((section) => section);

    if (only.length > 0) {
        return { only, partial: true };
    }

    const configured = [].concat(options.bootstrap?.only || []);

    if (configured.length === 0) {
        return { only: [], partial: false };
    }

    return {
        only: Array.from(new Set(configured.concat(nuxtApp[SECTIONS] || []))),
        partial: false,
    };
};

/**
 * Drop a token the backend no longer knows. The bootstrap is optionally
 * authenticated, so a revoked token does not answer 401 there, it answers as
 * a guest: an `auth` section without a user.
 */
const forgetStaleToken = async (nuxtApp, data) => {
    const auth = data?.auth;

    if (!auth || typeof auth !== 'object' || !('user' in auth)) {
        return;
    }

    const authStore = useAuthStore(nuxtApp.$pinia);

    if (auth.user === null && authStore.token) {
        authStore.token = null;

        await persistToken(nuxtApp);
    }
};

/**
 * Fetch the bootstrap and hand its sections to the stores.
 *
 * Everything request related goes through the given nuxtApp, never through a
 * context resolved after an await, so it is correct on a shared server.
 * Resolves true when it succeeded (what Network expects from a refresher).
 */
export const runBootstrap = async (nuxtApp, { only = [], source = 'client' } = {}) => {
    const pinia = nuxtApp.$pinia;
    const appStore = useAppStore(pinia);
    const sections = resolveSections(nuxtApp, only);

    const context = {
        nuxtApp,
        source,
        partial: sections.partial,
        path: options.bootstrap?.path || 'api/bootstrap',
        only: sections.only,
        params: {},
        headers: {},
    };

    appStore.loading = true;

    try {
        // Layers may change the path, sections, params or headers
        await nuxtApp.callHook('crudadmin:bootstrap:before', context);

        const params = { ...context.params };

        if (context.only.length > 0) {
            params.only = context.only.join(',');
        }

        const response = await useAxios(nuxtApp).$get(context.path, {
            params,
            headers: context.headers,
        });

        const data = response?.store || {};

        Response.bindStores(data, { pinia, scope: nuxtApp });

        await forgetStaleToken(nuxtApp, data);

        appStore.booted = true;

        useNetworkStore(pinia).setLastUpdate();

        await nuxtApp.callHook('crudadmin:bootstrap', {
            ...context,
            hydrated: false,
            response,
            data,
        });

        return true;
    } catch (error) {
        console.error('[@crudadmin/helpers] bootstrap failed:', error?.message || error);

        await nuxtApp.callHook('crudadmin:bootstrap:error', { ...context, error });

        return false;
    } finally {
        appStore.loading = false;
    }
};
