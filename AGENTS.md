# @crudadmin/helpers

The frontend half of every project built on CrudAdmin. Every Nuxt website,
Ionic + Capacitor app and Vue SPA talks to its Laravel backend through this
package, and the CrudAdmin administration uses it too. It holds the axios
wrapper, `Response` (toasts + binding the `store` object of responses into
Pinia stores), the bootstrap, auth, translations, modals, toasts and url
localization.

`AGENTS.md` is canonical; `CLAUDE.md` imports it. This file ships with the npm
package, so agents of projects read it in `node_modules/@crudadmin/helpers/`.

## Documentation

- `README.md` — the full API reference of this version.
- `MIGRATION-*.md` — upgrades between versions.
- https://docs.crudadmin.com/development/index — the development structure:
  how a Laravel backend shares data with the frontends.
  - `development/communication` — response format, `store` binding rules,
    controller patterns
  - `development/bootstrap` — the backend `AppRequest` sections
  - `development/frontend/{index,boot,requests,stores,modals,localization}` —
    this package

## Using the package in a project

- Every request goes through `useAxios()`, every response and every error
  through `useResponse()`.
- Shared data comes from the bootstrap request. A backend section fills the
  Pinia store with the same id, in the singular (`event` →
  `defineStore('event')`).
- `store` keys bind by store id: `"auth": {...}` writes properties,
  `"auth/user"` one property, `"event/updateEvent"` calls the action.
- Register stores receiving backend data with `Response.addStores([useXxxStore])`
  (definitions, not instances).
- Nuxt: `extends: ['@crudadmin/helpers/nuxt']` with
  `crudadmin.bootstrap.enabled`; no own bootstrap fetch, axios options, token
  storage or platform headers. Extend the `app`/`auth` stores from
  `@crudadmin/helpers/definitions` under the same id.
- Never symlink the package into a Nuxt project, install a local copy with
  `npm install --install-links <path>`.

## Working on the package

- Keep the public API backward compatible within a minor version. Document
  every behaviour change and new API in the `MIGRATION-*.md` of the version.
- Update `README.md` with every API change, and the matching pages of the
  documentation (`packages/admin/apps/docs/development/frontend/*.mdx`, source
  of the docs site and of the `crudadmin-development` Boost skill; rebuild it
  with `apps/docs/bin/build-boost`).
- The administration (`packages/admin/dependencies/resources/app`) links this
  package: changes of `Response`, `Modal`, `Toast`, `Translator` and the stores
  affect it too.
- No request state on module level: a Nuxt server shares the modules between
  requests. Keyed callbacks read state through the `pinia` they are handed,
  store definitions are resolved with the pinia of each request.
- Tests (`npm test`, vitest) come last: record what needs covering in
  `TESTING-BACKLOG.md` while a feature is being shaped, write the tests only
  when asked.
- Code and comments in English, Prettier settings from `.prettierrc`.
