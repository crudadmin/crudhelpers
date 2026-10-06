import axios from 'axios';
import { Toast } from './Toast.js';
import { useAjaxStore, useNetworkStore } from '../store/index.js';
import { useResponse } from './helpers.js';
import {
    Registry,
    resolveScope,
    runInScope,
    setScopeResolver,
} from './Registry.js';

// Connection errors are reported only when the network store knows the device is offline
Toast.setConnectionResolver(() => useNetworkStore().connected);

export const Axios = new (class Axios {
    constructor() {
        this.options = {};
        this.axiosOptions = {};

        // Extension points of other packages and layers (eshop Cart-Token, ...).
        // Scoped per request on a Nuxt server, see Registry.js.
        this.headersRegistry = new Registry();
        this.unauthorizedRegistry = new Registry();
    }

    /**
     * Replace all options. Kept as it always was, a project calling it from its
     * own plugin still owns the whole configuration.
     */
    setOptions(options = {}, axiosOptions = {}) {
        this.options = {
            baseURL: options.baseURL || import.meta.env.VITE_APP_SERVER_URL,
            token: options.token,
            locale: options.locale,
            headers: options.headers,
            callback: options.callback,
            unauthorized: options.unauthorized,
        };

        this.axiosOptions = axiosOptions || {};
    }

    /**
     * Merge options into the current ones, so the helpers layer can set the
     * defaults and a project only overrides what it has to.
     */
    configure(options = {}, axiosOptions = null) {
        const merged = { ...(this.options || {}) };

        for (const key in options) {
            if (options[key] !== undefined) {
                merged[key] = options[key];
            }
        }

        this.options = merged;

        if (axiosOptions) {
            this.axiosOptions = { ...(this.axiosOptions || {}), ...axiosOptions };
        }

        return this;
    }

    /**
     * How to find the current request (nuxtApp). Set by the Nuxt layer.
     */
    setScopeResolver(resolver) {
        setScopeResolver(resolver);

        return this;
    }

    /**
     * Add headers to every request, on top of the ones from the options.
     *
     * The callback gets { headers, nuxtApp, pinia } and returns an object;
     * null/undefined values are dropped. Read request state through the given
     * pinia (useCartStore(pinia)), never through a closure over a store
     * captured elsewhere, because a keyed callback is shared by all requests.
     *
     * Axios.addHeaders(({ pinia }) => ({ 'Cart-Token': useCartStore(pinia).token }), 'eshop.cart');
     *
     * Returns a function removing the callback.
     */
    addHeaders(callback, options = {}) {
        if (typeof callback !== 'function') {
            const headers = callback || {};

            callback = () => headers;
        }

        return this.headersRegistry.add(callback, options);
    }

    /**
     * Call the callback whenever a request answers 401. Every registered
     * handler runs (eshop drops the client data, the project redirects),
     * after the legacy options.unauthorized.
     *
     * Returns a function removing the handler.
     */
    onUnauthorized(callback, options = {}) {
        return this.unauthorizedRegistry.add(callback, options);
    }

    /**
     * Context handed to every callback.
     */
    context(scope) {
        scope = resolveScope(scope);

        return {
            nuxtApp: scope,
            pinia: scope?.$pinia,
        };
    }

    /**
     * Axios instance with the helpers interceptors.
     *
     * The scope (nuxtApp) is captured here, synchronously, because on a Nuxt
     * server the request context is gone by the time an interceptor runs after
     * an await. Call useAxios() in setup, a plugin or a hook, or pass the
     * nuxtApp: useAxios(nuxtApp).
     */
    create(scope) {
        const $axios = axios.create({
            baseURL: this.options.baseURL,
            ...this.axiosOptions,
        });

        Object.defineProperty($axios, '_crudScope', {
            value: resolveScope(scope),
            enumerable: false,
        });

        this.addInterceptors($axios);

        // Request helpers ($get, $post, ...)
        this.addCustomMethods($axios);

        // Axios callback mutator
        if (this.options.callback) {
            this.options.callback($axios);
        }

        return $axios;
    }

    buildHeaders(scope) {
        scope = resolveScope(scope);

        return runInScope(scope, () => this.resolveHeaders(scope));
    }

    resolveHeaders(scope) {
        let headers = {},
            options = this.options || {};

        const context = this.context(scope);

        // Authorization header
        const token = options.token ? options.token(context) : null;
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        // Locale header
        let locale = options.locale ? options.locale(context) : null;
        if (locale) {
            headers['app-locale'] = locale;
        }

        // Add headers
        if (options.headers) {
            headers = { ...headers, ...options.headers(headers, context) };
        }

        // Registered headers of other layers
        for (const callback of this.headersRegistry.all(context.nuxtApp)) {
            const added = callback({ ...context, headers }) || {};

            for (const key in added) {
                if (added[key] !== null && added[key] !== undefined) {
                    headers[key] = added[key];
                }
            }
        }

        return headers;
    }

    setLoading($axios, state) {
        let args = $axios._onLoading;

        if (!args || !args.length) {
            return;
        }

        let callback = args[0],
            key = args[1];

        if (typeof callback == 'function') {
            callback(state);
        }

        if (callback && 'value' in callback) {
            if (key) {
                callback.value[key] = state;
            } else {
                callback.value = state;
            }
        }
    }

    addInterceptors($axios) {
        $axios.interceptors.request.use(
            (successfulReq) => {
                this.setLoading($axios, true);

                //Push admin headers into each request
                if (successfulReq.headers) {
                    // prettier-ignore
                    // console.log('[AXIOS]', successfulReq.method.toUpperCase(), '-', successfulReq.url);

                    const headers = this.buildHeaders($axios._crudScope);
                    for (var key in headers) {
                        successfulReq.headers[key] = headers[key];
                    }
                }

                return successfulReq;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        $axios.interceptors.response.use(
            (response) => {
                //Toggle loading state
                this.setLoading($axios, false);

                return response;
            },
            (error) => {
                //Toggle loading state
                this.setLoading($axios, false);

                // On unauthorized error, call unauthorized callbacks
                if ((error.status || error.response?.status) === 401) {
                    this.callUnauthorized($axios._crudScope, error);
                }

                return Promise.reject(error);
            }
        );
    }

    callUnauthorized(scope, error) {
        scope = resolveScope(scope);

        runInScope(scope, () => this.runUnauthorized(scope, error));
    }

    runUnauthorized(scope, error) {
        const context = { ...this.context(scope), error };

        const handlers = [this.options.unauthorized].concat(
            this.unauthorizedRegistry.all(context.nuxtApp)
        );

        for (const handler of handlers) {
            if (typeof handler !== 'function') {
                continue;
            }

            try {
                handler(context);
            } catch (e) {
                console.error(e);
            }
        }
    }

    addCustomMethods($axios) {
        for (let method of [
            'request',
            'delete',
            'get',
            'head',
            'options',
            'post',
            'put',
            'patch',
        ]) {
            $axios['$' + method] = async function () {
                return this[method]
                    .apply(this, arguments)
                    .then((res) => res && res.data);
            };
        }

        $axios['$getOnline'] = function (url, data, errorMessage) {
            Toast.connectionError(errorMessage);

            return this.$get(url, data);
        };

        $axios['$postOnline'] = function (url, data, options, errorMessage) {
            Toast.connectionError(errorMessage);

            return this.$post(url, data, options);
        };

        $axios['$deleteOnline'] = function (url, data, options, errorMessage) {
            Toast.connectionError(errorMessage);

            return this.$delete(url, data, options);
        };

        $axios['$getAsync'] = async (url, data, options) => {
            return await this.asyncRequest($axios, 'get', url, data, options);
        };

        $axios['$postAsync'] = async (url, data, options) => {
            return await this.asyncRequest($axios, 'post', url, data, options);
        };

        $axios['$deleteAsync'] = async (url, data, options) => {
            // prettier-ignore
            return await this.asyncRequest($axios, 'delete', url, data, options);
        };

        $axios['loading'] = function (variableOrCallback, variableKey = null) {
            this._onLoading = [variableOrCallback, variableKey];

            return this;
        };
    }

    async asyncRequest($axios, method, url, data, options) {
        //Set key of request for redundancy
        if (typeof options == 'string') {
            options = { key: options };
        }

        options = options || {};

        const requestForLater = {
            method,
            url,
            data,
            key: options.key,
        };

        //Don't make request if error request of same request is already scheduled on future. Wait...
        //It will happen automatically
        const alreadyScheduled =
            useAjaxStore().isAlreadyScheduled(requestForLater);

        // prettier-ignore
        if ( options._forceCheck !== true && alreadyScheduled.length ) {
            console.log('[AJAX] already scheduled at', alreadyScheduled[0].nextTryAt,alreadyScheduled[0]);
            return;
        }

        try {
            let response = await $axios['$' + method](url, data);

            useResponse(response, { scope: $axios._crudScope });

            if (options.callback) {
                await options.callback();
            }

            return response;
        } catch (e) {
            if (options._isRepeatedTry) {
                throw Error(e);
            } else {
                //Save request for later send
                useAjaxStore().sendRequestLater(requestForLater);

                //Show error in console
                console.error(e);
            }
        }
    }
})();
