import { defineStore } from 'pinia';
import { useResponse } from '../utils/helpers.js';

export const useOtpStore = defineStore('otp', {
    persist: true,

    state() {
        return {
            otp: null,
            verified: false,
            token: null,
            options: {},
        };
    },

    actions: {
        reset() {
            this.otp = null;
            this.verified = false;
            this.token = null;
            this.options = {};
        },
        proceedToRoute(router, options) {
            let { name, to, from, next, data } = options;
            const route = router.currentRoute.value;

            from = from || {
                name: route.name,
                params: route.params,
            };

            options.from = from;

            this.options = options;

            router.push(
                to || {
                    name: name || 'code',
                    query: {
                        //For development purposes to see token in query
                        token: this.otp.token,
                    },
                }
            );
        },
        onCompleted(router) {
            //Bind data store from callback data
            if (this.options.callback) {
                useResponse().bindStores(this.options.callback);
            }

            //Redirect to the route
            else if (this.options.next) {
                router.push(this.options.next);
            }
        },
    },

    getters: {
        request() {
            if (!this.otp) {
                return {};
            }

            return {
                token: this.token,
                verificator: this.otp.verificator,
                ...(this.options.data || {}),
            };
        },
    },
});
