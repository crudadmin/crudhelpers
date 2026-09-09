import {
    getBaseRouteName,
    getLocalizedRouteName,
    localeHasPrefix,
} from '../utils/CustomRouter.js';

/**
 * Localization options resolved by the module at build time.
 */
export const useLocalizationConfig = () => {
    const config = useRuntimeConfig().public || {};

    return config.crudLocalization || { enabled: false };
};

/**
 * Every locale slug the routes were built for.
 */
export const useLocales = () => {
    return useLocalizationConfig().locales || [];
};

/**
 * Cookie remembering the last language the visitor picked.
 */
export const useLocaleCookie = () => {
    const config = useLocalizationConfig();

    return useCookie(config.cookie || 'locale', {
        path: '/',
        sameSite: 'lax',
        default: () => config.defaultLocale || null,
    });
};

/**
 * Language of the current request.
 */
export const useCurrentLocale = () => {
    const config = useLocalizationConfig();

    return useLocaleStore().locale || config.defaultLocale;
};

/**
 * Resolve the language of a url path from its first segment.
 *
 * Returns null for the default language, which has no prefix unless
 * prefixDefault is enabled.
 */
export const useLocaleFromPath = (path) => {
    const config = useLocalizationConfig();
    const locales = config.locales || [];
    const segment = String(path || '')
        .split('?')[0]
        .split('/')
        .filter((item) => item)[0];

    if (segment && locales.includes(segment)) {
        return segment;
    }

    return null;
};

/**
 * Resolve the language a hostname belongs to.
 *
 * Checks the explicit domains map first, then falls back to the top level
 * domain, so example.sk serves the sk language without any configuration.
 */
export const useLocaleFromDomain = (host) => {
    const config = useLocalizationConfig();

    if (config.domains === false) {
        return null;
    }

    const locales = config.locales || [];
    const domains = config.domains || {};

    host = String(host || '')
        .split(':')[0]
        .replace(/^www\./, '');

    if (host && domains[host] && locales.includes(domains[host])) {
        return domains[host];
    }

    const tld = host.split('.').pop();

    if (config.domainTld !== false && tld && locales.includes(tld)) {
        return tld;
    }

    return null;
};

/**
 * Build the path of a route in a given language.
 *
 * Accepts anything vue-router can resolve, so both useLocalePath('/about')
 * and useLocalePath({ name: 'projects-slug', params: { slug } }) work.
 */
export const useLocalePath = (to, locale) => {
    const config = useLocalizationConfig();
    const router = useRouter();

    // The router localizes into the active language on its own, so addressing
    // another language has to go around that wrapper.
    const resolve = router.__crudResolve || router.resolve.bind(router);

    if (config.enabled !== true) {
        return typeof to === 'string' ? to : resolve(to).href;
    }

    locale = locale || useCurrentLocale();

    // A target addressed by name has to be localized before it is resolved,
    // because the base name itself is no longer in the route table.
    if (to && typeof to === 'object' && to.name) {
        const named = getLocalizedRouteName(to.name, locale);

        if (router.hasRoute(named)) {
            return resolve({ ...to, name: named }).href;
        }
    }

    const resolved = resolve(to);
    const baseName =
        (resolved.meta || {}).baseName || getBaseRouteName(resolved.name);

    if (!baseName) {
        return resolved.href;
    }

    const name = getLocalizedRouteName(baseName, locale);

    // The language may not exist in the route table, for example when the
    // locales option is out of sync with the languages in the database.
    if (router.hasRoute(name) === false) {
        return resolved.href;
    }

    return resolve({
        name,
        params: resolved.params,
        query: resolved.query,
        hash: resolved.hash,
    }).href;
};

/**
 * Route parameters of the current page in the other languages.
 *
 * A dynamic segment often differs per language, because the record behind it
 * is localized as well. Only the page knows those values, so it hands them
 * over and the language switcher picks them up:
 *
 * useLocaleParams({
 *     sk: { slug: 'crm-erp-systemy' },
 *     en: { slug: 'crm-erp-systems' },
 * });
 *
 * Called without an argument it returns what the current page has set.
 */
export const useLocaleParams = (params) => {
    const state = useState('crudadmin-locale-params', () => ({}));

    if (params !== undefined) {
        state.value = params || {};
    }

    return state;
};

/**
 * The current page, in another language.
 */
export const useSwitchLocalePath = (locale) => {
    const route = useRoute();
    const params = useLocaleParams().value || {};

    return useLocalePath(
        {
            name: route.name,
            params: { ...route.params, ...(params[locale] || {}) },
            query: route.query,
            hash: route.hash,
        },
        locale
    );
};

/**
 * Switch the site to another language and go to the matching page.
 *
 * Reloads by default, because translations, and any content the backend
 * localizes, have to be fetched again for the new language.
 */
export const useSetLocale = async (locale, options = {}) => {
    const { reload = true } = options;
    const path = useSwitchLocalePath(locale);

    useLocaleStore().locale = locale;
    useLocaleCookie().value = locale;

    if (reload === true && typeof window !== 'undefined') {
        window.location.href = path;

        return path;
    }

    await navigateTo(path);

    return path;
};

/**
 * Does the given language live under a url prefix?
 */
export const useLocaleHasPrefix = (locale) => {
    return localeHasPrefix(locale, useLocalizationConfig());
};
