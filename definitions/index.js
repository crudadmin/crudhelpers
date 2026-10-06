/*
 * Store options shared by the projects, meant to be extended. Kept out of
 * store/index.js on purpose: AutoImportPreset auto-imports every export of
 * that file, and these names must not land in projects which define their own
 * app and auth stores.
 */
export * from './appStore.js';
export * from './authStore.js';
