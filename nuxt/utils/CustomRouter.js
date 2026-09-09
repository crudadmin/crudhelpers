/**
 * Separator between the base route name and its locale.
 *
 * Given a page named "projects-slug", the generated routes are named
 * "projects-slug___sk" and "projects-slug___en".
 */
export const LOCALE_NAME_SEPARATOR = '___';

/**
 * Strip a trailing slash, but keep the root path intact.
 */
const normalizePath = (path) => {
    path = String(path == null ? '' : path);

    if (path.length > 1 && path.endsWith('/')) {
        path = path.replace(/\/+$/, '');
    }

    return path === '' ? '/' : path;
};

/**
 * Return the base name of a route, without any locale suffix. Routes are
 * rebuilt on every pages:extend pass, so a route may already carry a suffix.
 */
export const getBaseRouteName = (name) => {
    if (!name) {
        return name;
    }

    return String(name).split(LOCALE_NAME_SEPARATOR)[0];
};

/**
 * Build the localized name of a route.
 */
export const getLocalizedRouteName = (name, locale) => {
    if (!name) {
        return name;
    }

    return getBaseRouteName(name) + LOCALE_NAME_SEPARATOR + locale;
};

/**
 * Return the path a route should use in the given locale.
 *
 * Two sources, in this order. The routes option, keyed by the base route name,
 * which stays stable no matter how the path is rewritten:
 *
 * routes: {
 *     about: { sk: '/o-nas', en: '/about' },
 * }
 *
 * and the gettext catalog of the backend, keyed by the untranslated path, which
 * is what the administration edits. The option wins, so a project can always
 * override a single path by hand.
 */
const translatePath = (route, locale, options) => {
    const basePath = normalizePath(route.path);
    const byName = options.routes || {};
    const baseName = getBaseRouteName(route.name);
    const named = baseName ? byName[baseName] : null;

    if (named && named[locale]) {
        return normalizePath(named[locale]);
    }

    const byPath = (options.translations || {})[locale] || {};

    if (byPath[basePath]) {
        return normalizePath(byPath[basePath]);
    }

    return basePath;
};

/**
 * Every distinct untranslated path in a route table, children included.
 *
 * These are the msgids the administration offers for translation.
 */
export const collectRoutePaths = (routes) => {
    const paths = [];

    const walk = (list) => {
        (list || []).forEach((route) => {
            const path = normalizePath(
                (route.meta || {}).basePath || route.path
            );

            if (path && paths.includes(path) === false) {
                paths.push(path);
            }

            walk(route.children);
        });
    };

    walk(routes);

    return paths;
};

/**
 * Does this locale live under its own url prefix?
 *
 * The default locale is served from the site root unless prefixDefault is on,
 * which mirrors localization_remove_default in the PHP CrudAdmin.
 */
export const localeHasPrefix = (locale, options) => {
    if (options.prefixDefault === true) {
        return true;
    }

    return locale !== options.defaultLocale;
};

/**
 * Prefix a root level path with the locale slug.
 */
const withLocalePrefix = (path, locale, options) => {
    if (localeHasPrefix(locale, options) === false) {
        return path;
    }

    const prefix = '/' + locale;

    return path === '/' ? prefix : prefix + path;
};

/**
 * Clone one route for one locale.
 *
 * Only root level routes receive the locale prefix. Child paths are relative
 * to their parent, so they are translated but never prefixed.
 */
const localizeRoute = (route, locale, options, isRoot) => {
    const localized = {
        ...route,
        path: translatePath(route, locale, options),
        name: getLocalizedRouteName(route.name, locale),
        meta: {
            ...(route.meta || {}),
            locale,
            baseName: getBaseRouteName(route.name),
            basePath: normalizePath(route.path),
        },
    };

    if (isRoot === true) {
        localized.path = withLocalePrefix(localized.path, locale, options);
    }

    if (Array.isArray(route.children) && route.children.length > 0) {
        localized.children = route.children.map((child) =>
            localizeRoute(child, locale, options, false)
        );
    }

    return localized;
};

/**
 * Undo a previous localization pass, so a route can be rebuilt from scratch.
 */
const toBaseRoute = (route) => {
    const meta = { ...(route.meta || {}) };

    if (!meta.locale) {
        return route;
    }

    const basePath = meta.basePath;
    const baseName = meta.baseName;

    delete meta.locale;
    delete meta.baseName;
    delete meta.basePath;

    const base = {
        ...route,
        path: basePath || route.path,
        name: baseName || getBaseRouteName(route.name),
        meta,
    };

    if (Array.isArray(route.children) && route.children.length > 0) {
        base.children = route.children.map(toBaseRoute);
    }

    return base;
};

/**
 * Reduce a route table back to one entry per page.
 *
 * The pages:extend hook can run more than once, for example when a page file
 * changes in dev. Without this the table would grow by one full set of
 * localized routes on every pass.
 */
const toBaseRoutes = (routes) => {
    const seen = new Set();
    const base = [];

    routes.forEach((route) => {
        if ((route.meta || {}).localeRoot === true) {
            return;
        }

        const candidate = toBaseRoute(route);
        const key = candidate.name || candidate.path;

        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        base.push(candidate);
    });

    return base;
};

/**
 * Replace every route with one variant per locale.
 *
 * Unlike the Nuxt 2 implementation, which rebuilt the router for the language
 * of the incoming request, every language exists in the route table at the same
 * time. One build serves all languages, and switching a language is a plain
 * navigation instead of a rebuild.
 *
 * The routes array is mutated in place, because that is what the pages:extend
 * hook consumes.
 */
export const buildTranslatableRoutes = (routes, options) => {
    const locales = (options || {}).locales || [];

    if (locales.length === 0) {
        return routes;
    }

    const source = toBaseRoutes(routes);
    const localized = [];

    locales.forEach((locale) => {
        source.forEach((route) => {
            localized.push(localizeRoute(route, locale, options, true));
        });
    });

    // With every locale prefixed there is nothing left on the site root,
    // so send it to the default locale.
    if (options.prefixDefault === true && options.defaultLocale) {
        localized.push({
            name: 'crudadmin-locale-root',
            path: '/',
            meta: { localeRoot: true },
            redirect: '/' + options.defaultLocale,
        });
    }

    routes.splice(0, routes.length, ...localized);

    return routes;
};
