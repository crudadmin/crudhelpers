import { resolveSwitchLocalePath } from './localization.js';

/**
 * Page head defaults resolved by the module at build time.
 */
export const useSeoConfig = () => {
    const runtime = (useRuntimeConfig().public || {}).crudSeo || {};

    // The app config survives into the browser bundle, the runtime config a
    // module writes does not, so it only fills in what the app overrides.
    return { ...(useAppConfig().crudSeo || {}), ...runtime };
};

/**
 * Turn a path into an absolute url, leaving absolute ones alone.
 */
const toAbsoluteUrl = (path, origin) => {
    if (!path) {
        return null;
    }

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `${origin.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
};

/**
 * Origin every canonical and og url is built on.
 *
 * The configured site url wins, because the request may arrive through a
 * proxy, a preview domain or plain http while the site is served elsewhere.
 */
export const useSeoOrigin = () => {
    const configured = useSeoConfig().siteUrl;

    if (configured) {
        return String(configured).replace(/\/+$/, '');
    }

    return useRequestURL().origin;
};

/**
 * Put the brand behind the title of the page.
 *
 * The site name is written once in the configuration and every page only says
 * what it is, so the two can never drift apart:
 *
 * useSeo({ title: __('Projects') })  ->  Projects - Gogoľ Development s.r.o
 *
 * titleTemplate overrides the shape, %s being the title of the page. A page
 * without a title of its own falls back to the site name alone.
 */
const composeTitle = (title, config) => {
    title = toValue(title) || null;

    if (!title) {
        return config.title || config.siteName || null;
    }

    if (config.titleTemplate) {
        return config.titleTemplate.replace('%s', title);
    }

    return config.siteName ? `${title} - ${config.siteName}` : title;
};

export const useSeoTitle = (title) => {
    return composeTitle(title, useSeoConfig());
};

/**
 * The current page in every language it exists in, as absolute urls.
 *
 * Dynamic segments come from useLocaleParams(), so a page whose slug differs
 * per language has to register them for the alternates to be correct.
 */
export const useLocaleAlternates = () => {
    const config = useLocalizationConfig();
    const locales = config.locales || [];

    if (config.enabled !== true || locales.length < 2) {
        return [];
    }

    const origin = useSeoOrigin();
    const router = useRouter();
    const route = useRoute();
    const params = useLocaleParams();

    return locales.map((locale) => ({
        locale,
        url: toAbsoluteUrl(
            resolveSwitchLocalePath(
                router,
                route,
                locale,
                config,
                params.value
            ),
            origin
        ),
    }));
};

/**
 * Describe the current page to search engines and social networks.
 *
 * Replaces the useHead() call a page would otherwise write by hand. On top of
 * the title and the description it derives everything that can be derived from
 * the route itself — the site name behind the title, the canonical url, the
 * hreflang alternates of every other language, and the Open Graph and Twitter
 * cards:
 *
 * useSeo({
 *     title: computed(() => service.value?.name),
 *     description: __('…'),
 * });
 *
 * Every option accepts a value, a ref or a getter, so a page whose content
 * arrives after the first render keeps its head in sync.
 */
export const useSeo = (options = {}) => {
    const route = useRoute();
    const router = useRouter();
    const localeStore = useLocaleStore();
    const localization = useLocalizationConfig();
    const localeParams = useLocaleParams();
    const config = useSeoConfig();
    const origin = useSeoOrigin();

    // The head is resolved after setup has finished, where none of the
    // composables reaching for the Nuxt context can run any more. Everything
    // they need is therefore read here and only the pure values below take
    // part in the reactive head object.
    const locales =
        localization.enabled === true ? localization.locales || [] : [];

    const title = computed(() => composeTitle(toValue(options.title), config));

    const description = computed(
        () => toValue(options.description) || config.description || null
    );

    const image = computed(() =>
        toAbsoluteUrl(toValue(options.image) || config.image, origin)
    );

    const robots = computed(() => toValue(options.robots) || null);

    // A page kept out of the index has nothing to point a canonical or an
    // hreflang at, and an unmatched url is not a page in the first place.
    const indexable = computed(
        () => !String(robots.value || '').includes('noindex') && !!route.name
    );

    const canonical = computed(() =>
        indexable.value
            ? toAbsoluteUrl(toValue(options.canonical) || route.path, origin)
            : null
    );

    const locale = computed(
        () => localeStore.locale || localization.defaultLocale || null
    );

    const alternates = computed(() => {
        if (locales.length < 2 || indexable.value === false) {
            return [];
        }

        return locales.map((item) => ({
            locale: item,
            url: toAbsoluteUrl(
                resolveSwitchLocalePath(
                    router,
                    route,
                    item,
                    localization,
                    localeParams.value
                ),
                origin
            ),
        }));
    });

    return useHead(
        computed(() => {
            const meta = [
                { name: 'description', content: description.value },
                { name: 'robots', content: robots.value },
                { property: 'og:type', content: toValue(options.type) || 'website' },
                { property: 'og:site_name', content: toValue(options.siteName) || config.siteName || null },
                { property: 'og:locale', content: locale.value },
                { property: 'og:url', content: canonical.value },
                { property: 'og:title', content: title.value },
                { property: 'og:description', content: description.value },
                { property: 'og:image', content: image.value },
                { name: 'twitter:card', content: image.value ? config.twitterCard || 'summary_large_image' : 'summary' },
                { name: 'twitter:title', content: title.value },
                { name: 'twitter:description', content: description.value },
                { name: 'twitter:image', content: image.value },
            ];

            const link = [{ rel: 'canonical', href: canonical.value }];

            alternates.value.forEach((alternate) => {
                link.push({
                    rel: 'alternate',
                    hreflang: alternate.locale,
                    href: alternate.url,
                });
            });

            const fallback = alternates.value.find(
                (alternate) => alternate.locale === localization.defaultLocale
            );

            if (fallback) {
                link.push({
                    rel: 'alternate',
                    hreflang: 'x-default',
                    href: fallback.url,
                });
            }

            return {
                ...(title.value ? { title: title.value } : {}),
                meta: meta.filter((item) => item.content),
                link: link.filter((item) => item.href),
            };
        })
    );
};
