import axios from 'axios';

export class Axios {
    constructor(options = {}) {
        this.options = {
            baseURL: options.baseURL || import.meta.env.VITE_APP_SERVER_URL,
            ...options,
        };

        const headers = this.buildHeaders();

        this.$axios = axios.create({
            ...this.options,
            addHeaders: () => {
                return headers;
            },
            headers: {
                common: {},
            },
        });

        this.addInterceptors(options.addHeaders);

        // Request helpers ($get, $post, ...)
        this.addCustomMethods();

        return this.$axios;
    }

    buildHeaders() {
        let obj = {};

        // Authorization header
        const token = this.options.token ? this.options.token() : null;
        if (token) {
            obj['Authorization'] = 'Bearer ' + token;
        }

        // Locale header
        let locale = this.options.locale ? this.options.locale() : null;
        if (locale) {
            obj['app-locale'] = locale;
        }

        return obj;
    }

    setLoading(state) {
        let args = this.$axios._onLoading;

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

    addInterceptors(addHeaders) {
        this.$axios.interceptors.request.use(
            (successfulReq) => {
                this.setLoading(true);

                //Push admin headers into each request
                if (successfulReq.headers) {
                    // prettier-ignore
                    // console.log('[AXIOS]', successfulReq.method.toUpperCase(), '-', successfulReq.url);

                    //Add cart and auth headers into axios
                    var appHeaders =
                        typeof addHeaders == 'function' ? addHeaders() : {};

                    for (var key in appHeaders) {
                        successfulReq.headers[key] = appHeaders[key];
                    }
                }

                return successfulReq;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        this.$axios.interceptors.response.use(
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
            this.$axios['$' + method] = async function () {
                return this[method]
                    .apply(this, arguments)
                    .then((res) => res && res.data);
            };
        }

        this.$axios['$getOnline'] = function (url, data, errorMessage) {
            useThrowConnectionAlert(errorMessage);

            return this.$get(url, data);
        };

        this.$axios['$postOnline'] = function (
            url,
            data,
            options,
            errorMessage
        ) {
            useThrowConnectionAlert(errorMessage);

            return this.$post(url, data, options);
        };

        this.$axios['$deleteOnline'] = function (
            url,
            data,
            options,
            errorMessage
        ) {
            useThrowConnectionAlert(errorMessage);

            return this.$delete(url, data, options);
        };

        this.$axios['$getAsync'] = async function (url, data, options) {
            return await this.asyncRequest('get', url, data, options);
        };

        this.$axios['$postAsync'] = async function (url, data, options) {
            return await this.asyncRequest('post', url, data, options);
        };

        this.$axios['$deleteAsync'] = async function (url, data, options) {
            return await this.asyncRequest(
                'delete',
                url,
                data,
                options,
                $axios
            );
        };

        this.$axios['loading'] = function (
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
            useAjaxStore().isAlreadyScheduled(requestForLater);

        // prettier-ignore
        if ( options._forceCheck !== true && alreadyScheduled.length ) {
            console.log('[AJAX] already scheduled at', alreadyScheduled[0].nextTryAt,alreadyScheduled[0]);
            return;
        }

        try {
            let response = await $axios['$' + method](url, data);

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
                useAjaxStore().sendRequestLater(requestForLater);

                //Show error in console
                console.error(e);
            }
        }
    }
}
