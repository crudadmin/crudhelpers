import { defineNuxtPlugin, addRouteMiddleware, navigateTo } from '#app';

import { installLocalizedRouter } from '../utils/LocalizeTarget.js';

/**
 * Keeps the active language and the url in sync.
 *
 * The url prefix is the source of truth. Every language exists in the route
 * table at once, so the matched route already tells us which language the page
 * has to render in, and nothing has to be rebuilt to switch.
 *
 * The domain and the remembered language only decide where an unprefixed url
 * should send the visitor, and only when the redirect option is on.
 */
export default defineNuxtPlugin(({ $pinia }) => {
    const config = useLocalizationConfig();

    if (config.enabled !== true) {
        return;
    }

    const localeStore = useLocaleStore($pinia);
    const cookie = useLocaleCookie();
    const locales = config.locales || [];

    const setLocale = (locale) => {
        if (!locale || locales.includes(locale) === false) {
            return;
        }

        if (localeStore.locale !== locale) {
            localeStore.locale = locale;
        }

        if (cookie.value !== locale) {
            cookie.value = locale;
        }
    };

    /**
     * Language remembered from the visitor's last switch.
     */
    const rememberedLocale = () => {
        return locales.includes(cookie.value) ? cookie.value : null;
    };

    /**
     * Where an unprefixed url should send the visitor.
     */
    const preferredLocale = () => {
        const url = useRequestURL();

        return useLocaleFromDomain(url.host) || rememberedLocale();
    };

    const url = useRequestURL();
    const urlLocale = useLocaleFromPath(url.pathname);

    // This runs before the application's own plugins, so anything they fetch
    // on boot is already requested in the right language.
    if (config.redirect === true) {
        setLocale(urlLocale || preferredLocale() || config.defaultLocale);
    } else {
        setLocale(urlLocale || config.defaultLocale);
    }

    /**
     * Teach the router to resolve and navigate in the active language, so
     * components can keep using plain route names and paths.
     */
    const localizeRouter = () => {
        const router = useRouter();

        if (router) {
            installLocalizedRouter(router, () => localeStore.locale);
        }
    };

    try {
        localizeRouter();
    } catch (e) {
        // The router is not up yet, the middleware below runs once it is.
    }

    addRouteMiddleware(
        'crudadmin-localization',
        (to, from) => {
            localizeRouter();

            const prefixed = useLocaleFromPath(to.path);

            // Translated route parameters belong to the page that set them.
            if (to.path !== from.path) {
                useLocaleParams({});
            }

            // An unprefixed url is the default language. Send the visitor to
            // their own language once, if they have one and it differs.
            if (config.redirect === true && prefixed === null) {
                const preferred = preferredLocale();

                if (preferred && preferred !== config.defaultLocale) {
                    const target = useLocalePath(
                        {
                            name: to.name,
                            params: to.params,
                            query: to.query,
                            hash: to.hash,
                        },
                        preferred
                    );

                    if (target && target !== to.fullPath) {
                        setLocale(preferred);

                        return navigateTo(target, { redirectCode: 302 });
                    }
                }
            }

            setLocale(
                (to.meta || {}).locale || prefixed || config.defaultLocale
            );
        },
        { global: true }
    );
});
