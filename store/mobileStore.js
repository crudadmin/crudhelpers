import { defineStore } from 'pinia';

export const useMobileStore = defineStore('mobile', {
    persist: true,

    state() {
        return {
            keyboard: false,
        };
    },

    actions: {},
    getters: {},
});
