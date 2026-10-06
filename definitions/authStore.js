/*
 * Options of the `auth` store, in the shape of the PHP helpers AuthResponse:
 *
 * {
 *     driver: 'clients',                       // table of the user model
 *     user: { ... },                           // setAuthResponse() of the model
 *     token: { token, expiration, abilities }, // Sanctum token, login only
 *     device_tokens: [ ... ],                  // notification tokens, optional
 * }
 *
 * The `auth` bootstrap section and the login response both bind into it.
 * Exported as options so a project can extend them, see appStore.js.
 */
export const authStore = {
    state() {
        return {
            token: null,
            driver: null,
            user: null,
            device_tokens: [],
        };
    },

    actions: {
        /**
         * Assign an AuthResponse (or a part of it).
         */
        setAuth(data = {}) {
            for (const key of ['token', 'driver', 'user', 'device_tokens']) {
                if (key in (data || {})) {
                    this[key] = data[key];
                }
            }
        },

        /**
         * Log out on the backend and forget the user. Goes through useAuth()
         * of the Nuxt layer, which also clears the stored token and lets the
         * other layers react.
         */
        async logout(options = {}) {
            if (typeof this.$crud?.logout === 'function') {
                return await this.$crud.logout(options);
            }

            this.flushData();
        },

        /**
         * Forget the user locally, without asking the backend.
         */
        flushData() {
            this.token = null;
            this.driver = null;
            this.user = null;

            // The next user on this device has to register its own device
            // token again.
            this.device_tokens = [];
        },
    },

    getters: {
        loggedIn() {
            return this.user ? true : false;
        },

        /**
         * Plain bearer token, what the Authorization header carries.
         */
        bearer() {
            if (!this.token) {
                return null;
            }

            return typeof this.token === 'string'
                ? this.token
                : this.token.token || null;
        },
    },
};
