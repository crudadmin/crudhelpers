import { Toast } from './Toast.js';
import { resolveScope, runInScope } from './Registry.js';

/*
 * A store definition is the useXxxStore function returned by defineStore(),
 * pinia gives it the $id of the store.
 */
const isStoreDefinition = (store) =>
    typeof store === 'function' && typeof store.$id === 'string';

export const Response = new (class Response {
    constructor() {
        // Legacy list of setStores(), replaced on every call
        this.stores = [];

        // Store definitions added by layers, keyed by the store $id. Only
        // definitions are kept, they are static modules and not request
        // state, so the map is safe to share by every request of a server.
        this.definitions = new Map();

        return this;
    }

    /**
     * Replace the list of stores which receive bootstrap data. Kept for
     * existing projects, it overwrites what the project set before, but never
     * the stores added through addStores().
     */
    setStores(stores) {
        this.stores = stores;
    }

    /**
     * Add stores which receive response data, without touching the stores of
     * the project or of other layers.
     *
     * Takes store definitions (useCartStore), one or an array. A definition
     * registered later under the same $id replaces the previous one, so a
     * project can register its extended store instead of the layer one.
     * Resolved per response through the pinia of the request.
     *
     * Response.addStores([useEshopStore, useCartStore]);
     */
    addStores(stores) {
        stores = Array.isArray(stores) ? stores : [stores];

        for (const store of stores) {
            if (isStoreDefinition(store)) {
                this.definitions.set(store.$id, store);
            } else if (store) {
                // prettier-ignore
                console.warn('[@crudadmin/helpers] Response.addStores() takes store definitions (useXxxStore), not store instances or factories. Use setStores() for those.', store);
            }
        }

        return this;
    }

    /**
     * Stop sending data to the store of the given $id.
     */
    removeStores(ids) {
        (Array.isArray(ids) ? ids : [ids]).forEach((id) =>
            this.definitions.delete(isStoreDefinition(id) ? id.$id : id)
        );

        return this;
    }

    /**
     * Every store receiving data: the legacy list first, then the added
     * definitions resolved with the pinia of the request. A store with the
     * same $id is bound once.
     */
    resolveStores(options = {}) {
        let stores = this.stores;

        if (typeof stores === 'function') {
            stores = stores();
        }

        stores = (stores || []).filter((store) => store);

        const scope = resolveScope(options.scope);
        const pinia = options.pinia || scope?.$pinia;
        const ids = new Set(stores.map((store) => store.$id));

        for (const [id, definition] of this.definitions) {
            if (ids.has(id)) {
                continue;
            }

            // Creating a store may need the Nuxt context, see runInScope()
            stores.push(
                runInScope(scope, () =>
                    pinia ? definition(pinia) : definition()
                )
            );
            ids.add(id);
        }

        return stores;
    }

    get(response, options = {}) {
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
            if (store) {
                this.bindStores(store, options);
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
                        duration:
                            data?.toast_duration || (isErrorCode ? 5000 : null),
                    };

                if (
                    isErrorCode ||
                    response instanceof Error ||
                    response?.error === true ||
                    response?.type === 'error'
                ) {
                    Toast.error(obj);
                } else {
                    Toast.open(obj);
                }
            }

            //If valid request without error data has been given
            else if (isError) {
                console.error(response);

                Toast.unknown(options.message);
            }
        }

        //If invalid error request has been given. For example on backend crash etc...
        else if (isError) {
            console.error(response);

            Toast.unknown(options.message);
        }
    }

    /**
     * Assign the sections of a response into the stores.
     *
     * options.pinia (or options.scope, a nuxtApp) picks the pinia the added
     * definitions are resolved with; without it the current request or the
     * active pinia is used.
     */
    bindStores(data, options = {}) {
        if (!data) {
            return;
        }

        const stores = this.resolveStores(options);

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
