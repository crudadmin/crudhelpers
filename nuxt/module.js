import { join, isAbsolute } from 'node:path';

import {
    addImports,
    addPlugin,
    addTemplate,
    createResolver,
    defineNuxtModule,
} from '@nuxt/kit';

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
const resolveLocalization = async (options, nuxt, bootstrap = {}) => {
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
            bootstrap.baseURL ||
            process.env.VITE_APP_SERVER_URL ||
            process.env.NUXT_PUBLIC_API_URL ||
            null,
        // The catalog comes from the same bootstrap the app boots from (O8),
        // so a project configures its path once, in crudadmin.bootstrap.
        bootstrapPath:
            localization.bootstrapPath ||
            '/' +
                String(bootstrap.path || 'api/bootstrap').replace(/^\/+/, '') +
                '?only=locale',
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

/**
 * Plugin directories of every layer but the project itself. Their numbered
 * plugins (eshop 10-19) are ordered together with the ones of helpers.
 */
const layerPluginDirs = (nuxt) => {
    return (nuxt.options._layers || [])
        .filter((layer) => layer.config?.rootDir !== nuxt.options.rootDir)
        .map((layer) =>
            join(
                layer.config.srcDir || layer.config.rootDir,
                layer.config.dir?.plugins || 'plugins'
            )
        );
};

/**
 * Auto-imports, stores and plugins of the app boot.
 *
 * Every auto-import gets priority -1, so a project (or a layer) exporting
 * the same name wins without a "Duplicated imports" warning. That keeps
 * projects with their own useAppStore, useAuthStore, useBackendEnv or a
 * re-export of @crudadmin/helpers/helpers working unchanged, and is how a
 * project replaces a store with its extended definition.
 */
const registerAppRuntime = (nuxt, resolve, { bootstrap, auth, platform, capacitor }) => {
    const ssr = nuxt.options.ssr !== false;

    // Build time options for the runtime files. Paths and switches only,
    // nothing secret ends up in the bundle.
    addTemplate({
        filename: 'crudadmin/options.mjs',
        write: true,
        getContents: () =>
            'export default ' +
            JSON.stringify({ ssr, bootstrap, auth, platform, capacitor }, null, 4) +
            ';\n',
    });

    // Imported statically only when asked for, so other projects never need
    // the package installed.
    addTemplate({
        filename: 'crudadmin/preferences.mjs',
        write: true,
        getContents: () =>
            auth.storage === 'preferences'
                ? "export { Preferences } from '@capacitor/preferences';\n"
                : 'export const Preferences = null;\n',
    });

    nuxt.options.runtimeConfig.public.crudBootstrap = {
        baseURL:
            bootstrap.baseURL ||
            process.env.VITE_APP_SERVER_URL ||
            process.env.NUXT_PUBLIC_API_URL ||
            null,
    };

    const imports = (names, from) =>
        names.map((name) => ({ name, from, priority: -1 }));

    addImports([
        ...imports(
            [
                'useAjaxStore',
                'useLocaleStore',
                'useMobileStore',
                'useNetworkStore',
                'useOtpStore',
            ],
            resolve('../store/index.js')
        ),
        ...imports(
            [
                'useAxios',
                'useResponse',
                'generateUuid',
                'useSleep',
                'useLazyClick',
                'useObjectToFormData',
                'useIsVersionNewer',
            ],
            resolve('../utils/helpers.js')
        ),
        ...imports(['useAppStore', 'useAuthStore'], resolve('./runtime/stores.js')),
        ...imports(
            ['useBootstrap', 'useBackendEnv', 'usePlatformHeaders', 'usePlatform'],
            resolve('./runtime/composables/app.js')
        ),
        ...imports(['useAuth'], resolve('./runtime/composables/auth.js')),
    ]);

    if (bootstrap.enabled === true) {
        addPlugin({ src: resolve('./runtime/plugins/03.bootstrap.js') });
    }

    if (capacitor.enabled === true) {
        addPlugin({
            src: resolve('./runtime/plugins/04.capacitor.client.js'),
            mode: 'client',
        });
    }
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

            // Backend to read them from. Falls back to bootstrap.baseURL and
            // VITE_APP_SERVER_URL.
            apiUrl: null,

            // Defaults to /<bootstrap.path>?only=locale
            bootstrapPath: null,

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

        // Boot of the app: axios defaults, auth token, the bootstrap request
        // and its refresh (plugin 03.bootstrap). Off by default, so projects
        // with their own boot plugin and app/auth stores keep working; the
        // eshop layer turns it on.
        bootstrap: {
            enabled: false,

            // Bootstrap endpoint, relative to baseURL. Autoskola style apps
            // point it at their own request, eg. api/bootstrap/autosaurus.
            path: 'api/bootstrap',

            // Backend url. Falls back to runtime config
            // public.crudBootstrap.baseURL, then VITE_APP_SERVER_URL.
            baseURL: null,

            // Sections asked for on boot, empty asks for all. Layers add
            // theirs at run time through useBootstrap().addSections(), which
            // only matters when this is not empty.
            only: [],

            // Fetch on the server when the app renders there, so the stores
            // reach the client with the payload. false leaves it to the client.
            ssr: true,

            // In the browser (SPA) wait for the bootstrap before the app
            // mounts. Off: the app mounts and appStore.booted tells when the
            // data are there, which is what an offline capable app wants.
            blocking: false,

            // Refresh on reconnect and every refreshSeconds in the browser.
            // backendEnv.APP_REFRESH_SECONDS of the backend wins.
            refresh: true,
            refreshSeconds: 600,
        },

        // Client authentication against the PHP crudadmin/helpers auth routes.
        // Wired by the bootstrap plugin, used through useAuth().
        auth: {
            // auto: cookie on the web build (the server has to see it to
            // render the logged in state), localStorage in the SPA build.
            // cookie | local | preferences (Capacitor Preferences) | false.
            storage: 'auto',

            // The cookie of the web build. secure defaults to on outside dev.
            cookie: {
                name: 'auth_token',
                maxAge: 60 * 60 * 24 * 365,
                sameSite: 'lax',
                secure: null,
            },

            // A 401 of any other than the auth routes forgets the user.
            logoutOnUnauthorized: true,

            // Backend paths, relative to the bootstrap baseURL. login, logout
            // and user are the AdminAuth routes of PHP helpers. register is
            // the registration endpoint, which also works without OTP. The
            // password routes are not in PHP helpers yet, override them.
            routes: {
                login: 'api/auth/login',
                logout: 'api/auth/logout',
                register: 'api/auth/register/otp-verify',
                user: 'api/user',
                passwordForgot: 'api/auth/password/forgot',
                passwordReset: 'api/auth/password/reset',
            },
        },

        // app-type header (O48), for more apps on one API (customer,
        // courier). version overrides the version read from the native app.
        platform: {
            type: null,
            version: null,
        },

        // Native app boot through @crudadmin/helpers/capacitor (network,
        // keyboard, toast opener). Needs @ionic/vue, @capacitor/network and
        // @capacitor/keyboard, so it is off unless asked for.
        capacitor: {
            enabled: false,
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
        const { resolve } = createResolver(import.meta.url);

        const bootstrap = { ...(moduleOptions.bootstrap || {}) };
        const auth = {
            ...(moduleOptions.auth || {}),
            cookie: { ...((moduleOptions.auth || {}).cookie || {}) },
            routes: { ...((moduleOptions.auth || {}).routes || {}) },
        };
        const platform = { ...(moduleOptions.platform || {}) };
        const capacitor = { ...(moduleOptions.capacitor || {}) };

        const localization = await resolveLocalization(
            moduleOptions.localization,
            nuxt,
            bootstrap
        );

        registerAppRuntime(nuxt, resolve, {
            bootstrap,
            auth,
            platform,
            capacitor,
        });

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

        nuxt.hook('app:resolve', async (app) => {
            app.plugins = regorganizePlugins(app.plugins, layerPluginDirs(nuxt));
        });
    },
});
