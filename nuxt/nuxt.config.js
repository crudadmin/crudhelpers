import { createResolver } from '@nuxt/kit';
const { resolve } = createResolver(import.meta.url);

export default {
    modules: [
        [
            '@pinia/nuxt',
            {
                autoImports: ['defineStore', 'acceptHMRUpdate'],
            },
        ],
        resolve('./module.js'),
    ],
    imports: {
        dirs: ['../store'],
    },
};
