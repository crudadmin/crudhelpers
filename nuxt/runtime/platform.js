import options from '#build/crudadmin/options.mjs';
import { useAppStore } from '#imports';

/**
 * Platform of this build: web for the web build and for an SPA opened in a
 * browser, otherwise what the native Capacitor bridge reports (ios, android).
 * window.Capacitor is injected by the native runtime, so no Capacitor package
 * has to be imported here.
 */
export const resolvePlatform = () => {
    if (options.ssr === true || import.meta.server) {
        return 'web';
    }

    try {
        return globalThis.Capacitor?.getPlatform?.() || 'web';
    } catch (e) {
        return 'web';
    }
};

/**
 * Installed version of the native app. The configured platform.version wins,
 * otherwise the App plugin of the native bridge is asked, when it is there.
 */
export const resolveAppVersion = async (platform) => {
    if (options.platform?.version) {
        return String(options.platform.version);
    }

    if (!platform || platform === 'web') {
        return null;
    }

    try {
        const info = await globalThis.Capacitor?.Plugins?.App?.getInfo?.();

        return info?.version || null;
    } catch (e) {
        return null;
    }
};

/**
 * Headers telling the backend which app asks (O48). Null values are left out.
 * Reads the app store of the given pinia, so it is safe on a shared server.
 */
export const platformHeaders = (pinia) => {
    const appStore = useAppStore(pinia);

    const headers = {
        'app-platform': appStore.platform || resolvePlatform(),
        'app-version': appStore.appVersion || null,
        'app-type': options.platform?.type || null,
    };

    for (const key in headers) {
        if (headers[key] === null || headers[key] === undefined) {
            delete headers[key];
        }
    }

    return headers;
};
