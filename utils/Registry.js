/*
 * Shared extension registries (axios headers, unauthorized handlers).
 *
 * Axios and Response are module singletons, and on a Nuxt server one module
 * instance serves every request. A plain array filled from a plugin would grow
 * by one entry on every request and keep each request's closures alive, which
 * is the memory leak the new generation must not have.
 *
 * So every entry lives in a scope. In a Nuxt app the scope is the nuxtApp of
 * the request (resolved through Registry.setScopeResolver(), done by the
 * helpers layer), held in a WeakMap, so it is garbage collected together with
 * the request. Outside Nuxt, or when an entry is registered under an explicit
 * key, it lives in the one global scope, where a key replaces the previous
 * entry instead of adding a new one. That keeps the global scope bounded by the
 * number of distinct keys.
 */
const GLOBAL_SCOPE = Object.freeze({ global: true });

let scopeResolver = null;

/**
 * Current scope (nuxtApp) or null when there is none.
 */
export const resolveScope = (scope) => {
    if (scope) {
        return scope;
    }

    try {
        return scopeResolver ? scopeResolver() || null : null;
    } catch (e) {
        return null;
    }
};

/**
 * Teach the registries how to find the current request. The Nuxt layer passes
 * tryUseNuxtApp. Assigning the same function again on every request is
 * harmless, it is not request state.
 */
export const setScopeResolver = (resolver) => {
    scopeResolver = typeof resolver === 'function' ? resolver : null;
};

/**
 * Run a callback in the context of the scope (nuxtApp.runWithContext).
 *
 * Interceptors and response handlers run after an await, when a Nuxt server
 * no longer knows the request. Creating a store there fails (pinia plugins
 * such as pinia-plugin-persistedstate/nuxt call useRuntimeConfig()), so the
 * context is restored from the captured nuxtApp.
 */
export const runInScope = (scope, callback) => {
    if (!scope || typeof scope.runWithContext !== 'function') {
        return callback();
    }

    // On a server runWithContext goes through unctx callAsync and returns a
    // promise, but it calls the callback synchronously before its first
    // await. The result is taken right there, so headers and stores stay
    // synchronous.
    let ran = false,
        result,
        error;

    const pending = scope.runWithContext(() => {
        ran = true;

        try {
            result = callback();
        } catch (e) {
            error = e;
        }
    });

    pending?.catch?.(() => {});

    if (!ran) {
        return callback();
    }

    if (error) {
        throw error;
    }

    return result;
};

export class Registry {
    constructor() {
        this.scopes = new WeakMap();
    }

    /**
     * Entries of one scope, created on demand.
     */
    bucket(scope) {
        if (!this.scopes.has(scope)) {
            this.scopes.set(scope, new Map());
        }

        return this.scopes.get(scope);
    }

    /**
     * Register an entry.
     *
     * With a key it is global and replaces any previous entry of that key.
     * Without one it belongs to the current request when there is one, and to
     * the global scope (keyed by the entry itself, so registering the same
     * function twice keeps one) otherwise.
     *
     * Returns a function removing the entry again.
     */
    add(entry, options = {}) {
        if (typeof options === 'string') {
            options = { key: options };
        }

        const key = options.key || entry;

        const scope = options.key
            ? GLOBAL_SCOPE
            : resolveScope(options.scope) || GLOBAL_SCOPE;

        this.bucket(scope).set(key, entry);

        return () => this.remove(key, scope);
    }

    remove(key, scope) {
        if (scope) {
            this.scopes.get(scope)?.delete(key);

            return;
        }

        this.scopes.get(GLOBAL_SCOPE)?.delete(key);

        const current = resolveScope();

        if (current) {
            this.scopes.get(current)?.delete(key);
        }
    }

    /**
     * Global entries first, then the ones of the given (or current) scope.
     */
    all(scope) {
        scope = resolveScope(scope);

        const entries = [...(this.scopes.get(GLOBAL_SCOPE)?.values() || [])];

        if (scope && scope !== GLOBAL_SCOPE) {
            entries.push(...(this.scopes.get(scope)?.values() || []));
        }

        return entries;
    }
}
