import { join, isAbsolute } from 'node:path';

import { defineNuxtModule } from '@nuxt/kit';

const LOG_PREFIX = '[@crudadmin/helpers]';

import {
    buildTranslatableRoutes,
    collectRoutePaths,
} from './utils/CustomRouter.js';
import {
    countTranslations,
    fetchRouteTranslations,
    filterRouteTranslations,
    readTranslationCache,
    writeGettextSource,
    writeTranslationCache,
} from './utils/RouteTranslations.js';
// import { addSitemap } from './utilities/initialize/sitemap.js';

import { regorganizePlugins } from './utils/installer.js';

/**
 * Resolve a configured file against the project root.
 */
const resolveFile = (file, rootDir) => {
    if (!file) {
        return null;
    }

    return isAbsolute(file) ? file : join(rootDir, file);
};

/**
 * Resolve the localization options into their final shape.
 *
 * The routes map may be given as a function, so an application can pull the
 * translated paths from its backend at build time instead of hardcoding them.
 */
const resolveLocalization = async (options, nuxt) => {
    const localization = { ...(options || {}) };

    if (localization.enabled !== true) {
        return { ...localization, enabled: false };
    }

    const locales = localization.locales || [];

    if (locales.length === 0) {
        // prettier-ignore
        console.warn('[@crudadmin/helpers] localization.enabled is on, but no locales were given. Localized routes will not be built.');

        return { ...localization, enabled: false };
    }

    if (typeof localization.routes === 'function') {
        localization.routes = (await localization.routes(localization)) || {};
    }

    const rootDir = nuxt.options.rootDir;
    const buildDir = nuxt.options.buildDir || rootDir;
    const translateRoutes = localization.translateRoutes === true;

    return {
        ...localization,
        locales,
        defaultLocale: localization.defaultLocale || locales[0],
        prefixDefault: localization.prefixDefault === true,
        redirect: localization.redirect !== false,
        domains:
            localization.domains === false ? false : localization.domains || {},
        domainTld: localization.domainTld !== false,
        cookie: localization.cookie || 'locale',
        routes: localization.routes || {},
        translations: localization.translations || {},
        translateRoutes,
        apiUrl:
            localization.apiUrl ||
            process.env.VITE_APP_SERVER_URL ||
            process.env.NUXT_PUBLIC_API_URL ||
            null,
        bootstrapPath:
            localization.bootstrapPath || '/api/bootstrap?only=locale',
        cacheFile: resolveFile(
            localization.cacheFile === false
                ? null
                : localization.cacheFile || 'crudadmin.routes.json',
            rootDir
        ),
        // Generated on every build, so it belongs in the build directory
        // rather than the sources. Point admin.gettext.source_paths at it for
        // the paths to show up in the administration.
        gettextFile: resolveFile(
            localization.gettextFile === false
                ? null
                : localization.gettextFile ||
                      (translateRoutes ? 'crudadmin.routes.js' : null),
            buildDir
        ),
    };
};

/**
 * Path translations to build the routes with.
 *
 * A backend can answer without a single route path in it, for example when it
 * has not scanned the generated file yet. That must not silently strip every
 * translated url from the site, so the previous build's answer wins whenever
 * the fresh one carries nothing.
 */
const resolveTranslations = async (localization, paths) => {
    const fetched = filterRouteTranslations(
        await fetchRouteTranslations(localization),
        paths
    );

    const cached = filterRouteTranslations(
        readTranslationCache(localization.cacheFile),
        paths
    );

    if (countTranslations(fetched) === 0 && countTranslations(cached) > 0) {
        // prettier-ignore
        console.warn(`${LOG_PREFIX} the backend returned no translated route paths, keeping the ones from ${localization.cacheFile}.`);

        return cached;
    }

    writeTranslationCache(localization.cacheFile, fetched);

    return fetched;
};

export default defineNuxtModule({
    meta: {
        name: '@crudadmin/helpers',
        configKey: 'crudadmin',
    },

    // Default configuration options for your module
    defaults: {
        localization: {
            // Turn the whole feature on. Off by default, so existing projects
            // keep their untouched single language routes.
            enabled: false,

            // Language slugs the routes are built for. Required, because the
            // routes are generated at build time while the languages
            // themselves live in the database.
            locales: [],

            // Language served from the site root. Defaults to the first one.
            defaultLocale: null,

            // Give the default language a prefix as well, so nothing is served
            // from the bare root. Mirrors localization_remove_default.
            prefixDefault: false,

            // Send an unprefixed url to the language of the domain, or to the
            // language the visitor picked last.
            redirect: true,

            // Explicit hostname to language map, eg { 'example.com': 'en' }.
            // Set to false to ignore the domain entirely.
            domains: {},

            // Also treat a matching top level domain as its language, so
            // example.sk serves sk without any mapping.
            domainTld: true,

            // Cookie remembering the picked language.
            cookie: 'locale',

            // Translated paths, keyed by route name:
            // { about: { sk: '/o-nas', en: '/about' } }
            // May also be a function returning that object. Wins over the
            // translations pulled from the backend.
            routes: {},

            // Read the path translations from the backend gettext catalog, so
            // the urls are edited in the administration instead of here.
            translateRoutes: false,

            // Backend to read them from. Falls back to VITE_APP_SERVER_URL.
            apiUrl: null,
            bootstrapPath: '/api/bootstrap?only=locale',

            // Last successful answer, used when the backend is unreachable
            // during a build. Relative to the project root, false disables it.
            cacheFile: 'crudadmin.routes.json',

            // Generated list of route paths as gettext calls, so the CrudAdmin
            // scanner offers them for translation. Relative to the Nuxt build
            // directory, written only when translateRoutes is on. Add its
            // absolute path to admin.gettext.source_paths on the backend.
            // False disables it.
            gettextFile: null,
        },

        // Defaults every useSeo() call falls back to.
        seo: {
            // Absolute base of the canonical and og urls. The request origin
            // is used when this is empty, which is wrong behind a proxy or on
            // a preview domain, so production should always set it.
            siteUrl: null,

            // Shown by social networks next to the page title.
            siteName: null,

            // Fallback og:image, either a path or an absolute url. Pages may
            // override it with their own.
            image: null,

            // Fallback title and description, for pages that set neither.
            title: null,
            description: null,

            // summary_large_image whenever an image is known, summary
            // otherwise. Only the former is configurable.
            twitterCard: 'summary_large_image',
        },
    },

    hooks: {},

    async setup(moduleOptions, nuxt) {
        const localization = await resolveLocalization(
            moduleOptions.localization,
            nuxt
        );

        const seo = {
            ...(moduleOptions.seo || {}),
            siteUrl:
                (moduleOptions.seo || {}).siteUrl ||
                process.env.NUXT_PUBLIC_SITE_URL ||
                null,
        };

        // Both, because only the app config is bundled into the client build.
        // A runtime config a module writes reaches the server render and the
        // payload, but the browser gets the empty shape the build started
        // with, which silently drops the site name after hydration.
        nuxt.options.runtimeConfig.public.crudSeo = seo;
        nuxt.options.appConfig.crudSeo = seo;

        nuxt.options.runtimeConfig.public.crudLocalization = {
            enabled: localization.enabled === true,
            locales: localization.locales || [],
            defaultLocale: localization.defaultLocale || null,
            prefixDefault: localization.prefixDefault === true,
            redirect: localization.redirect === true,
            domains: localization.domains,
            domainTld: localization.domainTld !== false,
            cookie: localization.cookie || 'locale',
        };

        if (localization.enabled === true) {
            let translationsRead = false;

            nuxt.hook('pages:extend', async (routes) => {
                const paths = collectRoutePaths(routes);

                // Offer the paths to the administration for translation. This
                // has to happen before they are read back: a build wipes the
                // build directory, and the backend drops from its catalog every
                // string it can no longer find in the sources.
                writeGettextSource(localization.gettextFile, paths);

                if (
                    localization.translateRoutes === true &&
                    translationsRead === false
                ) {
                    translationsRead = true;

                    localization.translations = await resolveTranslations(
                        localization,
                        paths
                    );
                }

                buildTranslatableRoutes(routes, localization);
            });
        }

        nuxt.hook('app:resolve', async (nuxt) => {
            nuxt.plugins = regorganizePlugins(nuxt.plugins);
        });
    },
});
