# Upgrading @crudadmin/helpers from 2.0 to 2.1

2.1 is backward compatible. Nothing has to change in a project which keeps its
own boot plugin, `appStore` and `authStore`. Everything new is opt-in through
`crudadmin.bootstrap.enabled` (the `@crudadmin/eshop` layer turns it on).

## Changed behaviour

- **Store auto-imports** are registered by the module (`addImports`) instead of
  scanning `../store`. The scanner misread `state() {` in every `defineStore()`
  as an export and logged false `Duplicated imports "state"` warnings. Projects
  can delete their `hooks['imports:extend']` workaround (qualit).
- **Auto-imports of the layer have priority -1.** A project (or layer) exporting
  the same name wins silently instead of a "Duplicated imports" warning. This is
  also how a project replaces a store with its extended definition.
- **`useAxios`, `useResponse`, `generateUuid`, `useSleep`, `useLazyClick`,
  `useObjectToFormData`, `useIsVersionNewer`** are auto-imported by the layer.
  `export * from '@crudadmin/helpers/helpers'` in a project composable is no
  longer needed, but keeps working.
- **`ajaxStore` retry delay** works: `nextTryAt` used `moment().add(s, s)`,
  which added nothing, so a failed `$postAsync` was retried by the 2 s loop of
  `Network` right away. It now waits `options.failedRequestDelaySeconds` (60 s).
- **Plugin order.** Numbered plugins (`NN.name.js`) of every layer extending
  helpers are ordered by number together with the helpers ones (helpers
  `00`-`09`, eshop `10`-`19`), right after pinia. Before, only helpers plugins
  were moved. Plugins of the project itself are not reordered.
- **New always-on plugin `02.axios`** gives `Axios` and `Response` a way to find
  the current nuxtApp (`tryUseNuxtApp`). Interceptor callbacks now run inside
  the Nuxt context of the request they were created in.
- `options.token`, `options.locale`, `options.headers` and
  `options.unauthorized` of `Axios.setOptions()` receive a context argument
  (`{ nuxtApp, pinia }`, `headers` gets it as the second argument). Callbacks
  ignoring arguments are unaffected.
- `localization.bootstrapPath` defaults to `/<bootstrap.path>?only=locale`
  (still `/api/bootstrap?only=locale` by default), `localization.apiUrl` falls
  back to `bootstrap.baseURL` before `VITE_APP_SERVER_URL`.
- `Network`: the default refresh interval is 600 s, the comment said 5 minutes.

## New

| | |
| --- | --- |
| `Response.addStores(definitions)`, `Response.removeStores(ids)` | add stores without replacing `setStores()` |
| `Axios.addHeaders(callback, key?)` | headers merged into every request |
| `Axios.onUnauthorized(callback, key?)` | every handler runs on a 401 |
| `Axios.configure(options)` | merge options instead of replacing them |
| `useAxios(nuxtApp?)` | pass the nuxtApp when created after an await on a server |
| `crudadmin.bootstrap`, `crudadmin.auth`, `crudadmin.platform`, `crudadmin.capacitor` | module options |
| plugins `03.bootstrap`, `04.capacitor.client` | added only when enabled |
| `useAppStore`, `useAuthStore` | helpers stores, options in `@crudadmin/helpers/definitions` |
| `useBootstrap`, `useAuth`, `useBackendEnv`, `usePlatformHeaders`, `usePlatform`, `useLocalePath` | composables |
| `useBootstrap().ready()` | starts the first bootstrap when it has not started yet, so route middleware can await it, also on the server (the router navigates in its own `app:created`, before the one of helpers) |
| `@crudadmin/helpers/nuxt/stores`, `@crudadmin/helpers/nuxt/composables` | `useAppStore`/`useAuthStore` and `useBootstrap`/`useBackendEnv`... for layers importing them directly instead of `#imports` |
| hooks `crudadmin:bootstrap:before`, `crudadmin:bootstrap`, `crudadmin:bootstrap:error`, `crudadmin:auth:login`, `crudadmin:auth:logout`, `crudadmin:capacitor:ready` | |

See the README, "App boot, bootstrap and auth".

## Moving a project onto the helpers boot

Optional, per project. Taking scorentino or qualit as the example:

1. `crudadmin: { bootstrap: { enabled: true } }` in `nuxt.config`, plus
   `platform.type` if the API serves more apps, and `capacitor.enabled` for the
   native build.
2. Delete from the boot plugin (`01.app.js`): `Axios.setOptions()` (token,
   locale, platform headers), `bootPlatformHeaders()`, the helpers stores in
   `Response.setStores()` and `new Capacitor(...)`. Register the project stores
   with `Response.addStores([...definitions])`. Project specific headers go
   through `Axios.addHeaders()` (scorentino `X-Socket-Id`).
3. Delete the SSR fetch from `app.vue` (`useAsyncData('app-bootstrap', ...)`).
4. Delete `appStore.refreshApp()`, `getBootstrapResponse()`, `useBackendEnv()`,
   `usePlatformHeaders()` / `bootPlatformHeaders()` from the project. Keep only
   project state, by extending the options from `@crudadmin/helpers/definitions`
   under the same store id. `useOnAppRefresh()` becomes a
   `crudadmin:bootstrap` hook.
5. `authStore`: extend `authStore` from `@crudadmin/helpers/definitions` with
   the project getters/actions. `logout()` of the store goes through
   `useAuth().logout()`, project clean up moves to the `crudadmin:auth:logout`
   hook.
6. Token storage changes: the web build keeps the token in the `auth_token`
   cookie, the SPA build in localStorage under `crudadmin.auth.token`. In the
   SPA build the `auth` store is still persisted in the old shape (all but
   `device_tokens`), so users logged in through the project store stay logged
   in. The web build no longer persists the store into localStorage, so web
   users logged in before the switch have to log in again.
7. A project which has its own `useAuth` (qualit) shadows the helpers one.
   Rename it, or make it a thin wrapper around the helpers composable.
8. Do not keep `rejectUnauthorized: false` on the server, the layer does not
   set it.
