import { defineStore } from 'pinia';

export const useLocaleStore = defineStore('locale', {
    persist: true,

    state() {
        return {
            locale: null,
            languages: [],
            translations: null,
        };
    },

    actions: {},
    getters: {},
});
