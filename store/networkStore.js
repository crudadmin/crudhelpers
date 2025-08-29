export const useNetworkStore = defineStore('network', {
    persist: true,

    state() {
        return {
            connected: false,
            lastUpdateTime: null,
        };
    },

    actions: {
        setConnection(status) {
            this.connected = status;
        },
        setLastUpdate(state) {
            this.lastUpdateTime = Date.now();
        },
        resetLastUpdate(state) {
            this.lastUpdateTime = null;
        },
    },

    getters: {
        /**
         * Displays if first appRequest has been made.
         */
        isBooted() {
            return this.lastUpdateTime ? true : false;
        },
    },
});
