import axios from 'axios';

export class Axios {
    constructor(options = {}, $axiosOptions = {}) {
        this.options = {
            baseURL: options.baseURL || import.meta.env.VITE_APP_SERVER_URL,
            token: options.token,
            locale: options.locale,
            headers: options.headers,
        };

        this.axios = axios.create({
            baseURL: this.options.baseURL,
            ...$axiosOptions,
        });

        this.addInterceptors();

        // Request helpers ($get, $post, ...)
        this.addCustomMethods();

        return this.axios;
    }

    buildHeaders() {
        let headers = {};

        // Authorization header
        const token = this.options.token ? this.options.token() : null;
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        // Locale header
        let locale = this.options.locale ? this.options.locale() : null;
        if (locale) {
            headers['app-locale'] = locale;
        }

        // Add headers
        if (this.options.headers) {
            headers = { ...headers, ...this.options.headers(headers) };
        }

        return headers;
    }

    setLoading(state) {
        let args = this.axios._onLoading;

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

    addInterceptors() {
        this.axios.interceptors.request.use(
            (successfulReq) => {
                this.setLoading(true);

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

        this.axios.interceptors.response.use(
            (response) => {
                //Toggle loading state
                this.setLoading(false);

                return response;
            },
            (error) => {
                //Toggle loading state
                this.setLoading(false);

                return Promise.reject(error);
            }
        );
    }

    addCustomMethods() {
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
            this.axios['$' + method] = async function () {
                return this[method]
                    .apply(this, arguments)
                    .then((res) => res && res.data);
            };
        }

        this.axios['$getOnline'] = function (url, data, errorMessage) {
            useThrowConnectionAlert(errorMessage);

            return this.$get(url, data);
        };

        this.axios['$postOnline'] = function (
            url,
            data,
            options,
            errorMessage
        ) {
            useThrowConnectionAlert(errorMessage);

            return this.$post(url, data, options);
        };

        this.axios['$deleteOnline'] = function (
            url,
            data,
            options,
            errorMessage
        ) {
            useThrowConnectionAlert(errorMessage);

            return this.$delete(url, data, options);
        };

        this.axios['$getAsync'] = async (url, data, options) => {
            return await this.asyncRequest('get', url, data, options);
        };

        this.axios['$postAsync'] = async (url, data, options) => {
            return await this.asyncRequest('post', url, data, options);
        };

        this.axios['$deleteAsync'] = async (url, data, options) => {
            return await this.asyncRequest('delete', url, data, options);
        };

        this.axios['loading'] = function (
            variableOrCallback,
            variableKey = null
        ) {
            this._onLoading = [variableOrCallback, variableKey];

            return this;
        };
    }

    async asyncRequest(method, url, data, options) {
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
            this.ajaxStore().isAlreadyScheduled(requestForLater);

        // prettier-ignore
        if ( options._forceCheck !== true && alreadyScheduled.length ) {
            console.log('[AJAX] already scheduled at', alreadyScheduled[0].nextTryAt,alreadyScheduled[0]);
            return;
        }

        try {
            let response = await this.axios['$' + method](url, data);

            useAutoAjaxResponse(response);

            if (options.callback) {
                await options.callback();
            }

            return response;
        } catch (e) {
            if (options._isRepeatedTry) {
                throw Error(e);
            } else {
                //Save request for later send
                this.ajaxStore().sendRequestLater(requestForLater);

                //Show error in console
                console.error(e);
            }
        }
    }

    ajaxStore() {
        return this.options.ajaxStore || useAjaxStore();
    }
}
