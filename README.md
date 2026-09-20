# @crudadmin/helpers

Shared Nuxt layer for CrudAdmin backed frontends: axios wrapper, gettext
translator, Pinia stores, modals, toasts, the frontend editor bootstrap and
url based localization.

```js
// nuxt.config.ts
export default defineNuxtConfig({
    extends: ['./node_modules/@crudadmin/helpers/nuxt'],
});
```

## Modals and toasts

`Modal` and `Toast` are shared by the Ionic apps and the CrudAdmin administration.
They keep the state only, the application gives them the look. The
`@crudadmin/helpers/modal` entry depends on Vue alone.

```js
import { Modal, Toast, ModalRenderer, ToastRenderer } from '@crudadmin/helpers/modal';
```

### Opening

```js
// by name, the component is placed in the app template or registered
Modal.open('chat-thread-delete', { thread });

// a component, mounted by <ModalRenderer />
const modal = Modal.open(EditRow, { row }, { title: 'Edit', class: '--wide' });

// messages, rendered by the default component
Modal.success('Saved.');
Modal.info({ title: 'Info', message: '...' });
Modal.warning({ message: '...', success: () => {} });
Modal.danger(); // default title and text
Modal.message(type, options); // type from a server response, error means danger

if (await Modal.confirm({ title: 'Delete?', message: 'This cannot be undone.' })) {
    // confirmed
}

// the second argument are the options of the opening itself
Modal.confirm({ title: 'Delete?' }, { replace: true }); // closes the modal below it
Modal.confirm({ title: 'Delete?' }, { replaceAll: true }); // closes every opened modal
```

Message options: `title`, `text` (or `message`), `type`, `success`, `cancel`,
`confirmText`, `cancelText`, `actions`, and anything else ends in
`modal.options` (`class`, `key`, ...). Every preset takes opening options as its
second argument: `replace` closes the modal below it, `replaceAll` closes every
opened modal, the rest joins `modal.options`. `Modal.open()` takes them too.
Returning `false` from `success`, `cancel` or an action keeps the modal opened.

Every opening is a separate entry with its own `id`, the same name or component
can be opened more times at once.

### The entry

```js
{
    id, name, component, props, data,
    message: { type, title, text }, // messages only
    actions: [{ type, name, class, callback, enter, close }],
    options: { class, key, ... },
    state: { visible, openedAt, closedAt },
    result, // Promise of { action, value }
    close(value, action),
}
```

`action` is `success`, `cancel`, `close` (X, escape, backdrop) or the type of a
custom action.

### Reading and closing

Every method accepts an entry, an id or a name. A name means the last opened
modal with that name.

| method | |
| --- | --- |
| `isOpen(target)`, `isActive(target)` | opened / on top |
| `get(target, fromClosed)`, `getData(target, fromClosed)` | entry / its data |
| `data(name, default)` | ref refreshed on every opening |
| `close(target?, value, action)` | without a target closes the top modal |
| `runAction(target, action)` | runs an action and closes unless it returns `false` |
| `replace(...)`, `replaceAll(...)`, `closeAll()` | both take the arguments of `open()`; a preset replaces through its own `{ replace: true }` or `{ replaceAll: true }` |
| `onOpen`, `onClose`, `onChange(target, callback)` | `onOpen` of an entry which is already open runs on the next tick |

### Setup

```js
Modal.configure({
    closeDelay: 500, // close() waits this long, against double clicks
    unmountDelay: 800, // a closed modal stays mounted for its leave animation
    labels: { close: () => __('Zatvoriť'), confirm: () => __('Potvrdiť') },
    titles: { success: () => __('Informácia'), danger: () => __('Upozornenie') },
    texts: { danger: () => __('Nastala nečakaná chyba.') },
    hooks: { closing(entry) {}, unmounted(entry) {} },
});

Modal.setDefaultComponent(MessageModal); // messages, and components without a modal prop
Modal.register({ 'modal-confirm': ConfirmModal }); // names rendered by <ModalRenderer />
```

Place `<ModalRenderer />` once in the app. A component declaring a `modal` prop
renders the whole modal and gets the entry in it; any other component is put in
the default slot of the default component. Names that are not registered are
left to the app template, which binds them to `Modal.isOpen(name)`.

### Toasts

```js
Toast.success('Saved.');
Toast.error({ title: 'Error', message: '...' });
Toast.open({ type: 'warning', message: '...', duration: 10000 });
```

Ionic apps hand toasts to `toastController` through `Toast.setOpener()`. Without
an opener they go to `Toast.toasts` and are rendered by `<ToastRenderer />` with
the component given to `Toast.setComponent()`, which receives the entry in the
`toast` prop.

## Localization by url slugs

Off by default. Turn it on and every page gets one route per language:

```js
export default defineNuxtConfig({
    extends: ['./node_modules/@crudadmin/helpers/nuxt'],

    crudadmin: {
        localization: {
            enabled: true,
            locales: ['sk', 'en'],
        },
    },
});
```

| url         | language | route name   |
| ----------- | -------- | ------------ |
| `/`         | sk       | `index___sk` |
| `/about`    | sk       | `about___sk` |
| `/en`       | en       | `index___en` |
| `/en/about` | en       | `about___en` |

The first locale is the default one and keeps the bare paths. Every other
language is served from its own `/<slug>` prefix.

All languages live in the route table at the same time, so one build serves
all of them and switching a language is a plain navigation. This is the main
difference from the old Nuxt 2 implementation, which rebuilt the router for the
language of each incoming request.

### Options

Everything sits under `crudadmin.localization`:

| option          | default    | what it does                                                                         |
| --------------- | ---------- | ------------------------------------------------------------------------------------ |
| `enabled`       | `false`    | Turns localized routes on.                                                           |
| `locales`       | `[]`       | Language slugs to build routes for. Required, routes are generated at build time.    |
| `defaultLocale` | first one  | Language served from the site root.                                                  |
| `prefixDefault` | `false`    | Prefix the default language too, and redirect `/` to it.                             |
| `redirect`      | `true`     | Send an unprefixed url to the domain's language, or the one the visitor picked last. |
| `domains`       | `{}`       | Hostname to language map, eg `{ 'example.com': 'en' }`. `false` ignores the domain.  |
| `domainTld`     | `true`     | Treat a matching top level domain as its language, so `example.sk` serves `sk`.      |
| `cookie`        | `'locale'` | Cookie remembering the picked language.                                              |
| `routes`        | `{}`       | Translated paths per route name. May be a function, resolved at build time.          |

### Translated paths

Paths are keyed by route name, which stays stable no matter how the path is
rewritten:

```js
crudadmin: {
    localization: {
        enabled: true,
        locales: ['sk', 'en'],
        routes: {
            about: { sk: '/o-nas', en: '/about' },
            'projects-slug': { sk: '/projekty/:slug?' },
        },
    },
},
```

gives `/o-nas` and `/en/about`. Child routes are translated as well, but only
the root of a page tree receives the language prefix.

### Paths translated in the administration

Set `translateRoutes` and the paths come from the backend gettext catalog
instead of the config, which is how the Nuxt 2 implementation worked:

```js
crudadmin: {
    localization: {
        enabled: true,
        locales: ['sk', 'en'],
        translateRoutes: true,
    },
},
```

Two things happen during a build.

The route paths are written out as gettext calls into
`<buildDir>/crudadmin.routes.js`. Nothing imports that file, it exists so the
CrudAdmin scanner finds the paths and offers them for translation. Point the
backend at it:

```php
// config/admin.php
'gettext_source_paths' => array_filter(array_merge([
    app_path('/Utilities'),
], [
    env('APP_SRC_PATH').'/app',
    env('APP_SRC_PATH').'/node_modules/.cache/nuxt/.nuxt/crudadmin.routes.js',
])),
```

`APP_SRC_PATH` is the Nuxt project root, so the same one value locates both the
sources and the generated route list. The tail of that path is the Nuxt build
directory, which is `.nuxt` on Nuxt 3 and `node_modules/.cache/nuxt/.nuxt` on
Nuxt 4.

Then the catalog of every language is read from `/api/bootstrap?only=locale`
and each route path is looked up in it. Translating `/about` to `/o-nas` in the
administration moves that page, and every link to it follows, because links
resolve by route name.

Routes are static in Nuxt, so a translated path takes effect on the **next
build**, not immediately. That is the one thing the per request router of the
Nuxt 2 version could do and this cannot.

The answer of the last successful build is kept in `crudadmin.routes.json` at
the project root and used when the backend cannot be reached, so a build never
silently drops every translated path. Commit it. Pointing `cacheFile` inside
the build directory defeats it, since a deploy wipes that.

Because `routes` may also be a function, the paths can come from somewhere else
entirely. It is awaited during the build:

```js
routes: async () => {
    const response = await fetch(process.env.VITE_APP_SERVER_URL + '/api/route-paths');

    return await response.json();
},
```

### How the language is picked

1. the `/<slug>` prefix of the url, which always wins
2. the domain, through `domains` or a matching top level domain
3. the `locale` cookie, from the visitor's last switch
4. `defaultLocale`

Steps 2 and 3 only apply to urls with no prefix, and only when `redirect` is on.
They cause a 302 to the prefixed url rather than rendering another language at
the same address, so the url and the rendered language never disagree.

### Links build themselves

The router is taught to resolve in the active language, so ordinary links and
ordinary navigation stay in that language on their own. Nothing in an
application has to know that prefixed routes exist:

```vue
<NuxtLink :to="{ name: 'about' }">{{ __('About') }}</NuxtLink>
<NuxtLink :to="{ name: 'projects-slug', params: { slug } }">…</NuxtLink>
```

```js
router.push({ name: 'projects-slug', params: { slug } });
```

On `/en` these resolve to `/en/about` and `/en/projects/<slug>`, on the default
language to `/about` and `/projects/<slug>`.

Address routes by name rather than by a written out path. A name survives a
path translation, a hardcoded `/about` does not. Paths still work and are
localized the same way, but they have to be written the way the default
language spells them.

Pointing at a language other than the active one is what the language
switcher does, through `useSwitchLocalePath`.

### Composables

All auto-imported:

| composable                       | returns                                          |
| -------------------------------- | ------------------------------------------------ |
| `useCurrentLocale()`             | active language slug                             |
| `useLocales()`                   | every configured slug                            |
| `useSwitchLocalePath(locale)`    | the current page in another language             |
| `useSetLocale(locale, options?)` | switch language and navigate there               |
| `useLocaleParams(params?)`       | route params of this page in the other languages |
| `useLocaleCookie()`              | the language cookie                              |
| `useLocalizationConfig()`        | resolved options                                 |

A language switcher:

```vue
<button v-for="slug in useLocales()" :key="slug" @click="useSetLocale(slug)">
    {{ slug.toUpperCase() }}
</button>
```

`useSetLocale` reloads the page by default, because the translations and any
content the backend localizes have to be fetched again. Pass
`{ reload: false }` for a client side navigation instead.

### Localized route parameters

A dynamic segment usually differs per language, because the record behind it is
localized too. The router cannot know the other language's value, so the page
hands it over:

```js
useLocaleParams({
    sk: { slug: 'crm-erp-systemy' },
    en: { slug: 'crm-erp-systems' },
});
```

The language switcher merges these over the current parameters. Without them a
switch keeps the parameter as it is, which lands on a url carrying the other
language's slug. The values are dropped again on the next navigation, so every
page sets its own.

### Notes

- `locales` has to be listed in the config. Routes are built ahead of time while
  the languages themselves live in the database, so the two are kept in sync by
  hand. A slug missing from `locales` simply has no routes.
- The layer writes the resolved language into both the store and the cookie
  before the application's own plugins run, so anything fetched on boot is
  already requested in the right language.
