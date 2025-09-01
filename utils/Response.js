import { Toast } from './Toast.js';

export const Response = new (class Response {
    constructor() {
        this.stores = [];

        return this;
    }

    setStores(stores) {
        this.stores = stores;
    }

    get(response) {
        let isError = response instanceof Error;

        //If is error response
        if (isError && response.response) {
            response = response.response;
        }

        //Axios request data
        if (response) {
            const data = response.data || {},
                status = response.status,
                store = response.store || data.store;

            //Set store from request data
            if (store && this.stores) {
                this.bindStores(store);
            }

            //Validation error
            if ([401, 403].includes(status)) {
                Toast.error({
                    // prettier-ignore
                    message: data?.error && data?.message ? data.message : __('Tento obsah už nie je k dispozícii.'),
                });
            } else if (status == 404) {
                Toast.error({
                    // prettier-ignore
                    message: __('Ľutujeme, dany záznam nebol nájdeny. Pravdepodobne už neexistuje.'),
                });
            } else if (status == 422 && data.errors) {
                Toast.error({
                    message: Object.values(data.errors).join(' '),
                    duration: 5000,
                });
            }

            //If valid request with error data has been given
            else if (response.message || data.message) {
                let isErrorCode = [4, 5].includes(parseInt((status + '')[0])), //All 400 + 500 error codes
                    obj = {
                        message: response.message || data.message,
                        duration: isErrorCode ? 5000 : null,
                    };

                if (isErrorCode || response instanceof Error) {
                    Toast.error(obj);
                } else {
                    Toast.open(obj);
                }
            }

            //If valid request without error data has been given
            else if (isError) {
                console.error(response);

                Toast.unknown();
            }
        }

        //If invalid error request has been given. For example on backend crash etc...
        else if (isError) {
            console.error(response);

            Toast.unknown();
        }
    }

    bindStores(data) {
        let stores = this.stores;

        if (typeof stores === 'function') {
            stores = stores();
        }

        const bindStore = (store, key, value) => {
            if (typeof store[key] == 'function') {
                store[key](value);
            } else {
                store[key] = value;
            }
        };

        stores.forEach((store) => {
            for (var key in data) {
                //Bind by slash path
                if (key.includes('/')) {
                    let parts = key.split('/');

                    if (store.$id != parts[0]) {
                        continue;
                    }

                    const value = data[key];

                    bindStore(store, parts[1], value);
                } else if (store.$id == key) {
                    for (var k in data[key]) {
                        bindStore(store, k, data[key][k]);
                    }
                }
            }
        });
    }
})();
