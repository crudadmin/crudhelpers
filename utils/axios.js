import axios from 'axios';
import { Toast } from './Toast.js';
import { useAjaxStore } from '../store/index.js';
import { useResponse } from './helpers.js';

export const Axios = new (class Axios {
    setOptions(options = {}, axiosOptions = {}) {
        this.options = {
            baseURL: options.baseURL || import.meta.env.VITE_APP_SERVER_URL,
            token: options.token,
            locale: options.locale,
            headers: options.headers,
        };

        this.axiosOptions = axiosOptions || {};
    }

    create() {
        const $axios = axios.create({
            baseURL: this.options.baseURL,
            ...this.axiosOptions,
        });

        this.addInterceptors($axios);

        // Request helpers ($get, $post, ...)
        this.addCustomMethods($axios);

        return $axios;
    }

    buildHeaders() {
        let headers = {},
            options = this.options || {};

        // Authorization header
        const token = options.token ? options.token() : null;
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        // Locale header
        let locale = options.locale ? options.locale() : null;
        if (locale) {
            headers['app-locale'] = locale;
        }

        // Add headers
        if (options.headers) {
            headers = { ...headers, ...options.headers(headers) };
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

                    const headers = this.buildHeaders();
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

                return Promise.reject(error);
            }
        );
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

            useResponse(response);

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
