import {
    LOCALE_NAME_SEPARATOR,
    getLocalizedRouteName,
} from './CustomRouter.js';

/**
 * Rewrite a navigation target into a given language.
 *
 * This is what lets the router localize on its own. A component asks for
 * { name: 'about' } and the router hands back the route of the active
 * language, so nothing in an application has to know that prefixed or
 * translated routes exist at all.
 *
 * Returns null when the target is already localized, points outside the
 * application, or has no localized counterpart. The caller then leaves it be.
 */
export const localizeTarget = (to, locale, router, resolve) => {
    if (!to || !locale) {
        return null;
    }

    if (typeof to === 'string') {
        return localizeLocation({ path: to }, locale, router, resolve);
    }

    if (typeof to !== 'object') {
        return null;
    }

    // Addressed by name, which is all we need.
    if (to.name) {
        const name = localizeName(to.name, locale, router);

        return name ? { ...to, name } : null;
    }

    if (to.path) {
        return localizeLocation(to, locale, router, resolve);
    }

    return null;
};

/**
 * Suffix a base route name with its language.
 */
const localizeName = (name, locale, router) => {
    if (typeof name !== 'string' || name.includes(LOCALE_NAME_SEPARATOR)) {
        return null;
    }

    const localized = getLocalizedRouteName(name, locale);

    return router.hasRoute(localized) ? localized : null;
};

/**
 * Rewrite a target given as a path.
 *
 * A path written in code is the one of the default language, so it is matched
 * against the route table first and then rebuilt in the wanted language. Paths
 * that already carry a language prefix are left alone.
 */
const localizeLocation = (to, locale, router, resolve) => {
    const path = String(to.path || '');

    if (path.startsWith('/') === false) {
        return null;
    }

    let resolved = null;

    try {
        resolved = resolve(path);
    } catch (e) {
        return null;
    }

    const meta = (resolved || {}).meta || {};

    // Already in the wanted language, or not one of our routes.
    if (!meta.baseName || meta.locale === locale) {
        return null;
    }

    const name = getLocalizedRouteName(meta.baseName, locale);

    if (router.hasRoute(name) === false) {
        return null;
    }

    return {
        ...to,
        path: undefined,
        name,
        params: { ...(resolved.params || {}), ...(to.params || {}) },
        query: to.query || resolved.query,
        hash: to.hash || resolved.hash,
    };
};

/**
 * Make the router resolve and navigate in the active language on its own.
 *
 * vue-router keeps its own reference to the internal resolve for push and
 * replace, so each entry point is wrapped separately.
 */
export const installLocalizedRouter = (router, getLocale) => {
    if (router.__crudLocalized === true) {
        return router;
    }

    const resolve = router.resolve.bind(router);

    // Kept so useLocalePath can address a language other than the active one
    // without the wrapper rewriting the target back.
    router.__crudResolve = resolve;
    router.__crudLocalized = true;

    const localize = (to) => {
        const localized = localizeTarget(to, getLocale(), router, resolve);

        return localized || to;
    };

    router.resolve = (to, currentLocation) =>
        resolve(localize(to), currentLocation);

    ['push', 'replace'].forEach((method) => {
        const original = router[method].bind(router);

        router[method] = (to) => original(localize(to));
    });

    return router;
};
