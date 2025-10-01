export const __ = function (key) {
    return useNuxtApp().$__(...arguments);
};
