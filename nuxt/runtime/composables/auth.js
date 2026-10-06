import { computed } from 'vue';
import { useNuxtApp } from '#app';
import { useAuthStore } from '#imports';

import { applyAuthResponse, authRequest, authRoute, logout, persistToken } from '../auth.js';
import { useAxios } from '../../../utils/helpers.js';
import { Response } from '../../../utils/Response.js';

/**
 * Client authentication against the auth routes of PHP crudadmin/helpers.
 *
 * const auth = useAuth();
 * await auth.login({ email, password });
 * await auth.logout();
 *
 * Every response which carries an AuthResponse or bootstrap sections
 * hydrates the stores, like a bootstrap does. Errors are thrown, so autoajax
 * forms or useResponse(e) can show them.
 */
export const useAuth = () => {
    const nuxtApp = useNuxtApp();
    const authStore = useAuthStore(nuxtApp.$pinia);

    const post = (route, data, options) => authRequest(nuxtApp, route, data, options);

    return {
        store: authStore,
        user: computed(() => authStore.user),
        loggedIn: computed(() => authStore.loggedIn),

        login: (credentials, options = {}) => post('login', credentials, options),

        register: (data, options = {}) => post('register', data, options),

        /**
         * Ask for the e-mail with the link to set a new password.
         */
        forgotPassword: async (data, options = {}) => {
            const response = await useAxios(nuxtApp).$post(options.path || authRoute('passwordForgot'), data);

            if (options.toast !== false) {
                Response.get(response, { pinia: nuxtApp.$pinia, scope: nuxtApp });
            }

            return response;
        },

        /**
         * Set the password from the link (reset, or the first password of an
         * account created with an order, O45). Logs in when the backend
         * answers with an AuthResponse.
         */
        resetPassword: (data, options = {}) => post('passwordReset', data, options),
        setPassword: (data, options = {}) => post('passwordReset', data, options),

        /**
         * Reload the logged user (GET routes.user).
         */
        fetchUser: async (options = {}) => {
            const response = await useAxios(nuxtApp).$get(options.path || authRoute('user'));

            return await applyAuthResponse(nuxtApp, response, { source: 'user', toast: false });
        },

        /**
         * Hydrate from a response of any other request, eg. an OTP verify.
         */
        handleResponse: (response, options = {}) => applyAuthResponse(nuxtApp, response, options),

        /**
         * Use a token obtained elsewhere (deep link, social login).
         */
        setToken: async (token) => {
            authStore.token = token || null;

            await persistToken(nuxtApp);
        },

        logout: (options = {}) => logout(nuxtApp, options),
    };
};
