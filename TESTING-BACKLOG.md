# Testing backlog

Owner's rule: tests come last. What the 2.1 changes need covered, once tests are
written. Verified manually so far in a throwaway Nuxt 4.5 app (SSR and SPA
builds, a fake API, a fake eshop layer); see the notes per item.

## Unit (vitest)

- `utils/Registry.js`
  - keyed entry is global and replaces the previous one of the key
  - unkeyed entry goes to the resolved scope, falls back to the global scope
  - `all(scope)` returns global entries first, then the scope ones
  - remover returned by `add()` removes the entry
  - `runInScope()` returns the callback result synchronously when
    `runWithContext` returns a promise (server), rethrows errors
- `utils/Axios.js`
  - `addHeaders()` merges callback headers, drops null/undefined, gets
    `{ headers, nuxtApp, pinia }`
  - object form `addHeaders({ ... })`
  - `configure()` merges, `setOptions()` replaces (BC)
  - `create(scope)` captures the scope used by the interceptors
  - 401 calls `options.unauthorized` and every `onUnauthorized` handler, with
    the error; a throwing handler does not stop the others
- `utils/Response.js`
  - `addStores()` keeps `setStores()` stores, dedupes by `$id`, a later
    definition of the same id replaces the earlier one
  - legacy store with the same `$id` wins over an added definition
  - `bindStores(data, { pinia })` resolves definitions with that pinia
  - `removeStores()`
  - non-definition argument warns and is ignored
- `store/ajaxStore.js`: `nextTryAt` is `failedRequestDelaySeconds` in the
  future (regression of the `moment().add(s, s)` bug)
- `definitions/appStore.js`: `updateAvailable` (no versions, equal, newer,
  3.0.10 vs 3.0.9), `updateStoreUrl` by platform, `refreshApp()` without
  `$crud` warns and resolves false
- `definitions/authStore.js`: `setAuth()` picks only AuthResponse keys,
  `flushData()`, `bearer` for string and object tokens, `loggedIn`
- `nuxt/utils/installer.js`: numbered plugins of layer dirs sorted by number
  with helpers ones, project numbered plugins untouched, pinia first

## Nuxt integration (@nuxt/test-utils, fixture app)

Manually verified on Nuxt 4.5.2 unless noted.

- SSR: bootstrap fetched once on the server, stores in the payload, client does
  not refetch (`crudadmin:bootstrap` with `source: 'hydration'`) - verified
- SSR: `auth_token` cookie sends `Authorization` on the server bootstrap,
  logged in state rendered, token absent from the html payload - verified
- SSR: `auth` section with `user: null` clears a revoked token and the cookie
  (`Set-Cookie: auth_token=; Max-Age=0`) - verified
- headers of a layer plugin (`Cart-Token`) and platform headers
  (`app-platform`, `app-type`) reach the bootstrap request on the server -
  verified
- project store added with `Response.addStores()` in a project plugin is
  filled by the server bootstrap - verified
- project extension of `useAppStore` under the same id wins the auto-import and
  is used by the layer plugin - verified
- `useAuth().login()` hydrates `auth` and the `cart` section, writes the
  cookie, runs `crudadmin:auth:login` and `crudadmin:bootstrap` (`login`) -
  verified
- 401 of a non-auth route logs out and clears the cookie; 401 of the login
  route does not - first part verified
- `useAuth().logout()` revokes, clears, runs the hook, fetches a guest
  bootstrap - verified
- SPA build: bootstrap on the client, token in localStorage, authenticated
  bootstrap after a reload - verified
- `bootstrap.only` + `useBootstrap().addSections()`; partial
  `refreshApp(['x'])` asks only for `x`
- `bootstrap.blocking`, `bootstrap.ssr: false`, route rule `ssr: false`
- browser refresher: no second fetch right after boot, refresh on `online`
- `auth.storage: 'preferences'` with and without `@capacitor/preferences`
- `capacitor.enabled` in a Capacitor build (Ionic toast opener, keyboard,
  refresher after the first bootstrap)
- concurrent SSR requests with different tokens and cart tokens never mix
  (the reason for the scoped registries); memory stable over many requests
- Nuxt 4.1 (scorentino) still boots with the always-on `02.axios` plugin and the
  module auto-imports instead of the `../store` scan
- `useLocalePath()` in the active and another language

## Known noise, not a failure

`pinia-plugin-persistedstate/nuxt` logs `[NUXT_E1001]` on the server when a
persisted helpers store (`locale`, `network`, ...) changes after an await: its
storage calls `useRuntimeConfig()` from a store subscription outside the Nuxt
context. Pre-existing, the write is skipped. Worth a fix in how the helpers
stores declare `persist` for the web build.

## 5. 10. 2026

- `useBootstrap().ready()` in a route middleware of the first navigation: on the server (token
  cookie, valid and revoked), in the SPA, after hydration (resolves without a request); the
  bootstrap runs once (app:created reuses the started promise), the browser refresher starts once.
- Imports `@crudadmin/helpers/nuxt/stores` and `/nuxt/composables` resolve to the same module
  instances as the auto-imports (one `app` store per request).
