# Upgrading @crudadmin/helpers from 1.x to 2.0

## Dependencies

- `vue`, `pinia` and `@pinia/nuxt` are peer dependencies now. Install them in the
  project. Pinia 3 and 4 are both supported.
- `@ionic/vue`, `@capacitor/keyboard` and `@capacitor/network` are optional peer
  dependencies. Install them only when you use `@crudadmin/helpers/capacitor`.
- Do not symlink the package into a Nuxt project (`npm link`, a `file:` dependency
  without `--install-links`). Nuxt loads its layer dependencies from the linked
  folder, which gives the app two copies of Vue and Pinia. Install a local copy with
  `npm install --install-links <path>` and run it again after changing the package.

## Modal

- Every `Modal.open()` creates a separate entry with its own `id`. The same name can be
  opened more than once.
- `Modal.close(name)` closes only the last opened modal with that name. Before, it closed
  all of them.
- `Modal.open()` returns the modal entry instead of the length of the stack.
- The payload given to `Modal.open(name, payload)` is in `entry.data`. `entry.callback`
  no longer exists. Replace `Modal.get(name)?.callback` with `Modal.getData(name)`.
- `Modal.modals.value` holds entries of the new shape:
  `{ id, name, component, props, data, message, actions, options, state, result }`.
  It still lists only opened modals, so `Modal.modals.value.length` works as before.
- `Modal.onClose(name, callback)` receives the data of the closed modal. Before 1.1.10
  it received `undefined`.
- `Modal.closeAll()` closes every opened modal. Before, it skipped every second one.
- `Modal.replace()` returns a promise of the new entry.

## Toast

- Toasts get a `type` (`success`, `info`, `warning`, `danger`) in addition to the
  legacy `cssClass`. `Toast.error()` keeps the `--error` class.
- When no opener is set with `Toast.setOpener()`, toasts go to a built-in stack
  rendered by `<ToastRenderer />` with the component from `Toast.setComponent()`.
  Ionic projects that set the opener are not affected.

## New

- `@crudadmin/helpers/modal` exports `Modal`, `Toast`, `ModalRenderer` and
  `ToastRenderer` and depends only on Vue.
- `Modal.success()`, `Modal.info()`, `Modal.warning()`, `Modal.danger()`,
  `Modal.message(type, options)` and `await Modal.confirm()` open messages rendered by
  the component given to `Modal.setDefaultComponent()`.
- `Modal.open(Component, props, options)` opens a component through `<ModalRenderer />`.
- `Modal.register(name, Component)` renders a modal opened by name through
  `<ModalRenderer />`, so it no longer has to be placed in the app template.
- `await modal.result` resolves with `{ action, value }` when the modal closes.
- `confirmText` and `cancelText` rename the buttons of one modal.
- Presets and `Modal.open()` take opening options, eg.
  `Modal.confirm({ title }, { replace: true })` closes the modal below it and
  `{ replaceAll: true }` closes every opened modal. `Modal.replaceAll(...)` does
  the same for a modal opened by name or by component.

See the README for the full API.

## Vue translations

- Install `CrudadminVue` after Pinia. It registers the shared `Translator` and follows `useLocaleStore().translations`, including catalogs arriving after mount.
- Catalog updates through `CrudadminVue` replace previous messages; resetting the locale store clears translations. Global helpers remain `__` and `n__`; Vue components also receive the context/plural helpers.
- `Translator.setTranslates(data)` now clears its parsed-input cache before applying the new catalog. Pass `{ replace: true }` as the second argument to discard previous catalogs; the default continues merging into the existing gettext instance.
