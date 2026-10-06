import { defineStore } from 'pinia';

import options from '#build/crudadmin/options.mjs';
import { appStore, authStore } from '../../definitions/index.js';

/*
 * Persistence depends on the build target, not on a runtime switch.
 *
 * The SPA (Capacitor) build starts from what it knew last, also offline. The
 * web build must not persist into localStorage at all: the plugin restores it
 * after hydration and would replace what the server has just rendered with a
 * stale copy. The token of the web build lives in a cookie instead, see
 * authStorage.js.
 */
const isSpa = options.ssr !== true;

export const useAppStore = defineStore('app', {
    ...appStore,
    persist: isSpa ? { omit: ['loading'] } : false,
});

export const useAuthStore = defineStore('auth', {
    ...authStore,

    // Same shape the projects persisted before (scorentino, qualit), so a user
    // logged in through their own auth store stays logged in. The token is
    // kept by the auth storage as well. Device tokens are not kept on
    // purpose: they are resent once per app boot, so a device removed on the
    // backend registers again.
    persist: isSpa ? { omit: ['device_tokens'] } : false,
});
